import express from "express";
import {
  createLiveEvent,
  listLiveEvents,
  getLiveEventCreateContext,
  joinLiveEvent,
  endLiveEvent,
  closeLiveEvent,
  removeLiveEventMember,
} from "../controllers/liveEvent.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import liveEventMessageRoute from "./liveEventMessage.route.js";

const router = express.Router();

router.get("/create-context", isAuthenticated, getLiveEventCreateContext);
router.get("/", isAuthenticated, listLiveEvents);
router.post("/", isAuthenticated, createLiveEvent);

router.post("/:eventId/join", isAuthenticated, joinLiveEvent);
router.patch("/:eventId/end", isAuthenticated, endLiveEvent);
router.delete(
  "/:eventId/members/:userId",
  isAuthenticated,
  removeLiveEventMember
);
router.delete("/:eventId", isAuthenticated, closeLiveEvent);

router.use("/:eventId", liveEventMessageRoute);

export default router;
