import mongoose from "mongoose";
import Community from "../models/community.js";
import Post from "../models/post.js";
import { backfillShortCodes } from "../utils/shortCode.js";

// Records created before short codes existed have none, and their URLs cannot
// be built until they do. This is a no-op once every record has a code.
const backfillMissingShortCodes = async () => {
  try {
    const [communities, posts] = await Promise.all([
      backfillShortCodes(Community),
      backfillShortCodes(Post),
    ]);
    if (communities || posts) {
      console.log(
        `Short codes backfilled: ${communities} communities, ${posts} posts`
      );
    }
  } catch (error) {
    console.log(`Short code backfill failed: ${error.message}`);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
  
    console.log(`MongoDB Connected ${conn.connection.host}`);
    await backfillMissingShortCodes();
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

export default connectDB;