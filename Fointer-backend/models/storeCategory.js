import mongoose from "mongoose";

const storeCategorySchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    /** Lowercase name, unique inside one store. */
    nameKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

storeCategorySchema.pre("validate", function assignNameKey() {
  this.nameKey = String(this.name || "").trim().toLowerCase();
});

storeCategorySchema.index({ store: 1, nameKey: 1 }, { unique: true });
storeCategorySchema.index({ store: 1, order: 1, createdAt: 1 });

const StoreCategory = mongoose.model("StoreCategory", storeCategorySchema);

export default StoreCategory;
