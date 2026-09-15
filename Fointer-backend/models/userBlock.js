import mongoose from "mongoose";

/**
 * One-way user block: blocker cannot be messaged by blocked,
 * and neither side can start/send DMs while the block exists.
 */
const userBlockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

userBlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

const UserBlock = mongoose.model("UserBlock", userBlockSchema);

export default UserBlock;
