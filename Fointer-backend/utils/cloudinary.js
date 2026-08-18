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

export const destroyFromCloudinary = async (urlOrPublicId, options = {}) => {
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

export default cloudinary;
