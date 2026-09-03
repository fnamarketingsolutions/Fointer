import User from "../models/user.js";
import { buildPublicProfilePayload } from "../utils/publicProfilePayload.js";
import { sendServerError } from "../utils/safeError.js";

export const normalizeUsername = (value) =>
  String(value || "")
    .trim()
    .replace(/^@+/, "");

export const getPublicProfile = async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    const user = await User.findOne({
      username,
      status: "active",
    }).select(
      "username name avatar bio interests city state country createdAt status"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const profile = await buildPublicProfilePayload(user, req.user || null);

    return res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
