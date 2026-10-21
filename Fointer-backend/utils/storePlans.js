import StorePlan from "../models/storePlan.js";
import { DEFAULT_STORE_PLANS } from "./storePlanCatalog.js";

/** Insert any missing default plans. Does not overwrite caps an admin already changed. */
export const ensureDefaultStorePlans = async () => {
  const codes = DEFAULT_STORE_PLANS.map((plan) => plan.code);
  const existing = await StorePlan.find({ code: { $in: codes } })
    .select("code")
    .lean();
  const have = new Set(existing.map((plan) => plan.code));
  const missing = DEFAULT_STORE_PLANS.filter((plan) => !have.has(plan.code));
  if (!missing.length) return;
  try {
    await StorePlan.insertMany(missing, { ordered: false });
  } catch (error) {
    const code = error?.code || error?.writeErrors?.[0]?.code;
    if (code !== 11000) throw error;
  }
};
