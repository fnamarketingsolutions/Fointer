import test from "node:test";
import assert from "node:assert/strict";
import {
  slugifyStoreName,
  storeSlugFromName,
  validateStoreSlug,
} from "./storeSlug.js";
import { DEFAULT_STORE_PLANS, DEFAULT_STORE_PLAN_CODE } from "./storePlanCatalog.js";

test("store slug drops apostrophes so Ada's Fashion becomes adas-fashion", () => {
  assert.equal(slugifyStoreName("Ada's Fashion"), "adas-fashion");
  assert.deepEqual(storeSlugFromName("Ada's Fashion"), {
    ok: true,
    slug: "adas-fashion",
  });
});

test("store slug rejects reserved and short links", () => {
  assert.equal(validateStoreSlug("marketplace").ok, false);
  assert.equal(validateStoreSlug("store").ok, false);
  assert.equal(validateStoreSlug("ab").ok, false);
  assert.equal(validateStoreSlug("Ada Fashion").ok, false);
  assert.equal(storeSlugFromName("!!").ok, false);
});

test("default store plans keep billing off and cap free at 10", () => {
  assert.equal(DEFAULT_STORE_PLAN_CODE, "FREE");
  const caps = Object.fromEntries(
    DEFAULT_STORE_PLANS.map((plan) => [plan.code, plan.maxActiveProducts])
  );
  assert.deepEqual(caps, {
    FREE: 10,
    BASIC: 50,
    GROWTH: 200,
    PROFESSIONAL: 1000,
  });
  assert.equal(
    DEFAULT_STORE_PLANS.every((plan) => plan.price === 0 && plan.isPurchasable === false),
    true
  );
});
