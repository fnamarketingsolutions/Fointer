import mongoose from "mongoose";

const watchGroupMessageSchema = new mongoose.Schema(
  {
    watchGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WatchGroup",
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

watchGroupMessageSchema.index({ watchGroup: 1, createdAt: -1 });
watchGroupMessageSchema.index({ watchGroup: 1, status: 1, createdAt: -1 });

const WatchGroupMessage = mongoose.model(
  "WatchGroupMessage",
  watchGroupMessageSchema
);

export default WatchGroupMessage;
