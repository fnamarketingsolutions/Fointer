import {
  createTimeLimitedTurnServer,
  normalizeTurnServers,
} from "../utils/webrtcIceServers.js";

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
const CREDENTIAL_TTL_MS = 60 * 60 * 1000;
const PROVIDER_FALLBACK_TTL_MS = 5 * 60 * 1000;

const providerExpiry = (body, servers) => {
  const explicit = Date.parse(body?.expiresAt || body?.expires_at || "");
  if (Number.isFinite(explicit) && explicit > Date.now()) return explicit;

  const usernameExpiries = servers
    .map((server) => Number(String(server.username).split(":", 1)[0]) * 1000)
    .filter((expiry) => Number.isFinite(expiry) && expiry > Date.now());
  return usernameExpiries.length
    ? Math.min(...usernameExpiries)
    : Date.now() + PROVIDER_FALLBACK_TTL_MS;
};

const fetchMeteredTurnServers = async () => {
  const domain = String(process.env.METERED_DOMAIN || "").trim();
  const apiKey = String(process.env.METERED_API_KEY || "").trim();
  if (!domain || !apiKey) return [];

  const providerUrl = new URL(domain.includes("://") ? domain : `https://${domain}`);
  if (
    providerUrl.protocol !== "https:" ||
    !(providerUrl.hostname === "metered.ca" || providerUrl.hostname.endsWith(".metered.ca"))
  ) {
    throw new Error("Invalid TURN provider domain configuration.");
  }

  const credentialsUrl = new URL("/api/v1/turn/credentials", providerUrl.origin);
  credentialsUrl.searchParams.set("apiKey", apiKey);
  const response = await fetch(credentialsUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`TURN provider responded with ${response.status}.`);
  }

  const body = await response.json();
  const servers = Array.isArray(body) ? body : body?.iceServers;
  const turnServers = normalizeTurnServers(servers);
  if (!turnServers.length) throw new Error("TURN provider returned no usable relay.");
  return {
    servers: turnServers,
    expiresAt: providerExpiry(body, turnServers),
  };
};

const configuredTurnServers = (userId) => {
  const generated = createTimeLimitedTurnServer({
    urls: process.env.TURN_URL,
    sharedSecret: process.env.TURN_SHARED_SECRET,
    userId,
  });
  if (generated) {
    return { servers: [generated.iceServer], expiresAt: generated.expiresAt };
  }

  const servers = normalizeTurnServers([
    {
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    },
  ]);
  return servers.length
    ? { servers, expiresAt: Date.now() + PROVIDER_FALLBACK_TTL_MS }
    : null;
};

export const getIceServers = async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = String(req.user?._id || req.user?.id || "");
  let turnServers = [];
  let expiresAt = 0;

  try {
    const providerCredentials = await fetchMeteredTurnServers();
    turnServers = providerCredentials.servers;
    expiresAt = providerCredentials.expiresAt;
  } catch (error) {
    console.warn("[webrtc] TURN provider unavailable", {
      message: String(error?.message || "provider request failed"),
    });
  }

  if (!turnServers.length) {
    const configured = configuredTurnServers(userId);
    turnServers = configured?.servers || [];
    expiresAt = configured?.expiresAt || 0;
  }

  if (!turnServers.length) {
    return res.status(503).json({
      success: false,
      code: "TURN_NOT_CONFIGURED",
      message: "Call relay is temporarily unavailable.",
    });
  }

  return res.json({
    success: true,
    iceServers: [...STUN_SERVERS, ...turnServers],
    expiresAt: new Date(expiresAt || Date.now() + CREDENTIAL_TTL_MS).toISOString(),
  });
};