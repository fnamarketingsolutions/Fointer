import mongoose from "mongoose";
import Banner from "../models/banner.js";
import { sendServerError } from "../utils/safeError.js";
import { destroyManyFromCloudinary } from "../utils/cloudinary.js";

const sanitizeCtaUrl = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value.slice(0, 500);
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString().slice(0, 500);
    }
  } catch {
    return "";
  }
  return "";
};

const parseOptionalDate = (value) => {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};

const formatBanner = (banner, { publicView = false } = {}) => {
  const payload = {
    id: banner._id,
    imageUrl: banner.imageUrl || "",
    title: banner.title || "",
    subtitle: banner.subtitle || "",
    ctaLabel: banner.ctaLabel || "",
    ctaUrl: banner.ctaUrl || "",
    displayOrder: banner.displayOrder ?? 0,
  };

  if (!publicView) {
    payload.imagePublicId = banner.imagePublicId || "";
    payload.isActive = Boolean(banner.isActive);
    payload.startsAt = banner.startsAt || null;
    payload.endsAt = banner.endsAt || null;
    payload.createdAt = banner.createdAt;
    payload.updatedAt = banner.updatedAt;
  }

  return payload;
};

const readBannerFields = (body = {}) => {
  const startsAt = parseOptionalDate(body.startsAt);
  const endsAt = parseOptionalDate(body.endsAt);
  if (startsAt === undefined || endsAt === undefined) {
    return { error: "Invalid start or end date." };
  }

  const displayOrderRaw = body.displayOrder;
  let displayOrder = 0;
  if (displayOrderRaw != null && displayOrderRaw !== "") {
    displayOrder = Number(displayOrderRaw);
    if (!Number.isFinite(displayOrder)) {
      return { error: "Display order must be a number." };
    }
    displayOrder = Math.max(-9999, Math.min(9999, Math.floor(displayOrder)));
  }

  return {
    fields: {
      imageUrl: String(body.imageUrl || "").trim().slice(0, 800),
      imagePublicId: String(body.imagePublicId || "").trim().slice(0, 300),
      title: String(body.title || "").trim().slice(0, 120),
      subtitle: String(body.subtitle || "").trim().slice(0, 240),
      ctaLabel: String(body.ctaLabel || "").trim().slice(0, 40),
      ctaUrl: sanitizeCtaUrl(body.ctaUrl),
      isActive: body.isActive == null ? true : Boolean(body.isActive),
      displayOrder,
      startsAt,
      endsAt,
    },
  };
};

const endOfUtcDay = (value) => {
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return null;
  return new Date(
    Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
};

const isCurrentlyVisible = (banner, now) => {
  if (!banner.isActive) return false;
  if (banner.startsAt && new Date(banner.startsAt) > now) return false;
  if (banner.endsAt) {
    const until = endOfUtcDay(banner.endsAt);
    if (until && until < now) return false;
  }
  return true;
};

const FEED_BANNER_LIMIT = 3;

export const listActiveBanners = async (_req, res) => {
  try {
    const now = new Date();
    const banners = await Banner.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      banners: banners
        .filter((banner) => isCurrentlyVisible(banner, now))
        .slice(0, FEED_BANNER_LIMIT)
        .map((banner) => formatBanner(banner, { publicView: true })),
    });
  } catch (error) {
    return sendServerError(res, error, "Could not load banners.");
  }
};

export const listAdminBanners = async (_req, res) => {
  try {
    const banners = await Banner.find()
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return res.status(200).json({
      success: true,
      banners: banners.map((banner) => formatBanner(banner)),
    });
  } catch (error) {
    return sendServerError(res, error, "Could not load banners.");
  }
};

export const createAdminBanner = async (req, res) => {
  try {
    const parsed = readBannerFields(req.body);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }
    if (!parsed.fields.imageUrl && !parsed.fields.title) {
      return res.status(400).json({
        success: false,
        message: "Add a banner image or a title.",
      });
    }

    const banner = await Banner.create(parsed.fields);
    return res.status(201).json({
      success: true,
      message: "Banner created.",
      banner: formatBanner(banner),
    });
  } catch (error) {
    return sendServerError(res, error, "Could not create banner.");
  }
};

export const updateAdminBanner = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner id.",
      });
    }

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found.",
      });
    }

    const parsed = readBannerFields({
      imageUrl: req.body?.imageUrl ?? banner.imageUrl,
      imagePublicId: req.body?.imagePublicId ?? banner.imagePublicId,
      title: req.body?.title ?? banner.title,
      subtitle: req.body?.subtitle ?? banner.subtitle,
      ctaLabel: req.body?.ctaLabel ?? banner.ctaLabel,
      ctaUrl: req.body?.ctaUrl ?? banner.ctaUrl,
      isActive: req.body?.isActive ?? banner.isActive,
      displayOrder: req.body?.displayOrder ?? banner.displayOrder,
      startsAt:
        req.body?.startsAt === undefined ? banner.startsAt : req.body.startsAt,
      endsAt: req.body?.endsAt === undefined ? banner.endsAt : req.body.endsAt,
    });
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }
    if (!parsed.fields.imageUrl && !parsed.fields.title) {
      return res.status(400).json({
        success: false,
        message: "Add a banner image or a title.",
      });
    }

    const previousUrl = banner.imageUrl;
    Object.assign(banner, parsed.fields);
    await banner.save();

    if (previousUrl && previousUrl !== banner.imageUrl) {
      await destroyManyFromCloudinary([previousUrl]);
    }

    return res.status(200).json({
      success: true,
      message: "Banner updated.",
      banner: formatBanner(banner),
    });
  } catch (error) {
    return sendServerError(res, error, "Could not update banner.");
  }
};

export const deleteAdminBanner = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid banner id.",
      });
    }

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found.",
      });
    }

    if (banner.imageUrl) {
      await destroyManyFromCloudinary([banner.imageUrl]);
    }
    await banner.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Banner deleted.",
    });
  } catch (error) {
    return sendServerError(res, error, "Could not delete banner.");
  }
};
