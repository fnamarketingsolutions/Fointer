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

const iceServers = [...stunServers];
if (turnUrls.length && turnUsername && turnCredential) {
  iceServers.push({
    urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
    username: turnUsername,
    credential: turnCredential,
  });
}

export const ICE_SERVERS = { iceServers };

/** True when a TURN relay was configured. Credentials stay in the RTCPeerConnection only. */
export const hasTurnRelay = () =>
  Boolean(turnUrls.length && turnUsername && turnCredential);
