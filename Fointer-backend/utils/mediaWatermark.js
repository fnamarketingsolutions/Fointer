import { spawn } from "child_process";
import { createRequire } from "module";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import SystemSetting from "../models/systemSetting.js";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");

const logoPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/watermark-logo.png"
);

export const WATERMARK_POSITIONS = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
  "center",
];

const DEFAULT_WATERMARK = {
  enabled: true,
  opacity: 60,
  sizePercent: 26,
  position: "bottom-right",
  marginPercent: 4,
  imageUrl: "",
  skipForOwner: false,
};

let settingsCache = { at: 0, value: null };
let logoCache = { key: "", buffer: null };

export const invalidateWatermarkCache = () => {
  settingsCache = { at: 0, value: null };
  logoCache = { key: "", buffer: null };
};

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
};

const normalizeWatermark = (settings) => {
  const position = WATERMARK_POSITIONS.includes(settings?.watermarkPosition)
    ? settings.watermarkPosition
    : DEFAULT_WATERMARK.position;
  return {
    enabled: settings?.watermarkEnabled !== false,
    opacity: clampNumber(settings?.watermarkOpacity, 40, 80, DEFAULT_WATERMARK.opacity),
    sizePercent: clampNumber(
      settings?.watermarkSizePercent,
      12,
      40,
      DEFAULT_WATERMARK.sizePercent
    ),
    position,
    marginPercent: clampNumber(
      settings?.watermarkMarginPercent,
      2,
      12,
      DEFAULT_WATERMARK.marginPercent
    ),
    imageUrl: String(settings?.watermarkImageUrl || "").trim(),
    skipForOwner: Boolean(settings?.watermarkSkipForOwner),
  };
};

export const getWatermarkConfig = async () => {
  if (settingsCache.value && Date.now() - settingsCache.at < 20_000) {
    return settingsCache.value;
  }
  let settings = null;
  try {
    settings = await SystemSetting.findOne({ key: "global" }).lean();
  } catch (error) {
    console.error("Watermark settings lookup failed", error);
  }
  const value = normalizeWatermark(settings);
  settingsCache = { at: Date.now(), value };
  return value;
};

const loadLogo = async (config) => {
  const key = config.imageUrl || "default";
  if (logoCache.key === key && logoCache.buffer) return logoCache.buffer;
  try {
    const buffer = config.imageUrl
      ? (await fetchFointerMedia(config.imageUrl)).buffer
      : await readFile(logoPath);
    logoCache = { key, buffer };
    return buffer;
  } catch (error) {
    console.error("Watermark logo load failed", error);
    if (key !== "default") {
      const buffer = await readFile(logoPath);
      logoCache = { key: "default", buffer };
      return buffer;
    }
    throw error;
  }
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

const operationalError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.isOperational = true;
  return error;
};

const allowedS3Hosts = () => {
  const hosts = new Set();
  const explicit = String(process.env.S3_PUBLIC_BASE_URL || "").trim();
  if (explicit) {
    try {
      hosts.add(new URL(explicit).hostname.toLowerCase());
    } catch {
      /* ignore a bad public base */
    }
  }
  const bucket = String(process.env.S3_BUCKET || "").trim().toLowerCase();
  const region = String(process.env.AWS_REGION || "").trim().toLowerCase();
  if (bucket && region) {
    hosts.add(`${bucket}.s3.${region}.amazonaws.com`);
    hosts.add(`${bucket}.s3.amazonaws.com`);
  }
  return { hosts, bucket };
};

export const assertFointerMediaUrl = (raw) => {
  let url;
  try {
    url = new URL(String(raw || "").trim());
  } catch {
    throw operationalError(400, "That file address is not valid.");
  }
  if (url.protocol !== "https:") {
    throw operationalError(400, "That file cannot be downloaded from Fointer.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "res.cloudinary.com") {
    if (!/\/(?:image|video)\/upload\//.test(url.pathname)) {
      throw operationalError(400, "That file cannot be downloaded from Fointer.");
    }
    return url;
  }
  const { hosts, bucket } = allowedS3Hosts();
  if (hosts.has(host)) return url;
  if (
    bucket &&
    host.endsWith(".amazonaws.com") &&
    (host.startsWith(`${bucket}.`) ||
      url.pathname.toLowerCase().includes(`/${bucket}/`))
  ) {
    return url;
  }
  throw operationalError(400, "That file cannot be downloaded from Fointer.");
};

const readLimited = async (response, maxBytes) => {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    throw operationalError(413, "This file is too large to watermark.");
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw operationalError(413, "This file is too large to watermark.");
    }
    return buffer;
  }
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw operationalError(413, "This file is too large to watermark.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
};

export const fetchFointerMedia = async (rawUrl) => {
  let current = String(rawUrl || "").trim();
  for (let hop = 0; hop < 3; hop += 1) {
    assertFointerMediaUrl(current);
    const response = await fetch(current, { redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next) throw operationalError(502, "Could not reach that file.");
      current = new URL(next, current).toString();
      continue;
    }
    if (!response.ok) {
      throw operationalError(404, "That file could not be found.");
    }
    const type = String(response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const isVideo = type.startsWith("video/");
    const buffer = await readLimited(
      response,
      isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    );
    return { buffer, type, isVideo };
  }
  throw operationalError(400, "That file cannot be downloaded from Fointer.");
};

const buildBadge = async (logoBuffer, targetWidth, config) => {
  const logoWidth = Math.max(96, Math.round(targetWidth * (config.sizePercent / 100)));
  const logo = await sharp(logoBuffer)
    .rotate()
    .resize({ width: logoWidth })
    .ensureAlpha()
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();
  const width = meta.width || logoWidth;
  const height = meta.height || logoWidth;
  const alpha = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: config.opacity / 100 },
    },
  })
    .png()
    .toBuffer();
  return sharp(logo)
    .composite([{ input: alpha, blend: "dest-in" }])
    .png()
    .toBuffer();
};

const placeBadge = (frameWidth, frameHeight, badgeWidth, badgeHeight, config) => {
  const marginX = Math.round(frameWidth * (config.marginPercent / 100));
  const marginY = Math.round(frameHeight * (config.marginPercent / 100));
  const maxLeft = Math.max(0, frameWidth - badgeWidth);
  const maxTop = Math.max(0, frameHeight - badgeHeight);
  if (config.position === "center") {
    return {
      left: Math.round(maxLeft / 2),
      top: Math.round(maxTop / 2),
    };
  }
  const right = config.position.endsWith("right");
  const bottom = config.position.startsWith("bottom");
  return {
    left: Math.min(maxLeft, Math.max(0, right ? frameWidth - badgeWidth - marginX : marginX)),
    top: Math.min(maxTop, Math.max(0, bottom ? frameHeight - badgeHeight - marginY : marginY)),
  };
};

export const watermarkImage = async (buffer, config) => {
  const resolved = config || (await getWatermarkConfig());
  const base = sharp(buffer, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width || 800;
  const height = meta.height || 800;
  const badge = await buildBadge(await loadLogo(resolved), width, resolved);
  const badgeMeta = await sharp(badge).metadata();
  const { left, top } = placeBadge(
    width,
    height,
    badgeMeta.width || 0,
    badgeMeta.height || 0,
    resolved
  );
  return base
    .composite([{ input: badge, left, top }])
    .jpeg({ quality: 92 })
    .toBuffer();
};

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(operationalError(500, "Video watermark is not available."));
      return;
    }
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(operationalError(504, "Watermarking this video took too long."));
    }, 90_000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else {
        console.error("Watermark ffmpeg failed", stderr.slice(-800));
        reject(operationalError(500, "Could not watermark this video."));
      }
    });
  });

const videoOverlay = (config) => {
  const margin = (config.marginPercent / 100).toFixed(3);
  if (config.position === "center") {
    return "(main_w-overlay_w)/2:(main_h-overlay_h)/2";
  }
  const x = config.position.endsWith("right")
    ? `main_w-overlay_w-main_w*${margin}`
    : `main_w*${margin}`;
  const y = config.position.startsWith("bottom")
    ? `main_h-overlay_h-main_h*${margin}`
    : `main_h*${margin}`;
  return `${x}:${y}`;
};

export const watermarkVideo = async (buffer, config) => {
  const resolved = config || (await getWatermarkConfig());
  const dir = await mkdtemp(path.join(os.tmpdir(), "fointer-wm-"));
  const inputPath = path.join(dir, "input");
  const badgePath = path.join(dir, "badge.png");
  const outputPath = path.join(dir, "output.mp4");
  const size = (resolved.sizePercent / 100).toFixed(3);
  const filter = `[1:v][0:v]scale2ref=w=iw*${size}:h=ow/mdar[wm][base];[base][wm]overlay=${videoOverlay(resolved)}[vout]`;
  const encode = (audioArgs) =>
    runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-i",
      badgePath,
      "-filter_complex",
      filter,
      "-map",
      "[vout]",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      ...audioArgs,
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  try {
    const badge = await buildBadge(await loadLogo(resolved), 1080, resolved);
    await Promise.all([
      writeFile(inputPath, buffer),
      writeFile(badgePath, badge),
    ]);
    try {
      await encode(["-c:a", "copy"]);
    } catch (error) {
      if (error?.status === 504) throw error;
      await encode(["-c:a", "aac", "-b:a", "160k"]);
    }
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
