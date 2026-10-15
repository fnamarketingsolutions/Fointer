import mongoose from "mongoose";
import {
  BILLING_PLATFORMS,
  PAYMENT_PROVIDERS,
} from "../utils/subscriptionEntitlement.js";

const subscriptionTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
    },
    entitlement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionEntitlement",
      default: null,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    status: {
      type: String,
      enum: [
        "initiated",
        "pending",
        "verified",
        "failed",
        "refunded",
        "revoked",
        "canceled",
      ],
      default: "initiated",
      index: true,
    },
    platform: {
      type: String,
      enum: BILLING_PLATFORMS,
      required: true,
    },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
    },
    /** Merchant / client reference (unique per provider attempt). */
    providerReference: {
      type: String,
      required: true,
      unique: true,
    },
    /** Provider transaction / order / purchase token id. */
    providerTransactionId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
      index: true,
    },
    paymentLink: { type: String, default: "" },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    failureReason: { type: String, default: "", maxlength: 500 },
    rawVerificationSummary: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

subscriptionTransactionSchema.index({ user: 1, createdAt: -1 });
subscriptionTransactionSchema.index({ provider: 1, providerTransactionId: 1 });
subscriptionTransactionSchema.index({ status: 1, createdAt: -1 });

const SubscriptionTransaction = mongoose.model(
  "SubscriptionTransaction",
  subscriptionTransactionSchema
);

export default SubscriptionTransaction;
