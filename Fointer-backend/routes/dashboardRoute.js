import express from "express";
import {
  getOverview,
  listUsers,
  updateUser,
  deleteUser,
} from "../controllers/dashboard.controller.js";
import { isAuthenticated, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/dashboard/overview", isAuthenticated, getOverview);

router.get(
  "/admin/users",
  isAuthenticated,
  authorize("admin"),
  listUsers
);

router.patch(
  "/admin/users/:id",
  isAuthenticated,
  authorize("admin"),
  updateUser
);

router.delete(
  "/admin/users/:id",
  isAuthenticated,
  authorize("admin"),
  deleteUser
);

export default router;
