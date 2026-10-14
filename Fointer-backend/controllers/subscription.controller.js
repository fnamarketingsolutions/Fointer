import crypto from "crypto";
import mongoose from "mongoose";
import SubscriptionPlan from "../models/subscriptionPlan.js";
import SubscriptionTransaction from "../models/subscriptionTransaction.js";
import { sendServerError } from "../utils/safeError.js";
import { derivePublicEntitlement } from "../utils/subscriptionEntitlement.js";
import {
  activateEntitlementFromVerifiedPurchase,
  cancelEntitlementForUser,
  claimProviderEvent,
  getPublicEntitlementForUser,
  markBillingRetry,
  markProviderEvent,
  revokeOrRefundEntitlement,
  serializeTransaction,
} from "../services/subscription/entitlementStore.js";
import {
  addBillingPeriod,
  createFlutterwaveCheckout,
  isFlutterwaveConfigured,
  paymentMatchesSubscription,
  verifyFlutterwaveTransaction,
  verifyFlutterwaveWebhookSignature,
} from "../services/subscription/flutterwaveBilling.js";
import {
  acknowledgeGooglePlaySubscription,
  googlePlayConfigStatus,
  summarizeGooglePlayNotification,
  verifyGooglePlaySubscription,
} from "../services/subscription/googlePlayBilling.js";
import {
  appleConfigStatus,
  summarizeAppleNotification,
  verifyAppleTransaction,
} from "../services/subscription/appleBilling.js";
import {
  buildPublicAdsConfig,
  getAdPlacementSettings,
} from "../services/subscription/adsConfig.js";

const DEFAULT_PLAN = {
  code: "ADFREE_MONTHLY",
  name: "Ad-Free Monthly",
  description:
    "Remove designated third-party display advertisements across Fointer. Sponsored Marketplace Listings and organic content are unaffected.",
  price: 4.99,
  currency: "USD",
  billingPeriodDays: 30,
  removesThirdPartyAds: true,
  isActive: true,
  displayOrder: 0,
};

export const ensureDefaultSubscriptionPlan = async () => {
  let plan = await SubscriptionPlan.findOne({ code: DEFAULT_PLAN.code });
  if (!plan) {
    plan = await SubscriptionPlan.create(DEFAULT_PLAN);
  }
  return plan;
};

const serializePlan = (plan, { includeAdmin = false } = {}) => {
  const base = {
    id: String(plan._id),
    code: plan.code,
    name: plan.name,
    description: plan.description,
    price: plan.price,
    currency: plan.currency,
    billingPeriodDays: plan.billingPeriodDays,
    removesThirdPartyAds: plan.removesThirdPartyAds,
    isActive: plan.isActive,
    displayOrder: plan.displayOrder,
    googlePlayProductId: plan.googlePlayProductId || "",
    appleProductId: plan.appleProductId || "",
  };
  if (includeAdmin) {
    base.flutterwavePaymentPlanId = plan.flutterwavePaymentPlanId || "";
    base.createdAt = plan.createdAt;
    base.updatedAt = plan.updatedAt;
  }
  return base;
};

export const listPlans = async (_req, res) => {
  try {
    await ensureDefaultSubscriptionPlan();
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({
      displayOrder: 1,
      createdAt: 1,
    });
    return res.json({
      success: true,
      plans: plans.map((p) => serializePlan(p)),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load subscription plans.");
  }
};

export const getMyEntitlement = async (req, res) => {
  try {
    const { public: entitlement } = await getPublicEntitlementForUser(req.user._id);
    return res.json({ success: true, entitlement });
  } catch (error) {
    return sendServerError(res, error, "Failed to load entitlement.");
  }
};

export const getAdsConfig = async (req, res) => {
  try {
    let adFreeActive = false;
    if (req.user?._id) {
      const result = await getPublicEntitlementForUser(req.user._id);
      adFreeActive = result.adFreeActive;
    }
    const settings = await getAdPlacementSettings();
    return res.json({
      success: true,
      ads: buildPublicAdsConfig({ settings, adFreeActive }),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load ads configuration.");
  }
};

export const startWebCheckout = async (req, res) => {
  let transaction;
  try {
    if (!isFlutterwaveConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          "Web subscription checkout is unavailable. Configure FLW_SECRET_KEY and FLW_SECRET_HASH.",
      });
    }

    const frontendUrl = String(process.env.FRONTEND_URL || "")
      .trim()
      .replace(/\/+$/, "");
    if (!frontendUrl) {
      return res.status(503).json({
        success: false,
        message: "FRONTEND_URL is required for checkout redirects.",
      });
    }

    await ensureDefaultSubscriptionPlan();
    const planCode = String(req.body.planCode || "ADFREE_MONTHLY")
      .trim()
      .toUpperCase();
    const plan = await SubscriptionPlan.findOne({ code: planCode, isActive: true });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found." });
    }

    const { adFreeActive, entitlement } = await getPublicEntitlementForUser(
      req.user._id
    );
    if (
      adFreeActive &&
      entitlement?.renewalStatus === "auto" &&
      !entitlement?.cancelAtPeriodEnd
    ) {
      return res.status(409).json({
        success: false,
        message: "You already have an active ad-free subscription.",
        entitlement: derivePublicEntitlement(entitlement),
      });
    }

    const pending = await SubscriptionTransaction.findOne({
      user: req.user._id,
      status: { $in: ["initiated", "pending"] },
      provider: "flutterwave",
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    }).sort({ createdAt: -1 });

    if (pending?.paymentLink) {
      return res.status(200).json({
        success: true,
        checkoutUrl: pending.paymentLink,
        transactionId: String(pending._id),
        resumed: true,
      });
    }

    const reference = `FO-SUB-${crypto.randomUUID()}`;
    transaction = await SubscriptionTransaction.create({
      user: req.user._id,
      plan: plan._id,
      amount: plan.price,
      currency: plan.currency,
      status: "pending",
      platform: "web",
      provider: "flutterwave",
      providerReference: reference,
      metadata: { planCode: plan.code },
    });

    const checkout = await createFlutterwaveCheckout({
      reference,
      amount: plan.price,
      currency: plan.currency,
      redirectUrl: `${frontendUrl}/subscription/success`,
      customer: {
        email: req.user.email,
        name: req.user.name || req.user.username,
        username: req.user.username,
      },
      title: "Fointer Ad-Free",
      description: plan.name,
      paymentPlanId: plan.flutterwavePaymentPlanId || "",
      meta: {
        type: "adfree_subscription",
        transactionId: String(transaction._id),
        userId: String(req.user._id),
        planCode: plan.code,
      },
    });

    if (!checkout.ok) {
      await SubscriptionTransaction.updateOne(
        { _id: transaction._id },
        { $set: { status: "failed", failureReason: checkout.message } }
      );
      return res.status(502).json({
        success: false,
        message: checkout.message || "Could not start checkout.",
      });
    }

    await SubscriptionTransaction.updateOne(
      { _id: transaction._id },
      { $set: { paymentLink: checkout.checkoutUrl } }
    );

    return res.status(201).json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      transactionId: String(transaction._id),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to start subscription checkout.");
  }
};

const verifyAndActivateFlutterwave = async ({
  transaction,
  providerTransactionId,
  eventSource,
}) => {
  const verification = await verifyFlutterwaveTransaction(providerTransactionId);
  if (!verification.ok) {
    return verification;
  }
  const payment = verification.data;
  if (!paymentMatchesSubscription(payment, transaction)) {
    if (String(payment?.status || "").toLowerCase() !== "successful") {
      await SubscriptionTransaction.updateOne(
        { _id: transaction._id, status: { $in: ["pending", "initiated"] } },
        { $set: { status: "failed", failureReason: "Payment not successful." } }
      );
    }
    return { ok: false, status: 400, message: "Payment verification failed." };
  }

  if (transaction.status === "verified") {
    const { public: entitlement } = await getPublicEntitlementForUser(
      transaction.user
    );
    return { ok: true, alreadyVerified: true, entitlement };
  }

  const claim = await claimProviderEvent({
    provider: "flutterwave",
    eventType: eventSource,
    eventId: String(payment.id || providerTransactionId),
    user: transaction.user,
    transaction: transaction._id,
    providerReference: transaction.providerReference,
  });
  if (claim.duplicate && claim.event?.processingStatus === "processed") {
    const { public: entitlement } = await getPublicEntitlementForUser(
      transaction.user
    );
    return { ok: true, alreadyVerified: true, entitlement };
  }

  const plan = await SubscriptionPlan.findById(transaction.plan);
  const periodStart = new Date();
  const periodEnd = addBillingPeriod(
    periodStart,
    plan?.billingPeriodDays || 30
  );

  await SubscriptionTransaction.updateOne(
    { _id: transaction._id },
    {
      $set: {
        status: "verified",
        providerTransactionId: String(payment.id || providerTransactionId),
        periodStart,
        periodEnd,
        rawVerificationSummary: `flutterwave:${payment.status}`,
      },
    }
  );

  await activateEntitlementFromVerifiedPurchase({
    userId: transaction.user,
    plan,
    platform: "web",
    provider: "flutterwave",
    periodStart,
    periodEnd,
    autoRenew: Boolean(plan?.flutterwavePaymentPlanId),
    providerSubscriptionId: String(payment.id || ""),
    transactionId: transaction._id,
  });

  await markProviderEvent(claim.event, "processed", "Activated entitlement");
  const { public: entitlement } = await getPublicEntitlementForUser(
    transaction.user
  );
  return { ok: true, entitlement };
};

export const verifyWebPayment = async (req, res) => {
  try {
    const transactionId = String(
      req.body.transactionId || req.body.transaction_id || ""
    ).trim();
    const txRef = String(req.body.tx_ref || req.body.txRef || "").trim();
    const flwId = String(
      req.body.flw_ref || req.body.providerTransactionId || req.query?.transaction_id || ""
    ).trim();

    let transaction = null;
    if (transactionId && mongoose.isValidObjectId(transactionId)) {
      transaction = await SubscriptionTransaction.findById(transactionId);
    }
    if (!transaction && txRef) {
      transaction = await SubscriptionTransaction.findOne({
        providerReference: txRef,
      });
    }
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Subscription transaction not found.",
      });
    }
    if (String(transaction.user) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "This payment does not belong to you.",
      });
    }

    // Never activate from client success alone — require provider transaction id.
    const providerTx =
      flwId ||
      String(req.body.transaction_id || req.query?.transaction_id || "").trim();
    if (!providerTx) {
      return res.status(400).json({
        success: false,
        message: "Missing Flutterwave transaction id for verification.",
      });
    }

    const result = await verifyAndActivateFlutterwave({
      transaction,
      providerTransactionId: providerTx,
      eventSource: "client_verify",
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }
    return res.json({
      success: true,
      entitlement: result.entitlement,
      alreadyVerified: Boolean(result.alreadyVerified),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to verify subscription payment.");
  }
};

/**
 * Process a parsed Flutterwave event for subscription tx_refs (FO-SUB-*).
 * Used by the dedicated subscription webhook and the shared sponsorship webhook.
 */
export const processFlutterwaveSubscriptionEvent = async (event) => {
  const eventType = String(event?.event || "").toLowerCase();
  const data = event?.data || {};
  const txRef = String(data?.tx_ref || "").trim();
  const flwId = String(data?.id || data?.transaction_id || "").trim();

  if (!txRef) {
    return { ok: true, ignored: true, reason: "missing_reference" };
  }

  const transaction = await SubscriptionTransaction.findOne({
    providerReference: txRef,
    provider: "flutterwave",
  });
  if (!transaction) {
    return { ok: true, ignored: true, reason: "not_subscription" };
  }

  if (eventType.includes("refund") || String(data?.status || "").toLowerCase() === "refunded") {
    await revokeOrRefundEntitlement(transaction.user, {
      type: "refunded",
      reason: "flutterwave_refund",
    });
    await SubscriptionTransaction.updateOne(
      { _id: transaction._id },
      { $set: { status: "refunded" } }
    );
    return { ok: true, refunded: true };
  }

  if (eventType && eventType !== "charge.completed") {
    return { ok: true, ignored: true, reason: "event_type" };
  }

  if (!flwId) {
    return { ok: false, status: 400, message: "Missing transaction id." };
  }

  const result = await verifyAndActivateFlutterwave({
    transaction,
    providerTransactionId: flwId,
    eventSource: `webhook:${eventType || "charge.completed"}`,
  });
  return result;
};

export const handleFlutterwaveSubscriptionWebhook = async (req, res) => {
  const signature = req.get("verif-hash") || req.get("x-verif-hash");
  if (!verifyFlutterwaveWebhookSignature(signature)) {
    return res.status(401).json({
      success: false,
      message: "Invalid webhook signature.",
    });
  }

  try {
    const raw = req.body;
    const event = Buffer.isBuffer(raw)
      ? JSON.parse(raw.toString("utf8"))
      : typeof raw === "string"
        ? JSON.parse(raw)
        : raw;
    const result = await processFlutterwaveSubscriptionEvent(event);
    if (!result.ok && result.status === 503) {
      return res.status(503).json({ success: false, message: result.message });
    }
    if (!result.ok && result.status === 400) {
      return res.status(400).json({ success: false, message: result.message });
    }
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Subscription Flutterwave webhook failed", error);
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed.",
    });
  }
};

export const verifyGooglePlayPurchase = async (req, res) => {
  try {
    if (!googlePlayConfigStatus().configured) {
      return res.status(503).json({
        success: false,
        message:
          "Google Play Billing is not configured on the server. Set GOOGLE_PLAY_PACKAGE_NAME and a service account.",
      });
    }

    const purchaseToken = String(req.body.purchaseToken || "").trim();
    const productId = String(req.body.productId || "").trim();
    if (!purchaseToken || !productId) {
      return res.status(400).json({
        success: false,
        message: "productId and purchaseToken are required.",
      });
    }

    await ensureDefaultSubscriptionPlan();
    const plan =
      (await SubscriptionPlan.findOne({
        googlePlayProductId: productId,
        isActive: true,
      })) || (await SubscriptionPlan.findOne({ code: "ADFREE_MONTHLY" }));

    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found." });
    }

    const verified = await verifyGooglePlaySubscription({
      productId,
      purchaseToken,
    });
    if (!verified.ok) {
      return res.status(verified.status || 400).json({
        success: false,
        message: verified.message,
      });
    }

    const claim = await claimProviderEvent({
      provider: "google_play",
      eventType: "purchase_verify",
      eventId: `${productId}:${purchaseToken}`,
      user: req.user._id,
      providerReference: purchaseToken,
    });
    if (claim.duplicate && claim.event?.processingStatus === "processed") {
      const { public: entitlement } = await getPublicEntitlementForUser(
        req.user._id
      );
      return res.json({ success: true, entitlement, alreadyVerified: true });
    }

    let transaction = await SubscriptionTransaction.findOne({
      providerReference: `GP-${purchaseToken.slice(0, 120)}`,
    });
    if (!transaction) {
      transaction = await SubscriptionTransaction.create({
        user: req.user._id,
        plan: plan._id,
        amount: plan.price,
        currency: plan.currency,
        status: "pending",
        platform: "android",
        provider: "google_play",
        providerReference: `GP-${purchaseToken.slice(0, 120)}`,
        providerTransactionId: verified.orderId || purchaseToken,
        metadata: { productId, purchaseToken },
      });
    }

    if (verified.revoked) {
      await revokeOrRefundEntitlement(req.user._id, {
        type: "revoked",
        reason: "google_play_revoked",
      });
      await markProviderEvent(claim.event, "processed", "Revoked");
      const { public: entitlement } = await getPublicEntitlementForUser(
        req.user._id
      );
      return res.json({ success: true, entitlement });
    }

    if (!verified.active) {
      await markProviderEvent(claim.event, "ignored", "Not active");
      return res.status(400).json({
        success: false,
        message: "Google Play purchase is not an active subscription.",
      });
    }

    await activateEntitlementFromVerifiedPurchase({
      userId: req.user._id,
      plan,
      platform: "android",
      provider: "google_play",
      periodStart: verified.periodStart,
      periodEnd: verified.periodEnd,
      autoRenew: verified.autoRenewing,
      providerSubscriptionId: verified.orderId || purchaseToken,
      transactionId: transaction._id,
    });

    if (verified.acknowledgementState === 0) {
      await acknowledgeGooglePlaySubscription({ productId, purchaseToken });
    }

    if (!verified.autoRenewing) {
      await cancelEntitlementForUser(req.user._id, {
        reason: "google_play_cancel_at_period_end",
      });
    }

    await markProviderEvent(claim.event, "processed", "Activated");
    const { public: entitlement } = await getPublicEntitlementForUser(
      req.user._id
    );
    return res.json({ success: true, entitlement });
  } catch (error) {
    return sendServerError(res, error, "Failed to verify Google Play purchase.");
  }
};

export const verifyApplePurchase = async (req, res) => {
  try {
    if (!appleConfigStatus().configured) {
      return res.status(503).json({
        success: false,
        message:
          "App Store billing is not configured. Set APPLE_BUNDLE_ID, APPLE_ISSUER_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY.",
      });
    }

    const transactionId = String(
      req.body.transactionId || req.body.originalTransactionId || ""
    ).trim();
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "transactionId is required.",
      });
    }

    const verified = await verifyAppleTransaction({ transactionId });
    if (!verified.ok) {
      return res.status(verified.status || 400).json({
        success: false,
        message: verified.message,
      });
    }

    await ensureDefaultSubscriptionPlan();
    const plan =
      (await SubscriptionPlan.findOne({
        appleProductId: verified.productId,
        isActive: true,
      })) || (await SubscriptionPlan.findOne({ code: "ADFREE_MONTHLY" }));

    const claim = await claimProviderEvent({
      provider: "apple_app_store",
      eventType: "purchase_verify",
      eventId: verified.transactionId || transactionId,
      user: req.user._id,
      providerReference: verified.originalTransactionId || transactionId,
    });
    if (claim.duplicate && claim.event?.processingStatus === "processed") {
      const { public: entitlement } = await getPublicEntitlementForUser(
        req.user._id
      );
      return res.json({ success: true, entitlement, alreadyVerified: true });
    }

    let transaction = await SubscriptionTransaction.findOne({
      providerReference: `AP-${verified.originalTransactionId || transactionId}`,
    });
    if (!transaction) {
      transaction = await SubscriptionTransaction.create({
        user: req.user._id,
        plan: plan?._id || null,
        amount: plan?.price || 0,
        currency: plan?.currency || "USD",
        status: "pending",
        platform: "ios",
        provider: "apple_app_store",
        providerReference: `AP-${verified.originalTransactionId || transactionId}`,
        providerTransactionId: verified.transactionId,
        metadata: { productId: verified.productId },
      });
    }

    if (verified.revoked) {
      await revokeOrRefundEntitlement(req.user._id, {
        type: "revoked",
        reason: "apple_revocation",
      });
      await SubscriptionTransaction.updateOne(
        { _id: transaction._id },
        { $set: { status: "revoked" } }
      );
      await markProviderEvent(claim.event, "processed", "Revoked");
      const { public: entitlement } = await getPublicEntitlementForUser(
        req.user._id
      );
      return res.json({ success: true, entitlement });
    }

    if (!verified.active) {
      await markProviderEvent(claim.event, "ignored", "Not active");
      return res.status(400).json({
        success: false,
        message: "Apple purchase is not an active subscription.",
      });
    }

    await activateEntitlementFromVerifiedPurchase({
      userId: req.user._id,
      plan,
      platform: "ios",
      provider: "apple_app_store",
      periodStart: verified.periodStart,
      periodEnd: verified.periodEnd,
      autoRenew: true,
      providerSubscriptionId: verified.originalTransactionId,
      transactionId: transaction._id,
    });

    await markProviderEvent(claim.event, "processed", "Activated");
    const { public: entitlement } = await getPublicEntitlementForUser(
      req.user._id
    );
    return res.json({ success: true, entitlement });
  } catch (error) {
    return sendServerError(res, error, "Failed to verify Apple purchase.");
  }
};

export const restorePurchases = async (req, res) => {
  try {
    const platform = String(req.body.platform || "").toLowerCase();
    if (platform === "android") {
      return verifyGooglePlayPurchase(req, res);
    }
    if (platform === "ios") {
      return verifyApplePurchase(req, res);
    }

    // Web restore = refresh server entitlement (Flutterwave has no local receipt store).
    const { public: entitlement } = await getPublicEntitlementForUser(
      req.user._id
    );
    return res.json({
      success: true,
      entitlement,
      message:
        platform === "web"
          ? "Web entitlement refreshed from server records."
          : "Specify platform android or ios to restore store purchases.",
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to restore purchases.");
  }
};

export const getManageInfo = async (req, res) => {
  try {
    const { public: entitlement, entitlement: doc } =
      await getPublicEntitlementForUser(req.user._id);
    const transactions = await SubscriptionTransaction.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json({
      success: true,
      entitlement,
      transactions: transactions.map(serializeTransaction),
      management: {
        webCancelHint:
          "Canceling keeps ad-free access until the current paid period ends.",
        androidManageUrl:
          "https://play.google.com/store/account/subscriptions",
        iosManageUrl: "https://apps.apple.com/account/subscriptions",
        canRequestCancelAtPeriodEnd: Boolean(
          entitlement.adFreeActive &&
            doc?.provider === "flutterwave" &&
            !entitlement.cancelAtPeriodEnd
        ),
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load subscription management.");
  }
};

export const cancelMySubscription = async (req, res) => {
  try {
    const reason = String(req.body.reason || "user_requested").slice(0, 500);
    const { public: before } = await getPublicEntitlementForUser(req.user._id);
    if (!before.adFreeActive && before.subscriptionStatus === "none") {
      return res.status(400).json({
        success: false,
        message: "No active subscription to cancel.",
      });
    }

    await cancelEntitlementForUser(req.user._id, { reason });
    const { public: entitlement } = await getPublicEntitlementForUser(
      req.user._id
    );
    return res.json({
      success: true,
      entitlement,
      message:
        "Cancellation recorded. Ad-free access continues until the current period ends.",
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to cancel subscription.");
  }
};

export const handleGooglePlayRealtimeNotification = async (req, res) => {
  try {
    if (!googlePlayConfigStatus().configured) {
      return res.status(503).json({
        success: false,
        message: "Google Play is not configured.",
      });
    }

    let body = req.body;
    if (body?.message?.data) {
      try {
        body = JSON.parse(
          Buffer.from(body.message.data, "base64").toString("utf8")
        );
      } catch {
        /* keep original */
      }
    }

    const summary = summarizeGooglePlayNotification(body);
    const claim = await claimProviderEvent({
      provider: "google_play",
      eventType: summary.eventType,
      eventId: summary.eventId,
      providerReference: summary.purchaseToken,
    });
    if (claim.duplicate) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    if (!summary.purchaseToken || !summary.productId) {
      await markProviderEvent(claim.event, "ignored", "Missing token/sku");
      return res.status(200).json({ success: true, ignored: true });
    }

    const verified = await verifyGooglePlaySubscription({
      productId: summary.productId,
      purchaseToken: summary.purchaseToken,
    });
    if (!verified.ok) {
      await markProviderEvent(claim.event, "failed", verified.message);
      return res.status(200).json({ success: true });
    }

    const existing = await SubscriptionTransaction.findOne({
      providerReference: `GP-${summary.purchaseToken.slice(0, 120)}`,
    });
    if (!existing) {
      await markProviderEvent(claim.event, "ignored", "No linked user transaction");
      return res.status(200).json({ success: true, ignored: true });
    }

    const plan = await SubscriptionPlan.findById(existing.plan);
    if (verified.active) {
      await activateEntitlementFromVerifiedPurchase({
        userId: existing.user,
        plan,
        platform: "android",
        provider: "google_play",
        periodStart: verified.periodStart,
        periodEnd: verified.periodEnd,
        autoRenew: verified.autoRenewing,
        providerSubscriptionId: verified.orderId || summary.purchaseToken,
        transactionId: existing._id,
      });
      if (!verified.autoRenewing) {
        await cancelEntitlementForUser(existing.user, {
          reason: "google_play_notification_cancel",
        });
      }
    } else {
      await markBillingRetry(existing.user);
    }

    await markProviderEvent(claim.event, "processed", "Synced");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Google Play RTDN failed", error);
    return res.status(500).json({ success: false, message: "RTDN failed." });
  }
};

export const handleAppleServerNotification = async (req, res) => {
  try {
    if (!appleConfigStatus().configured) {
      return res.status(503).json({
        success: false,
        message: "App Store is not configured.",
      });
    }

    const summary = summarizeAppleNotification(req.body || {});
    const claim = await claimProviderEvent({
      provider: "apple_app_store",
      eventType: summary.eventType,
      eventId: summary.eventId,
      providerReference: summary.originalTransactionId || summary.transactionId,
    });
    if (claim.duplicate) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    if (!summary.transactionId && !summary.originalTransactionId) {
      await markProviderEvent(claim.event, "ignored", "No transaction id");
      return res.status(200).json({ success: true, ignored: true });
    }

    const verified = await verifyAppleTransaction({
      transactionId: summary.transactionId || summary.originalTransactionId,
    });
    if (!verified.ok) {
      await markProviderEvent(claim.event, "failed", verified.message);
      return res.status(200).json({ success: true });
    }

    const existing = await SubscriptionTransaction.findOne({
      $or: [
        {
          providerReference: `AP-${verified.originalTransactionId}`,
        },
        { providerTransactionId: verified.transactionId },
      ],
    });
    if (!existing) {
      await markProviderEvent(claim.event, "ignored", "No linked user");
      return res.status(200).json({ success: true, ignored: true });
    }

    const plan = await SubscriptionPlan.findById(existing.plan);
    const type = summary.eventType.toUpperCase();

    if (type.includes("REFUND") || verified.revoked) {
      await revokeOrRefundEntitlement(existing.user, {
        type: type.includes("REFUND") ? "refunded" : "revoked",
        reason: summary.eventType,
      });
    } else if (type.includes("DID_FAIL_TO_RENEW")) {
      await markBillingRetry(existing.user);
    } else if (type.includes("CANCEL") || type.includes("DID_CHANGE_RENEWAL_STATUS")) {
      await cancelEntitlementForUser(existing.user, {
        reason: summary.eventType,
      });
    } else if (verified.active) {
      await activateEntitlementFromVerifiedPurchase({
        userId: existing.user,
        plan,
        platform: "ios",
        provider: "apple_app_store",
        periodStart: verified.periodStart,
        periodEnd: verified.periodEnd,
        autoRenew: !type.includes("AUTO_RENEW_DISABLED"),
        providerSubscriptionId: verified.originalTransactionId,
        transactionId: existing._id,
      });
    }

    await markProviderEvent(claim.event, "processed", "Synced");
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Apple ASN failed", error);
    return res.status(500).json({ success: false, message: "ASN failed." });
  }
};

export { serializePlan, DEFAULT_PLAN };
