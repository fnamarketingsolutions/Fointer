import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/user.js";
import { sendServerError } from "../utils/safeError.js";
import {
  parsePagination,
  buildPaginationMeta,
} from "../utils/pagination.js";
import { escapeRegex } from "../utils/validate.js";
import {
  getAdminAccessPayload,
  normalizeAssignableAdminTabs,
  resolveIsSuperAdmin,
} from "../utils/adminAccess.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";

const formatManagedAdmin = (u) => {
  const access = getAdminAccessPayload(u);
  return {
    id: u._id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: String(u.role || "user").toLowerCase().trim(),
    status: u.status || "active",
    avatar: u.avatar || "",
    isSuperAdmin: access.isSuperAdmin,
    adminTabs: access.adminTabs,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
};

const countSuperAdmins = async (excludeId = null) => {
  const filter = {
    role: { $regex: /^admin$/i },
    isSuperAdmin: true,
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return User.countDocuments(filter);
};

const buildUniqueUsername = async (seed) => {
  const base = String(seed || "admin")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20) || "admin";

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = crypto.randomInt(1000, 10000);
    const username = `${base}_${suffix}`;
    const exists = await User.findOne({ username }).select("_id").lean();
    if (!exists) return username;
  }

  return `admin_${Date.now()}`;
};

export const listAdmins = async (req, res) => {
  try {
    const { q } = req.query;
    const { enabled, page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const pageNum = enabled ? page : 1;
    const pageLimit = enabled ? limit : 25;
    const pageSkip = enabled ? skip : 0;

    const filter = { role: { $regex: /^admin$/i } };

    if (q && String(q).trim()) {
      const term = escapeRegex(String(q).trim());
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { username: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
      ];
    }

    const [admins, total, superAdminCount] = await Promise.all([
      User.find(filter)
        .select(
          "username name email role status avatar isSuperAdmin adminTabs createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .skip(pageSkip)
        .limit(pageLimit)
        .lean(),
      User.countDocuments(filter),
      countSuperAdmins(),
    ]);

    return res.status(200).json({
      success: true,
      admins: admins.map(formatManagedAdmin),
      summary: {
        all: total,
        superAdmins: superAdminCount,
      },
      pagination: buildPaginationMeta({
        page: pageNum,
        limit: pageLimit,
        total,
      }),
    });
  } catch (error) {
    return sendServerError(res, error, "Could not load admins.");
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, username, adminTabs } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const tabsResult = normalizeAssignableAdminTabs(adminTabs);
    if (!tabsResult.ok) {
      return res.status(400).json({
        success: false,
        message: tabsResult.message,
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();
    const requestedUsername = username
      ? String(username).trim().toLowerCase()
      : "";

    if (await respondIfBanned(res, requestedUsername || trimmedName, trimmedName)) {
      return;
    }

    const emailExists = await User.findOne({ email: normalizedEmail });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered.",
      });
    }

    let finalUsername = requestedUsername;
    if (finalUsername) {
      const usernameExists = await User.findOne({ username: finalUsername });
      if (usernameExists) {
        return res.status(400).json({
          success: false,
          message: "Username already exists.",
        });
      }
    } else {
      const emailLocal = normalizedEmail.split("@")[0] || "admin";
      finalUsername = await buildUniqueUsername(emailLocal);
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      username: finalUsername,
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
      isEmailVerified: true,
      isSuperAdmin: false,
      adminTabs: tabsResult.tabs,
      status: "active",
    });

    return res.status(201).json({
      success: true,
      message: "Admin created.",
      admin: formatManagedAdmin(user),
    });
  } catch (error) {
    return sendServerError(res, error, "Could not create admin.");
  }
};

export const updateAdminTabs = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminTabs } = req.body || {};

    const target = await User.findById(id);
    if (!target || String(target.role || "").toLowerCase() !== "admin") {
      return res.status(404).json({
        success: false,
        message: "Admin not found.",
      });
    }

    if (resolveIsSuperAdmin(target)) {
      return res.status(400).json({
        success: false,
        message: "Super admins have all tabs. Demote them first to limit tabs.",
      });
    }

    const tabsResult = normalizeAssignableAdminTabs(adminTabs);
    if (!tabsResult.ok) {
      return res.status(400).json({
        success: false,
        message: tabsResult.message,
      });
    }

    target.adminTabs = tabsResult.tabs;
    target.isSuperAdmin = false;
    await target.save();

    return res.status(200).json({
      success: true,
      message: "Admin tabs updated.",
      admin: formatManagedAdmin(target),
    });
  } catch (error) {
    return sendServerError(res, error, "Could not update admin tabs.");
  }
};

export const updateAdminSuper = async (req, res) => {
  try {
    const { id } = req.params;
    const makeSuper = Boolean(req.body?.isSuperAdmin);

    const target = await User.findById(id);
    if (!target || String(target.role || "").toLowerCase() !== "admin") {
      return res.status(404).json({
        success: false,
        message: "Admin not found.",
      });
    }

    if (makeSuper) {
      target.isSuperAdmin = true;
      target.adminTabs = [];
      await target.save();

      return res.status(200).json({
        success: true,
        message: "Admin promoted to super admin.",
        admin: formatManagedAdmin(target),
      });
    }

    // Demote from super → limited admin (tabs required)
    if (!resolveIsSuperAdmin(target)) {
      return res.status(400).json({
        success: false,
        message: "This admin is already a limited admin.",
      });
    }

    const otherSupers = await countSuperAdmins(target._id);
    if (otherSupers < 1) {
      return res.status(400).json({
        success: false,
        message: "Cannot demote the last super admin.",
      });
    }

    const tabsResult = normalizeAssignableAdminTabs(req.body?.adminTabs);
    if (!tabsResult.ok) {
      return res.status(400).json({
        success: false,
        message:
          tabsResult.message ||
          "Provide adminTabs when demoting a super admin.",
      });
    }

    target.isSuperAdmin = false;
    target.adminTabs = tabsResult.tabs;
    await target.save();

    return res.status(200).json({
      success: true,
      message: "Admin demoted to limited admin.",
      admin: formatManagedAdmin(target),
    });
  } catch (error) {
    return sendServerError(res, error, "Could not update super admin status.");
  }
};

/** Promote an existing member (role=user) to limited admin with tabs. */
export const promoteUserToAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminTabs } = req.body || {};

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (String(target.role || "").toLowerCase() === "admin") {
      return res.status(400).json({
        success: false,
        message: "User is already an admin.",
      });
    }

    const tabsResult = normalizeAssignableAdminTabs(adminTabs);
    if (!tabsResult.ok) {
      return res.status(400).json({
        success: false,
        message: tabsResult.message,
      });
    }

    target.role = "admin";
    target.isSuperAdmin = false;
    target.adminTabs = tabsResult.tabs;
    target.isEmailVerified = true;
    await target.save();

    return res.status(200).json({
      success: true,
      message: "User promoted to admin.",
      admin: formatManagedAdmin(target),
    });
  } catch (error) {
    return sendServerError(res, error, "Could not promote user to admin.");
  }
};
