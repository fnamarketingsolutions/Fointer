import mongoose from "mongoose";

const watchGroupMessageSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WatchGroup",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

watchGroupMessageSchema.index({ group: 1, createdAt: 1 });

const WatchGroupMessage = mongoose.model(
  "WatchGroupMessage",
  watchGroupMessageSchema
);

export default WatchGroupMessage;
