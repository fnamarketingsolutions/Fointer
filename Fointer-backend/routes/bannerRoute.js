import express from "express";
import {
  listActiveBanners,
  listAdminBanners,
  createAdminBanner,
  updateAdminBanner,
  deleteAdminBanner,
} from "../controllers/banner.controller.js";
import {
  isAuthenticated,
  authorize,
  requireAdminTab,
} from "../middleware/auth.middleware.js";

const router = express.Router();

const bannerAdminGate = [
  isAuthenticated,
  authorize("admin"),
  requireAdminTab("banners"),
];

router.get("/banners/active", listActiveBanners);
router.get("/admin/banners", ...bannerAdminGate, listAdminBanners);
router.post("/admin/banners", ...bannerAdminGate, createAdminBanner);
router.patch("/admin/banners/:id", ...bannerAdminGate, updateAdminBanner);
router.delete("/admin/banners/:id", ...bannerAdminGate, deleteAdminBanner);

export default router;
