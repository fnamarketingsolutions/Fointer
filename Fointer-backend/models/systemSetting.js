import mongoose from "mongoose";

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },
    postEditWindowMinutes: {
      type: Number,
      default: 60,
      min: 1,
      max: 10080,
    },
    contactEmail: {
      type: String,
      default: "",
      trim: true,
      maxlength: 254,
    },
    contactPhone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 32,
    },
  },
  {
    timestamps: true,
  }
);

const SystemSetting = mongoose.model("SystemSetting", systemSettingSchema);

export default SystemSetting;
