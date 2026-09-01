import mongoose from "mongoose";

const communityMemberSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "moderator", "member"],
      default: "member",
    },
    moderatorExpiresAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "banned"],
      default: "active",
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    bannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

communityMemberSchema.index({ community: 1, user: 1 }, { unique: true });
communityMemberSchema.index({ community: 1, status: 1 });
communityMemberSchema.index({ user: 1, status: 1 });

/** Effective role after temp-moderator expiry */
communityMemberSchema.methods.getEffectiveRole = function () {
  if (this.status !== "active") return null;
  if (
    this.role === "moderator" &&
    this.moderatorExpiresAt &&
    new Date(this.moderatorExpiresAt) < new Date()
  ) {
    return "member";
  }
  return this.role;
};

const CommunityMember = mongoose.model(
  "CommunityMember",
  communityMemberSchema
);

export default CommunityMember;
