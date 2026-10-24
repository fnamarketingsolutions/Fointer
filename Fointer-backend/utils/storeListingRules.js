import Store from "../models/store.js";
import StoreCategory from "../models/storeCategory.js";
import StorePlan from "../models/storePlan.js";
import Listing from "../models/listing.js";
import { parseObjectIdInput } from "./shortCode.js";
import { ensureDefaultStorePlans } from "./storePlans.js";
import { DEFAULT_STORE_PLAN_CODE } from "./storePlanCatalog.js";
import { hasStorefrontAdminPower } from "./adminAccess.js";

const refId = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

export const loadSuspendedStoreIds = async () => {
  const rows = await Store.find({ status: "suspended" }).select("_id").lean();
  return rows.map((row) => row._id);
};

export const resolveStoreBrowseTarget = async (param, user) => {
  const raw = String(param || "").trim();
  if (!raw) return { ok: false, status: 404, message: "Store not found." };
  const id = parseObjectIdInput(raw);
  const store = id
    ? await Store.findById(id).select("owner status name slug planCode")
    : await Store.findOne({ slug: raw.toLowerCase() }).select(
        "owner status name slug planCode"
      );
  if (!store) return { ok: false, status: 404, message: "Store not found." };
  const owner = Boolean(user) && String(store.owner) === String(user._id);
  if (store.status !== "active" && !owner && !hasStorefrontAdminPower(user)) {
    return { ok: false, status: 404, message: "Store not found." };
  }
  return { ok: true, store };
};

/**
 * Attach a listing to a store the seller owns.
 * Omitted fields keep the listing's current store and category.
 */
export const resolveListingStore = async (sellerId, body = {}, existing = null, { isAdmin = false } = {}) => {
  const hasStore = Object.prototype.hasOwnProperty.call(body, "store");
  const hasCategory = Object.prototype.hasOwnProperty.call(body, "storeCategory");
  let storeId = refId(existing?.store);

  if (hasStore) {
    if (body.store == null || body.store === "") {
      storeId = "";
    } else {
      const parsed = parseObjectIdInput(body.store);
      if (!parsed) return { ok: false, status: 400, message: "Store not found." };
      storeId = String(parsed);
    }
  }

  if (!storeId) {
    if (hasCategory && body.storeCategory) {
      return {
        ok: false,
        status: 400,
        message: "Choose a store before adding a store category.",
      };
    }
    return { ok: true, store: null, storeCategory: null };
  }

  const store = await Store.findById(storeId).select("owner status name slug planCode");
  if (!store) return { ok: false, status: 404, message: "Store not found." };
  if (String(store.owner) !== String(sellerId)) {
    return {
      ok: false,
      status: 403,
      message: "Only the store owner can add products to this store.",
    };
  }
  if (store.status !== "active" && !isAdmin) {
    return { ok: false, status: 403, message: "This store is suspended." };
  }

  let categoryId = refId(existing?.storeCategory);
  const storeChanged = refId(existing?.store) !== String(store._id);
  if (storeChanged && !hasCategory) categoryId = "";

  if (hasCategory) {
    if (body.storeCategory == null || body.storeCategory === "") {
      categoryId = "";
    } else {
      const parsed = parseObjectIdInput(body.storeCategory);
      if (!parsed) {
        return { ok: false, status: 400, message: "Store category not found." };
      }
      categoryId = String(parsed);
    }
  }

  if (!categoryId) return { ok: true, store, storeCategory: null };

  const category = await StoreCategory.findOne({
    _id: categoryId,
    store: store._id,
  }).select("_id");
  if (!category) {
    return { ok: false, status: 400, message: "That category is not in this store." };
  }
  return { ok: true, store, storeCategory: category._id };
};

export const assertStoreProductCapacity = async ({ store, listingId = null }) => {
  await ensureDefaultStorePlans();
  const plan = await StorePlan.findOne({
    code: store.planCode || DEFAULT_STORE_PLAN_CODE,
  })
    .select("maxActiveProducts")
    .lean();
  const max = Number(plan?.maxActiveProducts) || 10;
  const filter = { store: store._id, status: "active" };
  if (listingId) filter._id = { $ne: listingId };
  const count = await Listing.countDocuments(filter);
  if (count >= max) {
    return {
      ok: false,
      status: 403,
      message: `This store can list ${max} active products. Move one to draft or sold before adding another.`,
      maxActiveProducts: max,
    };
  }
  return { ok: true, maxActiveProducts: max };
};
