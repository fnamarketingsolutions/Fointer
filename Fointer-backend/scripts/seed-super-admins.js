/**
 * Promote existing role=admin users without explicit limited-admin config
 * to isSuperAdmin: true.
 *
 * Run: node scripts/seed-super-admins.js
 * (Also runs automatically on server connect via config/db.js)
 */
import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";
import User from "../models/user.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const filter = {
    role: { $regex: /^admin$/i },
    $or: [{ isSuperAdmin: { $exists: false } }, { isSuperAdmin: null }],
  };

  const before = await User.countDocuments(filter);
  const result = await User.updateMany(filter, {
    $set: { isSuperAdmin: true, adminTabs: [] },
  });

  const modified = result.modifiedCount ?? result.nModified ?? 0;
  console.log(
    `seed-super-admins: candidates=${before}, updated=${modified}`
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
