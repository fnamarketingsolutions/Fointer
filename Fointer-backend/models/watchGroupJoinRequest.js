import mongoose from "mongoose";

const watchGroupJoinRequestSchema = new mongoose.Schema(
  {
    watchGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WatchGroup",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending",
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

watchGroupJoinRequestSchema.index(
  { watchGroup: 1, user: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

watchGroupJoinRequestSchema.index({ watchGroup: 1, status: 1 });

const WatchGroupJoinRequest = mongoose.model(
  "WatchGroupJoinRequest",
  watchGroupJoinRequestSchema
);

export default WatchGroupJoinRequest;
