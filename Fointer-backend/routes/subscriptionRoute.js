import express from "express";
import {
  isAuthenticated,
  optionalAuthenticate,
  requireAdminTab,
  authorize,
} from "../middleware/auth.middleware.js";
import {
  cancelMySubscription,
  getAdsConfig,
  getManageInfo,
  getMyEntitlement,
  handleAppleServerNotification,
  handleGooglePlayRealtimeNotification,
  listPlans,
  restorePurchases,
  startWebCheckout,
  verifyApplePurchase,
  verifyGooglePlayPurchase,
  verifyWebPayment,
} from "../controllers/subscription.controller.js";
import {
  adminCancelUserSubscription,
  adminGetAdsSettings,
  adminGetIntegrationStatus,
  adminGetUserSubscription,
  adminGrantEntitlement,
  adminListPlans,
  adminListSubscribers,
  adminListTransactions,
  adminRevokeEntitlement,
  adminUpdateAdsSettings,
  adminUpsertPlan,
} from "../controllers/adminSubscription.controller.js";

const router = express.Router();

/** Public / member */
router.get("/subscriptions/plans", listPlans);
router.get("/ads/config", optionalAuthenticate, getAdsConfig);

router.get("/subscriptions/entitlement", isAuthenticated, getMyEntitlement);
router.get("/subscriptions/manage", isAuthenticated, getManageInfo);
router.post("/subscriptions/checkout", isAuthenticated, startWebCheckout);
router.post("/subscriptions/verify", isAuthenticated, verifyWebPayment);
router.post("/subscriptions/restore", isAuthenticated, restorePurchases);
router.post("/subscriptions/cancel", isAuthenticated, cancelMySubscription);
router.post(
  "/subscriptions/google/verify",
  isAuthenticated,
  verifyGooglePlayPurchase
);
router.post(
  "/subscriptions/apple/verify",
  isAuthenticated,
  verifyApplePurchase
);

/** Store notifications (Flutterwave raw webhook is mounted in server.js). */
router.post(
  "/subscriptions/webhook/google",
  handleGooglePlayRealtimeNotification
);
router.post(
  "/subscriptions/webhook/apple",
  handleAppleServerNotification
);

/** Admin */
const adminGate = [isAuthenticated, authorize("admin"), requireAdminTab("subscriptions")];

router.get("/admin/subscriptions/plans", ...adminGate, adminListPlans);
router.put("/admin/subscriptions/plans", ...adminGate, adminUpsertPlan);
router.get("/admin/subscriptions/subscribers", ...adminGate, adminListSubscribers);
router.get("/admin/subscriptions/transactions", ...adminGate, adminListTransactions);
router.get(
  "/admin/subscriptions/users/:userId",
  ...adminGate,
  adminGetUserSubscription
);
router.post(
  "/admin/subscriptions/users/:userId/cancel",
  ...adminGate,
  adminCancelUserSubscription
);
router.post(
  "/admin/subscriptions/users/:userId/grant",
  ...adminGate,
  adminGrantEntitlement
);
router.post(
  "/admin/subscriptions/users/:userId/revoke",
  ...adminGate,
  adminRevokeEntitlement
);
router.get("/admin/subscriptions/ads", ...adminGate, adminGetAdsSettings);
router.put("/admin/subscriptions/ads", ...adminGate, adminUpdateAdsSettings);
router.get(
  "/admin/subscriptions/integration",
  ...adminGate,
  adminGetIntegrationStatus
);

export default router;
