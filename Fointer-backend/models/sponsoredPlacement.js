import mongoose from "mongoose";

const sponsoredPlacementSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "SponsoredPurchase", required: true, unique: true },
    community: { type: mongoose.Schema.Types.ObjectId, ref: "Community", default: null, index: true },
    status: { type: String, enum: ["active", "refunded"], default: "active", index: true },
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    placement: {
      top: { type: Boolean, default: false },
      section: { type: Boolean, default: true },
      badge: { type: Boolean, default: true },
      priority: { type: Number, default: 0 },
    },
    geo: {
      countries: { type: [String], default: [] },
      states: { type: [String], default: [] },
      cities: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

sponsoredPlacementSchema.index({ status: 1, startsAt: 1, expiresAt: 1, community: 1 });

const SponsoredPlacement = mongoose.model("SponsoredPlacement", sponsoredPlacementSchema);

export default SponsoredPlacement;
