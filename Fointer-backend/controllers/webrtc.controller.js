import {
  createTimeLimitedTurnServer,
  fetchMeteredTurnCredentials,
  normalizeTurnServers,
} from "../utils/webrtcIceServers.js";

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
const CREDENTIAL_TTL_MS = 60 * 60 * 1000;
const PROVIDER_FALLBACK_TTL_MS = 5 * 60 * 1000;

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
    const providerCredentials = await fetchMeteredTurnCredentials();
    if (providerCredentials?.servers?.length) {
      turnServers = providerCredentials.servers;
      expiresAt = providerCredentials.expiresAt;
    }
  } catch (error) {
    const diagnostics = error?.diagnostics || {};
    console.warn("[webrtc] TURN provider unavailable", {
      message: String(error?.message || "provider request failed").slice(0, 180),
      domain: diagnostics.domain || "",
      apiKeyPresent: Boolean(diagnostics.apiKeyPresent),
      apiKeyEmptyAfterTrim: Boolean(diagnostics.apiKeyEmptyAfterTrim),
      status: Number(diagnostics.status) || 0,
      category: String(diagnostics.category || "").slice(0, 120),
      durationMs: Number(diagnostics.durationMs) || 0,
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
