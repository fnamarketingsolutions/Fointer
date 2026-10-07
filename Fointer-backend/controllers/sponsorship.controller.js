import crypto from "crypto";
import mongoose from "mongoose";
import Community from "../models/community.js";
import CommunityMember from "../models/communityMember.js";
import CommunitySponsoredEarning from "../models/communitySponsoredEarning.js";
import Listing from "../models/listing.js";
import SponsoredPackage from "../models/sponsoredPackage.js";
import SponsoredPlacement from "../models/sponsoredPlacement.js";
import SponsoredPurchase from "../models/sponsoredPurchase.js";
import SystemSetting from "../models/systemSetting.js";
import { resolveDocumentId } from "../utils/shortCode.js";
import { matchesSponsoredGeo } from "../utils/sponsoredTargeting.js";
import { sendServerError } from "../utils/safeError.js";

const normalizeList = (value, label) => {
  if (value == null || value === "") return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be a list.`);
  const items = value.map((item) => String(item || "").trim()).filter(Boolean);
  if (items.length > 100 || items.some((item) => item.length > 100)) {
    throw new Error(`${label} must contain at most 100 values, each 100 characters or fewer.`);
  }
  return [...new Set(items)];
};

const packageFlag = (value, fallback, label) => {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be true or false.`);
  return value;
};

const flutterwaveSecret = () => String(process.env.FLW_SECRET_KEY || "").trim();

const getGlobalSettings = async () =>
  (await SystemSetting.findOne({ key: "global" })) ||
  (await SystemSetting.create({ key: "global" }));

const cleanPackage = (body = {}) => {
  const name = String(body.name || "").trim();
  const price = Number(body.price);
  const durationDays = Number(body.durationDays);
  const currency = String(body.currency || "").trim().toUpperCase();
  const status = String(body.status || "active").trim().toLowerCase();
  const placement = body.placement || {};
  const geo = body.geo || {};
  if (typeof placement !== "object" || Array.isArray(placement)) {
    throw new Error("Placement settings must be an object.");
  }
  if (typeof geo !== "object" || Array.isArray(geo)) {
    throw new Error("Geo targeting must be an object.");
  }
  const priority = Number(placement.priority ?? 0);
  const communityAllowList = normalizeList(
    body.communityAllowList,
    "Community allow-list"
  );

  if (!name || name.length > 100) throw new Error("Enter a package name (100 characters or fewer).");
  if (!Number.isFinite(price) || price <= 0) throw new Error("Package price must be greater than zero.");
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
    throw new Error("Package duration must be between 1 and 365 days.");
  }
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Enter a valid 3-letter currency code.");
  if (!["active", "inactive"].includes(status)) throw new Error("Package status must be active or inactive.");
  if (!Number.isInteger(priority) || priority < 0 || priority > 1000) {
    throw new Error("Placement priority must be between 0 and 1000.");
  }
  if (communityAllowList.some((id) => !mongoose.isValidObjectId(id))) {
    throw new Error("One or more community selections are invalid.");
  }

  return {
    name,
    price,
    durationDays,
    currency,
    status,
    placement: {
      top: packageFlag(placement.top, false, "Top placement"),
      section: packageFlag(placement.section, true, "Sponsored section"),
      badge: packageFlag(placement.badge, true, "Sponsored badge"),
      priority,
      communityRequired: packageFlag(
        placement.communityRequired,
        false,
        "Community requirement"
      ),
    },
    geo: {
      countries: normalizeList(geo.countries, "Countries"),
      states: normalizeList(geo.states, "States"),
      cities: normalizeList(geo.cities, "Cities"),
    },
    communityAllowList,
  };
};

const packagePayload = (row) => ({
  id: String(row._id),
  name: row.name,
  price: row.price,
  currency: row.currency,
  durationDays: row.durationDays,
  status: row.status,
  placement: row.placement,
  geo: row.geo,
  communityAllowList: (row.communityAllowList || []).map((id) =>
    String(id?._id || id)
  ),
});

export const listSponsoredPackages = async (_req, res) => {
  try {
    const packages = await SponsoredPackage.find({ status: "active" })
      .sort({ price: 1, name: 1 })
      .lean();
    return res.json({ success: true, packages: packages.map(packagePayload) });
  } catch (error) {
    return sendServerError(res, error, "Failed to load sponsorship packages.");
  }
};

export const getSponsorOptions = async (req, res) => {
  try {
    const id = await resolveDocumentId(Listing, req.params.id);
    const listing = id ? await Listing.findById(id).lean() : null;
    if (!listing || String(listing.seller) !== String(req.user._id)) {
      return res.status(404).json({ success: false, message: "Your listing was not found." });
    }
    if (listing.status !== "active") {
      return res.status(400).json({ success: false, message: "Only active listings can be sponsored." });
    }

    const [packages, memberships] = await Promise.all([
      SponsoredPackage.find({ status: "active" }).sort({ price: 1, name: 1 }).lean(),
      CommunityMember.find({ user: req.user._id, status: "active" })
        .select("community")
        .lean(),
    ]);
    const communities = await Community.find({
      $or: [
        { type: "public" },
        { owner: req.user._id },
        { _id: { $in: memberships.map((membership) => membership.community) } },
      ],
    })
      .select("_id name shortCode type owner")
      .sort({ name: 1 })
      .lean();
    const matchingPackages = packages.filter((sponsoredPackage) =>
      matchesSponsoredGeo(sponsoredPackage.geo, listing)
    );
    return res.json({
      success: true,
      listing: { id: String(listing._id), title: listing.title, city: listing.city, state: listing.state, country: listing.country },
      packages: matchingPackages.map(packagePayload),
      hasActivePackages: packages.length > 0,
      communities: communities.map((community) => ({
        id: String(community._id),
        name: community.name,
        shortCode: community.shortCode || "",
        type: community.type,
      })),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load sponsorship options.");
  }
};

export const createSponsoredCheckout = async (req, res) => {
  let purchase;
  try {
    const secret = flutterwaveSecret();
    const secretHash = String(process.env.FLW_SECRET_HASH || "").trim();
    const frontendUrl = String(process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");
    if (!secret || !secretHash || !frontendUrl) {
      return res.status(503).json({
        success: false,
        message: "Flutterwave is not configured. Set FLW_SECRET_KEY, FLW_SECRET_HASH, and FRONTEND_URL.",
      });
    }

    const listingId = await resolveDocumentId(Listing, req.params.id);
    const packageId = String(req.body.packageId || "").trim();
    if (!mongoose.isValidObjectId(packageId)) {
      return res.status(400).json({ success: false, message: "Choose a valid sponsorship package." });
    }
    const [listing, sponsoredPackage] = await Promise.all([
      listingId ? Listing.findById(listingId) : null,
      SponsoredPackage.findOne({ _id: packageId, status: "active" }),
    ]);
    if (!listing || String(listing.seller) !== String(req.user._id)) {
      return res.status(404).json({ success: false, message: "Your listing was not found." });
    }
    if (listing.status !== "active") {
      return res.status(400).json({ success: false, message: "Only active listings can be sponsored." });
    }
    if (!sponsoredPackage) {
      return res.status(400).json({ success: false, message: "Choose an active sponsorship package." });
    }
    if (!matchesSponsoredGeo(sponsoredPackage.geo, listing)) {
      return res.status(400).json({
        success: false,
        message: "This listing does not match the package's geographic targeting.",
      });
    }

    const communityId = String(req.body.communityId || "").trim();
    let community = null;
    if (communityId) {
      if (!mongoose.isValidObjectId(communityId)) {
        return res.status(400).json({ success: false, message: "Choose a valid community." });
      }
      community = await Community.findById(communityId).select("_id owner name");
      if (!community) {
        return res.status(400).json({ success: false, message: "The selected community no longer exists." });
      }
      if (
        sponsoredPackage.communityAllowList.length &&
        !sponsoredPackage.communityAllowList.some((id) => String(id) === communityId)
      ) {
        return res.status(400).json({ success: false, message: "This package is not available in the selected community." });
      }
    } else if (sponsoredPackage.placement.communityRequired) {
      return res.status(400).json({ success: false, message: "Choose a community for this package." });
    }

    const reference = `FO-SPONSOR-${crypto.randomUUID()}`;
    const settings = await getGlobalSettings();
    purchase = await SponsoredPurchase.create({
      listing: listing._id,
      buyer: req.user._id,
      community: community?._id || null,
      communityOwner: community?.owner || null,
      package: sponsoredPackage._id,
      amount: sponsoredPackage.price,
      currency: sponsoredPackage.currency,
      providerReference: reference,
      placementSnapshot: {
        top: sponsoredPackage.placement.top,
        section: sponsoredPackage.placement.section,
        badge: sponsoredPackage.placement.badge,
        priority: sponsoredPackage.placement.priority,
      },
      geoSnapshot: sponsoredPackage.geo.toObject(),
      commissionPercentSnapshot: settings.communitySponsoredCommissionPercent || 0,
      packageSnapshot: {
        name: sponsoredPackage.name,
        durationDays: sponsoredPackage.durationDays,
      },
    });

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount: sponsoredPackage.price,
        currency: sponsoredPackage.currency,
        redirect_url: `${frontendUrl}/marketplace/my-listings?payment=pending`,
        customer: {
          email: req.user.email,
          name: req.user.name || req.user.username,
        },
        customizations: {
          title: "Fointer listing promotion",
          description: `Promotion fee for ${listing.title}`,
        },
        meta: { purchaseId: String(purchase._id), listingId: String(listing._id) },
      }),
    });
    const data = await response.json();
    const paymentLink = data?.data?.link;
    if (!response.ok || data?.status !== "success" || !paymentLink) {
      if (response.status >= 400 && response.status < 500) {
        await SponsoredPurchase.updateOne(
          { _id: purchase._id, paymentStatus: "pending" },
          { $set: { paymentStatus: "failed" } }
        );
      }
      console.error("Flutterwave checkout initialization failed", {
        status: response.status,
        message: data?.message || "No checkout link returned",
      });
      return res.status(502).json({
        success: false,
        message: "Flutterwave could not start checkout. Please try again.",
      });
    }

    await SponsoredPurchase.updateOne(
      { _id: purchase._id },
      { $set: { paymentLink } }
    );
    return res.status(201).json({
      success: true,
      checkoutUrl: paymentLink,
      purchaseId: String(purchase._id),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to start sponsorship checkout.");
  }
};

const signatureMatches = (provided, expected) => {
  const left = Buffer.from(String(provided || ""));
  const right = Buffer.from(String(expected || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const activatePaidPurchase = async (purchase, transactionId) => {
  if (purchase.paymentStatus === "refunded") return;
  if (purchase.paymentStatus !== "paid") {
    const now = new Date();
    const duration = Math.max(1, Number(purchase.packageSnapshot?.durationDays) || 1);
    const expiresAt = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
    const settings = await getGlobalSettings();
    const percent = Math.max(
      0,
      Math.min(100, Number(settings.communitySponsoredCommissionPercent) || 0)
    );
    const activated = await SponsoredPurchase.findOneAndUpdate(
      { _id: purchase._id, paymentStatus: "pending" },
      {
        $set: {
          paymentStatus: "paid",
          providerTransactionId: String(transactionId || ""),
          startsAt: now,
          expiresAt,
          commissionPercentSnapshot: percent,
        },
      },
      { new: true }
    );
    if (activated) purchase = activated;
    else purchase = await SponsoredPurchase.findById(purchase._id);
    if (!purchase || purchase.paymentStatus === "refunded") return;
    if (purchase.paymentStatus !== "paid") {
      throw new Error("Sponsorship payment was not pending when activation was attempted.");
    }
  }
  const now = purchase.startsAt || new Date();
  const duration = Math.max(1, Number(purchase.packageSnapshot?.durationDays) || 1);
  const expiresAt =
    purchase.expiresAt ||
    new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
  const percent = Math.max(
    0,
    Math.min(100, Number(purchase.commissionPercentSnapshot) || 0)
  );

  await SponsoredPlacement.findOneAndUpdate(
    { purchase: purchase._id },
    {
      $set: {
        listing: purchase.listing,
        community: purchase.community,
        status: "active",
        startsAt: now,
        expiresAt,
        placement: purchase.placementSnapshot,
        geo: purchase.geoSnapshot,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (purchase.community && purchase.communityOwner) {
    const commissionAmount =
      Math.round(purchase.amount * (percent / 100) * 100) / 100;
    await CommunitySponsoredEarning.findOneAndUpdate(
      { purchase: purchase._id },
      {
        $set: {
          community: purchase.community,
          owner: purchase.communityOwner,
          gross: purchase.amount,
          percentUsed: percent,
          commissionAmount,
          currency: purchase.currency,
          status: "earned",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await Listing.updateOne(
      { _id: purchase.listing },
      { $set: { community: purchase.community } }
    );
  }
  const latest = await SponsoredPurchase.findById(purchase._id)
    .select("paymentStatus")
    .lean();
  if (latest?.paymentStatus === "refunded") {
    await SponsoredPlacement.updateOne(
      { purchase: purchase._id },
      { $set: { status: "refunded" } }
    );
    await CommunitySponsoredEarning.updateOne(
      { purchase: purchase._id },
      { $set: { status: "reversed" } }
    );
  }
};

const reverseRefundedPurchase = async (reference) => {
  const purchase = await SponsoredPurchase.findOne({ providerReference: reference });
  if (!purchase) return;
  await SponsoredPurchase.updateOne(
    { _id: purchase._id, paymentStatus: { $ne: "refunded" } },
    { $set: { paymentStatus: "refunded" } }
  );
  await SponsoredPlacement.updateOne(
    { purchase: purchase._id },
    { $set: { status: "refunded" } }
  );
  await CommunitySponsoredEarning.updateOne(
    { purchase: purchase._id },
    { $set: { status: "reversed" } }
  );
};

export const handleFlutterwaveWebhook = async (req, res) => {
  const secretHash = String(process.env.FLW_SECRET_HASH || "").trim();
  const signature = req.get("verif-hash") || req.get("x-verif-hash");
  if (!secretHash || !signatureMatches(signature, secretHash)) {
    return res.status(401).json({ success: false, message: "Invalid webhook signature." });
  }

  try {
    const event = JSON.parse(req.body.toString("utf8"));
    const eventType = String(event?.event || "").toLowerCase();
    const reference = String(event?.data?.tx_ref || "").trim();
    if (!reference) return res.status(400).json({ success: false, message: "Missing transaction reference." });

    if (eventType.includes("refund") || String(event?.data?.status || "").toLowerCase() === "refunded") {
      await reverseRefundedPurchase(reference);
      return res.status(200).json({ success: true });
    }
    if (eventType !== "charge.completed") {
      return res.status(200).json({ success: true, ignored: true });
    }

    const purchase = await SponsoredPurchase.findOne({ providerReference: reference });
    if (!purchase) return res.status(404).json({ success: false, message: "Sponsorship purchase not found." });
    if (purchase.paymentStatus === "refunded") return res.status(200).json({ success: true });

    const transactionId = String(event?.data?.id || "");
    if (!transactionId || !flutterwaveSecret()) {
      return res.status(503).json({ success: false, message: "Flutterwave payment verification is unavailable." });
    }
    const verificationResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
      { headers: { Authorization: `Bearer ${flutterwaveSecret()}` } }
    );
    const verification = await verificationResponse.json();
    const payment = verification?.data;
    const hasMatchingReference =
      verificationResponse.ok &&
      verification?.status === "success" &&
      String(payment?.tx_ref || "") === purchase.providerReference;
    if (
      hasMatchingReference &&
      String(payment?.status || "").toLowerCase() !== "successful"
    ) {
      await SponsoredPurchase.updateOne(
        { _id: purchase._id, paymentStatus: "pending" },
        { $set: { paymentStatus: "failed" } }
      );
      return res.status(200).json({ success: true });
    }
    const matchesPurchase =
      hasMatchingReference &&
      String(payment?.status || "").toLowerCase() === "successful" &&
      String(payment?.currency || "").toUpperCase() === purchase.currency &&
      Math.abs(Number(payment?.amount) - purchase.amount) < 0.005;
    if (!matchesPurchase) {
      console.error("Flutterwave transaction verification did not match sponsorship purchase", {
        purchaseId: String(purchase._id),
        transactionId,
      });
      return res.status(400).json({ success: false, message: "Payment verification failed." });
    }

    await activatePaidPurchase(purchase, transactionId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Flutterwave webhook processing failed", error);
    return res.status(500).json({ success: false, message: "Webhook processing failed." });
  }
};

export const getAdminSponsorshipData = async (_req, res) => {
  try {
    const [packages, communities, purchases, placements, earnings, settings] =
      await Promise.all([
        SponsoredPackage.find().populate("communityAllowList", "name").sort({ createdAt: -1 }).lean(),
        Community.find().select("_id name").sort({ name: 1 }).lean(),
        SponsoredPurchase.find()
          .populate("listing", "title shortCode")
          .populate("buyer", "name username email")
          .populate("community", "name")
          .populate("package", "name")
          .sort({ createdAt: -1 })
          .limit(200)
          .lean(),
        SponsoredPlacement.find({
          status: "active",
          startsAt: { $lte: new Date() },
          expiresAt: { $gt: new Date() },
        })
          .populate("listing", "title shortCode")
          .populate("community", "name")
          .sort({ expiresAt: 1 })
          .lean(),
        CommunitySponsoredEarning.find()
          .populate("community", "name")
          .populate("owner", "name username email")
          .populate("purchase", "providerReference paymentStatus")
          .sort({ createdAt: -1 })
          .limit(200)
          .lean(),
        getGlobalSettings(),
      ]);
    const earningsSummary = new Map();
    for (const earning of earnings) {
      const communityId = String(earning.community?._id || earning.community);
      const ownerId = String(earning.owner?._id || earning.owner);
      const key = [
        communityId,
        ownerId,
        earning.currency,
        earning.percentUsed,
        earning.status,
      ].join(":");
      const row = earningsSummary.get(key) || {
        community: earning.community,
        owner: earning.owner,
        currency: earning.currency,
        percentUsed: earning.percentUsed,
        status: earning.status,
        gross: 0,
        commissionAmount: 0,
        purchaseCount: 0,
      };
      row.gross += Number(earning.gross) || 0;
      row.commissionAmount += Number(earning.commissionAmount) || 0;
      row.purchaseCount += 1;
      earningsSummary.set(key, row);
    }

    return res.json({
      success: true,
      packages: packages.map((row) => ({
        ...packagePayload(row),
        communityAllowList: (row.communityAllowList || []).map((item) => ({
          id: String(item._id),
          name: item.name,
        })),
      })),
      communities: communities.map((row) => ({ id: String(row._id), name: row.name })),
      purchases,
      activePlacements: placements,
      earnings: [...earningsSummary.values()],
      earningEntries: earnings,
      communitySponsoredCommissionPercent: settings.communitySponsoredCommissionPercent || 0,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load sponsorship reports.");
  }
};

export const createSponsoredPackage = async (req, res) => {
  try {
    const payload = cleanPackage(req.body);
    const communityIds = payload.communityAllowList;
    const found = communityIds.length
      ? await Community.countDocuments({ _id: { $in: communityIds } })
      : communityIds.length;
    if (found !== communityIds.length) {
      return res.status(400).json({ success: false, message: "One or more selected communities do not exist." });
    }
    const sponsoredPackage = await SponsoredPackage.create(payload);
    return res.status(201).json({ success: true, package: packagePayload(sponsoredPackage) });
  } catch (error) {
    if (error instanceof Error && !error.name.startsWith("Mongo")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return sendServerError(res, error, "Failed to create sponsorship package.");
  }
};

export const updateSponsoredPackage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Sponsorship package not found." });
    }
    const payload = cleanPackage(req.body);
    const communityIds = payload.communityAllowList;
    const found = communityIds.length
      ? await Community.countDocuments({ _id: { $in: communityIds } })
      : communityIds.length;
    if (found !== communityIds.length) {
      return res.status(400).json({ success: false, message: "One or more selected communities do not exist." });
    }
    const sponsoredPackage = await SponsoredPackage.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );
    if (!sponsoredPackage) {
      return res.status(404).json({ success: false, message: "Sponsorship package not found." });
    }
    return res.json({ success: true, package: packagePayload(sponsoredPackage) });
  } catch (error) {
    if (error instanceof Error && !error.name.startsWith("Mongo")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return sendServerError(res, error, "Failed to update sponsorship package.");
  }
};

export const deleteSponsoredPackage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Sponsorship package not found." });
    }
    const purchaseCount = await SponsoredPurchase.countDocuments({ package: req.params.id });
    if (purchaseCount > 0) {
      return res.status(409).json({
        success: false,
        message: "This package has purchase history and cannot be deleted. Deactivate it instead.",
      });
    }
    const sponsoredPackage = await SponsoredPackage.findByIdAndDelete(req.params.id);
    if (!sponsoredPackage) {
      return res.status(404).json({ success: false, message: "Sponsorship package not found." });
    }
    return res.json({ success: true, message: "Sponsorship package deleted." });
  } catch (error) {
    return sendServerError(res, error, "Failed to delete sponsorship package.");
  }
};

export const updateSponsoredCommission = async (req, res) => {
  try {
    const value = Number(req.body.communitySponsoredCommissionPercent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return res.status(400).json({ success: false, message: "Commission percent must be between 0 and 100." });
    }
    const settings = await getGlobalSettings();
    settings.communitySponsoredCommissionPercent = value;
    await settings.save();
    return res.json({
      success: true,
      communitySponsoredCommissionPercent: settings.communitySponsoredCommissionPercent,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update sponsorship commission.");
  }
};

export const listMySponsoredPurchases = async (req, res) => {
  try {
    const purchases = await SponsoredPurchase.find({ buyer: req.user._id })
      .populate("listing", "title shortCode")
      .populate("community", "name")
      .populate("package", "name durationDays")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, purchases });
  } catch (error) {
    return sendServerError(res, error, "Failed to load sponsorship history.");
  }
};

export const listMyCommunitySponsoredEarnings = async (req, res) => {
  try {
    const earnings = await CommunitySponsoredEarning.find({ owner: req.user._id })
      .populate("community", "name")
      .populate("purchase", "paymentStatus startsAt expiresAt")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.json({ success: true, earnings });
  } catch (error) {
    return sendServerError(res, error, "Failed to load community promotion earnings.");
  }
};
