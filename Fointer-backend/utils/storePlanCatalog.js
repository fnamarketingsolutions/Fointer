/**
 * Storefront product caps. Prices stay at 0 and plans stay non-purchasable
 * until subscription billing is turned on. Free is the only plan assigned
 * when a store is created.
 */
export const STORE_PLAN_CODES = ["FREE", "BASIC", "GROWTH", "PROFESSIONAL"];

export const DEFAULT_STORE_PLAN_CODE = "FREE";

export const DEFAULT_STORE_PLANS = [
  {
    code: "FREE",
    name: "Free",
    description: "Start a storefront with a small active product cap.",
    maxActiveProducts: 10,
    price: 0,
    currency: "USD",
    billingPeriodDays: 30,
    isActive: true,
    isPurchasable: false,
    displayOrder: 0,
  },
  {
    code: "BASIC",
    name: "Basic",
    description: "A higher active product cap for a growing store.",
    maxActiveProducts: 50,
    price: 0,
    currency: "USD",
    billingPeriodDays: 30,
    isActive: true,
    isPurchasable: false,
    displayOrder: 1,
  },
  {
    code: "GROWTH",
    name: "Growth",
    description: "A higher active product cap for an established store.",
    maxActiveProducts: 200,
    price: 0,
    currency: "USD",
    billingPeriodDays: 30,
    isActive: true,
    isPurchasable: false,
    displayOrder: 2,
  },
  {
    code: "PROFESSIONAL",
    name: "Professional",
    description: "The highest active product cap.",
    maxActiveProducts: 1000,
    price: 0,
    currency: "USD",
    billingPeriodDays: 30,
    isActive: true,
    isPurchasable: false,
    displayOrder: 3,
  },
];
