import mongoose from "mongoose";

const sponsoredPurchaseSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    community: { type: mongoose.Schema.Types.ObjectId, ref: "Community", default: null, index: true },
    communityOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    package: { type: mongoose.Schema.Types.ObjectId, ref: "SponsoredPackage", required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true, minlength: 3, maxlength: 3 },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending", index: true },
    provider: { type: String, enum: ["flutterwave"], default: "flutterwave" },
    providerReference: { type: String, required: true, unique: true },
    providerTransactionId: { type: String, default: "", index: true },
    paymentLink: { type: String, default: "" },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
    placementSnapshot: {
      top: { type: Boolean, default: false },
      section: { type: Boolean, default: true },
      badge: { type: Boolean, default: true },
      priority: { type: Number, default: 0 },
    },
    geoSnapshot: {
      countries: { type: [String], default: [] },
      states: { type: [String], default: [] },
      cities: { type: [String], default: [] },
    },
    commissionPercentSnapshot: { type: Number, default: 0, min: 0, max: 100 },
    packageSnapshot: {
      name: { type: String, default: "" },
      durationDays: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

sponsoredPurchaseSchema.index({ paymentStatus: 1, startsAt: 1, expiresAt: 1 });

const SponsoredPurchase = mongoose.model("SponsoredPurchase", sponsoredPurchaseSchema);

export default SponsoredPurchase;
