import api from "../services/http/client";
import {
  selectIceConfig,
  STUN_SERVERS,
  TurnUnavailableError,
  turnServersFrom,
  DEV_ICE_RELAY_STORAGE_KEY,
  devRelayRequested,
  validateIceConfig,
  withTestRelayPolicy,
} from "./iceConfigPolicy.js";

export { TurnUnavailableError, validateIceConfig };

const envFlag = (name) => {
  try {
    return Boolean(import.meta.env?.[name]);
  } catch {
    return false;
  }
};

let cached = null;
let announcedRelay = false;

const storedRelaySwitch = () => {
  try {
    return globalThis.localStorage?.getItem(DEV_ICE_RELAY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

/**
 * Read at call setup, before RTCPeerConnection is constructed.
 * Development accepts either the automated window flag or the manual storage switch.
 * The window flag must be the boolean true. The string "true" does not count.
 */
const testRelayRequested = () => {
  try {
    return devRelayRequested({
      dev: envFlag("DEV"),
      prod: envFlag("PROD"),
      windowFlag: globalThis.__FOINTER_TEST_ICE_RELAY,
      stored: storedRelaySwitch(),
    });
  } catch {
    return false;
  }
};

const announceRelay = (enabled) => {
  if (!enabled || announcedRelay || !envFlag("DEV") || envFlag("PROD")) return;
  announcedRelay = true;
  console.info("[fointer] Development relay-only ICE is on. The next call uses iceTransportPolicy relay.");
};

if (envFlag("DEV") && !envFlag("PROD")) {
  globalThis.fointerDevIceRelay = {
    enable() {
      globalThis.localStorage?.setItem(DEV_ICE_RELAY_STORAGE_KEY, "1");
      cached = null;
      announcedRelay = false;
      announceRelay(true);
    },
    disable() {
      globalThis.localStorage?.removeItem(DEV_ICE_RELAY_STORAGE_KEY);
      globalThis.__FOINTER_TEST_ICE_RELAY = false;
      cached = null;
      announcedRelay = false;
      console.info("[fointer] Development relay-only ICE is off. Reload before the next call.");
    },
  };
  announceRelay(testRelayRequested());
}

/**
 * Loads short-lived TURN credentials from the backend.
 * Production refuses to place a call without them. Development can still use
 * STUN on a local network. The public demo relay is not a fallback.
 * A relay-only transport is applied only in development, before the peer connection is created.
 */
export const getIceConfig = async () => {
  const production = envFlag("PROD");
  const testRelay = testRelayRequested();
  if (
    cached &&
    cached.expires > Date.now() &&
    cached.production === production &&
    cached.testRelay === testRelay
  ) {
    return cached.config;
  }

  try {
    const response = await api.get("/webrtc/ice-servers", { timeout: 7000 });
    const remoteTurns = turnServersFrom(response.data?.iceServers);
    const expiresAt = Date.parse(response.data?.expiresAt || "");
    const fresh =
      response.data?.success &&
      remoteTurns.length > 0 &&
      Number.isFinite(expiresAt) &&
      expiresAt > Date.now() + 30_000;
    const selected = selectIceConfig({
      production,
      remoteConfig: fresh
        ? {
            iceServers: [...STUN_SERVERS, ...remoteTurns],
            bundlePolicy: "max-bundle",
          }
        : null,
      expiresAt,
      now: Date.now(),
    });
    if (selected.error) throw new TurnUnavailableError(selected.error);
    const config = withTestRelayPolicy(selected.config, testRelay);
    announceRelay(testRelay);
    cached = {
      config,
      expires: Date.now() + selected.cacheMs,
      production,
      testRelay,
    };
    return config;
  } catch (error) {
    cached = null;
    if (production || error instanceof TurnUnavailableError) {
      throw error instanceof TurnUnavailableError ? error : new TurnUnavailableError();
    }
    if (envFlag("DEV")) {
      console.warn("[dm-call] backend TURN credentials unavailable", {
        status: error?.response?.status,
        code: error?.code || error?.response?.data?.code || "TURN_CONFIG_FETCH_FAILED",
      });
    }
    const fallback = selectIceConfig({ production: false, remoteConfig: null });
    const config = withTestRelayPolicy(fallback.config, testRelay);
    cached = {
      config,
      expires: Date.now() + fallback.cacheMs,
      production: false,
      testRelay,
    };
    return config;
  }
};

/** True only when the cached configuration contains a non-demo TURN relay. */
export const hasTurnRelay = () => {
  if (!cached || cached.expires <= Date.now()) return false;
  const verdict = validateIceConfig(cached.config, { production: true });
  return verdict.ok;
};
