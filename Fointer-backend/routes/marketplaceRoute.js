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
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", optionalAuthenticate, listListings);
router.get("/mine", isAuthenticated, listMyListings);
router.post("/", isAuthenticated, createListing);

router.get("/resolve/:code", optionalAuthenticate, resolveListingCode);

router.post("/:id/contact", isAuthenticated, contactSeller);
router.post("/:id/sold", isAuthenticated, markListingSold);

router.get("/:id", optionalAuthenticate, getListing);
router.patch("/:id", isAuthenticated, updateListing);
router.delete("/:id", isAuthenticated, deleteListing);

export default router;
