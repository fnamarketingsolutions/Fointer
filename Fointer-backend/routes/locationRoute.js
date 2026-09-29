import express from "express";
import {
  listCities,
  listCountries,
  listStates,
  lookupPostal,
} from "../controllers/location.controller.js";
import { locationRateLimit } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

// Public geo helpers for signup/profile — rate-limited, no PII.
router.get("/countries", locationRateLimit, listCountries);
router.get("/states", locationRateLimit, listStates);
router.get("/cities", locationRateLimit, listCities);
router.get("/postal/:code", locationRateLimit, lookupPostal);

export default router;
