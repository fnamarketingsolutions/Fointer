const UNSAFE = /candidate:|\ba=|password|username|apiKey|api_key|token|turns?:|stun:/i;
const IPV4 = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;
const IPV6 = /(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,7}:|(?:[0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,5}(?::[0-9a-f]{1,4}){1,2}|(?:[0-9a-f]{1,4}:){1,4}(?::[0-9a-f]{1,4}){1,3}|(?:[0-9a-f]{1,4}:){1,3}(?::[0-9a-f]{1,4}){1,4}|(?:[0-9a-f]{1,4}:){1,2}(?::[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:(?::[0-9a-f]{1,4}){1,6}|:(?::[0-9a-f]{1,4}){1,7}|::)/gi;

const redactIpAddresses = (value) => {
  IPV6.lastIndex = 0;
  IPV4.lastIndex = 0;
  return String(value ?? "").replace(IPV6, "[redacted]").replace(IPV4, "[redacted]");
};

const ALLOWED = [
  "callId",
  "phase",
  "signalingState",
  "connectionState",
  "iceConnectionState",
  "localCandidateType",
  "remoteCandidateType",
  "relayProtocol",
  "signalType",
  "delivery",
];

/** Structured call log. Drops SDP, candidate strings, secrets, and addresses. */
export const safeCallDiagnostic = (fields = {}, now = new Date()) => {
  const entry = { scope: "call", at: now.toISOString() };
  for (const key of ALLOWED) {
    const value = fields[key];
    if (value == null || value === "") continue;
    const text = String(value).slice(0, 80);
    if (UNSAFE.test(text)) continue;
    entry[key] = text;
  }
  return entry;
};

export const publishCallDiagnostic = (entry) => {
  if (!entry || typeof entry !== "object") return;
  import("../services/http/client")
    .then(({ default: api }) => api.post("/webrtc/diagnostics", entry))
    .catch(() => {});
};

export const logCallDiagnostic = (fields, writer = console.info) => {
  const entry = safeCallDiagnostic(fields);
  writer(JSON.stringify(entry));
  publishCallDiagnostic(entry);
};

const isIpAddress = (value) => {
  const host = String(value || "").trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!host) return false;
  if (host.includes(":")) return /^[0-9a-f:]+$/i.test(host);
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
};

/** ICE error fields safe to show or upload. IP addresses and secrets are omitted. */
export const sanitizeIceCandidateError = (event = {}) => {
  const errorCode = Number(event.errorCode);
  const errorText = redactIpAddresses(event.errorText).trim().slice(0, 120);
  const rawUrl = String(event.url || "").trim();
  const entry = { event: "ice_candidate_error" };
  if (Number.isInteger(errorCode)) entry.errorCode = errorCode;
  if (errorText && !UNSAFE.test(errorText)) entry.errorText = errorText;
  if (rawUrl && !rawUrl.includes("@") && !isIpAddress(rawUrl) && !redactIpAddresses(rawUrl).includes("[redacted]")) {
    entry.url = rawUrl.slice(0, 180);
  }
  return entry;
};

export const reportIceCandidateError = (event) => {
  const entry = sanitizeIceCandidateError(event);
  console.info(JSON.stringify(entry));
  publishCallDiagnostic(entry);
};
