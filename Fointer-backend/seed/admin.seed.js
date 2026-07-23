import dotenv from "dotenv";
import bcrypt from "bcryptjs";

import connectDB from "../config/db.js";
import User from "../models/user.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      console.log("Admin already exists.");
      console.log({
        id: existingAdmin._id,
        email: existingAdmin.email,
        username: existingAdmin.username,
        role: existingAdmin.role,
      });
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    const user = await User.create({
      username: "admin",
      name: "System Admin",
      email: "admin@gmail.com",
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin created successfully.");
    console.log({
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    });
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
};

seedAdmin();
