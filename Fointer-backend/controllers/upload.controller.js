import { uploadToCloudinary } from "../utils/cloudinary.js";
import { sendServerError } from "../utils/safeError.js";

export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    const isVideo = req.file.mimetype.startsWith("video/");
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "fointer/posts",
      resourceType: isVideo ? "video" : "image",
    });

    return res.status(200).json({
      success: true,
      media: {
        url: result.secure_url,
        publicId: result.public_id,
        type: isVideo ? "video" : "image",
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Upload failed.");
  }
};
