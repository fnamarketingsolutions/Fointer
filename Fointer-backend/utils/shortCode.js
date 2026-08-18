import crypto from "crypto";
import mongoose from "mongoose";

// Lower-case alphanumerics without look-alike characters (l, o, 0, 1) so a code
// stays readable when it is copied out of a URL or read aloud.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 7;
const MAX_ATTEMPTS = 8;

export const shortCodeField = {
  type: String,
  trim: true,
  lowercase: true,
  unique: true,
  sparse: true,
};

export const generateShortCode = (length = CODE_LENGTH) => {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
};

export const generateUniqueShortCode = async (Model) => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = generateShortCode();
    const taken = await Model.exists({ shortCode: code });
    if (!taken) return code;
  }
  throw new Error(
    `Could not generate a unique short code for ${Model.modelName}.`
  );
};

export const withShortCode = (schema) => {
  schema.pre("validate", async function assignShortCode() {
    if (this.shortCode) return;
    this.shortCode = await generateUniqueShortCode(this.constructor);
  });
  return schema;
};

export const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value ?? ""));

/**
 * Accept only a plain hex ObjectId string (or ObjectId instance).
 * Rejects objects/arrays so Express qs operator injection cannot reach Mongo.
 */
export const parseObjectIdInput = (value) => {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    if (value instanceof mongoose.Types.ObjectId) return value;
    return null;
  }
  const raw = String(value).trim();
  if (!isObjectId(raw)) return null;
  return mongoose.Types.ObjectId.createFromHexString(raw);
};

/**
 * URL segments carry a short code, but older links still carry a raw id, so
 * both shapes have to resolve.
 */
export const resolveDocumentId = async (Model, value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (isObjectId(raw)) {
    return mongoose.Types.ObjectId.createFromHexString(raw);
  }
  const doc = await Model.findOne({ shortCode: raw.toLowerCase() })
    .select("_id")
    .lean();
  return doc ? doc._id : null;
};

const MISSING_CODE = {
  $or: [
    { shortCode: { $exists: false } },
    { shortCode: null },
    { shortCode: "" },
  ],
};

export const backfillShortCodes = async (Model) => {
  const pending = await Model.find(MISSING_CODE).select("_id").lean();
  for (const doc of pending) {
    const shortCode = await generateUniqueShortCode(Model);
    await Model.updateOne({ _id: doc._id }, { $set: { shortCode } });
  }
  return pending.length;
};
