import SystemSetting from "../models/systemSetting.js";
import User from "../models/user.js";
import Warning from "../models/warning.js";
import { resolveIsSuperAdmin } from "./adminAccess.js";
import {
  getAdminIdsForNotificationType,
  notify,
  notifyMany,
  personName,
  snippet,
} from "./notify.js";

const DEFAULT_MAX_WARNINGS = 3;

export const getWarningPolicy = async () => {
  const settings = await SystemSetting.findOne({ key: "global" })
    .select("maxWarningsBeforeBan autoBanOnMaxWarnings")
    .lean();
  const max = Number(settings?.maxWarningsBeforeBan);
  return {
    maxWarningsBeforeBan:
      Number.isFinite(max) && max >= 1 && max <= 20
        ? Math.floor(max)
        : DEFAULT_MAX_WARNINGS,
    autoBanOnMaxWarnings: settings?.autoBanOnMaxWarnings !== false,
  };
};

const applyPlatformBan = async (user, actorId) => {
  if (String(user.status || "") === "banned") return user;
  user.status = "banned";
  await user.save();
  const { hideActiveListingsForSeller } = await import(
    "../controllers/adminMarketplace.controller.js"
  );
  await hideActiveListingsForSeller(user._id);
  return user;
};

/**
 * Issue a platform warning to a member (or admin if actor is super admin).
 * Optionally auto-bans when warning count reaches the configured max.
 */
export const issueUserWarning = async ({
  userId,
  actor,
  message,
  source = "admin_panel",
  relatedEntity = null,
  io = null,
}) => {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) {
    const err = new Error("Warning message is required.");
    err.status = 400;
    err.isOperational = true;
    throw err;
  }
  if (cleanMessage.length > 2000) {
    const err = new Error("Warning message must be 2000 characters or fewer.");
    err.status = 400;
    err.isOperational = true;
    throw err;
  }

  const target = await User.findById(userId);
  if (!target) {
    const err = new Error("User not found.");
    err.status = 404;
    err.isOperational = true;
    throw err;
  }

  if (String(target._id) === String(actor?._id || actor?.id)) {
    const err = new Error("You cannot warn your own account.");
    err.status = 400;
    err.isOperational = true;
    throw err;
  }

  const targetIsAdmin =
    String(target.role || "")
      .toLowerCase()
      .trim() === "admin";
  if (targetIsAdmin && !resolveIsSuperAdmin(actor)) {
    const err = new Error("Only a super admin can warn an admin account.");
    err.status = 403;
    err.isOperational = true;
    throw err;
  }

  if (String(target.status || "") === "banned") {
    const err = new Error("This account is already banned.");
    err.status = 400;
    err.isOperational = true;
    throw err;
  }

  const policy = await getWarningPolicy();

  const warning = await Warning.create({
    user: target._id,
    issuedBy: actor._id,
    message: cleanMessage,
    source,
    relatedEntity: relatedEntity
      ? {
          kind: relatedEntity.kind || "",
          targetId: relatedEntity.targetId || relatedEntity._id || null,
          title: relatedEntity.title || relatedEntity.name || "",
        }
      : undefined,
    resultedInBan: false,
  });

  const count = await Warning.countDocuments({ user: target._id });
  target.warningCount = count;
  await target.save();

  const shouldAutoBan =
    policy.autoBanOnMaxWarnings && count >= policy.maxWarningsBeforeBan;

  if (shouldAutoBan) {
    await applyPlatformBan(target, actor._id);
    warning.resultedInBan = true;
    await warning.save();
  }

  const warnTitle = shouldAutoBan
    ? "Account banned after warnings"
    : "Account warning";
  const warnBody = shouldAutoBan
    ? `You received warning ${count}/${policy.maxWarningsBeforeBan} and your account was banned. ${snippet(cleanMessage, 160)}`
    : `Warning ${count}/${policy.maxWarningsBeforeBan}: ${snippet(cleanMessage, 180)}`;

  // Member notification (skipped automatically if recipient is an admin account)
  await notify({
    io,
    recipientId: target._id,
    actor,
    type: "user_warning",
    title: warnTitle,
    body: warnBody,
    entity: {
      kind: "user",
      _id: target._id,
      title: target.username || target.name || "user",
    },
  });

  // Highlight for admins with Warnings tab (exclude actor + warned user)
  const adminIds = await getAdminIdsForNotificationType("user_warning");
  const skip = new Set(
    [actor?._id || actor?.id, target._id]
      .filter(Boolean)
      .map((id) => String(id))
  );
  await notifyMany(
    adminIds.filter((id) => !skip.has(String(id))),
    {
      io,
      actor,
      type: "user_warning",
      title: shouldAutoBan
        ? `${personName(target)} banned after ${count} warnings`
        : `Warning issued to ${personName(target)} (${count}/${policy.maxWarningsBeforeBan})`,
      body: snippet(cleanMessage, 180),
      entity: {
        kind: "user",
        _id: target._id,
        title: target.username || target.name || "user",
      },
    }
  );

  return {
    warning,
    user: target,
    warningCount: count,
    maxWarningsBeforeBan: policy.maxWarningsBeforeBan,
    autoBanOnMaxWarnings: policy.autoBanOnMaxWarnings,
    banned: shouldAutoBan,
  };
};

export const formatWarning = (doc) => {
  const w = doc?.toObject ? doc.toObject() : doc;
  if (!w) return null;
  return {
    id: w._id,
    message: w.message || "",
    source: w.source || "admin_panel",
    resultedInBan: Boolean(w.resultedInBan),
    createdAt: w.createdAt,
    relatedEntity: w.relatedEntity
      ? {
          kind: w.relatedEntity.kind || "",
          id: w.relatedEntity.targetId || null,
          title: w.relatedEntity.title || "",
        }
      : null,
    user: w.user
      ? typeof w.user === "object"
        ? {
            id: w.user._id,
            username: w.user.username,
            name: w.user.name,
            email: w.user.email,
            avatar: w.user.avatar || "",
            status: w.user.status || "active",
            warningCount: w.user.warningCount ?? 0,
          }
        : { id: w.user }
      : null,
    issuedBy: w.issuedBy
      ? typeof w.issuedBy === "object"
        ? {
            id: w.issuedBy._id,
            username: w.issuedBy.username,
            name: w.issuedBy.name,
            avatar: w.issuedBy.avatar || "",
          }
        : { id: w.issuedBy }
      : null,
  };
};
