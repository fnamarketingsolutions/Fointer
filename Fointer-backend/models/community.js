import mongoose from "mongoose";

export const COMMUNITY_TYPES = ["public", "private_invite", "private_request"];

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
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

const Community = mongoose.model("Community", communitySchema);

export default Community;
