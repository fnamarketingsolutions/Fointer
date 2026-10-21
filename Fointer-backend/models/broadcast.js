import mongoose from "mongoose";

const broadcastSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["sending", "sent", "failed"],
      default: "sending",
    },
    recipientCount: {
      type: Number,
      default: 0,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    error: {
      type: String,
      default: "",
      maxlength: 300,
    },
  },
  { timestamps: true }
);

broadcastSchema.index({ createdAt: -1 });

const Broadcast = mongoose.model("Broadcast", broadcastSchema);

export default Broadcast;
