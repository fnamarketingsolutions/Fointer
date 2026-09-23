import express from "express";
import {
  listMyBookmarks,
  toggleMyBookmark,
} from "../controllers/bookmark.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", isAuthenticated, listMyBookmarks);
router.post("/toggle", isAuthenticated, toggleMyBookmark);
router.post("/:targetType/:id", isAuthenticated, toggleMyBookmark);

export default router;
