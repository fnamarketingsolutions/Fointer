import mongoose from "mongoose";
import { shortCodeField, withShortCode } from "../utils/shortCode.js";

export const WATCH_GROUP_TYPES = ["public", "private"];
export const DEFAULT_MAX_PARTICIPANTS = 50;
export const ABSOLUTE_MAX_PARTICIPANTS = 50;

const watchGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    shortCode: shortCodeField,
    type: {
      type: String,
      enum: WATCH_GROUP_TYPES,
      required: true,
      default: "public",
    },
    maxParticipants: {
      type: Number,
      default: DEFAULT_MAX_PARTICIPANTS,
      min: 2,
      max: ABSOLUTE_MAX_PARTICIPANTS,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "paused", "closed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

watchGroupSchema.index({ community: 1, createdAt: -1 });
withShortCode(watchGroupSchema);

const WatchGroup = mongoose.model("WatchGroup", watchGroupSchema);

export default WatchGroup;
