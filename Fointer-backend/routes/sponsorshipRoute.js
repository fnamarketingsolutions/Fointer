import express from "express";
import {
  createSponsoredCheckout,
  createSponsoredPackage,
  deleteSponsoredPackage,
  getAdminSponsorshipData,
  getSponsorOptions,
  listMyCommunitySponsoredEarnings,
  listMySponsoredPurchases,
  updateSponsoredCommission,
  updateSponsoredPackage,
  verifySponsoredPayment,
} from "../controllers/sponsorship.controller.js";
import {
  authorize,
  isAuthenticated,
  requireAdminTab,
} from "../middleware/auth.middleware.js";

const router = express.Router();
const marketplaceAdminGate = [
  isAuthenticated,
  authorize("admin"),
  requireAdminTab("sponsorships"),
];

router.get("/sponsorships/mine", isAuthenticated, listMySponsoredPurchases);
router.get("/sponsorships/earnings/mine", isAuthenticated, listMyCommunitySponsoredEarnings);
router.post("/sponsorships/verify", isAuthenticated, verifySponsoredPayment);
router.get("/sponsor-options/:id", isAuthenticated, getSponsorOptions);
router.post("/:id/sponsor", isAuthenticated, createSponsoredCheckout);

router.get("/admin/sponsorships", ...marketplaceAdminGate, getAdminSponsorshipData);
router.post("/admin/sponsorship-packages", ...marketplaceAdminGate, createSponsoredPackage);
router.patch("/admin/sponsorship-packages/:id", ...marketplaceAdminGate, updateSponsoredPackage);
router.delete("/admin/sponsorship-packages/:id", ...marketplaceAdminGate, deleteSponsoredPackage);
router.patch("/admin/sponsorship-settings", ...marketplaceAdminGate, updateSponsoredCommission);

export default router;
