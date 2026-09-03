import mongoose from "mongoose";
import { shortCodeField, withShortCode } from "../utils/shortCode.js";

export const LISTING_CATEGORIES = [
  "electronics",
  "vehicles",
  "furniture",
  "clothing",
  "sports",
  "books",
  "toys",
  "home_garden",
  "health_beauty",
  "services",
  "other",
];

export const LISTING_CONDITIONS = [
  "new",
  "like_new",
  "good",
  "fair",
  "poor",
];

export const LISTING_STATUSES = ["active", "sold", "draft", "removed"];

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    type: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
  },
  { _id: false }
);

const listingSchema = new mongoose.Schema(
  {
    shortCode: shortCodeField,
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    currency: {
      type: String,
      default: "USD",
      trim: true,
      maxlength: 3,
    },
    category: {
      type: String,
      enum: LISTING_CATEGORIES,
      default: "other",
      index: true,
    },
    condition: {
      type: String,
      enum: LISTING_CONDITIONS,
      default: "good",
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
      default: "",
      trim: true,
      maxlength: 100,
    },
    media: {
      type: [mediaSchema],
      default: [],
    },
    status: {
      type: String,
      enum: LISTING_STATUSES,
      default: "active",
      index: true,
    },
    soldAt: {
      type: Date,
      default: null,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

listingSchema.index({ title: "text", description: "text" });
listingSchema.index({ createdAt: -1 });
listingSchema.index({ status: 1, createdAt: -1 });
listingSchema.index({ status: 1, category: 1, createdAt: -1 });
listingSchema.index({ status: 1, price: 1, createdAt: -1 });
listingSchema.index({ seller: 1, status: 1, createdAt: -1 });

withShortCode(listingSchema);

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
