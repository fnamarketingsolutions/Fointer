import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 64,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: "USD",
    },
    billingPeriodDays: {
      type: Number,
      required: true,
      min: 1,
      max: 366,
      default: 30,
    },
    /** Removes designated third-party display ads only. */
    removesThirdPartyAds: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    /** Flutterwave payment plan id when recurring billing is configured. */
    flutterwavePaymentPlanId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    googlePlayProductId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    appleProductId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index({ isActive: 1, displayOrder: 1 });

const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema
);

export default SubscriptionPlan;
