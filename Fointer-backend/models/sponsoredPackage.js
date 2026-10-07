import mongoose from "mongoose";

const geoSchema = new mongoose.Schema(
  {
    countries: { type: [String], default: [] },
    states: { type: [String], default: [] },
    cities: { type: [String], default: [] },
  },
  { _id: false }
);

const sponsoredPackageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    price: { type: Number, required: true, min: 0.01 },
    currency: { type: String, required: true, uppercase: true, trim: true, minlength: 3, maxlength: 3 },
    durationDays: { type: Number, required: true, min: 1, max: 365 },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    placement: {
      top: { type: Boolean, default: false },
      section: { type: Boolean, default: true },
      badge: { type: Boolean, default: true },
      priority: { type: Number, default: 0, min: 0, max: 1000 },
      communityRequired: { type: Boolean, default: false },
    },
    geo: { type: geoSchema, default: () => ({}) },
    communityAllowList: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Community" }],
      default: [],
    },
  },
  { timestamps: true }
);

const SponsoredPackage = mongoose.model("SponsoredPackage", sponsoredPackageSchema);

export default SponsoredPackage;
