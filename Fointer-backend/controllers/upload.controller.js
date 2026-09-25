import {
  uploadToCloudinary,
  signMedia,
  createDirectUploadSignature,
  confirmDirectUpload,
} from "../utils/cloudinary.js";
import { sniffMediaBuffer } from "../utils/fileSignature.js";
import { sendServerError } from "../utils/safeError.js";

const ALLOWED_FOLDERS = new Set([
  "fointer/posts",
  "fointer/communities",
  "fointer/avatars",
  "fointer/banners",
]);

const resolveUploadFolder = (value) => {
  const folder = String(value || "").trim().replace(/\\/g, "/");
  if (ALLOWED_FOLDERS.has(folder)) return folder;
  return "fointer/posts";
};

const ASSET_ID = /^[a-f0-9]{32}$/;

const sendUploadError = (res, error, fallback) => {
  if (error?.isOperational && error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }
  return sendServerError(res, error, fallback);
};

const mediaKind = (value) => {
  const kind = String(value || "");
  if (kind === "image" || kind === "video") return kind;
  return "";
};

export const signDirectUpload = async (req, res) => {
  try {
    const resourceType = mediaKind(req.body?.resourceType);
    if (!resourceType) {
      return res.status(400).json({
        success: false,
        message: "Only images and videos are allowed.",
      });
    }

    const upload = createDirectUploadSignature({
      userId: req.user._id,
      folder: resolveUploadFolder(req.body?.folder),
      resourceType,
    });

    return res.status(200).json({ success: true, upload });
  } catch (error) {
    return sendUploadError(res, error, "Could not start upload.");
  }
};

export const completeDirectUpload = async (req, res) => {
  try {
    const folder = String(req.body?.folder || "").trim().replace(/\\/g, "/");
    const assetId = String(req.body?.assetId || "").trim();
    const resourceType = mediaKind(req.body?.resourceType);
    if (!ALLOWED_FOLDERS.has(folder) || !ASSET_ID.test(assetId) || !resourceType) {
      return res.status(400).json({
        success: false,
        message: "Invalid upload.",
      });
    }

    const media = await confirmDirectUpload({
      userId: req.user._id,
      folder,
      assetId,
      resourceType,
      timestamp: req.body?.timestamp,
      proof: req.body?.proof,
    });
    media.signature = signMedia(req.user._id, media);

    return res.status(200).json({
      success: true,
      media,
    });
  } catch (error) {
    return sendUploadError(res, error, "Upload failed.");
  }
};

export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    const sniffed = sniffMediaBuffer(req.file.buffer);
    if (!sniffed) {
      return res.status(400).json({
        success: false,
        message: "Only images and videos are allowed.",
      });
    }

    const isHeic =
      sniffed.mime === "image/heic" || sniffed.mime === "image/heif";
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: resolveUploadFolder(req.body?.folder),
      resourceType: sniffed.kind === "video" ? "video" : "image",
      extra: isHeic ? { format: "jpg" } : undefined,
    });

    const media = {
      url: result.secure_url,
      publicId: result.public_id,
      type: sniffed.kind === "video" ? "video" : "image",
    };
    media.signature = signMedia(req.user._id, media);

    return res.status(200).json({
      success: true,
      media,
    });
  } catch (error) {
    return sendServerError(res, error, "Upload failed.");
  }
};
