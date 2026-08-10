import mongoose from "mongoose";
import { shortCodeField, withShortCode } from "../utils/shortCode.js";

export const WATCH_GROUP_TYPES = ["public", "private"];

const DEFAULT_MAX = 50;
const ABSOLUTE_MAX = 200;

const watchGroupSchema = new mongoose.Schema(
  {
    shortCode: shortCodeField,
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    type: {
      type: String,
      enum: WATCH_GROUP_TYPES,
      required: true,
      default: "public",
    },
    maxParticipants: {
      type: Number,
      default: DEFAULT_MAX,
      min: 2,
      max: ABSOLUTE_MAX,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

watchGroupSchema.index({ type: 1, createdAt: -1 });
watchGroupSchema.index({ name: "text" });

withShortCode(watchGroupSchema);

export const WATCH_GROUP_DEFAULT_MAX = DEFAULT_MAX;
export const WATCH_GROUP_ABSOLUTE_MAX = ABSOLUTE_MAX;

const WatchGroup = mongoose.model("WatchGroup", watchGroupSchema);

export default WatchGroup;
