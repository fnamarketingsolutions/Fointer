import mongoose from "mongoose";
import { shortCodeField, withShortCode } from "../utils/shortCode.js";
import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
} from "./listing.js";

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    type: { type: String, enum: ["image", "video"], required: true },
  },
  { _id: false }
);

const freeListingSchema = new mongoose.Schema(
  {
    shortCode: shortCodeField,
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    price: { type: Number, default: 0, min: 0 },
    pricing: { type: String, enum: ["free"], default: "free", immutable: true },
    currency: { type: String, default: "USD", trim: true, maxlength: 3 },
    category: {
      type: String,
      enum: LISTING_CATEGORIES,
      default: "other",
      index: true,
    },
    condition: { type: String, enum: LISTING_CONDITIONS, default: "good" },
    city: { type: String, default: "", trim: true, maxlength: 100 },
    state: { type: String, default: "", trim: true, maxlength: 100 },
    country: { type: String, default: "", trim: true, maxlength: 100 },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
      index: true,
    },
    storeCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreCategory",
      default: null,
    },
    media: { type: [mediaSchema], default: [] },
    status: {
      type: String,
      enum: LISTING_STATUSES,
      default: "active",
      index: true,
    },
    soldAt: { type: Date, default: null },
    removedAt: { type: Date, default: null },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    hiddenAt: { type: Date, default: null },
    hiddenReason: {
      type: String,
      enum: ["account_ban", "admin", null],
      default: null,
    },
  },
  { timestamps: true }
);

freeListingSchema.index({ title: "text", description: "text" });
freeListingSchema.index({ createdAt: -1 });
freeListingSchema.index({ status: 1, createdAt: -1 });
freeListingSchema.index({ status: 1, category: 1, createdAt: -1 });
freeListingSchema.index({ seller: 1, status: 1, createdAt: -1 });
freeListingSchema.index({ store: 1, status: 1, createdAt: -1 });

withShortCode(freeListingSchema);

const FreeListing = mongoose.model("FreeListing", freeListingSchema);

export default FreeListing;
