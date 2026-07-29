import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["post", "comment"],
      required: true,
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
    },
  },
  {
    timestamps: true,
  }
);

reactionSchema.index(
  { targetType: 1, targetId: 1, user: 1 },
  { unique: true }
);

const Reaction = mongoose.model("Reaction", reactionSchema);

export default Reaction;
