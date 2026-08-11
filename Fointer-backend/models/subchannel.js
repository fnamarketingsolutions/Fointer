import mongoose from "mongoose";

const subchannelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameNormalized: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

subchannelSchema.pre("validate", function () {
  if (this.name) {
    this.nameNormalized = String(this.name).trim().toLowerCase();
  }
});

subchannelSchema.index(
  { channel: 1, nameNormalized: 1 },
  { unique: true }
);

const Subchannel = mongoose.model("Subchannel", subchannelSchema);

export default Subchannel;
