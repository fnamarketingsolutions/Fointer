import mongoose from "mongoose";

export const WARNING_SOURCES = [
  "admin_panel",
  "marketplace",
  "report",
  "moderation",
];

const warningSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    source: {
      type: String,
      enum: WARNING_SOURCES,
      default: "admin_panel",
    },
    relatedEntity: {
      kind: {
        type: String,
        default: "",
      },
      targetId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      title: {
        type: String,
        default: "",
      },
    },
    resultedInBan: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

warningSchema.index({ user: 1, createdAt: -1 });
warningSchema.index({ createdAt: -1 });

const Warning = mongoose.model("Warning", warningSchema);

export default Warning;
