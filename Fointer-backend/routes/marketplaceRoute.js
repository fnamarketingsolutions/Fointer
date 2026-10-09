import express from "express";
import {
  listListings,
  listMyListings,
  getListing,
  createListing,
  updateListing,
  markListingSold,
  deleteListing,
  contactSeller,
  resolveListingCode,
} from "../controllers/marketplace.controller.js";
import {
  isAuthenticated,
  optionalAuthenticate,
  optionalAuthenticateFast,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Public browse is intentional for guests; seller phone/email never leave formatListing
// unless the viewer is owner/admin (includeSellerContact).
router.get("/", optionalAuthenticateFast, listListings);
router.get("/mine", isAuthenticated, listMyListings);
router.post("/", isAuthenticated, createListing);

router.get("/resolve/:code", optionalAuthenticate, resolveListingCode);

router.post("/:id/contact", isAuthenticated, contactSeller);
router.post("/:id/sold", isAuthenticated, markListingSold);

router.get("/:id", optionalAuthenticateFast, getListing);
router.patch("/:id", isAuthenticated, updateListing);
router.delete("/:id", isAuthenticated, deleteListing);

export default router;
