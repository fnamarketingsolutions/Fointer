import mongoose from "mongoose";
import UserSupportCategory from "../models/userSupportCategory.js";
import UserSupportRequest from "../models/userSupportRequest.js";
import { sendUserSupportRequestEmail } from "../utils/sendVerificationEmail.js";
import { sendServerError } from "../utils/safeError.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import { notifyAdmins, personName, snippet } from "../utils/notify.js";
import { EMAIL_RE, PHONE_RE } from "../utils/validate.js";

const MAX_NAME_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 5000;
const VALID_STATUSES = ["pending", "in_progress", "resolved"];

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const formatCategory = (category) => ({
  id: category._id,
  name: category.name || "",
  isActive: category.isActive !== false,
  displayOrder: category.displayOrder ?? 0,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

const formatRequest = (request) => {
  const category = request.category;
  const user = request.user;
  return {
    id: request._id,
    category:
      category && typeof category === "object" && category._id
        ? { id: category._id, name: category.name || request.categoryName }
        : {
            id: request.category,
            name: request.categoryName || "",
          },
    categoryName: request.categoryName || "",
    email: request.email || "",
    phone: request.phone || "",
    message: request.message || "",
    status: request.status || "pending",
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    user:
      user && typeof user === "object" && user._id
        ? {
            id: user._id,
            username: user.username,
            name: user.name,
            email: user.email,
          }
        : request.user
          ? { id: request.user }
          : null,
  };
};

export const listPublicCategories = async (_req, res) => {
  try {
    const categories = await UserSupportCategory.find({ isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      categories: categories.map(formatCategory),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const listAdminCategories = async (_req, res) => {
  try {
    const categories = await UserSupportCategory.find()
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      categories: categories.map(formatCategory),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const createAdminCategory = async (req, res) => {
  try {
    const name = normalizeName(req.body?.name);
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required.",
      });
    }
    if (name.length > MAX_NAME_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Category name must be ${MAX_NAME_LENGTH} characters or fewer.`,
      });
    }

    const displayOrderRaw = req.body?.displayOrder;
    let displayOrder = 0;
    if (displayOrderRaw != null && displayOrderRaw !== "") {
      displayOrder = Number(displayOrderRaw);
      if (!Number.isFinite(displayOrder)) {
        return res.status(400).json({
          success: false,
          message: "Display order must be a number.",
        });
      }
      displayOrder = Math.max(-9999, Math.min(9999, Math.floor(displayOrder)));
    }

    const category = await UserSupportCategory.create({
      name,
      isActive: req.body?.isActive == null ? true : Boolean(req.body.isActive),
      displayOrder,
    });

    return res.status(201).json({
      success: true,
      category: formatCategory(category),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A category with this name already exists.",
      });
    }
    return sendServerError(res, error);
  }
};

export const updateAdminCategory = async (req, res) => {
  try {
    const categoryId = req.params?.id;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "A valid category is required.",
      });
    }

    const category = await UserSupportCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    if (req.body?.name != null) {
      const name = normalizeName(req.body.name);
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Category name is required.",
        });
      }
      if (name.length > MAX_NAME_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `Category name must be ${MAX_NAME_LENGTH} characters or fewer.`,
        });
      }
      category.name = name;
    }

    if (req.body?.isActive != null) {
      category.isActive = Boolean(req.body.isActive);
    }

    if (req.body?.displayOrder != null && req.body.displayOrder !== "") {
      const displayOrder = Number(req.body.displayOrder);
      if (!Number.isFinite(displayOrder)) {
        return res.status(400).json({
          success: false,
          message: "Display order must be a number.",
        });
      }
      category.displayOrder = Math.max(
        -9999,
        Math.min(9999, Math.floor(displayOrder))
      );
    }

    await category.save();

    return res.status(200).json({
      success: true,
      category: formatCategory(category),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A category with this name already exists.",
      });
    }
    return sendServerError(res, error);
  }
};

export const createPublicRequest = async (req, res) => {
  try {
    const categoryId = String(req.body?.categoryId || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Select a support category.",
      });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({
        success: false,
        message: "A valid email is required.",
      });
    }
    if (!phone || !PHONE_RE.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "A valid phone number is required.",
      });
    }
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Please describe your request.",
      });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Request must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      });
    }

    if (await respondIfBanned(res, message)) return;

    const category = await UserSupportCategory.findOne({
      _id: categoryId,
      isActive: true,
    });
    if (!category) {
      return res.status(400).json({
        success: false,
        message: "That support category is not available.",
      });
    }

    const request = await UserSupportRequest.create({
      category: category._id,
      categoryName: category.name,
      user: req.user?._id || null,
      email,
      phone,
      message,
      status: "pending",
    });

    try {
      await sendUserSupportRequestEmail({
        email,
        phone,
        categoryName: category.name,
        message,
      });
    } catch (emailError) {
      console.error("User support email failed:", emailError.message);
    }

    const actor = req.user || { name: email, username: email };
    await notifyAdmins({
      io: req.app.get("io"),
      actor: req.user || null,
      type: "user_support",
      title: `${personName(actor)} submitted a support request`,
      body: `${category.name}: ${snippet(message)}`,
      entity: {
        kind: "user_support",
        id: request._id,
        title: category.name,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Support request submitted.",
      request: formatRequest(request),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const listAdminRequests = async (req, res) => {
  try {
    const status = String(req.query?.status || "")
      .trim()
      .toLowerCase();
    const filter = {};
    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }

    const requests = await UserSupportRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("category", "name isActive")
      .populate("user", "username name email")
      .lean();

    return res.status(200).json({
      success: true,
      requests: requests.map(formatRequest),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const updateAdminRequestStatus = async (req, res) => {
  try {
    const requestId = req.params?.id;
    const status = String(req.body?.status || "")
      .trim()
      .toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: "A valid request is required.",
      });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be pending, in_progress, or resolved.",
      });
    }

    const request = await UserSupportRequest.findById(requestId)
      .populate("category", "name isActive")
      .populate("user", "username name email");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Support request not found.",
      });
    }

    request.status = status;
    await request.save();

    return res.status(200).json({
      success: true,
      request: formatRequest(request),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
