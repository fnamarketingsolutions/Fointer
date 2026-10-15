import mongoose from "mongoose";
import { PAYMENT_PROVIDERS } from "../utils/subscriptionEntitlement.js";

/**
 * Idempotent audit log for provider webhooks / store notifications.
 * Unique idempotencyKey prevents double activation.
 */
const subscriptionProviderEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionTransaction",
      default: null,
    },
    providerReference: { type: String, default: "", index: true },
    processingStatus: {
      type: String,
      enum: ["received", "processed", "ignored", "failed"],
      default: "received",
      index: true,
    },
    resultMessage: { type: String, default: "", maxlength: 500 },
    payloadDigest: { type: String, default: "", maxlength: 128 },
  },
  { timestamps: true }
);

subscriptionProviderEventSchema.index({ createdAt: -1 });

const SubscriptionProviderEvent = mongoose.model(
  "SubscriptionProviderEvent",
  subscriptionProviderEventSchema
);

export default SubscriptionProviderEvent;
