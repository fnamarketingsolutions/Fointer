import mongoose from "mongoose";

const storeFollowSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

storeFollowSchema.index({ follower: 1, store: 1 }, { unique: true });
storeFollowSchema.index({ store: 1, createdAt: -1 });

const StoreFollow = mongoose.model("StoreFollow", storeFollowSchema);

export default StoreFollow;
