import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fitPosterToFrame } from "./mediaWatermark.js";
import {
  frameSizeFromMp4,
  moovLocation,
  playerFrameSize,
  probeVideoFrameSize,
  resetVideoFrameCache,
} from "./videoFrameSize.js";

const u32 = (value) => {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value >>> 0, 0);
  return buf;
};

const u16 = (value) => {
  const buf = Buffer.alloc(2);
  buf.writeUInt16BE(value, 0);
  return buf;
};

const i32 = (value) => {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(value, 0);
  return buf;
};

const box = (type, payload) =>
  Buffer.concat([u32(8 + payload.length), Buffer.from(type, "ascii"), payload]);

const tkhd = ({ width, height, rotate90 = false }) => {
  const matrix = rotate90
    ? [0, 0x00010000, 0, -0x00010000, 0, 0, 0, 0, 0x40000000]
    : [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];
  return box(
    "tkhd",
    Buffer.concat([
      u32(0),
      u32(0),
      u32(0),
      u32(1),
      u32(0),
      u32(1000),
      u32(0),
      u32(0),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      ...matrix.map((value) => i32(value)),
      i32(width * 0x10000),
      i32(height * 0x10000),
    ])
  );
};

const hdlr = (kind) => {
  const payload = Buffer.alloc(12);
  payload.write(kind, 8, "ascii");
  return box("hdlr", payload);
};

const videoFile = ({ width, height, rotate90 = false, audioFirst = false }) => {
  const video = box("trak", Buffer.concat([tkhd({ width, height, rotate90 }), box("mdia", hdlr("vide"))]));
  const audio = box("trak", Buffer.concat([tkhd({ width: 0, height: 0 }), box("mdia", hdlr("soun"))]));
  const tracks = audioFirst ? [audio, video] : [video];
  return Buffer.concat([
    box("ftyp", Buffer.from("isom")),
    box("moov", Buffer.concat(tracks)),
  ]);
};

const rangeResponse = (buffer, start, end, total) => ({
  status: 206,
  headers: {
    get(name) {
      const key = String(name).toLowerCase();
      if (key === "content-range") return `bytes ${start}-${end}/${total}`;
      if (key === "content-length") return String(buffer.length);
      return null;
    },
  },
  body: {
    getReader() {
      let sent = false;
      return {
        async read() {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: buffer };
        },
        async cancel() {},
      };
    },
  },
});

test("portrait phone video keeps its tall display size", () => {
  const size = frameSizeFromMp4(videoFile({ width: 1920, height: 1080, rotate90: true }));
  assert.deepEqual(size, { width: 1080, height: 1920 });
  assert.deepEqual(playerFrameSize(size.width, size.height), { width: 720, height: 1280 });
});

test("landscape video is not rotated", () => {
  const size = frameSizeFromMp4(
    videoFile({ width: 1920, height: 1080, audioFirst: true })
  );
  assert.deepEqual(size, { width: 1920, height: 1080 });
  assert.deepEqual(playerFrameSize(size.width, size.height), { width: 1280, height: 720 });
});

test("a tiny frame is raised above X's player image minimum", () => {
  const frame = playerFrameSize(100, 100);
  assert.ok(frame.width * frame.height >= 68600);
  assert.equal(frame.width, frame.height);
});

test("moov that sits after mdat is still located", () => {
  const ftyp = box("ftyp", Buffer.from("isom"));
  const head = Buffer.concat([ftyp, u32(1_000_000), Buffer.from("mdat", "ascii")]);
  assert.deepEqual(moovLocation(head), { offset: ftyp.length + 1_000_000, size: 0 });
});

test("probe reads a moov that is not in the first bytes", async () => {
  resetVideoFrameCache();
  const file = videoFile({ width: 1080, height: 1920 });
  const ftyp = box("ftyp", Buffer.from("isom"));
  const mdatSize = file.length + 500_000;
  const head = Buffer.concat([ftyp, u32(mdatSize), Buffer.from("mdat", "ascii")]);
  const moovAt = ftyp.length + mdatSize;
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    calls += 1;
    const match = /bytes=(\d+)-(\d+)/.exec(options.headers.Range);
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start === 0) return rangeResponse(head, start, end, moovAt + file.length);
    assert.equal(start, moovAt);
    return rangeResponse(file, start, end, moovAt + file.length);
  };
  const size = await probeVideoFrameSize(
    "https://res.cloudinary.com/demo/video/upload/v1/clip.mp4",
    fetchImpl
  );
  assert.deepEqual(size, { width: 1080, height: 1920 });
  assert.equal(calls, 2);
  const again = await probeVideoFrameSize(
    "https://res.cloudinary.com/demo/video/upload/v1/clip.mp4",
    fetchImpl
  );
  assert.deepEqual(again, size);
  assert.equal(calls, 2);
});

test("poster keeps the whole frame inside the player shape", async () => {
  const jpeg = await sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();
  const fitted = await fitPosterToFrame(jpeg, 400, 200);
  const meta = await sharp(fitted).metadata();
  assert.equal(meta.width, 400);
  assert.equal(meta.height, 200);
  const { data, info } = await sharp(fitted).raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[0], 0);
  const center = (info.width * Math.floor(info.height / 2) + Math.floor(info.width / 2)) * info.channels;
  assert.ok(data[center] > 200);
});
