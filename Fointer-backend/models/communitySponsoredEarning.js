import mongoose from "mongoose";

const communitySponsoredEarningSchema = new mongoose.Schema(
  {
    community: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "SponsoredPurchase", required: true, unique: true },
    gross: { type: Number, required: true, min: 0 },
    percentUsed: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true, minlength: 3, maxlength: 3 },
    status: { type: String, enum: ["earned", "reversed"], default: "earned", index: true },
  },
  { timestamps: true }
);

const CommunitySponsoredEarning = mongoose.model(
  "CommunitySponsoredEarning",
  communitySponsoredEarningSchema
);

export default CommunitySponsoredEarning;
