import mongoose from "mongoose";

const liveEventMessageSchema = new mongoose.Schema(
  {
    liveEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiveEvent",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "deleted"],
      default: "active",
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
  },
  { timestamps: true }
);

liveEventMessageSchema.index({ liveEvent: 1, createdAt: -1 });
liveEventMessageSchema.index({ liveEvent: 1, status: 1, createdAt: -1 });

const LiveEventMessage = mongoose.model(
  "LiveEventMessage",
  liveEventMessageSchema
);

export default LiveEventMessage;
