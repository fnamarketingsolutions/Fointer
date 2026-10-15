import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCancellation,
  applyExpiryIfNeeded,
  applyRefundOrRevocation,
  applyVerifiedPeriod,
  buildIdempotencyKey,
  derivePublicEntitlement,
  isAdFreeActive,
  resolveEligibleAdPlacements,
} from "./subscriptionEntitlement.js";

const now = new Date("2026-06-15T12:00:00.000Z");

test("verified purchase activates ad-free until period end", () => {
  const next = applyVerifiedPeriod(
    null,
    {
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-01T00:00:00.000Z"),
      platform: "web",
      provider: "flutterwave",
      planCode: "ADFREE_MONTHLY",
    },
    now
  );
  assert.equal(next.status, "active");
  assert.equal(isAdFreeActive(next, now), true);
  const pub = derivePublicEntitlement(next, now);
  assert.equal(pub.adFreeActive, true);
  assert.equal(pub.subscriptionStatus, "active");
});

test("cancellation keeps access until paid period ends", () => {
  const active = applyVerifiedPeriod(
    null,
    {
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-01T00:00:00.000Z"),
      platform: "android",
      provider: "google_play",
      planCode: "ADFREE_MONTHLY",
    },
    now
  );
  const canceled = applyCancellation(active, {
    reason: "user",
    at: now,
  });
  assert.equal(canceled.status, "canceled");
  assert.equal(canceled.cancelAtPeriodEnd, true);
  assert.equal(isAdFreeActive(canceled, now), true);
  assert.equal(isAdFreeActive(canceled, new Date("2026-07-02T00:00:00.000Z")), false);
});

test("expiry after period end removes ad-free", () => {
  const active = {
    status: "active",
    currentPeriodEnd: new Date("2026-06-10T00:00:00.000Z"),
    renewalStatus: "auto",
  };
  const expired = applyExpiryIfNeeded(active, now);
  assert.equal(expired.status, "expired");
  assert.equal(isAdFreeActive(expired, now), false);
});

test("refund and revocation immediately remove ad-free", () => {
  const active = applyVerifiedPeriod(
    null,
    {
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-01T00:00:00.000Z"),
      platform: "ios",
      provider: "apple_app_store",
      planCode: "ADFREE_MONTHLY",
    },
    now
  );
  const refunded = applyRefundOrRevocation(active, {
    type: "refunded",
    at: now,
  });
  assert.equal(refunded.status, "refunded");
  assert.equal(isAdFreeActive(refunded, now), false);

  const revoked = applyRefundOrRevocation(active, {
    type: "revoked",
    at: now,
  });
  assert.equal(revoked.status, "revoked");
  assert.equal(isAdFreeActive(revoked, now), false);
});

test("cross-platform entitlement is account-scoped not device-scoped", () => {
  const fromAndroid = applyVerifiedPeriod(
    null,
    {
      periodStart: now,
      periodEnd: new Date("2026-07-15T00:00:00.000Z"),
      platform: "android",
      provider: "google_play",
      planCode: "ADFREE_MONTHLY",
    },
    now
  );
  const pub = derivePublicEntitlement(fromAndroid, now);
  assert.equal(pub.adFreeActive, true);
  assert.equal(pub.platform, "android");
  // Same public shape is what web/iOS clients consume for the same user.
  assert.ok("renewalStatus" in pub);
  assert.ok("currentPeriodEnd" in pub);
});

test("duplicate provider events share a stable idempotency key", () => {
  const a = buildIdempotencyKey("flutterwave", "client_verify", "tx-1");
  const b = buildIdempotencyKey("flutterwave", "client_verify", "tx-1");
  assert.equal(a, b);
  assert.notEqual(
    a,
    buildIdempotencyKey("flutterwave", "webhook:charge.completed", "tx-1")
  );
});

test("ad placements hide only third-party display ads when ad-free", () => {
  const free = resolveEligibleAdPlacements({
    adFreeActive: true,
    providerConfigured: true,
    placementConfig: {
      home_feed: true,
      community_feed: true,
      marketplace_browse: true,
      feed_banner: true,
    },
  });
  assert.equal(free.home_feed, false);
  assert.equal(free.marketplace_browse, false);

  const shown = resolveEligibleAdPlacements({
    adFreeActive: false,
    providerConfigured: true,
    placementConfig: {
      home_feed: true,
      community_feed: false,
      marketplace_browse: true,
      feed_banner: true,
    },
  });
  assert.equal(shown.home_feed, true);
  assert.equal(shown.community_feed, false);
  assert.equal(shown.marketplace_browse, true);

  const unconfigured = resolveEligibleAdPlacements({
    adFreeActive: false,
    providerConfigured: false,
    placementConfig: { home_feed: true },
  });
  assert.equal(unconfigured.home_feed, false);
});

test("client booleans alone cannot invent entitlement", () => {
  assert.equal(isAdFreeActive({ status: "none", currentPeriodEnd: null }, now), false);
  assert.equal(
    isAdFreeActive(
      { status: "pending", currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z") },
      now
    ),
    false
  );
  // Manipulated client-style payload without verified period end
  assert.equal(isAdFreeActive({ status: "active" }, now), false);
});
