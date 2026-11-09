export const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const TURN_UNAVAILABLE_MESSAGE =
  "Reliable calling is temporarily unavailable. Please try again in a moment.";

export class TurnUnavailableError extends Error {
  constructor(message = TURN_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "TurnUnavailableError";
    this.code = "TURN_UNAVAILABLE";
  }
}

const urlsOf = (server) => {
  const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
  return urls.map((url) => String(url || "")).filter(Boolean);
};

const relayHost = (url) => {
  const value = String(url || "");
  const matched = value.match(/^[a-z]+:([^/?]+)(?:[/?]|$)/i);
  const hostport = matched ? matched[1] : "";
  return hostport.replace(/^\[|\]$/g, "").split(":")[0].toLowerCase();
};

export const isDemoRelayUrl = (url) => {
  const host = relayHost(url);
  return host === "openrelay.metered.ca" || host.endsWith(".openrelay.metered.ca");
};

export const turnServersFrom = (servers) => {
  if (!Array.isArray(servers)) return [];
  return servers.filter((server) => {
    const urls = urlsOf(server);
    return (
      Boolean(server?.username) &&
      Boolean(server?.credential) &&
      urls.some((url) => /^turns?:/i.test(url))
    );
  });
};

export const configUsesDemoRelay = (config) =>
  (config?.iceServers || []).some((server) => urlsOf(server).some(isDemoRelayUrl));

/** Production calls need a real TURN relay and must not use the public demo relay. */
export const validateIceConfig = (config, { production = false } = {}) => {
  const turnCount = turnServersFrom(config?.iceServers).length;
  const demo = configUsesDemoRelay(config);
  if (production && (turnCount < 1 || demo)) {
    return {
      ok: false,
      code: "TURN_UNAVAILABLE",
      message: TURN_UNAVAILABLE_MESSAGE,
      turnCount,
      demo,
    };
  }
  return { ok: true, turnCount, demo };
};

/**
 * Chooses the ICE config for a call.
 * Production never falls through to STUN-only or the public demo relay.
 * Development may use STUN so a local network call can still be placed.
 */
export const selectIceConfig = ({
  production = false,
  remoteConfig = null,
  expiresAt = NaN,
  now = Date.now(),
} = {}) => {
  const verdict = remoteConfig ? validateIceConfig(remoteConfig, { production }) : null;
  if (verdict?.ok && verdict.turnCount > 0 && !verdict.demo) {
    const remaining = Number.isFinite(expiresAt) ? expiresAt - now - 30_000 : 60 * 60 * 1000;
    return {
      config: remoteConfig,
      source: "backend",
      cacheMs: Math.min(60 * 60 * 1000, Math.max(30_000, remaining)),
    };
  }
  if (production) {
    return { error: TURN_UNAVAILABLE_MESSAGE, code: "TURN_UNAVAILABLE" };
  }
  return {
    config: { iceServers: [...STUN_SERVERS], bundlePolicy: "max-bundle" },
    source: "development-stun",
    cacheMs: 60_000,
  };
};

/** Development-only localStorage key. Production builds never honor it. */
export const DEV_ICE_RELAY_STORAGE_KEY = "fointer:dev-ice-relay";

/**
 * Relay-only transport is allowed only in a development build.
 * A production build ignores both the window flag and the stored switch.
 */
export const devRelayRequested = ({
  dev = false,
  prod = false,
  windowFlag = false,
  stored = "",
} = {}) => {
  if (!dev || prod) return false;
  return windowFlag === true || stored === "1";
};

/**
 * Local development and automated tests can force a TURN-only path.
 * Production selection never calls this, and a disabled flag leaves the config unchanged.
 */
export const withTestRelayPolicy = (config, enabled = false) => {
  if (!enabled || !config) return config;
  return { ...config, iceTransportPolicy: "relay" };
};
