import mongoose from "mongoose";
import { shortCodeField, withShortCode } from "../utils/shortCode.js";

export const LIVE_EVENT_CATEGORIES = [
  "sports",
  "entertainment",
  "news",
  "custom",
];

export const LIVE_EVENT_ACCESS = ["public", "community"];

export const LIVE_EVENT_STATUS = ["live", "ended"];

const liveEventSchema = new mongoose.Schema(
  {
    shortCode: shortCodeField,
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    category: {
      type: String,
      enum: LIVE_EVENT_CATEGORIES,
      required: true,
    },
    customCategory: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },
    access: {
      type: String,
      enum: LIVE_EVENT_ACCESS,
      required: true,
      default: "community",
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: LIVE_EVENT_STATUS,
      default: "live",
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

liveEventSchema.index({ status: 1, createdAt: -1 });
liveEventSchema.index({ community: 1, status: 1 });

withShortCode(liveEventSchema);

const LiveEvent = mongoose.model("LiveEvent", liveEventSchema);

export default LiveEvent;
