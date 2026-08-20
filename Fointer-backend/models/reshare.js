import mongoose from "mongoose";

const reshareSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
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

reshareSchema.index({ post: 1, user: 1 }, { unique: true });

const Reshare = mongoose.model("Reshare", reshareSchema);

export default Reshare;