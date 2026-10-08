import crypto from "crypto";
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DIRECT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const UPLOAD_PROOF_TTL_SECONDS = 2 * 60 * 60;
const PRESIGN_EXPIRES_SECONDS = 15 * 60;

const ALLOWED_CONTENT_TYPES = {
  "image/jpeg": { ext: "jpg", resourceType: "image" },
  "image/png": { ext: "png", resourceType: "image" },
  "image/webp": { ext: "webp", resourceType: "image" },
  "image/gif": { ext: "gif", resourceType: "image" },
  "video/mp4": { ext: "mp4", resourceType: "video" },
  "video/webm": { ext: "webm", resourceType: "video" },
  "video/quicktime": { ext: "mov", resourceType: "video" },
};

const normalizeIncomingContentType = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .split(";")[0];
  if (raw === "image/jpg") return "image/jpeg";
  return raw;
};

const operationalError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.isOperational = true;
  return error;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mediaHmacSecret = () =>
  process.env.MEDIA_HMAC_SECRET ||
  process.env.JWT_SECRET ||
  "";

const normalizeMediaType = (type) => (type === "video" ? "video" : "image");

const awsRegion = () => String(process.env.AWS_REGION || "").trim();
const s3Bucket = () => String(process.env.S3_BUCKET || "").trim();

const s3PublicBaseUrl = () => {
  const explicit = String(process.env.S3_PUBLIC_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (explicit) return explicit;
  const bucket = s3Bucket();
  const region = awsRegion();
  if (!bucket || !region) return "";
  return `https://${bucket}.s3.${region}.amazonaws.com`;
};

let s3Client = null;

const getS3 = () => {
  if (s3Client) return s3Client;
  const region = awsRegion();
  const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.AWS_SECRET_ACCESS_KEY || "").trim();
  if (!region || !s3Bucket() || !accessKeyId || !secretAccessKey) {
    throw operationalError(500, "Upload is not configured.");
  }
  // WHEN_REQUIRED avoids CRC32 query params on browser presigned PUTs
  // (those make S3 reject the upload; browsers then report a misleading CORS error).
  s3Client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return s3Client;
};

export const resolveContentType = (value, resourceType) => {
  const contentType = normalizeIncomingContentType(value);
  const meta = ALLOWED_CONTENT_TYPES[contentType];
  if (!meta) return null;
  if (resourceType && meta.resourceType !== resourceType) return null;
  return { contentType, ...meta };
};

/** Extract S3 object key from a public URL. */
export const keyFromUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    if (!path) return null;
    // Virtual-hosted / CloudFront: path is the key
    if (path.startsWith("fointer/")) return path;
    return path || null;
  } catch {
    return null;
  }
};

const uploadProofPayload = ({
  userId,
  folder,
  assetId,
  resourceType,
  contentType,
  timestamp,
}) =>
  `${String(userId)}:${folder}:${assetId}:${resourceType}:${contentType}:${timestamp}`;

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

const publicUrlForKey = (key) => {
  const base = s3PublicBaseUrl();
  if (!base) throw operationalError(500, "Upload is not configured.");
  return `${base}/${key}`;
};

/** Browser uploads straight to S3 via a short-lived presigned PUT URL. */
export const createDirectUploadSignature = async ({
  userId,
  folder,
  resourceType,
  contentType: rawContentType,
}) => {
  getS3();
  const resolved = resolveContentType(rawContentType, resourceType);
  if (!resolved) {
    throw operationalError(400, "Unsupported file type.");
  }

  const assetId = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.round(Date.now() / 1000);
  const assetKey = `${folder}/${assetId}.${resolved.ext}`;
  const contentType = resolved.contentType;

  const command = new PutObjectCommand({
    Bucket: s3Bucket(),
    Key: assetKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getS3(), command, {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
    signableHeaders: new Set(["content-type"]),
  });

  const proof = signUploadProof({
    userId,
    folder,
    assetId,
    resourceType,
    contentType,
    timestamp,
  });

  return {
    uploadUrl,
    assetKey,
    assetId,
    folder,
    resourceType,
    contentType,
    timestamp,
    proof,
    publicUrl: publicUrlForKey(assetKey),
  };
};

const headObject = async (key) => {
  try {
    return await getS3().send(
      new HeadObjectCommand({
        Bucket: s3Bucket(),
        Key: key,
      })
    );
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode || error?.name;
    if (
      status === 404 ||
      status === 403 ||
      error?.name === "NotFound" ||
      error?.name === "NoSuchKey"
    ) {
      return null;
    }
    throw error;
  }
};

const findDirectUpload = async (assetKey) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const info = await headObject(assetKey);
    if (info) return info;
    if (attempt < 3) await sleep(350);
  }
  return null;
};

/**
 * Confirms the browser upload landed in our S3 bucket, then returns
 * the media fields the rest of the API already signs.
 */
export const confirmDirectUpload = async ({
  userId,
  folder,
  assetId,
  resourceType,
  contentType: rawContentType,
  timestamp,
  proof,
}) => {
  const resolved = resolveContentType(rawContentType, resourceType);
  if (!resolved) {
    throw operationalError(400, "Invalid upload.");
  }

  const contentType = resolved.contentType;
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
      signUploadProof({
        userId,
        folder,
        assetId,
        resourceType,
        contentType,
        timestamp: ts,
      })
    );
  if (!proofOk) {
    throw operationalError(400, "Invalid upload.");
  }

  const assetKey = `${folder}/${assetId}.${resolved.ext}`;
  const info = await findDirectUpload(assetKey);
  if (!info) {
    throw operationalError(400, "Upload not found.");
  }

  const size = Number(info.ContentLength || 0);
  if (size > DIRECT_UPLOAD_MAX_BYTES) {
    try {
      await getS3().send(
        new DeleteObjectCommand({ Bucket: s3Bucket(), Key: assetKey })
      );
    } catch (error) {
      console.error(error);
    }
    throw operationalError(400, "That file is too large. Use a file under 25 MB.");
  }

  const returnedType = String(info.ContentType || "")
    .trim()
    .toLowerCase()
    .split(";")[0];
  if (returnedType && returnedType !== contentType) {
    // Some browsers omit / alter Content-Type on PUT; allow empty mismatch only when missing
    if (returnedType) {
      throw operationalError(400, "Invalid upload.");
    }
  }

  const url = publicUrlForKey(assetKey);
  if (!isAllowedMediaUrl(url)) {
    throw operationalError(400, "Invalid upload.");
  }

  return {
    url,
    publicId: assetKey,
    type: resourceType,
  };
};

export const isAllowedMediaUrl = (url) => {
  const base = s3PublicBaseUrl();
  const raw = String(url || "").trim();
  if (!base || !raw) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const allowed = new URL(base);
    if (parsed.hostname.toLowerCase() !== allowed.hostname.toLowerCase()) {
      return false;
    }
    const path = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    return path.startsWith("fointer/");
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
  if (!isAllowedMediaUrl(url)) return false;
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

const destroyFromS3 = async (urlOrKey) => {
  if (!urlOrKey || typeof urlOrKey !== "string") return null;

  let key = urlOrKey;
  if (urlOrKey.includes("://")) {
    if (!isAllowedMediaUrl(urlOrKey)) return null;
    key = keyFromUrl(urlOrKey);
  }
  if (!key || !key.startsWith("fointer/")) return null;

  try {
    return await getS3().send(
      new DeleteObjectCommand({
        Bucket: s3Bucket(),
        Key: key,
      })
    );
  } catch {
    return null;
  }
};

export const destroyManyFromS3 = async (urls = []) => {
  const list = [...new Set((urls || []).filter(Boolean))];
  await Promise.all(list.map((url) => destroyFromS3(url)));
};
