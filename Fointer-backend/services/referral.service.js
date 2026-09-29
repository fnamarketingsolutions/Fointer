import Referral from "../models/referral.js";
import User from "../models/user.js";
import { getPublicFrontendUrl } from "../utils/publicAppUrls.js";
import {
  generateReferralCodeCandidate,
  normalizeReferralCode,
} from "../utils/referralCode.js";
import { notify, personName, snapshotEntity } from "../utils/notify.js";

const CODE_MAX_ATTEMPTS = 12;
const LIST_DEFAULT_LIMIT = 20;
const LIST_MAX_LIMIT = 50;

/**
 * Ensure user has a unique referralCode. Safe under concurrent calls
 * (unique index + retry on duplicate key).
 */
export const ensureUserReferralCode = async (userOrId) => {
  const user =
    userOrId && typeof userOrId === "object" && userOrId._id
      ? userOrId
      : await User.findById(userOrId).select("referralCode username");

  if (!user) return null;
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < CODE_MAX_ATTEMPTS; attempt += 1) {
    const code = generateReferralCodeCandidate();
    try {
      const updated = await User.findOneAndUpdate(
        { _id: user._id, $or: [{ referralCode: null }, { referralCode: "" }, { referralCode: { $exists: false } }] },
        { $set: { referralCode: code } },
        { returnDocument: "after" }
      ).select("referralCode");
      if (updated?.referralCode) return updated.referralCode;

      const fresh = await User.findById(user._id).select("referralCode");
      if (fresh?.referralCode) return fresh.referralCode;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }

  throw new Error("Unable to allocate referral code.");
};

export const buildInviteLink = (code) => {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return "";
  return `${getPublicFrontendUrl()}/signup?ref=${encodeURIComponent(normalized)}`;
};

/**
 * Attach a pending referral at account creation (email / Google / Facebook).
 * Never throws to callers — signup must not fail because of referrals.
 */
export const attachReferralOnSignup = async ({
  refereeUser,
  referralCode,
}) => {
  try {
    if (!refereeUser?._id) return { attached: false };

    const code = normalizeReferralCode(referralCode);
    if (!code) return { attached: false };

    if (refereeUser.referredBy) {
      return { attached: false, reason: "already_attributed" };
    }

    const referrer = await User.findOne({ referralCode: code })
      .select("_id username name status referralCode")
      .lean();

    if (!referrer) return { attached: false, reason: "invalid_code" };
    if (String(referrer._id) === String(refereeUser._id)) {
      return { attached: false, reason: "same_user" };
    }
    if (referrer.status === "banned" || referrer.status === "suspended") {
      return { attached: false, reason: "referrer_inactive" };
    }

    const existing = await Referral.findOne({ referee: refereeUser._id })
      .select("_id")
      .lean();
    if (existing) return { attached: false, reason: "already_attributed" };

    await User.updateOne(
      {
        _id: refereeUser._id,
        $or: [{ referredBy: null }, { referredBy: { $exists: false } }],
      },
      { $set: { referredBy: referrer._id } }
    );

    try {
      await Referral.create({
        referrer: referrer._id,
        referee: refereeUser._id,
        codeUsed: code,
        status: "pending",
      });
    } catch (err) {
      if (err?.code === 11000) {
        return { attached: false, reason: "already_attributed" };
      }
      throw err;
    }

    return { attached: true, referrerId: referrer._id };
  } catch (err) {
    console.error("[referral] attach failed:", err?.message || err);
    return { attached: false, reason: "error" };
  }
};

/**
 * Move pending → qualified once email is verified. Idempotent.
 * Notifies referrer at most once.
 */
export const qualifyReferralForUser = async (refereeUser, { io } = {}) => {
  try {
    if (!refereeUser?._id) return { qualified: false };

    const referral = await Referral.findOneAndUpdate(
      { referee: refereeUser._id, status: "pending" },
      {
        $set: {
          status: "qualified",
          qualifiedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!referral) {
      const already = await Referral.findOne({
        referee: refereeUser._id,
        status: "qualified",
      })
        .select("_id notifiedAt")
        .lean();
      return {
        qualified: Boolean(already),
        alreadyQualified: Boolean(already),
      };
    }

    if (!refereeUser.referredBy) {
      await User.updateOne(
        { _id: refereeUser._id },
        { $set: { referredBy: referral.referrer } }
      );
    }

    if (!referral.notifiedAt) {
      const marked = await Referral.findOneAndUpdate(
        { _id: referral._id, notifiedAt: null },
        { $set: { notifiedAt: new Date() } },
        { returnDocument: "after" }
      );

      if (marked) {
        await notify({
          io,
          recipientId: referral.referrer,
          actor: refereeUser,
          type: "referral_qualified",
          title: `${personName(refereeUser)} joined via your invite`,
          body: "Someone signed up with your Fointer invite link.",
          entity: snapshotEntity("user", refereeUser),
        });
      }
    }

    return { qualified: true, referralId: referral._id };
  } catch (err) {
    console.error("[referral] qualify failed:", err?.message || err);
    return { qualified: false, reason: "error" };
  }
};

export const countQualifiedReferrals = async (userId) => {
  if (!userId) return 0;
  return Referral.countDocuments({
    referrer: userId,
    status: "qualified",
  });
};

export const getReferralDashboard = async (
  userId,
  { limit = LIST_DEFAULT_LIMIT, cursor } = {}
) => {
  const code = await ensureUserReferralCode(userId);
  const take = Math.min(
    Math.max(Number(limit) || LIST_DEFAULT_LIMIT, 1),
    LIST_MAX_LIMIT
  );

  const filter = { referrer: userId };
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      filter.createdAt = { $lt: cursorDate };
    }
  }

  const [qualifiedCount, pendingCount, rows] = await Promise.all([
    Referral.countDocuments({ referrer: userId, status: "qualified" }),
    Referral.countDocuments({ referrer: userId, status: "pending" }),
    Referral.find(filter)
      .sort({ createdAt: -1 })
      .limit(take + 1)
      .populate("referee", "username name avatar status")
      .lean(),
  ]);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore
    ? page[page.length - 1]?.createdAt?.toISOString?.() || null
    : null;

  return {
    code,
    inviteLink: buildInviteLink(code),
    stats: {
      qualified: qualifiedCount,
      pending: pendingCount,
      total: qualifiedCount + pendingCount,
    },
    referrals: page.map((row) => ({
      id: row._id,
      status: row.status,
      codeUsed: row.codeUsed,
      createdAt: row.createdAt,
      qualifiedAt: row.qualifiedAt,
      referee: row.referee
        ? {
            id: row.referee._id,
            username: row.referee.username || "",
            name: row.referee.name || "",
            avatar: row.referee.avatar || "",
          }
        : null,
    })),
    nextCursor,
  };
};
