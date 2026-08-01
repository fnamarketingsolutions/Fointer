import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    type: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    media: {
      type: [mediaSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

postSchema.index({ title: "text", text: "text" });

const Post = mongoose.model("Post", postSchema);

export default Post;
