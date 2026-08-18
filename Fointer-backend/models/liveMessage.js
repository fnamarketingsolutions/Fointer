import mongoose from "mongoose";

const liveMessageSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiveEvent",
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

liveMessageSchema.index({ event: 1, createdAt: 1 });

const LiveMessage = mongoose.model("LiveMessage", liveMessageSchema);

export default LiveMessage;
