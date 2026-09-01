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
export const publicIdFromUrl = (url) => {
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

export const verifySignedMedia = (userId, item = {}, { expectedType } = {}) => {
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

export const destroyFromCloudinary = async (urlOrPublicId, options = {}) => {
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

