import mongoose from "mongoose";
import { shortCodeField, withShortCode } from "../utils/shortCode.js";

export const LIVE_EVENT_CATEGORIES = [
  "sports",
  "entertainment",
  "news",
  "custom",
];
export const LIVE_EVENT_ACCESS = ["public", "community_restricted"];

const liveEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    shortCode: shortCodeField,
    category: {
      type: String,
      enum: LIVE_EVENT_CATEGORIES,
      required: true,
      default: "custom",
    },
    access: {
      type: String,
      enum: LIVE_EVENT_ACCESS,
      required: true,
      default: "community_restricted",
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "ended", "closed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

liveEventSchema.index({ community: 1, createdAt: -1 });
liveEventSchema.index({ status: 1, createdAt: -1 });
withShortCode(liveEventSchema);

const LiveEvent = mongoose.model("LiveEvent", liveEventSchema);

export default LiveEvent;
