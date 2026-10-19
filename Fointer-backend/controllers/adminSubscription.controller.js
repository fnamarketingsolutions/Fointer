import mongoose from "mongoose";
import User from "../models/user.js";
import SubscriptionPlan from "../models/subscriptionPlan.js";
import SubscriptionEntitlement from "../models/subscriptionEntitlement.js";
import SubscriptionTransaction from "../models/subscriptionTransaction.js";
import SubscriptionProviderEvent from "../models/subscriptionProviderEvent.js";
import { sendServerError } from "../utils/safeError.js";
import { derivePublicEntitlement } from "../utils/subscriptionEntitlement.js";
import {
  activateEntitlementFromVerifiedPurchase,
  cancelEntitlementForUser,
  getPublicEntitlementForUser,
  refreshEntitlementDocument,
  revokeOrRefundEntitlement,
  serializeTransaction,
} from "../services/subscription/entitlementStore.js";
import {
  buildIntegrationStatus,
  getAdPlacementSettings,
  updateAdPlacementSettings,
} from "../services/subscription/adsConfig.js";
import {
  DEFAULT_PLAN,
  ensureDefaultSubscriptionPlan,
  serializePlan,
} from "./subscription.controller.js";
import { addBillingPeriod } from "../services/subscription/flutterwaveBilling.js";

export const adminListPlans = async (_req, res) => {
  try {
    await ensureDefaultSubscriptionPlan();
    const plans = await SubscriptionPlan.find().sort({
      displayOrder: 1,
      createdAt: 1,
    });
    return res.json({
      success: true,
      plans: plans.map((p) => serializePlan(p, { includeAdmin: true })),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to list plans.");
  }
};

export const adminUpsertPlan = async (req, res) => {
  try {
    const code = String(req.body.code || DEFAULT_PLAN.code)
      .trim()
      .toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, message: "code is required." });
    }

    let plan = await SubscriptionPlan.findOne({ code });
    if (!plan) {
      plan = new SubscriptionPlan({ code, ...DEFAULT_PLAN, code });
    }

    const fields = [
      "name",
      "description",
      "price",
      "currency",
      "billingPeriodDays",
      "removesThirdPartyAds",
      "isActive",
      "flutterwavePaymentPlanId",
      "googlePlayProductId",
      "appleProductId",
      "displayOrder",
    ];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        plan[field] = req.body[field];
      }
    }
    if (plan.currency) plan.currency = String(plan.currency).toUpperCase();
    await plan.save();

    return res.json({
      success: true,
      plan: serializePlan(plan, { includeAdmin: true }),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to save plan.");
  }
};

export const adminListSubscribers = async (req, res) => {
  try {
    const status = String(req.query.status || "").trim().toLowerCase();
    const q = String(req.query.q || "").trim();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const cursor = String(req.query.cursor || "").trim();

    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    } else {
      filter.status = { $nin: ["none"] };
    }
    if (cursor && mongoose.isValidObjectId(cursor)) {
      filter._id = { $lt: cursor };
    }

    let rows = await SubscriptionEntitlement.find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .populate("user", "username name email status")
      .populate("plan", "code name price currency");

    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      rows = rows.filter(
        (row) =>
          re.test(row.user?.username || "") ||
          re.test(row.user?.email || "") ||
          re.test(row.user?.name || "") ||
          re.test(row.planCode || "")
      );
    }

    const now = new Date();
    for (const row of rows) {
      await refreshEntitlementDocument(row, now);
    }

    return res.json({
      success: true,
      subscribers: rows.map((row) => ({
        id: String(row._id),
        user: row.user
          ? {
              id: String(row.user._id),
              username: row.user.username,
              name: row.user.name,
              email: row.user.email,
              status: row.user.status,
            }
          : null,
        entitlement: derivePublicEntitlement(row.toObject(), now),
        platform: row.platform,
        provider: row.provider,
        planCode: row.planCode,
        providerSubscriptionId: row.providerSubscriptionId || "",
        lastVerifiedAt: row.lastVerifiedAt,
        lastSyncError: row.lastSyncError || "",
        updatedAt: row.updatedAt,
      })),
      nextCursor: rows.length ? String(rows[rows.length - 1]._id) : null,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to list subscribers.");
  }
};

export const adminGetUserSubscription = async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id." });
    }
    const user = await User.findById(userId).select("username name email status");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { public: entitlement } = await getPublicEntitlementForUser(userId);
    const transactions = await SubscriptionTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);
    const events = await SubscriptionProviderEvent.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      success: true,
      user: {
        id: String(user._id),
        username: user.username,
        name: user.name,
        email: user.email,
        status: user.status,
      },
      entitlement,
      transactions: transactions.map(serializeTransaction),
      events: events.map((e) => ({
        id: String(e._id),
        provider: e.provider,
        eventType: e.eventType,
        processingStatus: e.processingStatus,
        resultMessage: e.resultMessage,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load user subscription.");
  }
};

export const adminCancelUserSubscription = async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id." });
    }
    await cancelEntitlementForUser(userId, {
      reason: String(req.body.reason || "admin_cancel").slice(0, 500),
    });
    const { public: entitlement } = await getPublicEntitlementForUser(userId);
    return res.json({ success: true, entitlement });
  } catch (error) {
    return sendServerError(res, error, "Failed to cancel subscription.");
  }
};

/** Manual grant for support — records an admin transaction (no card data). */
export const adminGrantEntitlement = async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id." });
    }
    await ensureDefaultSubscriptionPlan();
    const planCode = String(req.body.planCode || "ADFREE_MONTHLY")
      .trim()
      .toUpperCase();
    const plan = await SubscriptionPlan.findOne({ code: planCode });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found." });
    }

    const days = Math.max(
      1,
      Number(req.body.billingPeriodDays) || plan.billingPeriodDays || 30
    );
    const periodStart = new Date();
    const periodEnd = addBillingPeriod(periodStart, days);

    const transaction = await SubscriptionTransaction.create({
      user: userId,
      plan: plan._id,
      amount: 0,
      currency: plan.currency,
      status: "verified",
      platform: "admin",
      provider: "admin",
      providerReference: `ADMIN-${cryptoRandom()}`,
      periodStart,
      periodEnd,
      metadata: {
        grantedBy: String(req.user._id),
        reason: String(req.body.reason || "admin_grant").slice(0, 500),
      },
    });

    await activateEntitlementFromVerifiedPurchase({
      userId,
      plan,
      platform: "admin",
      provider: "admin",
      periodStart,
      periodEnd,
      autoRenew: false,
      providerSubscriptionId: String(transaction._id),
      transactionId: transaction._id,
    });

    const { public: entitlement } = await getPublicEntitlementForUser(userId);
    return res.json({ success: true, entitlement });
  } catch (error) {
    return sendServerError(res, error, "Failed to grant entitlement.");
  }
};

export const adminRevokeEntitlement = async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id." });
    }
    await revokeOrRefundEntitlement(userId, {
      type: String(req.body.type || "revoked") === "refunded" ? "refunded" : "revoked",
      reason: String(req.body.reason || "admin_revoke").slice(0, 500),
    });
    const { public: entitlement } = await getPublicEntitlementForUser(userId);
    return res.json({ success: true, entitlement });
  } catch (error) {
    return sendServerError(res, error, "Failed to revoke entitlement.");
  }
};

export const adminGetAdsSettings = async (_req, res) => {
  try {
    const settings = await getAdPlacementSettings();
    const integration = await buildIntegrationStatus();
    return res.json({
      success: true,
      settings: {
        provider: settings.provider,
        webProvider: settings.webProvider,
        androidProvider: settings.androidProvider,
        iosProvider: settings.iosProvider,
        placements: settings.placements,
        adsenseClientId: settings.adsenseClientId,
        adsenseSlots: settings.adsenseSlots,
        notes: settings.notes,
        updatedAt: settings.updatedAt,
      },
      integration,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load ads settings.");
  }
};

export const adminUpdateAdsSettings = async (req, res) => {
  try {
    const settings = await updateAdPlacementSettings(req.body || {});
    const integration = await buildIntegrationStatus();
    return res.json({
      success: true,
      settings: {
        provider: settings.provider,
        webProvider: settings.webProvider,
        androidProvider: settings.androidProvider,
        iosProvider: settings.iosProvider,
        placements: settings.placements,
        adsenseClientId: settings.adsenseClientId,
        adsenseSlots: settings.adsenseSlots,
        notes: settings.notes,
        updatedAt: settings.updatedAt,
      },
      integration,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update ads settings.");
  }
};

export const adminGetIntegrationStatus = async (_req, res) => {
  try {
    const integration = await buildIntegrationStatus();
    return res.json({ success: true, integration });
  } catch (error) {
    return sendServerError(res, error, "Failed to load integration status.");
  }
};

export const adminListTransactions = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const page = Math.max(1, Number(req.query.page) || 1);
    const status = String(req.query.status || "").trim().toLowerCase();
    const filter = {};
    if (status && status !== "all") filter.status = status;

    const [rows, total] = await Promise.all([
      SubscriptionTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "username email name"),
      SubscriptionTransaction.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      transactions: rows.map((row) => ({
        ...serializeTransaction(row),
        user: row.user
          ? {
              id: String(row.user._id),
              username: row.user.username,
              email: row.user.email,
              name: row.user.name,
            }
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to list transactions.");
  }
};

const cryptoRandom = () =>
  `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
