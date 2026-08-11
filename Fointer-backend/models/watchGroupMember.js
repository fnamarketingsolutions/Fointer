import mongoose from "mongoose";

const watchGroupMemberSchema = new mongoose.Schema(
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
    role: {
      type: String,
      enum: ["owner", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["active", "removed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

watchGroupMemberSchema.index({ watchGroup: 1, user: 1 }, { unique: true });
watchGroupMemberSchema.index({ user: 1, status: 1 });

const WatchGroupMember = mongoose.model(
  "WatchGroupMember",
  watchGroupMemberSchema
);

export default WatchGroupMember;
