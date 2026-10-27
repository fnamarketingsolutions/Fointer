import Store from "../models/store.js";
import StoreCategory from "../models/storeCategory.js";
import StorePlan from "../models/storePlan.js";
import Listing, { LISTING_CATEGORIES } from "../models/listing.js";
import FreeListing from "../models/freeListing.js";
import { acceptSignedImageValue } from "../utils/s3.js";
import { respondIfBanned } from "../utils/bannedKeywords.js";
import { sendServerError } from "../utils/safeError.js";
import { refreshHotReads } from "../utils/hotReadCache.js";
import { formatUserRef } from "../utils/deletedUser.js";
import { resolveDocumentId, parseObjectIdInput } from "../utils/shortCode.js";
import { escapeRegex, EMAIL_RE, PHONE_RE } from "../utils/validate.js";
import {
  parsePagination,
  buildPaginationMeta,
} from "../utils/pagination.js";
import { hasStorefrontAdminPower } from "../utils/adminAccess.js";
import { ensureDefaultStorePlans } from "../utils/storePlans.js";
import {
  DEFAULT_STORE_PLAN_CODE,
  STORE_PLAN_CODES,
} from "../utils/storePlanCatalog.js";
import { storeSlugFromName, validateStoreSlug } from "../utils/storeSlug.js";
import StoreFollow from "../models/storeFollow.js";
import { isMessagingBlocked } from "./block.controller.js";
import {
  getOrCreateConversation,
  sendDirectMessage,
} from "./conversation.controller.js";

const MAX_STORE_CATEGORIES = 20;
const OWNER_FIELDS = "name username avatar";

const formatCategory = (category) => ({
  id: category._id,
  name: category.name,
  order: category.order ?? 0,
});

const formatStore = (
  store,
  {
    categories = null,
    viewerId = null,
    followedByMe = false,
    activeProductCount = null,
  } = {}
) => {
  const ownerId =
    store.owner && typeof store.owner === "object" && store.owner._id
      ? store.owner._id
      : store.owner;
  const viewer = viewerId ? String(viewerId) : "";

  const payload = {
    id: store._id,
    shortCode: store.shortCode || "",
    name: store.name,
    slug: store.slug,
    description: store.description || "",
    logo: store.logo || "",
    coverImage: store.coverImage || "",
    category: store.category,
    city: store.city || "",
    state: store.state || "",
    country: store.country || "",
    contactPhone: store.contactPhone || "",
    contactEmail: store.contactEmail || "",
    status: store.status,
    planCode: store.planCode || DEFAULT_STORE_PLAN_CODE,
    followerCount: store.followerCount || 0,
    owner: formatUserRef(store.owner),
    isOwner: Boolean(viewer) && String(ownerId) === viewer,
    followedByMe: Boolean(followedByMe),
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  };
  if (Array.isArray(categories)) payload.categories = categories;
  if (activeProductCount != null) payload.activeProductCount = activeProductCount;
  return payload;
};

const categoriesByStore = async (storeIds) => {
  if (!storeIds.length) return new Map();
  const rows = await StoreCategory.find({ store: { $in: storeIds } })
    .sort({ order: 1, createdAt: 1 })
    .lean();
  const map = new Map();
  for (const row of rows) {
    const key = String(row.store);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(formatCategory(row));
  }
  return map;
};

const loadStore = async (param) => {
  const id = await resolveDocumentId(Store, param);
  if (!id) return null;
  return Store.findById(id).populate("owner", OWNER_FIELDS);
};

const isOwner = (store, user) =>
  Boolean(user) && String(store.owner?._id || store.owner) === String(user._id);

const canReadStore = (store, user) => {
  if (store.status === "active") return true;
  if (isOwner(store, user)) return true;
  return hasStorefrontAdminPower(user);
};

const readRequiredText = (value, label, max) => {
  if (typeof value !== "string") {
    return { ok: false, message: `${label} is required.` };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: `${label} is required.` };
  if (trimmed.length > max) {
    return { ok: false, message: `${label} must be ${max} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
};

const readOptionalText = (value, label, max) => {
  if (value == null || value === "") return { ok: true, value: "" };
  if (typeof value !== "string") {
    return { ok: false, message: `${label} is invalid.` };
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    return { ok: false, message: `${label} must be ${max} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
};

const readCategory = (value) => {
  const category = String(value || "").trim();
  if (!LISTING_CATEGORIES.includes(category)) {
    return {
      ok: false,
      message: `Choose a category: ${LISTING_CATEGORIES.join(", ")}.`,
    };
  }
  return { ok: true, value: category };
};

const readContact = (body) => {
  const phone = readOptionalText(body.contactPhone, "Phone", 32);
  if (!phone.ok) return phone;
  if (phone.value && !PHONE_RE.test(phone.value)) {
    return { ok: false, message: "Enter a valid phone number." };
  }
  const email = readOptionalText(body.contactEmail, "Email", 254);
  if (!email.ok) return email;
  const normalized = email.value.toLowerCase();
  if (normalized && !EMAIL_RE.test(normalized)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  return { ok: true, phone: phone.value, email: normalized };
};

const readImage = (userId, input, previousUrl) =>
  acceptSignedImageValue(userId, input, previousUrl);

const slugIsTaken = async (slug, exceptId = null) => {
  const filter = { slug };
  if (exceptId) filter._id = { $ne: exceptId };
  return Boolean(await Store.exists(filter));
};

const chooseSlug = async (name, explicit, exceptId = null) => {
  const resolved = explicit
    ? validateStoreSlug(explicit)
    : storeSlugFromName(name);
  if (!resolved.ok) return resolved;
  if (await slugIsTaken(resolved.slug, exceptId)) {
    return { ok: false, message: "That store link is already taken.", status: 409 };
  }
  return resolved;
};

const presentStore = async (store, viewerId) => {
  const map = await categoriesByStore([store._id]);
  const followedByMe = viewerId
    ? Boolean(
        await StoreFollow.exists({ follower: viewerId, store: store._id })
      )
    : false;
  return formatStore(store, {
    categories: map.get(String(store._id)) || [],
    viewerId,
    followedByMe,
  });
};

const duplicateKeyMessage = (error) => {
  if (error?.code !== 11000) return "";
  const fields = error.keyPattern ? Object.keys(error.keyPattern) : [];
  if (fields.includes("slug")) return "That store link is already taken.";
  if (fields.includes("nameKey")) return "That category already exists in this store.";
  return "That value is already in use.";
};

export const createStore = async (req, res) => {
  try {
    const name = readRequiredText(req.body?.name, "Store name", 80);
    if (!name.ok) {
      return res.status(400).json({ success: false, message: name.message });
    }
    const description = readOptionalText(req.body?.description, "Description", 2000);
    if (!description.ok) {
      return res.status(400).json({ success: false, message: description.message });
    }
    const category = readCategory(req.body?.category);
    if (!category.ok) {
      return res.status(400).json({ success: false, message: category.message });
    }
    const city = readOptionalText(req.body?.city, "City", 100);
    if (!city.ok) return res.status(400).json({ success: false, message: city.message });
    const state = readOptionalText(req.body?.state, "State", 100);
    if (!state.ok) return res.status(400).json({ success: false, message: state.message });
    const country = readRequiredText(req.body?.country, "Country", 100);
    if (!country.ok) {
      return res.status(400).json({ success: false, message: country.message });
    }
    const contact = readContact(req.body || {});
    if (!contact.ok) {
      return res.status(400).json({ success: false, message: contact.message });
    }

    if (await respondIfBanned(res, name.value, description.value)) return;

    const explicitSlug =
      typeof req.body?.slug === "string" ? req.body.slug : "";
    const slug = await chooseSlug(name.value, explicitSlug);
    if (!slug.ok) {
      return res.status(slug.status || 400).json({ success: false, message: slug.message });
    }

    const logo = readImage(req.user._id, req.body?.logo, "");
    if (!logo.ok) return res.status(400).json({ success: false, message: logo.message });
    const cover = readImage(req.user._id, req.body?.coverImage, "");
    if (!cover.ok) return res.status(400).json({ success: false, message: cover.message });

    await ensureDefaultStorePlans();

    const store = await Store.create({
      owner: req.user._id,
      name: name.value,
      slug: slug.slug,
      description: description.value,
      logo: logo.url,
      coverImage: cover.url,
      category: category.value,
      city: city.value,
      state: state.value,
      country: country.value,
      contactPhone: contact.phone,
      contactEmail: contact.email,
      status: "active",
      planCode: DEFAULT_STORE_PLAN_CODE,
    });

    const populated = await Store.findById(store._id).populate("owner", OWNER_FIELDS);
    return res.status(201).json({
      success: true,
      message: "Store created.",
      store: await presentStore(populated, req.user._id),
    });
  } catch (error) {
    const duplicate = duplicateKeyMessage(error);
    if (duplicate) {
      return res.status(409).json({ success: false, message: duplicate });
    }
    return sendServerError(res, error);
  }
};

export const listMyStores = async (req, res) => {
  try {
    const stores = await Store.find({ owner: req.user._id })
      .populate("owner", OWNER_FIELDS)
      .sort({ createdAt: -1 });
    const map = await categoriesByStore(stores.map((store) => store._id));
    return res.status(200).json({
      success: true,
      stores: stores.map((store) =>
        formatStore(store, {
          categories: map.get(String(store._id)) || [],
          viewerId: req.user._id,
        })
      ),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const getStoreBySlug = async (req, res) => {
  try {
    const slug = validateStoreSlug(req.params.slug);
    if (!slug.ok) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    const store = await Store.findOne({ slug: slug.slug }).populate("owner", OWNER_FIELDS);
    if (!store || !canReadStore(store, req.user)) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    return res.status(200).json({
      success: true,
      store: await presentStore(store, req.user?._id),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const getStore = async (req, res) => {
  try {
    const store = await loadStore(req.params.id);
    if (!store || !canReadStore(store, req.user)) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    return res.status(200).json({
      success: true,
      store: await presentStore(store, req.user?._id),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const updateStore = async (req, res) => {
  try {
    const store = await loadStore(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    if (!isOwner(store, req.user)) {
      return res.status(403).json({ success: false, message: "Only the store owner can edit this store." });
    }

    const body = req.body || {};
    const texts = [];

    if ("name" in body) {
      const name = readRequiredText(body.name, "Store name", 80);
      if (!name.ok) return res.status(400).json({ success: false, message: name.message });
      store.name = name.value;
      texts.push(name.value);
    }
    if ("description" in body) {
      const description = readOptionalText(body.description, "Description", 2000);
      if (!description.ok) {
        return res.status(400).json({ success: false, message: description.message });
      }
      store.description = description.value;
      texts.push(description.value);
    }
    if ("category" in body) {
      const category = readCategory(body.category);
      if (!category.ok) return res.status(400).json({ success: false, message: category.message });
      store.category = category.value;
    }
    if ("city" in body) {
      const city = readOptionalText(body.city, "City", 100);
      if (!city.ok) return res.status(400).json({ success: false, message: city.message });
      store.city = city.value;
    }
    if ("state" in body) {
      const state = readOptionalText(body.state, "State", 100);
      if (!state.ok) return res.status(400).json({ success: false, message: state.message });
      store.state = state.value;
    }
    if ("country" in body) {
      const country = readRequiredText(body.country, "Country", 100);
      if (!country.ok) return res.status(400).json({ success: false, message: country.message });
      store.country = country.value;
    }
    if ("contactPhone" in body || "contactEmail" in body) {
      const contact = readContact({
        contactPhone: "contactPhone" in body ? body.contactPhone : store.contactPhone,
        contactEmail: "contactEmail" in body ? body.contactEmail : store.contactEmail,
      });
      if (!contact.ok) return res.status(400).json({ success: false, message: contact.message });
      store.contactPhone = contact.phone;
      store.contactEmail = contact.email;
    }
    if ("slug" in body) {
      if (typeof body.slug !== "string" || !body.slug.trim()) {
        return res.status(400).json({ success: false, message: "Store link is required." });
      }
      const slug = await chooseSlug(store.name, body.slug, store._id);
      if (!slug.ok) {
        return res.status(slug.status || 400).json({ success: false, message: slug.message });
      }
      store.slug = slug.slug;
    }
    if ("logo" in body) {
      const logo = readImage(req.user._id, body.logo, store.logo || "");
      if (!logo.ok) return res.status(400).json({ success: false, message: logo.message });
      store.logo = logo.url;
    }
    if ("coverImage" in body) {
      const cover = readImage(req.user._id, body.coverImage, store.coverImage || "");
      if (!cover.ok) return res.status(400).json({ success: false, message: cover.message });
      store.coverImage = cover.url;
    }

    if (texts.length && (await respondIfBanned(res, ...texts))) return;

    await store.save();
    return res.status(200).json({
      success: true,
      message: "Store updated.",
      store: await presentStore(store, req.user._id),
    });
  } catch (error) {
    const duplicate = duplicateKeyMessage(error);
    if (duplicate) return res.status(409).json({ success: false, message: duplicate });
    return sendServerError(res, error);
  }
};

const loadOwnedStore = async (param, user) => {
  const store = await loadStore(param);
  if (!store) return { error: { status: 404, message: "Store not found." } };
  if (!isOwner(store, user)) {
    return { error: { status: 403, message: "Only the store owner can edit this store." } };
  }
  return { store };
};

export const deleteStore = async (req, res) => {
  try {
    const store = await loadStore(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    if (!isOwner(store, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only the store owner can delete this store.",
      });
    }

    const storeId = store._id;
    await Listing.updateMany(
      { store: storeId },
      { $set: { store: null, storeCategory: null } }
    );
    await FreeListing.updateMany(
      { store: storeId },
      { $set: { store: null, storeCategory: null } }
    );
    await StoreCategory.deleteMany({ store: storeId });
    await StoreFollow.deleteMany({ store: storeId });
    await Store.deleteOne({ _id: storeId });
    refreshHotReads();

    return res.status(200).json({
      success: true,
      message:
        "Store deleted. Paid products stay on the marketplace and free listings remain in Free Listings.",
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const createStoreCategory = async (req, res) => {
  try {
    const loaded = await loadOwnedStore(req.params.id, req.user);
    if (loaded.error) {
      return res.status(loaded.error.status).json({ success: false, message: loaded.error.message });
    }
    const name = readRequiredText(req.body?.name, "Category name", 40);
    if (!name.ok) return res.status(400).json({ success: false, message: name.message });
    if (await respondIfBanned(res, name.value)) return;

    const count = await StoreCategory.countDocuments({ store: loaded.store._id });
    if (count >= MAX_STORE_CATEGORIES) {
      return res.status(400).json({
        success: false,
        message: `A store can have up to ${MAX_STORE_CATEGORIES} categories.`,
      });
    }
    const last = await StoreCategory.findOne({ store: loaded.store._id })
      .sort({ order: -1 })
      .select("order")
      .lean();

    const category = await StoreCategory.create({
      store: loaded.store._id,
      name: name.value,
      order: last ? (last.order || 0) + 1 : 0,
    });

    return res.status(201).json({
      success: true,
      message: "Category added.",
      category: formatCategory(category),
    });
  } catch (error) {
    const duplicate = duplicateKeyMessage(error);
    if (duplicate) return res.status(409).json({ success: false, message: duplicate });
    return sendServerError(res, error);
  }
};

export const updateStoreCategory = async (req, res) => {
  try {
    const loaded = await loadOwnedStore(req.params.id, req.user);
    if (loaded.error) {
      return res.status(loaded.error.status).json({ success: false, message: loaded.error.message });
    }
    const categoryId = parseObjectIdInput(req.params.categoryId);
    if (!categoryId) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }
    const category = await StoreCategory.findOne({
      _id: categoryId,
      store: loaded.store._id,
    });
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }

    const body = req.body || {};
    if ("name" in body) {
      const name = readRequiredText(body.name, "Category name", 40);
      if (!name.ok) return res.status(400).json({ success: false, message: name.message });
      if (await respondIfBanned(res, name.value)) return;
      category.name = name.value;
    }
    if ("order" in body) {
      const order = Number(body.order);
      if (!Number.isInteger(order) || order < 0 || order > 1000) {
        return res.status(400).json({ success: false, message: "Category order is invalid." });
      }
      category.order = order;
    }

    await category.save();
    return res.status(200).json({
      success: true,
      message: "Category updated.",
      category: formatCategory(category),
    });
  } catch (error) {
    const duplicate = duplicateKeyMessage(error);
    if (duplicate) return res.status(409).json({ success: false, message: duplicate });
    return sendServerError(res, error);
  }
};

export const deleteStoreCategory = async (req, res) => {
  try {
    const loaded = await loadOwnedStore(req.params.id, req.user);
    if (loaded.error) {
      return res.status(loaded.error.status).json({ success: false, message: loaded.error.message });
    }
    const categoryId = parseObjectIdInput(req.params.categoryId);
    if (!categoryId) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }
    const deleted = await StoreCategory.findOneAndDelete({
      _id: categoryId,
      store: loaded.store._id,
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }
    return res.status(200).json({ success: true, message: "Category removed." });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const adminListStores = async (req, res) => {
  try {
    await ensureDefaultStorePlans();
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const filter = {};
    const status = String(req.query.status || "").trim();
    if (status) {
      if (status !== "active" && status !== "suspended") {
        return res.status(400).json({ success: false, message: "Status must be active or suspended." });
      }
      filter.status = status;
    }
    const q = String(req.query.q || "").trim();
    if (q) {
      const pattern = escapeRegex(q);
      filter.$or = [
        { name: { $regex: pattern, $options: "i" } },
        { slug: { $regex: pattern, $options: "i" } },
      ];
    }

    const [stores, total] = await Promise.all([
      Store.find(filter)
        .populate("owner", OWNER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Store.countDocuments(filter),
    ]);
    const counts = stores.length
      ? await Listing.aggregate([
          {
            $match: {
              store: { $in: stores.map((store) => store._id) },
              status: "active",
            },
          },
          { $group: { _id: "$store", count: { $sum: 1 } } },
        ])
      : [];
    const activeByStore = new Map(
      counts.map((row) => [String(row._id), row.count])
    );

    return res.status(200).json({
      success: true,
      stores: stores.map((store) =>
        formatStore(store, {
          viewerId: req.user._id,
          activeProductCount: activeByStore.get(String(store._id)) || 0,
        })
      ),
      pagination: buildPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

const setStoreStatus = async (req, res, status) => {
  try {
    const store = await loadStore(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    if (store.status === status) {
      const message = status === "suspended" ? "Store is already suspended." : "Store is already active.";
      return res.status(400).json({ success: false, message });
    }
    store.status = status;
    await store.save();
    refreshHotReads();
    return res.status(200).json({
      success: true,
      message: status === "suspended" ? "Store suspended." : "Store restored.",
      store: await presentStore(store, req.user._id),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const adminSuspendStore = (req, res) => setStoreStatus(req, res, "suspended");

export const adminRestoreStore = (req, res) => setStoreStatus(req, res, "active");

const formatPlan = (plan) => ({
  id: plan._id,
  code: plan.code,
  name: plan.name,
  description: plan.description || "",
  maxActiveProducts: plan.maxActiveProducts,
  price: plan.price,
  currency: plan.currency,
  billingPeriodDays: plan.billingPeriodDays,
  isActive: plan.isActive !== false,
  isPurchasable: Boolean(plan.isPurchasable),
  displayOrder: plan.displayOrder ?? 0,
});

const readPlanNumber = (value, { label, min, max, integer = false }) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return { ok: false, message: `${label} must be a number.` };
  }
  if (integer && !Number.isInteger(numeric)) {
    return { ok: false, message: `${label} must be a whole number.` };
  }
  if (numeric < min || numeric > max) {
    return { ok: false, message: `${label} must be between ${min} and ${max}.` };
  }
  return { ok: true, value: integer ? numeric : Math.round(numeric * 100) / 100 };
};

export const adminListStorePlans = async (req, res) => {
  try {
    await ensureDefaultStorePlans();
    const plans = await StorePlan.find({ code: { $in: STORE_PLAN_CODES } }).sort({
      displayOrder: 1,
      code: 1,
    });
    return res.status(200).json({
      success: true,
      plans: plans.map(formatPlan),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const adminUpdateStorePlan = async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!STORE_PLAN_CODES.includes(code)) {
      return res.status(404).json({ success: false, message: "Plan not found." });
    }
    if (req.body?.isPurchasable === true) {
      return res.status(400).json({
        success: false,
        message: "Store checkout is not available yet.",
      });
    }

    await ensureDefaultStorePlans();
    const plan = await StorePlan.findOne({ code });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found." });
    }

    const body = req.body || {};
    let changed = false;

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      const name = readRequiredText(body.name, "Name", 80);
      if (!name.ok) return res.status(400).json({ success: false, message: name.message });
      plan.name = name.value;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(body, "description")) {
      const description = readOptionalText(body.description, "Description", 500);
      if (!description.ok) {
        return res.status(400).json({ success: false, message: description.message });
      }
      plan.description = description.value;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(body, "maxActiveProducts")) {
      const cap = readPlanNumber(body.maxActiveProducts, {
        label: "Active product cap",
        min: 1,
        max: 100000,
        integer: true,
      });
      if (!cap.ok) return res.status(400).json({ success: false, message: cap.message });
      plan.maxActiveProducts = cap.value;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(body, "price")) {
      const price = readPlanNumber(body.price, { label: "Price", min: 0, max: 1000000 });
      if (!price.ok) return res.status(400).json({ success: false, message: price.message });
      plan.price = price.value;
      plan.isPurchasable = false;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(body, "currency")) {
      const currency = String(body.currency || "").trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) {
        return res.status(400).json({
          success: false,
          message: "Currency must be a 3-letter code.",
        });
      }
      plan.currency = currency;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(body, "billingPeriodDays")) {
      const days = readPlanNumber(body.billingPeriodDays, {
        label: "Billing period",
        min: 1,
        max: 366,
        integer: true,
      });
      if (!days.ok) return res.status(400).json({ success: false, message: days.message });
      plan.billingPeriodDays = days.value;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
      plan.isActive = Boolean(body.isActive);
      changed = true;
    }

    if (!changed) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    await plan.save();
    return res.status(200).json({
      success: true,
      message: "Plan saved. Checkout stays off.",
      plan: formatPlan(plan),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const listPublicStores = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });
    const filter = { status: "active" };
    if (req.query.owner !== undefined) {
      const ownerId = parseObjectIdInput(req.query.owner);
      if (!ownerId) {
        return res.status(400).json({
          success: false,
          message: "Owner must be a valid user ID.",
        });
      }
      filter.owner = ownerId;
    }
    const q = String(req.query.q || "").trim();
    if (q) {
      filter.name = { $regex: escapeRegex(q), $options: "i" };
    }

    const [stores, total] = await Promise.all([
      Store.find(filter)
        .populate("owner", OWNER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Store.countDocuments(filter),
    ]);
    const followed = new Set();
    if (req.user?._id && stores.length) {
      const rows = await StoreFollow.find({
        follower: req.user._id,
        store: { $in: stores.map((store) => store._id) },
      })
        .select("store")
        .lean();
      rows.forEach((row) => followed.add(String(row.store)));
    }

    return res.status(200).json({
      success: true,
      stores: stores.map((store) =>
        formatStore(store, {
          viewerId: req.user?._id,
          followedByMe: followed.has(String(store._id)),
        })
      ),
      pagination: buildPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

const loadActiveStore = async (param) => {
  const store = await loadStore(param);
  if (!store || store.status !== "active") return null;
  return store;
};

export const followStore = async (req, res) => {
  try {
    const store = await loadActiveStore(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    if (isOwner(store, req.user)) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow your own store.",
      });
    }
    await StoreFollow.create({ follower: req.user._id, store: store._id });
    await Store.updateOne({ _id: store._id }, { $inc: { followerCount: 1 } });
    store.followerCount = (store.followerCount || 0) + 1;
    return res.status(200).json({
      success: true,
      message: "Store followed.",
      store: await presentStore(store, req.user._id),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "You already follow this store." });
    }
    return sendServerError(res, error);
  }
};

export const unfollowStore = async (req, res) => {
  try {
    const store = await loadStore(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    const removed = await StoreFollow.findOneAndDelete({
      follower: req.user._id,
      store: store._id,
    });
    if (!removed) {
      return res.status(400).json({ success: false, message: "You do not follow this store." });
    }
    await Store.updateOne(
      { _id: store._id, followerCount: { $gt: 0 } },
      { $inc: { followerCount: -1 } }
    );
    store.followerCount = Math.max(0, (store.followerCount || 0) - 1);
    return res.status(200).json({
      success: true,
      message: "Store unfollowed.",
      store: await presentStore(store, req.user._id),
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

export const messageStore = async (req, res) => {
  try {
    const store = await loadActiveStore(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    const ownerId = store.owner?._id || store.owner;
    if (String(ownerId) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot message your own store.",
      });
    }
    if (await isMessagingBlocked(req.user._id, ownerId)) {
      return res.status(403).json({
        success: false,
        message: "You cannot message this user.",
      });
    }
    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ success: false, message: "Please include a message." });
    }
    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message must be 2000 characters or fewer.",
      });
    }
    if (await respondIfBanned(res, message)) return;

    const conversation = await getOrCreateConversation(req.user._id, ownerId);
    await sendDirectMessage({
      conversation,
      author: req.user,
      text: message,
      storeSnapshot: {
        storeId: store._id,
        shortCode: store.shortCode || "",
        slug: store.slug,
        name: store.name,
        category: store.category,
        city: store.city || "",
        state: store.state || "",
        country: store.country || "",
        logo: store.logo || "",
      },
      io: req.app.get("io"),
    });
    return res.status(200).json({
      success: true,
      message: "Your message was sent.",
      conversationId: conversation._id,
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};
