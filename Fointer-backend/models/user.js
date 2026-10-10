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

    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    district: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other", ""],
      default: "",
    },

    ageRange: {
      type: String,
      enum: [
        "13–17 years",
        "18–24 years",
        "25–34 years",
        "35–44 years",
        "45–54 years",
        "55–64 years",
        "65+ years",
        "",
      ],
      default: "",
    },

    dateOfBirth: {
      type: Date,
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

    passwordResetOtp: {
      type: String,
    },

    passwordResetOtpExpires: {
      type: Date,
    },

    passwordResetOtpAttempts: {
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

    /** When true, others cannot see who follows this user (counts still public). */
    hideFollowersList: {
      type: Boolean,
      default: false,
    },

    /** When true, others cannot see who this user follows (counts still public). */
    hideFollowingList: {
      type: Boolean,
      default: false,
    },

    /** Unique invite code for this user (lazy-allocated). */
    referralCode: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 32,
      default: null,
    },

    /** Who invited this account (set once at signup). */
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index(
  { referralCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      referralCode: { $exists: true, $type: "string" },
    },
  }
);

const User = mongoose.model("User", userSchema);

export default User;
