import mongoose from "mongoose";
import { STORE_PLAN_CODES } from "../utils/storePlanCatalog.js";

const storePlanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      enum: STORE_PLAN_CODES,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    maxActiveProducts: {
      type: Number,
      required: true,
      min: 1,
      max: 100000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
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
    isActive: {
      type: Boolean,
      default: true,
    },
    /** False until storefront subscription checkout is switched on. */
    isPurchasable: {
      type: Boolean,
      default: false,
    },
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

storePlanSchema.index({ isActive: 1, displayOrder: 1 });

const StorePlan = mongoose.model("StorePlan", storePlanSchema);

export default StorePlan;
