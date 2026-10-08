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
import {
  normalizePromoteLocation,
  packageAvailableForLocation,
} from "../utils/sponsoredTargeting.js";
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

const clampPercent = (value, fallback = 0) =>
  Math.max(0, Math.min(100, Number(value ?? fallback) || 0));

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const moneyByCurrencyFromGroups = (groups) =>
  groups
    .map((row) => ({
      currency: String(row._id || "USD").toUpperCase(),
      amount: roundMoney(row.amount),
      count: Number(row.count) || 0,
    }))
    .sort((a, b) => b.amount - a.amount);

const currencyAmountsFromMap = (map) =>
  [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount: roundMoney(amount) }))
    .sort((a, b) => b.amount - a.amount);

const paymentSuccessfulForPurchase = (payment, purchase) =>
  String(payment?.status || "").toLowerCase() === "successful" &&
  String(payment?.currency || "").toUpperCase() === purchase.currency &&
  Math.abs(Number(payment?.amount) - purchase.amount) < 0.005;

const ensureCommunitiesExist = async (communityIds) => {
  if (!communityIds.length) return true;
  const found = await Community.countDocuments({ _id: { $in: communityIds } });
  return found === communityIds.length;
};

/** Roll up leaderboard currency rows (earned / reversed / net). */
const formatLeaderCurrency = (rows = []) => {
  const map = new Map();
  for (const row of rows) {
    const currency = String(row.currency || "USD").toUpperCase();
    const current = map.get(currency) || {
      currency,
      earned: 0,
      reversed: 0,
      net: 0,
      gross: 0,
      purchaseCount: 0,
    };
    const commission = roundMoney(row.commission);
    const gross = roundMoney(row.gross);
    const count = Number(row.count) || 0;
    if (row.status === "earned") {
      current.earned += commission;
      current.gross += gross;
      current.purchaseCount += count;
    } else if (row.status === "reversed") {
      current.reversed += commission;
    }
    current.net = roundMoney(current.earned - current.reversed);
    map.set(currency, current);
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      earned: roundMoney(row.earned),
      reversed: roundMoney(row.reversed),
      gross: roundMoney(row.gross),
    }))
    .sort((a, b) => b.net - a.net);
};

const getGlobalSettings = async () => {
  let settings = await SystemSetting.findOne({ key: "global" });
  if (!settings) {
    settings = await SystemSetting.create({
      key: "global",
      communitySponsoredCommissionPercent: 20,
    });
  } else if (
    settings.communitySponsoredCommissionPercent == null ||
    Number.isNaN(Number(settings.communitySponsoredCommissionPercent))
  ) {
    settings.communitySponsoredCommissionPercent = 20;
    await settings.save();
  }
  return settings;
};

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

  const top = packageFlag(placement.top, false, "Top placement");
  const section = packageFlag(placement.section, true, "Sponsored section");
  const badge = packageFlag(placement.badge, true, "Sponsored badge");
  if (!top && !section && !badge) {
    throw new Error(
      "Enable at least one visibility option: top placement, sponsored section, or sponsored badge."
    );
  }

  return {
    name,
    price,
    durationDays,
    currency,
    status,
    placement: {
      top,
      section,
      badge,
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

const packagePayload = (row, promoteLocation = null) => {
  const geo = row.geo || { countries: [], states: [], cities: [] };
  const isGlobal =
    !geo.countries?.length && !geo.states?.length && !geo.cities?.length;
  const availableForLocation = promoteLocation
    ? packageAvailableForLocation(geo, promoteLocation)
    : true;
  return {
    id: String(row._id),
    name: row.name,
    price: row.price,
    currency: row.currency,
    durationDays: row.durationDays,
    status: row.status,
    placement: row.placement,
    geo,
    isGlobal,
    availableForLocation,
    communityAllowList: (row.communityAllowList || []).map((id) =>
      String(id?._id || id)
    ),
  };
};

const PENDING_CHECKOUT_TTL_MS = 2 * 60 * 60 * 1000;

const getListingSponsorshipState = async (listingId) => {
  const now = new Date();
  const pendingCutoff = new Date(now.getTime() - PENDING_CHECKOUT_TTL_MS);

  await SponsoredPurchase.updateMany(
    {
      listing: listingId,
      paymentStatus: "pending",
      createdAt: { $lt: pendingCutoff },
    },
    { $set: { paymentStatus: "failed" } }
  );

  const [activePlacement, queuedPlacement, pendingPurchase] = await Promise.all([
    SponsoredPlacement.findOne({
      listing: listingId,
      status: "active",
      startsAt: { $lte: now },
      expiresAt: { $gt: now },
    })
      .sort({ expiresAt: -1 })
      .lean(),
    SponsoredPlacement.findOne({
      listing: listingId,
      status: "active",
      startsAt: { $gt: now },
      expiresAt: { $gt: now },
    })
      .sort({ expiresAt: -1 })
      .lean(),
    SponsoredPurchase.findOne({
      listing: listingId,
      paymentStatus: "pending",
      createdAt: { $gte: pendingCutoff },
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const scheduleAnchor = [activePlacement, queuedPlacement]
    .filter(Boolean)
    .sort((a, b) => new Date(b.expiresAt) - new Date(a.expiresAt))[0];

  return {
    now,
    activePlacement,
    queuedPlacement,
    pendingPurchase,
    scheduleAnchor,
    nextStartsAt: scheduleAnchor?.expiresAt
      ? new Date(scheduleAnchor.expiresAt)
      : now,
  };
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
    const state = await getListingSponsorshipState(listing._id);
    const active = state.activePlacement;
    const queued = state.queuedPlacement;
    const defaultLocation = {
      city: listing.city || "",
      state: listing.state || "",
      country: listing.country || "",
    };
    return res.json({
      success: true,
      listing: {
        id: String(listing._id),
        title: listing.title,
        city: listing.city || "",
        state: listing.state || "",
        country: listing.country || "",
      },
      packages: packages.map((row) => packagePayload(row, defaultLocation)),
      communities: communities.map((community) => ({
        id: String(community._id),
        name: community.name,
        shortCode: community.shortCode || "",
        type: community.type,
      })),
      sponsorshipState: {
        hasActive: Boolean(active),
        hasQueued: Boolean(queued),
        hasPendingCheckout: Boolean(state.pendingPurchase),
        canCheckout: !state.pendingPurchase,
        mode: active || queued ? "extend" : "start",
        activeExpiresAt: active?.expiresAt || null,
        queuedStartsAt: queued?.startsAt || null,
        queuedExpiresAt: queued?.expiresAt || null,
        nextStartsAt: state.nextStartsAt,
        pendingPurchaseId: state.pendingPurchase
          ? String(state.pendingPurchase._id)
          : null,
      },
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

    let promoteGeo;
    try {
      promoteGeo = normalizePromoteLocation({
        country: req.body?.country ?? listing.country,
        state: req.body?.state ?? listing.state,
        city: req.body?.city ?? listing.city,
      });
    } catch (locationError) {
      return res.status(400).json({
        success: false,
        message: locationError.message || "Choose a promotion location.",
      });
    }
    if (!packageAvailableForLocation(sponsoredPackage.geo, promoteGeo)) {
      return res.status(400).json({
        success: false,
        message:
          "This package is not available for the selected promotion location. Pick another package or change the location.",
      });
    }

    const state = await getListingSponsorshipState(listing._id);
    if (state.pendingPurchase) {
      return res.status(409).json({
        success: false,
        message:
          "A checkout is already pending for this listing. Finish that payment or wait up to 2 hours before starting another boost.",
        pendingPurchaseId: String(state.pendingPurchase._id),
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
      geoSnapshot: promoteGeo,
      commissionPercentSnapshot:
        settings.communitySponsoredCommissionPercent ?? 20,
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
        redirect_url: `${frontendUrl}/marketplace/promote/success`,
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

const resolveBoostWindow = async (listingId, durationDays) => {
  const duration = Math.max(1, Number(durationDays) || 1);
  const state = await getListingSponsorshipState(listingId);
  const startsAt = new Date(
    Math.max(state.now.getTime(), new Date(state.nextStartsAt).getTime())
  );
  const expiresAt = new Date(startsAt.getTime() + duration * 24 * 60 * 60 * 1000);
  return { startsAt, expiresAt };
};

const activatePaidPurchase = async (purchase, transactionId) => {
  if (purchase.paymentStatus === "refunded") return;
  const duration = Math.max(1, Number(purchase.packageSnapshot?.durationDays) || 1);

  if (purchase.paymentStatus !== "paid") {
    const { startsAt, expiresAt } = await resolveBoostWindow(
      purchase.listing,
      duration
    );
    const settings = await getGlobalSettings();
    const percent = clampPercent(
      settings.communitySponsoredCommissionPercent,
      20
    );
    const activated = await SponsoredPurchase.findOneAndUpdate(
      { _id: purchase._id, paymentStatus: "pending" },
      {
        $set: {
          paymentStatus: "paid",
          providerTransactionId: String(transactionId || ""),
          startsAt,
          expiresAt,
          commissionPercentSnapshot: percent,
        },
      },
      { returnDocument: "after" }
    );
    if (activated) purchase = activated;
    else purchase = await SponsoredPurchase.findById(purchase._id);
    if (!purchase || purchase.paymentStatus === "refunded") return;
    if (purchase.paymentStatus !== "paid") {
      throw new Error("Sponsorship payment was not pending when activation was attempted.");
    }
  }

  let startsAt = purchase.startsAt ? new Date(purchase.startsAt) : null;
  let expiresAt = purchase.expiresAt ? new Date(purchase.expiresAt) : null;
  if (!startsAt || !expiresAt) {
    const window = await resolveBoostWindow(purchase.listing, duration);
    startsAt = window.startsAt;
    expiresAt = window.expiresAt;
    await SponsoredPurchase.updateOne(
      { _id: purchase._id },
      { $set: { startsAt, expiresAt } }
    );
  }
  const percent = clampPercent(purchase.commissionPercentSnapshot, 0);

  await SponsoredPlacement.findOneAndUpdate(
    { purchase: purchase._id },
    {
      $set: {
        listing: purchase.listing,
        community: purchase.community,
        status: "active",
        startsAt,
        expiresAt,
        placement: purchase.placementSnapshot,
        geo: purchase.geoSnapshot,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  if (purchase.community && purchase.communityOwner) {
    const commissionAmount = roundMoney(purchase.amount * (percent / 100));
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
      { upsert: true, setDefaultsOnInsert: true }
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

const verifyAndActivateByTransactionId = async (transactionId, buyerId) => {
  const id = String(transactionId || "").trim();
  if (!id || !flutterwaveSecret()) {
    return { ok: false, status: 503, message: "Payment verification is unavailable." };
  }
  const verificationResponse = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(id)}/verify`,
    { headers: { Authorization: `Bearer ${flutterwaveSecret()}` } }
  );
  const verification = await verificationResponse.json();
  const payment = verification?.data;
  if (
    !verificationResponse.ok ||
    verification?.status !== "success" ||
    !payment?.tx_ref
  ) {
    return { ok: false, status: 400, message: "Unable to verify this payment." };
  }

  const purchase = await SponsoredPurchase.findOne({
    providerReference: String(payment.tx_ref),
  });
  if (!purchase) {
    return { ok: false, status: 404, message: "Sponsorship purchase not found." };
  }
  // Member confirm endpoint must not disclose or re-activate another buyer's purchase.
  if (
    buyerId != null &&
    String(purchase.buyer) !== String(buyerId)
  ) {
    return {
      ok: false,
      status: 403,
      message: "This payment does not belong to you.",
    };
  }
  if (purchase.paymentStatus === "refunded") {
    return { ok: true, purchase, already: true };
  }
  if (purchase.paymentStatus === "paid") {
    await activatePaidPurchase(purchase, id);
    return { ok: true, purchase, already: true };
  }

  if (!paymentSuccessfulForPurchase(payment, purchase)) {
    if (String(payment.status || "").toLowerCase() !== "successful") {
      await SponsoredPurchase.updateOne(
        { _id: purchase._id, paymentStatus: "pending" },
        { $set: { paymentStatus: "failed" } }
      );
    }
    return { ok: false, status: 400, message: "Payment was not successful." };
  }

  await activatePaidPurchase(purchase, id);
  const fresh = await SponsoredPurchase.findById(purchase._id).lean();
  return { ok: true, purchase: fresh, already: false };
};

const formatVerifiedPurchase = async (purchaseDoc) => {
  const purchase = await SponsoredPurchase.findById(purchaseDoc._id)
    .populate("listing", "title shortCode")
    .populate("package", "name durationDays")
    .populate("community", "name")
    .lean();
  if (!purchase) return null;
  const now = Date.now();
  const startsAt = purchase.startsAt ? new Date(purchase.startsAt) : null;
  const expiresAt = purchase.expiresAt ? new Date(purchase.expiresAt) : null;
  const isLive =
    purchase.paymentStatus === "paid" &&
    startsAt &&
    expiresAt &&
    startsAt.getTime() <= now &&
    expiresAt.getTime() > now;
  const isQueued =
    purchase.paymentStatus === "paid" &&
    startsAt &&
    expiresAt &&
    startsAt.getTime() > now;
  return {
    id: String(purchase._id),
    paymentStatus: purchase.paymentStatus,
    startsAt: purchase.startsAt,
    expiresAt: purchase.expiresAt,
    listingId: String(purchase.listing?._id || purchase.listing || ""),
    listingTitle: purchase.listing?.title || "Your listing",
    listingShortCode: purchase.listing?.shortCode || "",
    packageName: purchase.package?.name || purchase.packageSnapshot?.name || "Promotion",
    durationDays:
      purchase.package?.durationDays ||
      purchase.packageSnapshot?.durationDays ||
      null,
    communityName: purchase.community?.name || null,
    isLive,
    isQueued,
    mode: isQueued ? "queued" : isLive ? "active" : purchase.paymentStatus,
  };
};

/** Member return-URL confirmation (webhook backup). */
export const verifySponsoredPayment = async (req, res) => {
  try {
    const transactionId =
      req.body?.transactionId ||
      req.query?.transaction_id ||
      req.query?.transactionId;
    const result = await verifyAndActivateByTransactionId(
      transactionId,
      req.user._id
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }
    const purchase = await formatVerifiedPurchase(result.purchase);
    return res.json({
      success: true,
      already: Boolean(result.already),
      purchase,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to verify sponsorship payment.");
  }
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
    if (!hasMatchingReference || !paymentSuccessfulForPurchase(payment, purchase)) {
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
    const [
      packages,
      communities,
      purchases,
      placements,
      earnings,
      settings,
      purchaseStatusCounts,
      paidGmvByCurrency,
      commissionByCurrencyStatus,
      topEarnerRows,
      topCommunityRows,
      earningEntryCount,
    ] = await Promise.all([
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
        expiresAt: { $gt: new Date() },
      })
        .populate("listing", "title shortCode")
        .populate("community", "name")
        .sort({ startsAt: 1, expiresAt: 1 })
        .lean(),
      CommunitySponsoredEarning.find()
        .populate("community", "name")
        .populate("owner", "name username email")
        .populate("purchase", "providerReference paymentStatus")
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      getGlobalSettings(),
      SponsoredPurchase.aggregate([
        { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
      ]),
      SponsoredPurchase.aggregate([
        { $match: { paymentStatus: "paid" } },
        {
          $group: {
            _id: "$currency",
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      CommunitySponsoredEarning.aggregate([
        {
          $group: {
            _id: { currency: "$currency", status: "$status" },
            amount: { $sum: "$commissionAmount" },
            gross: { $sum: "$gross" },
            count: { $sum: 1 },
          },
        },
      ]),
      CommunitySponsoredEarning.aggregate([
        {
          $group: {
            _id: {
              owner: "$owner",
              currency: "$currency",
              status: "$status",
            },
            commission: { $sum: "$commissionAmount" },
            gross: { $sum: "$gross" },
            count: { $sum: 1 },
            communities: { $addToSet: "$community" },
          },
        },
        {
          $group: {
            _id: "$_id.owner",
            byCurrency: {
              $push: {
                currency: "$_id.currency",
                status: "$_id.status",
                commission: "$commission",
                gross: "$gross",
                count: "$count",
              },
            },
            communities: { $push: "$communities" },
            sortEarned: {
              $sum: {
                $cond: [
                  { $eq: ["$_id.status", "earned"] },
                  "$commission",
                  0,
                ],
              },
            },
          },
        },
        { $sort: { sortEarned: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "ownerDoc",
          },
        },
        { $unwind: { path: "$ownerDoc", preserveNullAndEmptyArrays: true } },
      ]),
      CommunitySponsoredEarning.aggregate([
        {
          $group: {
            _id: {
              community: "$community",
              currency: "$currency",
              status: "$status",
            },
            commission: { $sum: "$commissionAmount" },
            gross: { $sum: "$gross" },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.community",
            byCurrency: {
              $push: {
                currency: "$_id.currency",
                status: "$_id.status",
                commission: "$commission",
                gross: "$gross",
                count: "$count",
              },
            },
            sortEarned: {
              $sum: {
                $cond: [
                  { $eq: ["$_id.status", "earned"] },
                  "$commission",
                  0,
                ],
              },
            },
          },
        },
        { $sort: { sortEarned: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "communities",
            localField: "_id",
            foreignField: "_id",
            as: "communityDoc",
          },
        },
        {
          $unwind: {
            path: "$communityDoc",
            preserveNullAndEmptyArrays: true,
          },
        },
      ]),
      CommunitySponsoredEarning.countDocuments(),
    ]);

    const purchaseCounts = {
      paid: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
      total: 0,
    };
    for (const row of purchaseStatusCounts) {
      const key = String(row._id || "");
      const count = Number(row.count) || 0;
      purchaseCounts.total += count;
      if (Object.prototype.hasOwnProperty.call(purchaseCounts, key)) {
        purchaseCounts[key] = count;
      }
    }

    const earnedMap = new Map();
    const reversedMap = new Map();
    const grossMap = new Map();
    for (const row of commissionByCurrencyStatus) {
      const currency = String(row._id?.currency || "USD").toUpperCase();
      const status = String(row._id?.status || "");
      const amount = roundMoney(row.amount);
      const gross = roundMoney(row.gross);
      if (status === "earned") {
        earnedMap.set(currency, (earnedMap.get(currency) || 0) + amount);
        grossMap.set(currency, (grossMap.get(currency) || 0) + gross);
      } else if (status === "reversed") {
        reversedMap.set(currency, (reversedMap.get(currency) || 0) + amount);
      }
    }
    const commissionEarnedByCurrency = currencyAmountsFromMap(earnedMap);
    const commissionReversedByCurrency = currencyAmountsFromMap(reversedMap);
    const grossPromotedByCurrency = currencyAmountsFromMap(grossMap);

    const topEarners = topEarnerRows.map((row, index) => {
      const communityIds = new Set();
      for (const group of row.communities || []) {
        for (const id of group || []) {
          if (id) communityIds.add(String(id));
        }
      }
      return {
        rank: index + 1,
        owner: row.ownerDoc
          ? {
              id: String(row.ownerDoc._id),
              name: row.ownerDoc.name || "",
              username: row.ownerDoc.username || "",
              email: row.ownerDoc.email || "",
            }
          : { id: String(row._id), name: "", username: "", email: "" },
        communityCount: communityIds.size,
        byCurrency: formatLeaderCurrency(row.byCurrency),
        sortEarned: roundMoney(row.sortEarned),
      };
    });

    const topCommunities = topCommunityRows.map((row, index) => ({
      rank: index + 1,
      community: row.communityDoc
        ? {
            id: String(row.communityDoc._id),
            name: row.communityDoc.name || "Community",
            shortCode: row.communityDoc.shortCode || "",
          }
        : {
            id: String(row._id),
            name: "Community",
            shortCode: "",
          },
      byCurrency: formatLeaderCurrency(row.byCurrency),
      sortEarned: roundMoney(row.sortEarned),
    }));

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
      communitySponsoredCommissionPercent:
        settings.communitySponsoredCommissionPercent ?? 20,
      stats: {
        packagesTotal: packages.length,
        packagesActive: packages.filter((row) => row.status === "active").length,
        activePlacements: placements.length,
        purchases: purchaseCounts,
        paidGmvByCurrency: moneyByCurrencyFromGroups(paidGmvByCurrency),
        grossPromotedByCurrency,
        commissionEarnedByCurrency,
        commissionReversedByCurrency,
        earningEntryCount,
        communitiesTracked: communities.length,
      },
      topEarners,
      topCommunities,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load sponsorship reports.");
  }
};

export const createSponsoredPackage = async (req, res) => {
  try {
    const payload = cleanPackage(req.body);
    if (!(await ensureCommunitiesExist(payload.communityAllowList))) {
      return res.status(400).json({
        success: false,
        message: "One or more selected communities do not exist.",
      });
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
    if (!(await ensureCommunitiesExist(payload.communityAllowList))) {
      return res.status(400).json({
        success: false,
        message: "One or more selected communities do not exist.",
      });
    }
    const sponsoredPackage = await SponsoredPackage.findByIdAndUpdate(
      req.params.id,
      payload,
      { returnDocument: "after", runValidators: true }
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
    const packageId = req.params.id;

    const [paidCount, refundedCount, pendingCount, failedCount] = await Promise.all([
      SponsoredPurchase.countDocuments({ package: packageId, paymentStatus: "paid" }),
      SponsoredPurchase.countDocuments({ package: packageId, paymentStatus: "refunded" }),
      SponsoredPurchase.countDocuments({ package: packageId, paymentStatus: "pending" }),
      SponsoredPurchase.countDocuments({ package: packageId, paymentStatus: "failed" }),
    ]);
    const historyCount = paidCount + refundedCount;

    if (historyCount > 0) {
      return res.status(409).json({
        success: false,
        code: "PACKAGE_HAS_PURCHASE_HISTORY",
        message:
          "This package still has paid (or refunded) purchase history, even if those listings were deleted. Deactivate the package instead of deleting it so reports stay accurate.",
        counts: {
          paid: paidCount,
          refunded: refundedCount,
          pending: pendingCount,
          failed: failedCount,
        },
      });
    }

    if (pendingCount + failedCount > 0) {
      await SponsoredPurchase.deleteMany({
        package: packageId,
        paymentStatus: { $in: ["pending", "failed"] },
      });
    }

    const sponsoredPackage = await SponsoredPackage.findByIdAndDelete(packageId);
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
      .populate("listing", "title shortCode status")
      .populate("community", "name shortCode")
      .populate("package", "name durationDays")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const now = Date.now();
    return res.json({
      success: true,
      purchases: purchases.map((row) => {
        const startsAt = row.startsAt ? new Date(row.startsAt).getTime() : null;
        const expiresAt = row.expiresAt ? new Date(row.expiresAt).getTime() : null;
        const isLive =
          row.paymentStatus === "paid" &&
          startsAt != null &&
          expiresAt != null &&
          startsAt <= now &&
          expiresAt > now;
        const isQueued =
          row.paymentStatus === "paid" &&
          startsAt != null &&
          startsAt > now;
        return {
          id: String(row._id),
          paymentStatus: row.paymentStatus,
          amount: row.amount,
          currency: row.currency,
          providerReference: row.providerReference,
          paymentLink: row.paymentLink || "",
          canCompletePayment:
            row.paymentStatus === "pending" && Boolean(row.paymentLink),
          startsAt: row.startsAt,
          expiresAt: row.expiresAt,
          createdAt: row.createdAt,
          isLive,
          isQueued,
          placement: row.placementSnapshot || null,
          geo: row.geoSnapshot || null,
          packageSnapshot: row.packageSnapshot || null,
          listing: row.listing
            ? {
                id: String(row.listing._id),
                title: row.listing.title || "Listing",
                shortCode: row.listing.shortCode || "",
                status: row.listing.status || "",
              }
            : null,
          community: row.community
            ? {
                id: String(row.community._id),
                name: row.community.name || "Community",
                shortCode: row.community.shortCode || "",
              }
            : null,
          package: row.package
            ? {
                id: String(row.package._id),
                name: row.package.name || row.packageSnapshot?.name || "Promotion",
                durationDays:
                  row.package.durationDays ||
                  row.packageSnapshot?.durationDays ||
                  null,
              }
            : {
                id: null,
                name: row.packageSnapshot?.name || "Promotion",
                durationDays: row.packageSnapshot?.durationDays || null,
              },
        };
      }),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load sponsorship history.");
  }
};

export const listMyCommunitySponsoredEarnings = async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(String(req.user._id));
    const [earnings, totalRows, byCommunityRows] = await Promise.all([
      CommunitySponsoredEarning.find({ owner: ownerId })
        .populate("community", "name shortCode")
        .populate({
          path: "purchase",
          select:
            "paymentStatus startsAt expiresAt amount currency providerReference listing packageSnapshot geoSnapshot",
          populate: { path: "listing", select: "title shortCode status" },
        })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      CommunitySponsoredEarning.aggregate([
        { $match: { owner: ownerId } },
        {
          $group: {
            _id: { currency: "$currency", status: "$status" },
            commission: { $sum: "$commissionAmount" },
            gross: { $sum: "$gross" },
            count: { $sum: 1 },
          },
        },
      ]),
      CommunitySponsoredEarning.aggregate([
        { $match: { owner: ownerId, status: "earned" } },
        {
          $group: {
            _id: { community: "$community", currency: "$currency" },
            commission: { $sum: "$commissionAmount" },
            gross: { $sum: "$gross" },
            count: { $sum: 1 },
          },
        },
        { $sort: { commission: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: "communities",
            localField: "_id.community",
            foreignField: "_id",
            as: "communityDoc",
          },
        },
        {
          $unwind: {
            path: "$communityDoc",
            preserveNullAndEmptyArrays: true,
          },
        },
      ]),
    ]);

    const totalsMap = new Map();
    let entryCount = 0;
    for (const row of totalRows) {
      const currency = String(row._id?.currency || "USD").toUpperCase();
      const status = String(row._id?.status || "");
      const current = totalsMap.get(currency) || {
        currency,
        earned: 0,
        reversed: 0,
        net: 0,
        gross: 0,
        earnedCount: 0,
        reversedCount: 0,
      };
      const commission = roundMoney(row.commission);
      const gross = roundMoney(row.gross);
      const count = Number(row.count) || 0;
      entryCount += count;
      if (status === "earned") {
        current.earned += commission;
        current.gross += gross;
        current.earnedCount += count;
      } else if (status === "reversed") {
        current.reversed += commission;
        current.reversedCount += count;
      }
      current.net = roundMoney(current.earned - current.reversed);
      totalsMap.set(currency, current);
    }
    const totalsByCurrency = [...totalsMap.values()]
      .map((row) => ({
        ...row,
        earned: roundMoney(row.earned),
        reversed: roundMoney(row.reversed),
        gross: roundMoney(row.gross),
      }))
      .sort((a, b) => b.net - a.net);

    return res.json({
      success: true,
      summary: {
        entryCount,
        totalsByCurrency,
        byCommunity: byCommunityRows.map((row) => ({
          community: row.communityDoc
            ? {
                id: String(row.communityDoc._id),
                name: row.communityDoc.name || "Community",
                shortCode: row.communityDoc.shortCode || "",
              }
            : {
                id: String(row._id?.community || ""),
                name: "Community",
                shortCode: "",
              },
          currency: String(row._id?.currency || "USD").toUpperCase(),
          commission: roundMoney(row.commission),
          gross: roundMoney(row.gross),
          count: Number(row.count) || 0,
        })),
      },
      earnings: earnings.map((row) => ({
        id: String(row._id),
        status: row.status,
        gross: row.gross,
        percentUsed: row.percentUsed,
        commissionAmount: row.commissionAmount,
        currency: row.currency,
        createdAt: row.createdAt,
        community: row.community
          ? {
              id: String(row.community._id),
              name: row.community.name || "Community",
              shortCode: row.community.shortCode || "",
            }
          : null,
        purchase: row.purchase
          ? {
              id: String(row.purchase._id),
              paymentStatus: row.purchase.paymentStatus,
              startsAt: row.purchase.startsAt,
              expiresAt: row.purchase.expiresAt,
              amount: row.purchase.amount,
              currency: row.purchase.currency,
              providerReference: row.purchase.providerReference,
              packageName: row.purchase.packageSnapshot?.name || "Promotion",
              geo: row.purchase.geoSnapshot || null,
              listing: row.purchase.listing
                ? {
                    id: String(row.purchase.listing._id),
                    title: row.purchase.listing.title || "Listing",
                    shortCode: row.purchase.listing.shortCode || "",
                    status: row.purchase.listing.status || "",
                  }
                : null,
            }
          : null,
      })),
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load community promotion earnings.");
  }
};
