import mongoose from "mongoose";

const userSupportRequestSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSupportCategory",
      required: true,
      index: true,
    },
    categoryName: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "resolved"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const UserSupportRequest = mongoose.model(
  "UserSupportRequest",
  userSupportRequestSchema
);

export default UserSupportRequest;
