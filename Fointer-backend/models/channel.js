import mongoose from "mongoose";

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    nameNormalized: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

channelSchema.pre("validate", function () {
  if (this.name) {
    this.nameNormalized = String(this.name).trim().toLowerCase();
  }
});

const Channel = mongoose.model("Channel", channelSchema);

export default Channel;
