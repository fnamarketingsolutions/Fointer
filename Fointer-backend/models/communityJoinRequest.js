import mongoose from "mongoose";

const communityJoinRequestSchema = new mongoose.Schema(
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

communityJoinRequestSchema.index(
  { community: 1, user: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

const CommunityJoinRequest = mongoose.model(
  "CommunityJoinRequest",
  communityJoinRequestSchema
);

export default CommunityJoinRequest;
