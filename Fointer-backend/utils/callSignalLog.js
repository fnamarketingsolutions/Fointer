const UNSAFE = /candidate:|\ba=|password|username|apiKey|api_key|token|turns?:|stun:/i;

const ALLOWED = [
  "callId",
  "phase",
  "signalingState",
  "connectionState",
  "iceConnectionState",
  "localCandidateType",
  "remoteCandidateType",
  "relayProtocol",
  "type",
  "delivery",
  "reason",
];

/** Fields safe to print for one signaling event. SDP and candidates are not accepted. */
export const callSignalLogFields = (fields = {}, now = new Date()) => {
  const entry = { at: now.toISOString() };
  for (const key of ALLOWED) {
    const value = fields[key];
    if (value == null || value === "") continue;
    const text = String(value).slice(0, 80);
    if (UNSAFE.test(text)) continue;
    entry[key] = text;
  }
  return entry;
};

const loggedIce = new Set();

/** Offer and answer are logged. ICE is logged once per call so candidate bursts stay quiet. */
export const shouldLogCallSignal = (callId, type) => {
  if (type === "offer" || type === "answer") return true;
  if (type !== "ice") return false;
  const key = String(callId || "");
  if (!key || loggedIce.has(key)) return false;
  loggedIce.add(key);
  if (loggedIce.size > 500) loggedIce.clear();
  return true;
};
