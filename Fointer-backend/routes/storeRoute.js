import express from "express";
import {
  isAuthenticated,
  authorize,
  optionalAuthenticate,
  requireAdminTab,
} from "../middleware/auth.middleware.js";
import {
  createStore,
  listMyStores,
  getStoreBySlug,
  getStore,
  updateStore,
  deleteStore,
  createStoreCategory,
  updateStoreCategory,
  deleteStoreCategory,
  adminListStores,
  adminListStorePlans,
  adminUpdateStorePlan,
  adminSuspendStore,
  adminRestoreStore,
  listPublicStores,
  followStore,
  unfollowStore,
  messageStore,
} from "../controllers/store.controller.js";

const router = express.Router();

const storeAdmin = [isAuthenticated, authorize("admin"), requireAdminTab("stores")];

router.get("/mine", isAuthenticated, listMyStores);
router.get("/slug/:slug", optionalAuthenticate, getStoreBySlug);
router.get("/", optionalAuthenticate, listPublicStores);

router.get("/admin/plans", ...storeAdmin, adminListStorePlans);
router.patch("/admin/plans/:code", ...storeAdmin, adminUpdateStorePlan);
router.get("/admin", ...storeAdmin, adminListStores);
router.post("/admin/:id/suspend", ...storeAdmin, adminSuspendStore);
router.post("/admin/:id/restore", ...storeAdmin, adminRestoreStore);

router.post("/", isAuthenticated, createStore);
router.get("/:id", optionalAuthenticate, getStore);
router.patch("/:id", isAuthenticated, updateStore);
router.delete("/:id", isAuthenticated, deleteStore);

router.post("/:id/categories", isAuthenticated, createStoreCategory);
router.patch("/:id/categories/:categoryId", isAuthenticated, updateStoreCategory);
router.delete("/:id/categories/:categoryId", isAuthenticated, deleteStoreCategory);
router.post("/:id/follow", isAuthenticated, followStore);
router.delete("/:id/follow", isAuthenticated, unfollowStore);
router.post("/:id/message", isAuthenticated, messageStore);

export default router;
