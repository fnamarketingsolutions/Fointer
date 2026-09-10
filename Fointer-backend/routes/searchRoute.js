import express from "express";
import { globalSearch } from "../controllers/search.controller.js";
import { optionalAuthenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", optionalAuthenticate, globalSearch);

export default router;
