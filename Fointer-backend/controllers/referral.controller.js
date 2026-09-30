import {
  getReferralDashboard,
  ensureUserReferralCode,
  buildInviteLink,
} from "../services/referral.service.js";
import { sendServerError } from "../utils/safeError.js";

export const getMyReferrals = async (req, res) => {
  try {
    const limit = req.query.limit;
    const cursor = req.query.cursor;
    const dashboard = await getReferralDashboard(req.user._id, {
      limit,
      cursor,
    });
    return res.status(200).json({
      success: true,
      ...dashboard,
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to load referrals.");
  }
};

/** Lightweight code + link for share sheets. */
export const getMyInviteLink = async (req, res) => {
  try {
    const code = await ensureUserReferralCode(req.user._id);
    return res.status(200).json({
      success: true,
      code,
      inviteLink: buildInviteLink(code),
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to load invite link.");
  }
};
