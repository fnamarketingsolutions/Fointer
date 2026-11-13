import {
  createTimeLimitedTurnServer,
  fetchConfiguredTurnCredentials,
  normalizeTurnServers,
} from "../../utils/webrtcIceServers.js";

export const ICE_CONFIG_VERSION = 1;
const DEFAULT_REFRESH_MS = 5 * 60 * 1000;
const EXPIRY_MARGIN_MS = 30 * 1000;
const STUN_FALLBACK_REFRESH_MS = 60 * 1000;

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const flagOn = (value) => {
  const text = String(value || "").trim().toLowerCase();
  return text === "1" || text === "true";
};

export const iceRefreshMs = (env = process.env) => {
  const parsed = Number(env.ICE_CONFIG_REFRESH_MS);
  if (Number.isFinite(parsed) && parsed >= 30_000 && parsed <= 60 * 60 * 1000) return parsed;
  return DEFAULT_REFRESH_MS;
};

export const iceProductionMode = (env = process.env) =>
  String(env.NODE_ENV || "").trim().toLowerCase() === "production";

export const iceStunFallbackAllowed = (env = process.env) => {
  if (iceProductionMode(env) || flagOn(env.ICE_REQUIRE_TURN)) return false;
  const nodeEnv = String(env.NODE_ENV || "").trim().toLowerCase();
  return nodeEnv === "development" || flagOn(env.ICE_ALLOW_STUN_FALLBACK);
};

const hasTurn = (servers) =>
  (servers || []).some((server) => {
    const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
    return urls.some((url) => /^turns?:/i.test(String(url || "")));
  });

const rtcServers = (turnServers) => [...STUN_SERVERS, ...turnServers];

/**
 * Relay-only is a backend test policy. It is never returned without TURN,
 * and production ignores the request.
 */
export const relayTransportPolicy = ({ production, relayAvailable, relayTest = false, env = process.env }) => {
  if (production || !relayAvailable) return "all";
  if (flagOn(env.ICE_RELAY_ONLY) || relayTest) return "relay";
  return "all";
};

const turnIdentity = (userId) =>
  String(userId || "fointer").replace(/[^a-zA-Z0-9._-]/g, "") || "fointer";

const sharedSecretConfigured = (env) => {
  const secret = String(env.TURN_SHARED_SECRET || "").trim();
  return Boolean(secret && /turns?:/i.test(String(env.TURN_URL || "")));
};

const configuredStaticTurn = (env) => {
  const servers = normalizeTurnServers([
    {
      urls: env.TURN_URL,
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL,
    },
  ]);
  return servers.length ? { servers, expiresAt: null, scope: "app" } : null;
};

const buildResponse = ({
  turnServers,
  expiresAt,
  now,
  production,
  fallback = null,
  relayTest = false,
  env,
  providerCache = "generated",
}) => {
  const relayAvailable = hasTurn(turnServers);
  const transportPolicy = relayTransportPolicy({
    production,
    relayAvailable,
    relayTest,
    env,
  });
  const refreshWindow = fallback ? STUN_FALLBACK_REFRESH_MS : iceRefreshMs(env);
  const refreshDeadline = now + refreshWindow;
  const restartBeforeMs = expiresAt == null ? null : expiresAt - EXPIRY_MARGIN_MS;
  const refreshAtMs = restartBeforeMs == null
    ? refreshDeadline
    : Math.min(refreshDeadline, restartBeforeMs);
  const iceServers = relayAvailable ? rtcServers(turnServers) : [...STUN_SERVERS];
  const rtc = {
    iceServers,
    bundlePolicy: "max-bundle",
    iceTransportPolicy: transportPolicy,
  };
  return {
    success: true,
    version: ICE_CONFIG_VERSION,
    issuedAt: new Date(now).toISOString(),
    expiresAt: expiresAt == null ? null : new Date(expiresAt).toISOString(),
    refreshAt: new Date(Math.max(refreshAtMs, now + 1000)).toISOString(),
    // A GET never updates an existing RTCPeerConnection.
    // "renegotiate" means fetch, setConfiguration, then ICE restart.
    // "next-peer-connection" means the active connection keeps its credentials.
    credentialUpdate: expiresAt == null ? "next-peer-connection" : "renegotiate",
    restartBefore: restartBeforeMs == null ? null : new Date(restartBeforeMs).toISOString(),
    relay: {
      available: relayAvailable,
      required: production,
    },
    fallback,
    providerCache: providerCache === "hit" ? "hit" : "generated",
    transportPolicy,
    rtc,
    iceServers,
  };
};

export const createIceConfigService = ({
  fetchCredentials = fetchConfiguredTurnCredentials,
  createTurn = createTimeLimitedTurnServer,
  now = () => Date.now(),
  env = process.env,
  warn = console.warn,
  fetchImpl,
} = {}) => {
  let appCache = null;
  let staticCache = null;
  let providerSkippedUntil = 0;
  let providerInflight = null;
  let providerGeneration = 0;
  const userCaches = new Map();
  const userInflight = new Map();

  const cacheFresh = (entry, at) => {
    if (!entry) return false;
    if (at - entry.fetchedAt >= iceRefreshMs(env)) return false;
    if (entry.expiresAt != null && entry.expiresAt - EXPIRY_MARGIN_MS <= at) return false;
    return true;
  };

  const respond = (material, at, production, relayTest, providerCache) => buildResponse({
    turnServers: material.servers,
    expiresAt: material.expiresAt ?? null,
    now: at,
    production,
    relayTest,
    env,
    providerCache,
  });

  const safeProviderLogText = (value) => String(value || "")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted]")
    .replace(/(?:[0-9a-f]{1,4}:){2,}[0-9a-f:]*/gi, "[redacted]")
    .replace(/[A-Za-z0-9+/=_-]{24,}/g, "[redacted]")
    .slice(0, 180);

  const warnProvider = (error) => {
    const diagnostics = error?.diagnostics || {};
    const attempts = Number(diagnostics.attempts);
    warn("[webrtc] TURN provider unavailable", {
      provider: String(diagnostics.provider || "metered").slice(0, 32),
      message: safeProviderLogText(error?.message || "provider request failed"),
      domain: safeProviderLogText(diagnostics.domain || ""),
      apiKeyPresent: Boolean(diagnostics.apiKeyPresent),
      apiKeyEmptyAfterTrim: Boolean(diagnostics.apiKeyEmptyAfterTrim),
      status: Number(diagnostics.status) || 0,
      category: safeProviderLogText(diagnostics.category || "").slice(0, 120),
      ...(diagnostics.keyIdPresent == null
        ? {}
        : { keyIdPresent: Boolean(diagnostics.keyIdPresent) }),
      ...(diagnostics.secretLookupCategory
        ? {
            secretLookupStatus: Number(diagnostics.secretLookupStatus) || 0,
            secretLookupCategory: safeProviderLogText(diagnostics.secretLookupCategory).slice(0, 120),
          }
        : {}),
      durationMs: Number(diagnostics.durationMs) || 0,
      ...(Number.isInteger(attempts) && attempts >= 0 && attempts <= 3 ? { attempts } : {}),
    });
  };

  const loadProvider = async (at) => {
    if (providerInflight) return providerInflight;
    const generation = providerGeneration;
    let resolveFlight;
    const pending = new Promise((resolve) => {
      resolveFlight = resolve;
    });
    providerInflight = pending;
    let settled = false;
    const finish = (value) => {
      if (settled) return value;
      settled = true;
      resolveFlight(value);
      return value;
    };
    try {
      const provider = await fetchCredentials({
        env,
        provider: env.WEBRTC_TURN_PROVIDER,
        domain: env.METERED_DOMAIN,
        apiKey: env.METERED_API_KEY,
        secretKey: env.METERED_SECRET_KEY,
        keyId: env.CLOUDFLARE_TURN_KEY_ID,
        apiToken: env.CLOUDFLARE_TURN_API_TOKEN,
        ttlSeconds: env.CLOUDFLARE_TURN_TTL,
        nowMs: at,
        fetchImpl,
      });
      if (generation !== providerGeneration) return finish(null);
      if (provider?.servers?.length) {
        const material = {
          servers: provider.servers,
          expiresAt: provider.expiresAt ?? null,
          fetchedAt: at,
          scope: "app",
        };
        if (material.expiresAt != null && material.expiresAt - EXPIRY_MARGIN_MS <= at) {
          appCache = null;
          providerSkippedUntil = at + iceRefreshMs(env);
          return finish(null);
        }
        providerSkippedUntil = 0;
        appCache = material;
        return finish(material);
      }
      providerSkippedUntil = at + iceRefreshMs(env);
      return finish(null);
    } catch (error) {
      try {
        warnProvider(error);
      } catch {
        /* a logging failure must not skip the configured TURN fallback */
      }
      if (generation === providerGeneration) providerSkippedUntil = at + iceRefreshMs(env);
      return finish(null);
    } finally {
      finish(null);
      if (providerInflight === pending) providerInflight = null;
    }
  };

  const loadUserTurn = async (userId, at, fresh) => {
    if (!sharedSecretConfigured(env)) return null;
    const key = `user:${turnIdentity(userId)}`;
    const existingFlight = userInflight.get(key);
    if (existingFlight) return existingFlight;
    const cached = userCaches.get(key);
    if (!fresh && cacheFresh(cached, at)) return cached;

    let resolveFlight;
    const pending = new Promise((resolve) => {
      resolveFlight = resolve;
    });
    userInflight.set(key, pending);
    try {
      const generated = await createTurn({
        urls: env.TURN_URL,
        sharedSecret: env.TURN_SHARED_SECRET,
        userId,
        nowMs: at,
      });
      if (!generated?.iceServer || generated.expiresAt - EXPIRY_MARGIN_MS <= at) {
        resolveFlight(null);
        return null;
      }
      const entry = {
        servers: [generated.iceServer],
        expiresAt: generated.expiresAt,
        fetchedAt: at,
        scope: key,
      };
      if (userInflight.get(key) === pending) userCaches.set(key, entry);
      resolveFlight(entry);
      return entry;
    } catch {
      resolveFlight(null);
      return null;
    } finally {
      if (userInflight.get(key) === pending) userInflight.delete(key);
    }
  };

  const loadStaticTurn = (at, fresh) => {
    if (!fresh && cacheFresh(staticCache, at)) return staticCache;
    const material = configuredStaticTurn(env);
    if (!material) return null;
    staticCache = { ...material, fetchedAt: at };
    return staticCache;
  };

  return {
    clear() {
      providerGeneration += 1;
      appCache = null;
      staticCache = null;
      providerSkippedUntil = 0;
      providerInflight = null;
      userCaches.clear();
      userInflight.clear();
    },
    async getConfig({ userId = "", relayTest = false, fresh = false } = {}) {
      const at = now();
      const production = iceProductionMode(env);
      if (!fresh && cacheFresh(appCache, at)) {
        return respond(appCache, at, production, relayTest, "hit");
      }

      let material = null;
      let providerCache = "generated";
      if (fresh || at >= providerSkippedUntil) {
        material = await loadProvider(at);
      }
      if (!material) {
        const userKey = `user:${turnIdentity(userId)}`;
        const previousUser = userCaches.get(userKey);
        material = await loadUserTurn(userId, at, fresh);
        if (material && material === previousUser) providerCache = "hit";
      }
      if (!material) {
        const previousStatic = staticCache;
        material = loadStaticTurn(at, fresh);
        if (material && material === previousStatic) providerCache = "hit";
      }
      if (material?.servers?.length) {
        return respond(material, at, production, relayTest, providerCache);
      }

      if (!iceStunFallbackAllowed(env)) {
        const error = new Error("Call relay is temporarily unavailable.");
        error.code = "TURN_NOT_CONFIGURED";
        throw error;
      }
      return buildResponse({
        turnServers: [],
        expiresAt: null,
        now: at,
        production: false,
        fallback: "development-stun",
        relayTest,
        env,
        providerCache: "generated",
      });
    },
  };
};

export const iceConfigService = createIceConfigService();

export const clearIceConfigCache = () => {
  iceConfigService.clear();
};
