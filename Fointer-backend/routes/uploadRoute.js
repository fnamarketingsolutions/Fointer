import express from "express";
import { uploadMedia } from "../controllers/upload.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = express.Router();

router.post("/", isAuthenticated, upload.single("file"), uploadMedia);

export default router;
