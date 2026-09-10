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

    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    state: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    country: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    zipCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 20,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },

    yearOfBirth: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear(),
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

    /** Full admin-panel access + Admin Management. Only meaningful when role === "admin". */
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },

    /**
     * Tab ids this limited admin may use (e.g. users, support).
     * Ignored when isSuperAdmin is true.
     */
    adminTabs: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ["active", "suspended", "banned"],
      default: "active",
    },

    /** Denormalized count of platform warnings issued to this user. */
    warningCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
