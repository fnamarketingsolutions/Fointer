import SubscriptionEntitlement from "../../models/subscriptionEntitlement.js";
import SubscriptionTransaction from "../../models/subscriptionTransaction.js";
import SubscriptionProviderEvent from "../../models/subscriptionProviderEvent.js";
import {
  applyBillingRetry,
  applyCancellation,
  applyExpiryIfNeeded,
  applyRefundOrRevocation,
  applyVerifiedPeriod,
  buildIdempotencyKey,
  derivePublicEntitlement,
  isAdFreeActive,
} from "../../utils/subscriptionEntitlement.js";

const toPlain = (doc) => (doc?.toObject ? doc.toObject() : doc);

export const getOrCreateEntitlement = async (userId) => {
  let entitlement = await SubscriptionEntitlement.findOne({ user: userId });
  if (!entitlement) {
    try {
      entitlement = await SubscriptionEntitlement.create({
        user: userId,
        status: "none",
        renewalStatus: "none",
      });
    } catch (error) {
      if (error?.code === 11000) {
        entitlement = await SubscriptionEntitlement.findOne({ user: userId });
      } else {
        throw error;
      }
    }
  }
  return entitlement;
};

export const refreshEntitlementDocument = async (entitlement, now = new Date()) => {
  if (!entitlement) return null;
  const next = applyExpiryIfNeeded(toPlain(entitlement), now);
  if (next.status !== entitlement.status) {
    entitlement.status = next.status;
    entitlement.renewalStatus = next.renewalStatus;
    entitlement.expiredAt = next.expiredAt;
    entitlement.cancelAtPeriodEnd = next.cancelAtPeriodEnd;
    await entitlement.save();
  }
  return entitlement;
};

export const getPublicEntitlementForUser = async (userId, now = new Date()) => {
  const entitlement = await refreshEntitlementDocument(
    await getOrCreateEntitlement(userId),
    now
  );
  return {
    entitlement,
    public: derivePublicEntitlement(toPlain(entitlement), now),
    adFreeActive: isAdFreeActive(toPlain(entitlement), now),
  };
};

/**
 * Record a provider event once. Returns { duplicate, event }.
 */
export const claimProviderEvent = async ({
  provider,
  eventType,
  eventId,
  user = null,
  transaction = null,
  providerReference = "",
  payloadDigest = "",
}) => {
  const idempotencyKey = buildIdempotencyKey(provider, eventType, eventId);
  try {
    const event = await SubscriptionProviderEvent.create({
      provider,
      eventType,
      eventId: String(eventId),
      idempotencyKey,
      user,
      transaction,
      providerReference,
      payloadDigest,
      processingStatus: "received",
    });
    return { duplicate: false, event };
  } catch (error) {
    if (error?.code === 11000) {
      const event = await SubscriptionProviderEvent.findOne({ idempotencyKey });
      return { duplicate: true, event };
    }
    throw error;
  }
};

export const markProviderEvent = async (event, status, message = "") => {
  if (!event) return null;
  event.processingStatus = status;
  event.resultMessage = String(message || "").slice(0, 500);
  await event.save();
  return event;
};

export const activateEntitlementFromVerifiedPurchase = async ({
  userId,
  plan,
  platform,
  provider,
  periodStart,
  periodEnd,
  autoRenew = true,
  providerSubscriptionId = "",
  transactionId = null,
  now = new Date(),
}) => {
  const entitlement = await getOrCreateEntitlement(userId);
  const next = applyVerifiedPeriod(
    toPlain(entitlement),
    {
      periodStart,
      periodEnd,
      platform,
      provider,
      planCode: plan?.code,
      planId: plan?._id || plan?.id || null,
      autoRenew,
    },
    now
  );

  entitlement.status = next.status;
  entitlement.renewalStatus = next.renewalStatus;
  entitlement.cancelAtPeriodEnd = next.cancelAtPeriodEnd;
  entitlement.canceledAt = next.canceledAt;
  entitlement.cancelReason = next.cancelReason || "";
  entitlement.currentPeriodStart = next.currentPeriodStart;
  entitlement.currentPeriodEnd = next.currentPeriodEnd;
  entitlement.activatedAt = next.activatedAt;
  entitlement.expiredAt = next.expiredAt;
  entitlement.refundedAt = next.refundedAt;
  entitlement.revokedAt = next.revokedAt;
  entitlement.platform = next.platform;
  entitlement.provider = next.provider;
  entitlement.planCode = next.planCode;
  entitlement.plan = next.plan;
  if (providerSubscriptionId) {
    entitlement.providerSubscriptionId = String(providerSubscriptionId).slice(0, 240);
  }
  entitlement.lastVerifiedAt = now;
  entitlement.lastSyncError = "";
  await entitlement.save();

  if (transactionId) {
    await SubscriptionTransaction.updateOne(
      { _id: transactionId },
      {
        $set: {
          status: "verified",
          entitlement: entitlement._id,
          periodStart: entitlement.currentPeriodStart,
          periodEnd: entitlement.currentPeriodEnd,
        },
      }
    );
  }

  return entitlement;
};

export const cancelEntitlementForUser = async (userId, { reason = "", at = new Date() } = {}) => {
  const entitlement = await getOrCreateEntitlement(userId);
  const next = applyCancellation(toPlain(entitlement), { reason, at });
  Object.assign(entitlement, {
    status: next.status,
    renewalStatus: next.renewalStatus,
    cancelAtPeriodEnd: next.cancelAtPeriodEnd,
    canceledAt: next.canceledAt,
    cancelReason: next.cancelReason,
  });
  await entitlement.save();
  return entitlement;
};

export const revokeOrRefundEntitlement = async (
  userId,
  { type = "refunded", reason = "", at = new Date() } = {}
) => {
  const entitlement = await getOrCreateEntitlement(userId);
  const next = applyRefundOrRevocation(toPlain(entitlement), { type, reason, at });
  Object.assign(entitlement, {
    status: next.status,
    renewalStatus: next.renewalStatus,
    cancelAtPeriodEnd: next.cancelAtPeriodEnd,
    currentPeriodEnd: next.currentPeriodEnd,
    cancelReason: next.cancelReason,
    refundedAt: next.refundedAt,
    revokedAt: next.revokedAt,
    expiredAt: next.expiredAt,
  });
  await entitlement.save();
  return entitlement;
};

export const markBillingRetry = async (userId, now = new Date()) => {
  const entitlement = await getOrCreateEntitlement(userId);
  const next = applyBillingRetry(toPlain(entitlement), now);
  entitlement.status = next.status;
  entitlement.renewalStatus = next.renewalStatus;
  await entitlement.save();
  return entitlement;
};

export const serializeTransaction = (row) => ({
  id: String(row._id),
  status: row.status,
  amount: row.amount,
  currency: row.currency,
  platform: row.platform,
  provider: row.provider,
  providerReference: row.providerReference,
  providerTransactionId: row.providerTransactionId || "",
  periodStart: row.periodStart,
  periodEnd: row.periodEnd,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
