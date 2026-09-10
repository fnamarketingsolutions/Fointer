import express from "express";
import { getPublicProfile } from "../controllers/user.controller.js";
import {
  followUser,
  unfollowUser,
  listFollowers,
  listFollowing,
} from "../controllers/follow.controller.js";
import {
  isAuthenticated,
  optionalAuthenticate,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/:username/followers", optionalAuthenticate, listFollowers);
router.get("/:username/following", optionalAuthenticate, listFollowing);
router.post("/:username/follow", isAuthenticated, followUser);
router.delete("/:username/follow", isAuthenticated, unfollowUser);
router.get("/:username", optionalAuthenticate, getPublicProfile);

export default router;
