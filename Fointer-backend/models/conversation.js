import mongoose from "mongoose";

const participantStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
    hiddenAt: {
      type: Date,
      default: null,
    },
    clearedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const listingSnapshotSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
    shortCode: { type: String, default: "" },
    title: { type: String, default: "" },
    price: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    imageUrl: { type: String, default: "" },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    participants: {
      type: [participantStateSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: "A conversation must have exactly two participants.",
      },
    },
    listing: {
      type: listingSnapshotSchema,
      default: null,
    },
    lastMessageText: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastMessageAuthor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ "participants.user": 1, lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
