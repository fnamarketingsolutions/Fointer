const IMAGE_NAME = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i;
const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;

const isVideoFile = (file) =>
  String(file?.type || "")
    .toLowerCase()
    .startsWith("video/");

const isImageFile = (file) => {
  const type = String(file?.type || "").toLowerCase();
  if (type.startsWith("video/")) return false;
  if (type.startsWith("image/")) return true;
  return IMAGE_NAME.test(file?.name || "");
};

const decodeImage = async (file) => {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Some browsers cannot decode HEIC via createImageBitmap.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this photo."));
    };
    img.src = url;
  });
};

/**
 * Normalize camera photos (HEIC, huge JPEGs, odd MIME types) into a
 * reasonably sized JPEG before upload.
 */
export async function prepareMediaForUpload(file) {
  if (!file || isVideoFile(file) || !isImageFile(file)) return file;

  try {
    const source = await decodeImage(file);
    const width = source.width || source.videoWidth;
    const height = source.height || source.videoHeight;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const nextWidth = Math.max(1, Math.round(width * scale));
    const nextHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(source, 0, 0, nextWidth, nextHeight);
    if (typeof source.close === "function") source.close();

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) return file;

    const base = String(file.name || "photo").replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
