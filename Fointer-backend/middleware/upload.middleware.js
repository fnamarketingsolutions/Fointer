import multer from "multer";

const storage = multer.memoryStorage();

const isAllowedDeclaredType = (mimetype = "") => {
  const mime = String(mimetype || "").toLowerCase();
  return (
    !mime ||
    mime === "application/octet-stream" ||
    mime.startsWith("image/") ||
    mime.startsWith("video/")
  );
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB — phone camera photos are often 8–20MB
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedDeclaredType(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error("Only images and videos are allowed.");
    err.status = 400;
    cb(err);
  },
});

export const uploadSingle = (field = "file") => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message:
          "That photo is too large. Use a picture under 25 MB, or pick a smaller one.",
      });
    }
    return res.status(err.status || 400).json({
      success: false,
      message: err.message || "Upload failed.",
    });
  });
};
