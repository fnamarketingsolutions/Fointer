import mongoose from "mongoose";
import { shortCodeField, withShortCode } from "../utils/shortCode.js";
import { LISTING_CATEGORIES } from "./listing.js";
import { STORE_PLAN_CODES, DEFAULT_STORE_PLAN_CODE } from "../utils/storePlanCatalog.js";

export const STORE_STATUSES = ["active", "suspended"];

const storeSchema = new mongoose.Schema(
  {
    shortCode: shortCodeField,
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 60,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    logo: {
      type: String,
      default: "",
      trim: true,
    },
    coverImage: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      enum: LISTING_CATEGORIES,
      required: true,
      index: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    state: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    contactPhone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 32,
    },
    contactEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    status: {
      type: String,
      enum: STORE_STATUSES,
      default: "active",
      index: true,
    },
    planCode: {
      type: String,
      enum: STORE_PLAN_CODES,
      default: DEFAULT_STORE_PLAN_CODE,
      uppercase: true,
    },
    followerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

withShortCode(storeSchema);

storeSchema.index({ owner: 1, createdAt: -1 });
storeSchema.index({ status: 1, createdAt: -1 });

const Store = mongoose.model("Store", storeSchema);

export default Store;
