import mongoose from "mongoose";

const communityInviteSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },
    inviter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invitee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
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

communityInviteSchema.index(
  { community: 1, invitee: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

const CommunityInvite = mongoose.model("CommunityInvite", communityInviteSchema);

export default CommunityInvite;
