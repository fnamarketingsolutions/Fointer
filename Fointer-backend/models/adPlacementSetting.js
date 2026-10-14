import mongoose from "mongoose";
import {
  AD_PLACEMENT_IDS,
  DEFAULT_AD_PLACEMENTS,
} from "../utils/subscriptionEntitlement.js";

/**
 * Non-secret advertising configuration.
 * Provider credentials stay in environment variables only.
 */
const placementShape = AD_PLACEMENT_IDS.reduce((acc, id) => {
  acc[id] = { type: Boolean, default: DEFAULT_AD_PLACEMENTS[id] };
  return acc;
}, {});

const adPlacementSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },
    /** Selected display-ad provider for documentation + runtime adapters. */
    provider: {
      type: String,
      enum: ["none", "google_adsense", "google_admob", "custom"],
      default: "none",
    },
    webProvider: {
      type: String,
      enum: ["none", "google_adsense", "custom"],
      default: "google_adsense",
    },
    androidProvider: {
      type: String,
      enum: ["none", "google_admob", "custom"],
      default: "google_admob",
    },
    iosProvider: {
      type: String,
      enum: ["none", "google_admob", "custom"],
      default: "google_admob",
    },
    placements: placementShape,
    /** Public AdSense client / slot ids (not secrets). */
    adsenseClientId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    adsenseSlots: {
      home_feed: { type: String, default: "", trim: true, maxlength: 80 },
      community_feed: { type: String, default: "", trim: true, maxlength: 80 },
      marketplace_browse: { type: String, default: "", trim: true, maxlength: 80 },
      feed_banner: { type: String, default: "", trim: true, maxlength: 80 },
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

const AdPlacementSetting = mongoose.model(
  "AdPlacementSetting",
  adPlacementSettingSchema
);

export default AdPlacementSetting;
