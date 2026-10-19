import { openRelayIceServers } from "./turnCredential.js";

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

let cached = null;

/** Prefer a private TURN relay. Otherwise use the public relay so LTE can connect. */
export const getIceConfig = async () => {
  if (cached && cached.expires > Date.now()) return cached.config;
  const turn = customTurn();
  let servers = [...stunServers];
  if (turn) servers.push(turn);
  else {
    try {
      servers = await openRelayIceServers();
    } catch {
      servers = [...stunServers];
    }
  }
  const config = { iceServers: servers, bundlePolicy: "max-bundle" };
  cached = {
    config,
    expires: Date.now() + (turn ? 60 * 60 * 1000 : 12 * 60 * 60 * 1000),
  };
  return config;
};

/** True when a TURN relay is available. Credentials stay in the RTCPeerConnection only. */
export const hasTurnRelay = () => Boolean(customTurn()) || Boolean(cached?.config);
