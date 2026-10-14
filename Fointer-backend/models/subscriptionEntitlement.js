import mongoose from "mongoose";
import {
  BILLING_PLATFORMS,
  PAYMENT_PROVIDERS,
  RENEWAL_STATUSES,
  SUBSCRIPTION_STATUSES,
} from "../utils/subscriptionEntitlement.js";

/**
 * One authoritative entitlement document per Fointer user account.
 * Clients must never invent adFreeActive — always derive via API.
 */
const subscriptionEntitlementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
    },
    planCode: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
      maxlength: 64,
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: "none",
      index: true,
    },
    renewalStatus: {
      type: String,
      enum: RENEWAL_STATUSES,
      default: "none",
    },
    platform: {
      type: String,
      enum: BILLING_PLATFORMS,
      default: undefined,
    },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      default: undefined,
    },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null, index: true },
    activatedAt: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelReason: { type: String, default: "", maxlength: 500 },
    expiredAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    /** Latest verified store / provider subscription id when available. */
    providerSubscriptionId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
      index: true,
    },
    lastVerifiedAt: { type: Date, default: null },
    lastSyncError: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

subscriptionEntitlementSchema.index({ status: 1, currentPeriodEnd: 1 });

const SubscriptionEntitlement = mongoose.model(
  "SubscriptionEntitlement",
  subscriptionEntitlementSchema
);

export default SubscriptionEntitlement;
