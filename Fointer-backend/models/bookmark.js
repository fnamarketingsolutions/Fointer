import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["post", "listing"],
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

bookmarkSchema.index(
  { user: 1, targetType: 1, targetId: 1 },
  { unique: true }
);

bookmarkSchema.index({ user: 1, targetType: 1, createdAt: -1 });

const Bookmark = mongoose.model("Bookmark", bookmarkSchema);

export default Bookmark;
