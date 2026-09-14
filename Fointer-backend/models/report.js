import mongoose from "mongoose";

export const REPORT_TARGET_TYPES = ["post", "comment", "listing", "conversation"];

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "sexual_content",
  "hate_speech",
  "violence",
  "misinformation",
  "other",
];

export const REPORT_STATUSES = [
  "pending",
  "reviewed",
  "actioned",
  "dismissed",
];

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: REPORT_TARGET_TYPES,
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
    },
    details: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: "pending",
      index: true,
    },
    /** Snapshot so admins can still review after content is deleted */
    snapshot: {
      title: { type: String, default: "" },
      text: { type: String, default: "" },
      authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      authorName: { type: String, default: "" },
      communityName: { type: String, default: "" },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    listingPrice: { type: Number, default: null },
    listingCurrency: { type: String, default: "" },
    listingImageUrl: { type: String, default: "" },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    messages: {
      type: [
        {
          authorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
          },
          authorName: { type: String, default: "" },
          text: { type: String, default: "" },
          createdAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    actionTaken: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

reportSchema.index(
  { reporter: 1, targetType: 1, targetId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
