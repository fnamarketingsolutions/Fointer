/**
 * Pure subscription entitlement helpers (no I/O).
 * Server-authoritative ad-free status is derived from verified provider state.
 */

export const SUBSCRIPTION_STATUSES = [
  "none",
  "pending",
  "active",
  "grace",
  "canceled",
  "expired",
  "refunded",
  "revoked",
];

export const RENEWAL_STATUSES = [
  "none",
  "auto",
  "manual",
  "canceled",
  "billing_retry",
  "failed",
];

export const BILLING_PLATFORMS = ["web", "android", "ios", "admin"];

export const PAYMENT_PROVIDERS = [
  "flutterwave",
  "google_play",
  "apple_app_store",
  "admin",
];

/** Removable third-party display ad placements (not sponsored marketplace). */
export const AD_PLACEMENT_IDS = [
  "home_feed",
  "community_feed",
  "marketplace_browse",
  "feed_banner",
];

export const DEFAULT_AD_PLACEMENTS = Object.freeze(
  AD_PLACEMENT_IDS.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {})
);

const asDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Whether the account currently receives ad-free access.
 * Cancellation alone does not remove access while the paid period is active.
 */
export const isAdFreeActive = (entitlement, now = new Date()) => {
  if (!entitlement) return false;
  const status = String(entitlement.status || "").toLowerCase();
  if (status === "refunded" || status === "revoked" || status === "expired") {
    return false;
  }
  if (status === "pending" || status === "none") return false;

  const periodEnd = asDate(entitlement.currentPeriodEnd);
  if (!periodEnd) return false;
  if (periodEnd.getTime() <= now.getTime()) return false;

  return status === "active" || status === "canceled" || status === "grace";
};

export const derivePublicEntitlement = (entitlement, now = new Date()) => {
  const adFreeActive = isAdFreeActive(entitlement, now);
  const status = String(entitlement?.status || "none").toLowerCase();
  const periodEnd = asDate(entitlement?.currentPeriodEnd);

  let subscriptionStatus = status;
  if (
    (status === "active" || status === "canceled" || status === "grace") &&
    periodEnd &&
    periodEnd.getTime() <= now.getTime()
  ) {
    subscriptionStatus = "expired";
  }

  return {
    adFreeActive,
    subscriptionStatus: adFreeActive
      ? subscriptionStatus === "expired"
        ? "active"
        : subscriptionStatus
      : subscriptionStatus === "none"
        ? "none"
        : subscriptionStatus,
    currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
    currentPeriodStart: asDate(entitlement?.currentPeriodStart)?.toISOString() || null,
    renewalStatus: String(entitlement?.renewalStatus || "none"),
    cancelAtPeriodEnd: Boolean(entitlement?.cancelAtPeriodEnd),
    canceledAt: asDate(entitlement?.canceledAt)?.toISOString() || null,
    platform: entitlement?.platform || null,
    provider: entitlement?.provider || null,
    planCode: entitlement?.planCode || null,
  };
};

/**
 * Apply a verified activation/renewal window.
 * Extends from max(now, existing period end) when already active.
 */
export const applyVerifiedPeriod = (
  entitlement,
  { periodStart, periodEnd, platform, provider, planCode, planId, autoRenew = true },
  now = new Date()
) => {
  const start = asDate(periodStart) || now;
  let end = asDate(periodEnd);
  if (!end) {
    throw new Error("Verified period end is required.");
  }

  const existingEnd = asDate(entitlement?.currentPeriodEnd);
  if (
    isAdFreeActive(entitlement, now) &&
    existingEnd &&
    existingEnd.getTime() > end.getTime()
  ) {
    end = existingEnd;
  }

  return {
    ...(entitlement || {}),
    status: "active",
    renewalStatus: autoRenew ? "auto" : "manual",
    cancelAtPeriodEnd: false,
    canceledAt: null,
    cancelReason: "",
    currentPeriodStart: start,
    currentPeriodEnd: end,
    activatedAt: entitlement?.activatedAt || start,
    expiredAt: null,
    refundedAt: null,
    revokedAt: null,
    platform: platform || entitlement?.platform || "web",
    provider: provider || entitlement?.provider || "flutterwave",
    planCode: planCode || entitlement?.planCode || "",
    plan: planId || entitlement?.plan || null,
  };
};

/** Mark cancel-at-period-end; entitlement stays active until period end. */
export const applyCancellation = (entitlement, { reason = "", at = new Date() } = {}) => {
  if (!entitlement) return entitlement;
  return {
    ...entitlement,
    status: isAdFreeActive(entitlement, at) ? "canceled" : "expired",
    renewalStatus: "canceled",
    cancelAtPeriodEnd: true,
    canceledAt: asDate(at) || new Date(),
    cancelReason: String(reason || "").slice(0, 500),
  };
};

export const applyExpiryIfNeeded = (entitlement, now = new Date()) => {
  if (!entitlement) return entitlement;
  const status = String(entitlement.status || "").toLowerCase();
  if (status === "refunded" || status === "revoked" || status === "expired") {
    return entitlement;
  }
  const periodEnd = asDate(entitlement.currentPeriodEnd);
  if (!periodEnd || periodEnd.getTime() > now.getTime()) return entitlement;
  return {
    ...entitlement,
    status: "expired",
    renewalStatus:
      entitlement.renewalStatus === "canceled"
        ? "canceled"
        : entitlement.renewalStatus === "billing_retry"
          ? "failed"
          : entitlement.renewalStatus || "none",
    expiredAt: periodEnd,
    cancelAtPeriodEnd: false,
  };
};

export const applyRefundOrRevocation = (
  entitlement,
  { type = "refunded", at = new Date(), reason = "" } = {}
) => {
  const stamp = asDate(at) || new Date();
  const status = type === "revoked" ? "revoked" : "refunded";
  return {
    ...(entitlement || {}),
    status,
    renewalStatus: "none",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: stamp,
    cancelReason: String(reason || "").slice(0, 500),
    refundedAt: status === "refunded" ? stamp : entitlement?.refundedAt || null,
    revokedAt: status === "revoked" ? stamp : entitlement?.revokedAt || null,
    expiredAt: stamp,
  };
};

export const applyBillingRetry = (entitlement, now = new Date()) => {
  if (!entitlement) return entitlement;
  return {
    ...entitlement,
    status: isAdFreeActive(entitlement, now) ? "grace" : "expired",
    renewalStatus: "billing_retry",
  };
};

/**
 * Eligible third-party placements for a viewer.
 * Sponsored marketplace listings are never included here.
 */
export const resolveEligibleAdPlacements = ({
  adFreeActive,
  placementConfig = DEFAULT_AD_PLACEMENTS,
  providerConfigured = false,
} = {}) => {
  if (adFreeActive || !providerConfigured) {
    return AD_PLACEMENT_IDS.reduce((acc, id) => {
      acc[id] = false;
      return acc;
    }, {});
  }

  return AD_PLACEMENT_IDS.reduce((acc, id) => {
    acc[id] = Boolean(placementConfig?.[id]);
    return acc;
  }, {});
};

export const buildIdempotencyKey = (provider, eventType, eventId) =>
  `${String(provider || "").toLowerCase()}:${String(eventType || "").toLowerCase()}:${String(eventId || "")}`;
