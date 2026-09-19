import mongoose from "mongoose";

const userSupportCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    nameNormalized: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

userSupportCategorySchema.pre("validate", function () {
  if (this.name) {
    this.nameNormalized = String(this.name).trim().toLowerCase();
  }
});

const UserSupportCategory = mongoose.model(
  "UserSupportCategory",
  userSupportCategorySchema
);

export default UserSupportCategory;
