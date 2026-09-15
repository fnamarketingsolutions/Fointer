import express from "express";
import {
  listBlockedUsers,
  blockUser,
  unblockUser,
} from "../controllers/block.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", isAuthenticated, listBlockedUsers);
router.post("/", isAuthenticated, blockUser);
router.delete("/:username", isAuthenticated, unblockUser);

export default router;
