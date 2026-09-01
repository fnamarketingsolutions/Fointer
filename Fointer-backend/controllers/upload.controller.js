import { uploadToCloudinary, signMedia } from "../utils/cloudinary.js";
import { sniffMediaBuffer } from "../utils/fileSignature.js";
import { sendServerError } from "../utils/safeError.js";

const ALLOWED_FOLDERS = new Set([
  "fointer/posts",
  "fointer/communities",
  "fointer/avatars",
]);

const resolveUploadFolder = (value) => {
  const folder = String(value || "").trim().replace(/\\/g, "/");
  if (ALLOWED_FOLDERS.has(folder)) return folder;
  return "fointer/posts";
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

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: resolveUploadFolder(req.body?.folder),
      resourceType: sniffed.kind === "video" ? "video" : "image",
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
