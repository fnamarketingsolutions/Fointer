import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      minlength: 8,
      required: function () {
      return !this.googleId && !this.facebookId;
      },
    },

    googleId: {
      type: String,
    },
    facebookId: {
      type: String,
    },

    avatar: {
      type: String,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    interests: {
      type: [String],
      default: [],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationOtp: {
      type: String,
    },

    emailVerificationOtpExpires: {
      type: Date,
    },

    emailVerificationOtpAttempts: {
      type: Number,
      default: 0,
    },

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
      set: (v) => String(v || "user").toLowerCase().trim(),
    },

    status: {
      type: String,
      enum: ["active", "suspended", "banned"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
