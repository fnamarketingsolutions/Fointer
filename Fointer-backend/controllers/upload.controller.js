import {
  signMedia,
  createDirectUploadSignature,
  confirmDirectUpload,
  resolveContentType,
} from "../utils/s3.js";
import { sendServerError } from "../utils/safeError.js";
import { canAccessAdminTab } from "../utils/adminAccess.js";

const ALLOWED_FOLDERS = new Set([
  "fointer/posts",
  "fointer/communities",
  "fointer/avatars",
  "fointer/banners",
]);

/** Banner media is admin-only (banners tab / super admin). */
const ADMIN_ONLY_FOLDERS = new Set(["fointer/banners"]);

const resolveUploadFolder = (value) => {
  const folder = String(value || "").trim().replace(/\\/g, "/");
  if (ALLOWED_FOLDERS.has(folder)) return folder;
  return "fointer/posts";
};

const assertFolderAccess = (user, folder) => {
  if (!ADMIN_ONLY_FOLDERS.has(folder)) return null;
  if (canAccessAdminTab(user, "banners")) return null;
  return {
    status: 403,
    message: "Only admins with banner access can upload to this folder.",
  };
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

    const resolved = resolveContentType(req.body?.contentType, resourceType);
    if (!resolved) {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type.",
      });
    }

    const folder = resolveUploadFolder(req.body?.folder);
    const denied = assertFolderAccess(req.user, folder);
    if (denied) {
      return res.status(denied.status).json({
        success: false,
        message: denied.message,
      });
    }

    const upload = await createDirectUploadSignature({
      userId: req.user._id,
      folder,
      resourceType,
      contentType: resolved.contentType,
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
    const resolved = resolveContentType(req.body?.contentType, resourceType);

    if (
      !ALLOWED_FOLDERS.has(folder) ||
      !ASSET_ID.test(assetId) ||
      !resourceType ||
      !resolved
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid upload.",
      });
    }

    const denied = assertFolderAccess(req.user, folder);
    if (denied) {
      return res.status(denied.status).json({
        success: false,
        message: denied.message,
      });
    }

    const media = await confirmDirectUpload({
      userId: req.user._id,
      folder,
      assetId,
      resourceType,
      contentType: resolved.contentType,
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
