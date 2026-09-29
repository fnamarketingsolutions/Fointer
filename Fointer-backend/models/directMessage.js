import mongoose from "mongoose";

const listingSnapshotSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
    shortCode: { type: String, default: "" },
    title: { type: String, default: "" },
    price: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    imageUrl: { type: String, default: "" },
  },
  { _id: false }
);

const postSnapshotSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    shortCode: { type: String, default: "" },
    title: { type: String, default: "" },
    text: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: "Community" },
    communityShortCode: { type: String, default: "" },
    communityName: { type: String, default: "" },
  },
  { _id: false }
);

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

const callSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["audio", "video"],
      default: "audio",
    },
    status: {
      type: String,
      enum: ["completed", "missed", "rejected", "cancelled"],
      required: true,
    },
    durationSec: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const directMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["text", "media", "call", "system"],
      default: "text",
    },
    text: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    media: {
      type: [mediaSchema],
      default: [],
    },
    call: {
      type: callSchema,
      default: null,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DirectMessage",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    listing: {
      type: listingSnapshotSchema,
      default: null,
    },
    post: {
      type: postSnapshotSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

directMessageSchema.index({ conversation: 1, createdAt: 1 });

const DirectMessage = mongoose.model("DirectMessage", directMessageSchema);

export default DirectMessage;
