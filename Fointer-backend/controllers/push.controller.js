import PushDevice, { PUSH_PLATFORMS } from "../models/pushDevice.js";
import {
  ANDROID_CHANNEL_ID,
  getWebPushConfig,
  isPushConfigured,
} from "../utils/push.js";
import { sendServerError } from "../utils/safeError.js";

const cleanToken = (value) => String(value || "").trim();

const cleanDeviceId = (value) => String(value || "").trim().slice(0, 128);

export const getPushConfig = async (_req, res) => {
  const web = getWebPushConfig();
  const enabled = isPushConfigured() && Boolean(web);

  return res.status(200).json({
    success: true,
    enabled,
    platforms: PUSH_PLATFORMS,
    androidChannelId: ANDROID_CHANNEL_ID,
    web: web
      ? {
          apiKey: web.apiKey,
          authDomain: web.authDomain,
          projectId: web.projectId,
          messagingSenderId: web.messagingSenderId,
          appId: web.appId,
          vapidKey: web.vapidKey,
        }
      : null,
  });
};

export const registerPushDevice = async (req, res) => {
  try {
    const token = cleanToken(req.body?.token);
    const platform = String(req.body?.platform || "").trim().toLowerCase();
    const deviceId = cleanDeviceId(req.body?.deviceId);

    if (!token || token.length > 4096) {
      return res.status(400).json({
        success: false,
        message: "A device token is required.",
      });
    }
    if (!PUSH_PLATFORMS.includes(platform)) {
      return res.status(400).json({
        success: false,
        message: "Platform must be web, android, or ios.",
      });
    }

    await PushDevice.findOneAndUpdate(
      { token },
      {
        $set: {
          user: req.user._id,
          token,
          platform,
          deviceId,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    if (deviceId) {
      await PushDevice.deleteMany({
        user: req.user._id,
        platform,
        deviceId,
        token: { $ne: token },
      });
    }

    return res.status(200).json({
      success: true,
      platform,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const unregisterPushDevice = async (req, res) => {
  try {
    const token = cleanToken(req.body?.token);
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "A device token is required.",
      });
    }

    await PushDevice.deleteOne({
      token,
      user: req.user._id,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return sendServerError(res, error);
  }
};
