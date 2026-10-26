import Post from "../models/post.js";
import Listing from "../models/listing.js";
import FreeListing from "../models/freeListing.js";
import DirectMessage from "../models/directMessage.js";
import { sendServerError } from "../utils/safeError.js";
import {
  fetchFointerMedia,
  getWatermarkConfig,
  watermarkImage,
  watermarkVideo,
} from "../utils/mediaWatermark.js";

const sameId = (left, right) => String(left || "") === String(right || "");

const userOwnsMedia = async (userId, url) => {
  const [post, listing, freeListing, message] = await Promise.all([
    Post.findOne({ "media.url": url }).select("author").lean(),
    Listing.findOne({ "media.url": url }).select("seller").lean(),
    FreeListing.findOne({ "media.url": url }).select("seller").lean(),
    DirectMessage.findOne({ "media.url": url }).select("author").lean(),
  ]);
  return (
    sameId(post?.author, userId) ||
    sameId(listing?.seller, userId) ||
    sameId(freeListing?.seller, userId) ||
    sameId(message?.author, userId)
  );
};

const sendDownload = (res, buffer, contentType, filename) => {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  return res.send(buffer);
};

export const downloadWatermarkedMedia = async (req, res) => {
  try {
    const source = await fetchFointerMedia(req.query.url);
    const kind = String(req.query.kind || "").toLowerCase();
    const isVideo = source.type.startsWith("video/")
      ? true
      : source.type.startsWith("image/")
        ? false
        : source.isVideo || kind === "video";
    const config = await getWatermarkConfig();
    const ownerSkip =
      config.skipForOwner &&
      req.user?._id &&
      (await userOwnsMedia(req.user._id, String(req.query.url || "").trim()));
    if (!config.enabled || ownerSkip) {
      const type = source.type || (isVideo ? "video/mp4" : "image/jpeg");
      const extension = isVideo ? "mp4" : type.includes("png") ? "png" : "jpg";
      return sendDownload(res, source.buffer, type, `fointer-media.${extension}`);
    }
    const file = isVideo
      ? await watermarkVideo(source.buffer, config)
      : await watermarkImage(source.buffer, config);
    return sendDownload(
      res,
      file,
      isVideo ? "video/mp4" : "image/jpeg",
      isVideo ? "fointer-video.mp4" : "fointer-image.jpg"
    );
  } catch (error) {
    if (error?.isOperational) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
    return sendServerError(res, error, "Could not prepare that download.");
  }
};
