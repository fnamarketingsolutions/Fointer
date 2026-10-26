import express from "express";
import {
  contactFreeListingSeller,
  createFreeListing,
  deleteFreeListing,
  getFreeListing,
  listFreeListings,
  listMyFreeListings,
  markFreeListingSold,
  resolveFreeListingCode,
  updateFreeListing,
} from "../controllers/freeListing.controller.js";
import {
  isAuthenticated,
  optionalAuthenticate,
  optionalAuthenticateFast,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", optionalAuthenticateFast, listFreeListings);
router.get("/mine", isAuthenticated, listMyFreeListings);
router.post("/", isAuthenticated, createFreeListing);
router.get("/resolve/:code", optionalAuthenticate, resolveFreeListingCode);
router.post("/:id/contact", isAuthenticated, contactFreeListingSeller);
router.post("/:id/sold", isAuthenticated, markFreeListingSold);
router.get("/:id", optionalAuthenticateFast, getFreeListing);
router.patch("/:id", isAuthenticated, updateFreeListing);
router.delete("/:id", isAuthenticated, deleteFreeListing);

export default router;
