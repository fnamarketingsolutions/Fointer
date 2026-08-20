import SystemSetting from "../models/systemSetting.js";
import {
  getEditWindowMinutes,
  invalidateEditWindowCache,
} from "../utils/communityPermissions.js";
import { sendServerError } from "../utils/safeError.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s().-]{6,30}$/;

const formatContact = (settings) => ({
  contactEmail: String(settings?.contactEmail || "").trim(),
  contactPhone: String(settings?.contactPhone || "").trim(),
});

const formatAdminSettings = (settings, postEditWindowMinutes) => ({
  postEditWindowMinutes:
    settings.postEditWindowMinutes ?? postEditWindowMinutes,
  ...formatContact(settings),
});

const getOrCreateGlobalSettings = async () => {
  let settings = await SystemSetting.findOne({ key: "global" });
  if (!settings) {
    const minutes = Number(process.env.POST_EDIT_WINDOW_MINUTES) || 10;
    settings = await SystemSetting.create({
      key: "global",
      postEditWindowMinutes: minutes,
      contactEmail: "",
      contactPhone: "",
    });
  }
  return settings;
};

export const getPublicSiteContact = async (_req, res) => {
  try {
    const settings = await getOrCreateGlobalSettings();
    return res.status(200).json({
      success: true,
      contact: formatContact(settings),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const getSystemSettings = async (req, res) => {
  try {
    const settings = await getOrCreateGlobalSettings();
    const postEditWindowMinutes = await getEditWindowMinutes();

    return res.status(200).json({
      success: true,
      settings: formatAdminSettings(settings, postEditWindowMinutes),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const updateSystemSettings = async (req, res) => {
  try {
    const body = req.body || {};
    const hasMinutes = Object.prototype.hasOwnProperty.call(
      body,
      "postEditWindowMinutes"
    );
    const hasEmail = Object.prototype.hasOwnProperty.call(body, "contactEmail");
    const hasPhone = Object.prototype.hasOwnProperty.call(body, "contactPhone");

    if (!hasMinutes && !hasEmail && !hasPhone) {
      return res.status(400).json({
        success: false,
        message: "No settings provided.",
      });
    }

    const settings = await getOrCreateGlobalSettings();

    if (hasMinutes) {
      const minutes = Number(body.postEditWindowMinutes);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 10080) {
        return res.status(400).json({
          success: false,
          message: "postEditWindowMinutes must be between 1 and 10080.",
        });
      }
      settings.postEditWindowMinutes = Math.floor(minutes);
    }

    if (hasEmail) {
      const email = String(body.contactEmail || "").trim();
      if (email && !EMAIL_RE.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid contact email, or leave it blank.",
        });
      }
      settings.contactEmail = email;
    }

    if (hasPhone) {
      const phone = String(body.contactPhone || "").trim();
      if (phone && !PHONE_RE.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid contact phone, or leave it blank.",
        });
      }
      settings.contactPhone = phone;
    }

    await settings.save();
    if (hasMinutes) invalidateEditWindowCache();

    const postEditWindowMinutes = await getEditWindowMinutes();
    return res.status(200).json({
      success: true,
      message: "Settings updated.",
      settings: formatAdminSettings(settings, postEditWindowMinutes),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
