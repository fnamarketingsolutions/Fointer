import mongoose from "mongoose";

export const PUSH_PLATFORMS = ["web", "android", "ios"];

const pushDeviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4096,
    },
    platform: {
      type: String,
      enum: PUSH_PLATFORMS,
      required: true,
    },
    deviceId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 128,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

pushDeviceSchema.index({ token: 1 }, { unique: true });
pushDeviceSchema.index({ user: 1, platform: 1, deviceId: 1 });

const PushDevice = mongoose.model("PushDevice", pushDeviceSchema);

export default PushDevice;
