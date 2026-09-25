import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "fointer/posts",
        resource_type: options.resourceType || "auto",
        ...options.extra,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });

/** Extract Cloudinary public_id from a secure_url / url. */
const publicIdFromUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  try {
    const match = url.match(
      /\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/
    );
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

const guessResourceType = (urlOrPublicId, explicitType) => {
  if (explicitType === "video" || explicitType === "image" || explicitType === "raw") {
    return explicitType;
  }
  const value = String(urlOrPublicId || "");
  if (/\/video\/upload\//i.test(value) || /\.(mp4|webm|mov)(\?|$)/i.test(value)) {
    return "video";
  }
  return "image";
};

const mediaHmacSecret = () =>
  process.env.CLOUDINARY_API_SECRET || process.env.JWT_SECRET || "";

const normalizeMediaType = (type) => (type === "video" ? "video" : "image");

const DIRECT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const UPLOAD_PROOF_TTL_SECONDS = 2 * 60 * 60;

const operationalError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.isOperational = true;
  return error;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cloudinaryHttpCode = (error) =>
  error?.http_code || error?.error?.http_code || null;

const uploadProofPayload = ({ userId, folder, assetId, resourceType, timestamp }) =>
  `${String(userId)}:${folder}:${assetId}:${resourceType}:${timestamp}`;

const signUploadProof = (parts) =>
  crypto
    .createHmac("sha256", mediaHmacSecret())
    .update(uploadProofPayload(parts))
    .digest("hex");

const proofsMatch = (left, right) => {
  try {
    const a = Buffer.from(String(left || ""), "hex");
    const b = Buffer.from(String(right || ""), "hex");
    if (!a.length || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

/** Browser uploads straight to Cloudinary. The API secret never leaves the server. */
export const createDirectUploadSignature = ({ userId, folder, resourceType }) => {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw operationalError(500, "Upload is not configured.");
  }

  const assetId = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder, public_id: assetId, timestamp };
  const signature = cloudinary.utils.api_sign_request(params, apiSecret);
  const proof = signUploadProof({
    userId,
    folder,
    assetId,
    resourceType,
    timestamp,
  });

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    assetId,
    resourceType,
    proof,
  };
};

const readCloudinaryResource = async (publicId, resourceType) => {
  try {
    return await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      type: "upload",
    });
  } catch (error) {
    const code = cloudinaryHttpCode(error);
    if (code === 404 || code === 400) return null;
    throw error;
  }
};

const findDirectUpload = async (folder, assetId, resourceType) => {
  const ids = [`${folder}/${assetId}`, assetId];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    for (const publicId of ids) {
      const info = await readCloudinaryResource(publicId, resourceType);
      if (!info) continue;
      const returned = String(info.public_id || "");
      if (returned !== `${folder}/${assetId}` && returned !== assetId) continue;
      return info;
    }
    if (attempt < 3) await sleep(350);
  }
  return null;
};

/**
 * Confirms the browser upload landed in our Cloudinary account, then returns
 * the media fields the rest of the API already signs.
 */
export const confirmDirectUpload = async ({
  userId,
  folder,
  assetId,
  resourceType,
  timestamp,
  proof,
}) => {
  const ts = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  const fresh =
    Number.isFinite(ts) &&
    Math.floor(ts) === ts &&
    now - ts <= UPLOAD_PROOF_TTL_SECONDS &&
    ts - now <= 5 * 60;
  const proofOk =
    fresh &&
    proofsMatch(
      proof,
      signUploadProof({ userId, folder, assetId, resourceType, timestamp: ts })
    );
  if (!proofOk) {
    throw operationalError(400, "Invalid upload.");
  }

  const info = await findDirectUpload(folder, assetId, resourceType);
  if (!info?.secure_url) {
    throw operationalError(400, "Upload not found.");
  }
  if (info.resource_type !== resourceType) {
    throw operationalError(400, "Invalid upload.");
  }
  if (Number(info.bytes) > DIRECT_UPLOAD_MAX_BYTES) {
    try {
      await cloudinary.uploader.destroy(info.public_id, {
        resource_type: resourceType,
      });
    } catch (error) {
      console.error(error);
    }
    throw operationalError(400, "That file is too large. Use a file under 25 MB.");
  }

  const url = String(info.secure_url);
  if (!isAllowedCloudinaryUrl(url)) {
    throw operationalError(400, "Invalid upload.");
  }

  return {
    url,
    publicId: info.public_id,
    type: resourceType,
  };
};

export const isAllowedCloudinaryUrl = (url) => {
  const cloud = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const raw = String(url || "").trim();
  if (!cloud || !raw) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;
    if (host === "res.cloudinary.com") {
      return path.startsWith(`/${cloud}/`);
    }
    return host === `${cloud}.media.cloudinary.com`;
  } catch {
    return false;
  }
};

export const signMedia = (userId, { url, publicId, type } = {}) => {
  const secret = mediaHmacSecret();
  const payload = `${String(userId)}:${String(publicId || "").trim()}:${String(url || "").trim()}:${normalizeMediaType(type)}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
};

const verifySignedMedia = (userId, item = {}, { expectedType } = {}) => {
  const url = String(item.url || "").trim();
  const publicId = String(item.publicId || "").trim();
  const type = normalizeMediaType(item.type);
  const signature = String(item.signature || "").trim();
  if (!url || !publicId || !signature) return false;
  if (expectedType && type !== expectedType) return false;
  if (!isAllowedCloudinaryUrl(url)) return false;
  const expected = signMedia(userId, { url, publicId, type });
  try {
    const left = Buffer.from(signature, "hex");
    const right = Buffer.from(expected, "hex");
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
};

const asMediaInput = (input) => {
  if (input == null || input === "") return null;
  if (typeof input === "string") {
    const url = input.trim();
    return url ? { url } : null;
  }
  if (typeof input === "object") {
    const url = String(input.url || "").trim();
    if (!url) return null;
    return {
      url,
      publicId: String(input.publicId || "").trim(),
      type: normalizeMediaType(input.type),
      signature: String(input.signature || "").trim(),
    };
  }
  return null;
};

export const acceptSignedImageValue = (userId, input, previousUrl = "") => {
  const item = asMediaInput(input);
  if (!item) return { ok: true, url: "" };
  if (previousUrl && item.url === previousUrl) {
    return { ok: true, url: item.url };
  }
  if (!verifySignedMedia(userId, { ...item, type: "image" }, { expectedType: "image" })) {
    return { ok: false, message: "Invalid image upload." };
  }
  return { ok: true, url: item.url };
};

export const acceptSignedImageList = (userId, inputs = [], previousUrls = []) => {
  const list = Array.isArray(inputs) ? inputs : [];
  const prev = new Set((previousUrls || []).filter(Boolean).map(String));
  const urls = [];
  for (const entry of list) {
    const preview = asMediaInput(entry);
    const previousMatch =
      preview && prev.has(preview.url) ? preview.url : "";
    const accepted = acceptSignedImageValue(userId, entry, previousMatch);
    if (!accepted.ok) return accepted;
    if (accepted.url) urls.push(accepted.url);
  }
  return { ok: true, urls };
};

export const acceptSignedMediaList = (userId, inputs = [], previousItems = []) => {
  const list = Array.isArray(inputs) ? inputs : [];
  const prevByUrl = new Map(
    (previousItems || [])
      .filter((item) => item?.url)
      .map((item) => [String(item.url), item])
  );
  const items = [];
  for (const entry of list) {
    const parsed = asMediaInput(entry);
    if (!parsed) continue;
    const previous = prevByUrl.get(parsed.url);
    if (previous) {
      items.push({
        url: previous.url,
        publicId: previous.publicId || parsed.publicId || "",
        type: normalizeMediaType(previous.type || parsed.type),
      });
      continue;
    }
    if (!verifySignedMedia(userId, parsed)) {
      return { ok: false, message: "Invalid media upload." };
    }
    items.push({
      url: parsed.url,
      publicId: parsed.publicId,
      type: parsed.type,
    });
  }
  return { ok: true, items };
};

const destroyFromCloudinary = async (urlOrPublicId, options = {}) => {
  if (typeof urlOrPublicId === "string" && urlOrPublicId.includes("://")) {
    if (!isAllowedCloudinaryUrl(urlOrPublicId)) return null;
  }

  const publicId =
    urlOrPublicId?.includes?.("://") || urlOrPublicId?.includes?.("/upload/")
      ? publicIdFromUrl(urlOrPublicId)
      : urlOrPublicId;
  if (!publicId) return null;

  const primary = guessResourceType(urlOrPublicId, options.resourceType);
  const fallback = primary === "video" ? "image" : "video";

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: primary,
    });
    if (result?.result === "not found") {
      return cloudinary.uploader.destroy(publicId, {
        resource_type: fallback,
      });
    }
    return result;
  } catch {
    try {
      return await cloudinary.uploader.destroy(publicId, {
        resource_type: fallback,
      });
    } catch {
      return null;
    }
  }
};

export const destroyManyFromCloudinary = async (urls = []) => {
  const list = [...new Set((urls || []).filter(Boolean))];
  await Promise.all(list.map((url) => destroyFromCloudinary(url)));
};

