import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    imagePublicId: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
    },
    ctaLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    ctaUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

bannerSchema.index({ isActive: 1, displayOrder: 1, createdAt: -1 });

const Banner = mongoose.model("Banner", bannerSchema);

export default Banner;
