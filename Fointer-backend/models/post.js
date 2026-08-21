import mongoose from "mongoose";
import { shortCodeField, withShortCode } from "../utils/shortCode.js";

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

const postSchema = new mongoose.Schema(
  {
    shortCode: shortCodeField,
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: false,
      default: null,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    media: {
      type: [mediaSchema],
      default: [],
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    reshareCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

postSchema.index({ title: "text", text: "text" });
postSchema.index({ community: 1, createdAt: -1 });
postSchema.index({ community: 1, likeCount: -1, createdAt: -1 });
postSchema.index({ community: 1, commentCount: -1, createdAt: -1 });

withShortCode(postSchema);

const Post = mongoose.model("Post", postSchema);

export default Post;