import { assertFointerMediaUrl } from "./mediaWatermark.js";

const HEAD_BYTES = 256 * 1024;
const MOOV_BYTES = 256 * 1024;
const MIN_PLAYER_PIXELS = 68600;
const MAX_PLAYER_EDGE = 1280;
const CACHE_MS = 60 * 60 * 1000;

const cache = new Map();

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl"]);

const readFixed16 = (buf, offset) => buf.readInt32BE(offset) / 65536;

const peekBox = (buf, offset, limit) => {
  if (offset + 8 > limit) return null;
  let size = buf.readUInt32BE(offset);
  let header = 8;
  if (size === 1) {
    if (offset + 16 > limit) return null;
    const large = buf.readBigUInt64BE(offset + 8);
    if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(large);
    header = 16;
  } else if (size === 0) {
    size = limit - offset;
  }
  if (!Number.isFinite(size) || size < header) return null;
  return {
    type: buf.toString("latin1", offset + 4, offset + 8),
    start: offset + header,
    next: offset + size,
  };
};

const walkAvailable = (buf, start, end, visit) => {
  let offset = start;
  while (offset + 8 <= end) {
    const box = peekBox(buf, offset, end);
    if (!box) break;
    const availableEnd = Math.min(box.next, end);
    visit({
      type: box.type,
      start: box.start,
      end: availableEnd,
      complete: box.next <= end,
    });
    if (box.next > end || box.next <= offset) break;
    offset = box.next;
  }
};

const findDescendant = (buf, start, end, type) => {
  let found = null;
  walkAvailable(buf, start, end, (box) => {
    if (found) return;
    if (box.type === type && box.complete) {
      found = box;
      return;
    }
    if (CONTAINERS.has(box.type)) {
      found = findDescendant(buf, box.start, box.end, type);
    }
  });
  return found;
};

const readTkhd = (payload) => {
  if (!payload || payload.length < 84) return null;
  const version = payload[0];
  const matrixAt = version === 1 ? 52 : 40;
  const sizeAt = matrixAt + 36;
  if (payload.length < sizeAt + 8) return null;
  const a = readFixed16(payload, matrixAt);
  const b = readFixed16(payload, matrixAt + 4);
  const c = readFixed16(payload, matrixAt + 12);
  const d = readFixed16(payload, matrixAt + 16);
  let width = readFixed16(payload, sizeAt);
  let height = readFixed16(payload, sizeAt + 4);
  if (Math.abs(b) > Math.abs(a) && Math.abs(c) > Math.abs(d)) {
    [width, height] = [height, width];
  }
  width = Math.round(Math.abs(width));
  height = Math.round(Math.abs(height));
  if (width < 2 || height < 2) return null;
  return { width, height };
};

const handlerType = (payload) => {
  if (!payload || payload.length < 12) return "";
  return payload.toString("latin1", 8, 12);
};

const sizeFromTrak = (buf, trak) => {
  const hdlr = findDescendant(buf, trak.start, trak.end, "hdlr");
  if (hdlr) {
    const kind = handlerType(buf.subarray(hdlr.start, hdlr.end));
    if (kind && kind !== "vide") return null;
  }
  const tkhd = findDescendant(buf, trak.start, trak.end, "tkhd");
  if (!tkhd) return null;
  return readTkhd(buf.subarray(tkhd.start, tkhd.end));
};

/** Display size of the first video track, including a 90/270 rotation matrix. */
export const frameSizeFromMp4 = (buffer) => {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  let size = null;
  const consider = (start, end) => {
    walkAvailable(buf, start, end, (child) => {
      if (size || child.type !== "trak") return;
      size = sizeFromTrak(buf, child) || size;
    });
  };
  let offset = 0;
  while (!size && offset + 8 <= buf.length) {
    const box = peekBox(buf, offset, buf.length);
    if (!box) break;
    if (box.type === "moov") {
      consider(box.start, Math.min(box.next, buf.length));
      break;
    }
    if (box.next > buf.length || box.next <= offset) break;
    offset = box.next;
  }
  return size;
};

/**
 * Where the moov header is, or where the next top-level box starts when
 * the head only contains a large mdat.
 */
export const moovLocation = (buf) => {
  const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const box = peekBox(buffer, offset, buffer.length);
    if (!box) return null;
    if (box.type === "moov") return { offset, size: box.next - offset };
    if (box.next <= offset) return null;
    if (box.next > buffer.length) return { offset: box.next, size: 0 };
    offset = box.next;
  }
  return null;
};

const even = (value) => {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
};

/** Player frame that keeps the video's shape and clears X's image minimum. */
export const playerFrameSize = (width, height) => {
  let frameWidth = Math.round(Number(width));
  let frameHeight = Math.round(Number(height));
  if (
    !Number.isFinite(frameWidth) ||
    !Number.isFinite(frameHeight) ||
    frameWidth < 2 ||
    frameHeight < 2
  ) {
    frameWidth = 720;
    frameHeight = 1280;
  }
  const scale = Math.min(1, MAX_PLAYER_EDGE / Math.max(frameWidth, frameHeight));
  frameWidth = even(frameWidth * scale);
  frameHeight = even(frameHeight * scale);
  if (frameWidth * frameHeight < MIN_PLAYER_PIXELS) {
    const boost = Math.sqrt(MIN_PLAYER_PIXELS / (frameWidth * frameHeight));
    frameWidth = even(frameWidth * boost);
    frameHeight = even(frameHeight * boost);
  }
  return { width: frameWidth, height: frameHeight };
};

const totalFromContentRange = (header) => {
  const match = /\/(\d+)\s*$/.exec(String(header || ""));
  if (!match) return 0;
  const total = Number(match[1]);
  return Number.isFinite(total) ? total : 0;
};

const readBounded = async (response, maxBytes) => {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.subarray(0, maxBytes);
  }
  const chunks = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = maxBytes - received;
    const slice = value.byteLength > room ? value.subarray(0, room) : value;
    chunks.push(Buffer.from(slice));
    received += slice.byteLength;
    if (value.byteLength > room) {
      await reader.cancel();
      break;
    }
  }
  return received ? Buffer.concat(chunks) : null;
};

const fetchRange = async (url, start, end, fetchImpl, signal) => {
  let current = url;
  for (let hop = 0; hop < 3; hop += 1) {
    assertFointerMediaUrl(current);
    const response = await fetchImpl(current, {
      redirect: "manual",
      signal,
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      await response.body?.cancel?.();
      if (!next) return null;
      current = new URL(next, current).toString();
      continue;
    }
    if (response.status !== 200 && response.status !== 206) {
      await response.body?.cancel?.();
      return null;
    }
    const buffer = await readBounded(response, end - start + 1 + 1024);
    if (!buffer) return null;
    return {
      buffer,
      total: totalFromContentRange(response.headers.get("content-range")),
      partial: response.status === 206,
    };
  }
  return null;
};

const sizeFromParts = async (url, fetchImpl, signal) => {
  const head = await fetchRange(url, 0, HEAD_BYTES - 1, fetchImpl, signal);
  if (!head) return null;
  const immediate = frameSizeFromMp4(head.buffer);
  if (immediate) return immediate;

  const location = moovLocation(head.buffer);
  if (location && (location.size === 0 || location.offset + 8 > head.buffer.length)) {
    const length = location.size > 0 ? Math.min(location.size, MOOV_BYTES) : MOOV_BYTES;
    const slice = await fetchRange(
      url,
      location.offset,
      location.offset + length - 1,
      fetchImpl,
      signal
    );
    return slice ? frameSizeFromMp4(slice.buffer) : null;
  }

  if (head.partial && head.total > head.buffer.length) {
    const tailStart = Math.max(0, head.total - HEAD_BYTES);
    const tail = await fetchRange(url, tailStart, head.total - 1, fetchImpl, signal);
    return tail ? frameSizeFromMp4(tail.buffer) : null;
  }
  return null;
};

/** Remote MP4 display size. Failures return null and are not cached. */
export const probeVideoFrameSize = async (rawUrl, fetchImpl = fetch) => {
  let url;
  try {
    url = assertFointerMediaUrl(rawUrl).toString();
  } catch {
    return null;
  }
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return { width: hit.width, height: hit.height };
  }
  const signal = AbortSignal.timeout(2500);
  try {
    const size = await sizeFromParts(url, fetchImpl, signal);
    if (!size) return null;
    cache.set(url, { at: Date.now(), width: size.width, height: size.height });
    return size;
  } catch {
    return null;
  }
};

export const resolvePlayerFrame = async (rawUrl, fetchImpl = fetch) => {
  const size = await probeVideoFrameSize(rawUrl, fetchImpl);
  return playerFrameSize(size?.width, size?.height);
};

export const resetVideoFrameCache = () => {
  cache.clear();
};
