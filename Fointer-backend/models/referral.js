import mongoose from "mongoose";

export const REFERRAL_STATUSES = ["pending", "qualified"];

/**
 * One row per referee (new account). Unlimited rows per referrer.
 * Qualify happens once on email verification — idempotent via status.
 */
const referralSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    codeUsed: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 32,
    },
    status: {
      type: String,
      enum: REFERRAL_STATUSES,
      default: "pending",
      index: true,
    },
    qualifiedAt: {
      type: Date,
      default: null,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/** Each new account attributes to at most one invite link. */
referralSchema.index({ referee: 1 }, { unique: true });
/** Referrer inbox / stats — newest first, filter by status. */
referralSchema.index({ referrer: 1, status: 1, createdAt: -1 });
referralSchema.index({ referrer: 1, createdAt: -1 });
referralSchema.index({ codeUsed: 1, createdAt: -1 });

const Referral = mongoose.model("Referral", referralSchema);

export default Referral;
