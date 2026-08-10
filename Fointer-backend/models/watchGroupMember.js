import mongoose from "mongoose";

export const WATCH_GROUP_ROLES = ["owner", "moderator", "member"];
export const WATCH_GROUP_MEMBER_STATUS = ["active", "removed"];

const watchGroupMemberSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WatchGroup",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: WATCH_GROUP_ROLES,
      default: "member",
    },
    status: {
      type: String,
      enum: WATCH_GROUP_MEMBER_STATUS,
      default: "active",
      index: true,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

watchGroupMemberSchema.index({ group: 1, user: 1 }, { unique: true });
watchGroupMemberSchema.index({ group: 1, status: 1 });

const WatchGroupMember = mongoose.model(
  "WatchGroupMember",
  watchGroupMemberSchema
);

export default WatchGroupMember;
