import Warning from "../models/warning.js";
import { sendServerError, safeErrorMessage } from "../utils/safeError.js";
import {
  parsePagination,
  buildPaginationMeta,
} from "../utils/pagination.js";
import { escapeRegex } from "../utils/validate.js";
import {
  formatWarning,
  getWarningPolicy,
  issueUserWarning,
} from "../utils/userWarnings.js";

export const listWarnings = async (req, res) => {
  try {
    const { q, userId } = req.query;
    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const pageNum = enabled ? page : 1;
    const pageLimit = enabled ? limit : 25;
    const pageSkip = enabled ? skip : 0;

    const filter = {};
    if (userId) {
      filter.user = userId;
    }

    if (q && String(q).trim()) {
      const term = escapeRegex(String(q).trim());
      const User = (await import("../models/user.js")).default;
      const users = await User.find({
        $or: [
          { name: { $regex: term, $options: "i" } },
          { username: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } },
        ],
      })
        .select("_id")
        .limit(50)
        .lean();
      filter.$or = [
        { message: { $regex: term, $options: "i" } },
        { user: { $in: users.map((u) => u._id) } },
      ];
    }

    const [rows, total, policy] = await Promise.all([
      Warning.find(filter)
        .sort({ createdAt: -1 })
        .skip(pageSkip)
        .limit(pageLimit)
        .populate("user", "username name email avatar status warningCount")
        .populate("issuedBy", "username name avatar")
        .lean(),
      Warning.countDocuments(filter),
      getWarningPolicy(),
    ]);

    return res.status(200).json({
      success: true,
      warnings: rows.map(formatWarning),
      policy,
      pagination: buildPaginationMeta({
        page: pageNum,
        limit: pageLimit,
        total,
      }),
    });
  } catch (error) {
    return sendServerError(res, error, "Could not load warnings.");
  }
};

/** Warning policy for tabs that can warn (no full settings access required). */
export const getWarningPolicySettings = async (_req, res) => {
  try {
    const policy = await getWarningPolicy();
    return res.status(200).json({ success: true, policy });
  } catch (error) {
    return sendServerError(res, error, "Could not load warning policy.");
  }
};

export const createWarning = async (req, res) => {
  try {
    const { userId, message } = req.body || {};
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required.",
      });
    }

    const result = await issueUserWarning({
      userId,
      actor: req.user,
      message,
      source: "admin_panel",
      io: req.app.get("io"),
    });

    return res.status(201).json({
      success: true,
      message: result.banned
        ? "Warning issued. Account was auto-banned after reaching the limit."
        : "Warning issued.",
      warning: formatWarning(
        await Warning.findById(result.warning._id)
          .populate("user", "username name email avatar status warningCount")
          .populate("issuedBy", "username name avatar")
          .lean()
      ),
      warningCount: result.warningCount,
      maxWarningsBeforeBan: result.maxWarningsBeforeBan,
      autoBanOnMaxWarnings: result.autoBanOnMaxWarnings,
      banned: result.banned,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({
        success: false,
        message: safeErrorMessage(
          error,
          error.message || "Could not issue warning."
        ),
      });
    }
    return sendServerError(res, error, "Could not issue warning.");
  }
};
