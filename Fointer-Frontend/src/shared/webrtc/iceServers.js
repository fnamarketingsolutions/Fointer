import { openRelayIceServers } from "./turnCredential.js";
import api from "../services/http/client";

const stunServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const turnUrls = String(import.meta.env.VITE_TURN_URL || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const turnUsername = String(import.meta.env.VITE_TURN_USERNAME || "");
const turnCredential = String(import.meta.env.VITE_TURN_CREDENTIAL || "");

const customTurn = () => {
  if (!turnUrls.length || !turnUsername || !turnCredential) return null;
  return {
    urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
    username: turnUsername,
    credential: turnCredential,
  };
};

const iceServers = [...stunServers];
const configuredTurn = customTurn();
if (configuredTurn) iceServers.push(configuredTurn);

export const ICE_SERVERS = { iceServers, bundlePolicy: "max-bundle" };

const turnServersFrom = (servers) => {
  if (!Array.isArray(servers)) return [];
  return servers.filter((server) => {
    const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
    return (
      Boolean(server?.username) &&
      Boolean(server?.credential) &&
      urls.some((url) => /^turns?:/i.test(String(url || "")))
    );
  });
};

const hasTurnServer = (config) => turnServersFrom(config?.iceServers).length > 0;

let cached = null;

/** Prefer authenticated backend TURN credentials, then existing relay fallbacks. */
export const getIceConfig = async () => {
  if (cached && cached.expires > Date.now()) return cached.config;

  let config;
  let cacheMs = 60 * 60 * 1000;
  try {
    const response = await api.get("/webrtc/ice-servers", { timeout: 7000 });
    const remoteTurns = turnServersFrom(response.data?.iceServers);
    if (!response.data?.success || !remoteTurns.length) {
      throw new Error("Backend returned no TURN relay.");
    }
    const expiresAt = Date.parse(response.data?.expiresAt || "");
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + 30_000) {
      throw new Error("Backend TURN credentials are expired or missing an expiry.");
    }
    cacheMs = Math.min(cacheMs, expiresAt - Date.now() - 30_000);
    config = {
      iceServers: [...stunServers, ...remoteTurns],
      bundlePolicy: "max-bundle",
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[dm-call] backend TURN credentials unavailable", {
        status: error?.response?.status,
        code: error?.response?.data?.code || "TURN_CONFIG_FETCH_FAILED",
      });
    }
    const turn = customTurn();
    if (turn) {
      config = { iceServers: [...stunServers, turn], bundlePolicy: "max-bundle" };
    } else {
      try {
        config = { iceServers: await openRelayIceServers(), bundlePolicy: "max-bundle" };
        cacheMs = 12 * 60 * 60 * 1000;
      } catch {
        config = { iceServers: [...stunServers], bundlePolicy: "max-bundle" };
        cacheMs = 60_000;
      }
    }
  }

  cached = { config, expires: Date.now() + cacheMs };
  return config;
};

/** True only when the active configuration contains a TURN relay. */
export const hasTurnRelay = () => {
  if (cached?.expires > Date.now()) return hasTurnServer(cached.config);
  const turn = customTurn();
  return Boolean(turn);
};
