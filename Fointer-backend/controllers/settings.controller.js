import SystemSetting from "../models/systemSetting.js";
import {
  getEditWindowMinutes,
  invalidateEditWindowCache,
} from "../utils/communityPermissions.js";
import { sendServerError } from "../utils/safeError.js";

const getOrCreateGlobalSettings = async () => {
  let settings = await SystemSetting.findOne({ key: "global" });
  if (!settings) {
    const minutes = Number(process.env.POST_EDIT_WINDOW_MINUTES) || 10;
    settings = await SystemSetting.create({
      key: "global",
      postEditWindowMinutes: minutes,
    });
  }
  return settings;
};

export const getSystemSettings = async (req, res) => {
  try {
    const settings = await getOrCreateGlobalSettings();
    const postEditWindowMinutes = await getEditWindowMinutes();

    return res.status(200).json({
      success: true,
      settings: {
        postEditWindowMinutes:
          settings.postEditWindowMinutes ?? postEditWindowMinutes,
      },
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const updateSystemSettings = async (req, res) => {
  try {
    const raw = req.body?.postEditWindowMinutes;
    const minutes = Number(raw);

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 10080) {
      return res.status(400).json({
        success: false,
        message: "postEditWindowMinutes must be between 1 and 10080.",
      });
    }

    const settings = await getOrCreateGlobalSettings();
    settings.postEditWindowMinutes = Math.floor(minutes);
    await settings.save();
    invalidateEditWindowCache();

    return res.status(200).json({
      success: true,
      message: "Settings updated.",
      settings: {
        postEditWindowMinutes: settings.postEditWindowMinutes,
      },
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
