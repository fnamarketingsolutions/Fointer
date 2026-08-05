import mongoose from "mongoose";
import { shortCodeField, withShortCode } from "../utils/shortCode.js";

export const COMMUNITY_TYPES = ["public", "private_invite", "private_request"];

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    shortCode: shortCodeField,
    description: {
      type: String,
      default: "",
      trim: true,
    },
    rules: {
      type: String,
      default: "",
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    coverImage: {
      type: String,
      default: "",
      trim: true,
    },
    galleryImages: {
      type: [String],
      default: [],
    },
    type: {
      type: String,
      enum: COMMUNITY_TYPES,
      required: true,
      default: "public",
    },
    channel: {
      type: String,
      default: "",
      trim: true,
    },
    subchannels: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
      validate: {
        validator(value) {
          if (!Array.isArray(value)) return false;
          if (value.length === 0) return true;
          return value.length >= 1 && value.length <= 5;
        },
        message: "Select between 1 and 5 subchannels.",
      },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

withShortCode(communitySchema);

const Community = mongoose.model("Community", communitySchema);

export default Community;
