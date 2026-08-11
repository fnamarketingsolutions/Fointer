import mongoose from "mongoose";

const liveEventMemberSchema = new mongoose.Schema(
  {
    liveEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiveEvent",
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

liveEventMemberSchema.index({ liveEvent: 1, user: 1 }, { unique: true });
liveEventMemberSchema.index({ user: 1, status: 1 });

const LiveEventMember = mongoose.model(
  "LiveEventMember",
  liveEventMemberSchema
);

export default LiveEventMember;
