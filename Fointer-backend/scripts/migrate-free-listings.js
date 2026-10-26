import "dotenv/config";
import mongoose from "mongoose";
import Listing from "../models/listing.js";
import FreeListing from "../models/freeListing.js";
import { backfillShortCodes } from "../utils/shortCode.js";

const BATCH_SIZE = 250;

async function migrateFreeListings() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }
  await mongoose.connect(process.env.MONGO_URI);

  let migrated = 0;
  let batch = [];
  const migrateBatch = async (documents) => {
    if (!documents.length) return;
    const operations = documents.map((listing) => {
      const { _id, ...fields } = listing;
      return {
        updateOne: {
          filter: { _id },
          update: { $setOnInsert: { ...fields, pricing: "free", price: 0 } },
          upsert: true,
        },
      };
    });
    await FreeListing.bulkWrite(operations, { ordered: false });

    const ids = documents.map((listing) => listing._id);
    const copied = await FreeListing.countDocuments({ _id: { $in: ids } });
    if (copied !== ids.length) {
      throw new Error(
        `Free listing copy verification failed: expected ${ids.length}, found ${copied}`
      );
    }

    const deleted = await Listing.deleteMany({
      _id: { $in: ids },
      pricing: "free",
    });
    migrated += deleted.deletedCount || 0;
  };

  try {
    const cursor = Listing.find({ pricing: "free" }).lean().cursor();
    for await (const listing of cursor) {
      batch.push(listing);
      if (batch.length >= BATCH_SIZE) {
        await migrateBatch(batch);
        batch = [];
      }
    }
    await migrateBatch(batch);
    const backfilled = await backfillShortCodes(FreeListing);
    if (backfilled) {
      console.log(`migrate-free-listings: generated short codes=${backfilled}`);
    }
    console.log(`migrate-free-listings: moved=${migrated}`);
  } finally {
    await mongoose.disconnect();
  }
}

migrateFreeListings().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // Preserve the original migration failure.
  }
  process.exitCode = 1;
});
