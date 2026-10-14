import AdPlacementSetting from "../../models/adPlacementSetting.js";
import {
  AD_PLACEMENT_IDS,
  DEFAULT_AD_PLACEMENTS,
  resolveEligibleAdPlacements,
} from "../../utils/subscriptionEntitlement.js";
import { googlePlayConfigStatus } from "./googlePlayBilling.js";
import { appleConfigStatus } from "./appleBilling.js";
import { flutterwaveConfigStatus } from "./flutterwaveBilling.js";

const envAdsenseClient = () =>
  String(process.env.ADSENSE_CLIENT_ID || process.env.VITE_ADSENSE_CLIENT_ID || "").trim();

export const getAdPlacementSettings = async () => {
  let doc = await AdPlacementSetting.findOne({ key: "global" });
  if (!doc) {
    doc = await AdPlacementSetting.create({
      key: "global",
      provider: "none",
      webProvider: "google_adsense",
      androidProvider: "google_admob",
      iosProvider: "google_admob",
      placements: { ...DEFAULT_AD_PLACEMENTS },
      adsenseClientId: envAdsenseClient(),
    });
  }
  return doc;
};

export const updateAdPlacementSettings = async (patch = {}) => {
  const doc = await getAdPlacementSettings();
  if (patch.webProvider !== undefined) doc.webProvider = patch.webProvider;
  if (patch.androidProvider !== undefined) {
    doc.androidProvider = patch.androidProvider;
  }
  if (patch.iosProvider !== undefined) doc.iosProvider = patch.iosProvider;
  if (patch.provider !== undefined) doc.provider = patch.provider;
  if (patch.notes !== undefined) doc.notes = String(patch.notes || "").slice(0, 1000);
  if (patch.adsenseClientId !== undefined) {
    doc.adsenseClientId = String(patch.adsenseClientId || "").trim().slice(0, 80);
  }
  if (patch.placements && typeof patch.placements === "object") {
    for (const id of AD_PLACEMENT_IDS) {
      if (typeof patch.placements[id] === "boolean") {
        doc.placements[id] = patch.placements[id];
      }
    }
  }
  if (patch.adsenseSlots && typeof patch.adsenseSlots === "object") {
    for (const id of AD_PLACEMENT_IDS) {
      if (patch.adsenseSlots[id] !== undefined) {
        doc.adsenseSlots[id] = String(patch.adsenseSlots[id] || "")
          .trim()
          .slice(0, 80);
      }
    }
  }
  await doc.save();
  return doc;
};

export const isWebAdProviderConfigured = (settings) => {
  const clientId = String(settings?.adsenseClientId || envAdsenseClient() || "").trim();
  const provider = settings?.webProvider || "none";
  if (provider === "none") return false;
  if (provider === "google_adsense") return Boolean(clientId);
  if (provider === "custom") return Boolean(clientId);
  return false;
};

export const buildPublicAdsConfig = ({ settings, adFreeActive }) => {
  const clientId = String(settings?.adsenseClientId || envAdsenseClient() || "").trim();
  const providerConfigured = isWebAdProviderConfigured(settings);
  const placements = resolveEligibleAdPlacements({
    adFreeActive,
    placementConfig: settings?.placements || DEFAULT_AD_PLACEMENTS,
    providerConfigured,
  });

  const slots = {};
  for (const id of AD_PLACEMENT_IDS) {
    slots[id] = placements[id]
      ? String(settings?.adsenseSlots?.[id] || "").trim()
      : "";
  }

  return {
    adFreeActive: Boolean(adFreeActive),
    provider: providerConfigured ? settings.webProvider : "none",
    adsenseClientId: providerConfigured && !adFreeActive ? clientId : "",
    placements,
    slots,
    /** Categories that must never be treated as removable third-party ads. */
    nonRemovableCategories: [
      "organic_posts",
      "community_content",
      "direct_messages",
      "sponsored_marketplace_listings",
      "fointer_first_party_banners",
    ],
  };
};

export const buildIntegrationStatus = async () => {
  const settings = await getAdPlacementSettings();
  const flw = flutterwaveConfigStatus();
  const play = googlePlayConfigStatus();
  const apple = appleConfigStatus();
  const adsenseConfigured = isWebAdProviderConfigured(settings);

  return {
    billing: {
      web: {
        provider: "flutterwave",
        ...flw,
      },
      android: {
        provider: "google_play",
        ...play,
      },
      ios: {
        provider: "apple_app_store",
        ...apple,
      },
    },
    advertising: {
      webProvider: settings.webProvider,
      androidProvider: settings.androidProvider,
      iosProvider: settings.iosProvider,
      adsenseConfigured,
      adsenseClientIdSet: Boolean(
        String(settings.adsenseClientId || envAdsenseClient() || "").trim()
      ),
      placements: settings.placements,
      /** Secrets are never returned — only presence flags. */
      admobAppIdConfigured: Boolean(
        String(process.env.ADMOB_ANDROID_APP_ID || "").trim() ||
          String(process.env.ADMOB_IOS_APP_ID || "").trim()
      ),
    },
  };
};

export { AD_PLACEMENT_IDS };
