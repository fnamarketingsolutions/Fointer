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
    contactAddress: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
    },
    bannedKeywords: {
      type: [String],
      default: [],
    },
    watchGroupMaxCapacity: {
      type: Number,
      default: 50,
      min: 2,
      max: 200,
    },
    communitySponsoredCommissionPercent: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },

    /** After this many platform warnings, auto-ban (if enabled). */
    maxWarningsBeforeBan: {
      type: Number,
      default: 3,
      min: 1,
      max: 20,
    },

    /** When true, issuing the Nth warning bans the account automatically. */
    autoBanOnMaxWarnings: {
      type: Boolean,
      default: true,
    },

    watermarkEnabled: {
      type: Boolean,
      default: true,
    },
    watermarkOpacity: {
      type: Number,
      default: 60,
      min: 40,
      max: 80,
    },
    watermarkSizePercent: {
      type: Number,
      default: 26,
      min: 12,
      max: 40,
    },
    watermarkPosition: {
      type: String,
      enum: ["bottom-right", "bottom-left", "top-right", "top-left", "center"],
      default: "bottom-right",
    },
    watermarkMarginPercent: {
      type: Number,
      default: 4,
      min: 2,
      max: 12,
    },
    watermarkImageUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    watermarkSkipForOwner: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const SystemSetting = mongoose.model("SystemSetting", systemSettingSchema);

export default SystemSetting;
