const SECRET = /password|credential|username|api[_-]?key|token|authorization/i;
const SDP = /\ba=|v=0|candidate:/i;
const IPV4 = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;
const IPV6 = /(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,7}:|(?:[0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,5}(?::[0-9a-f]{1,4}){1,2}|(?:[0-9a-f]{1,4}:){1,4}(?::[0-9a-f]{1,4}){1,3}|(?:[0-9a-f]{1,4}:){1,3}(?::[0-9a-f]{1,4}){1,4}|(?:[0-9a-f]{1,4}:){1,2}(?::[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:(?::[0-9a-f]{1,4}){1,6}|:(?::[0-9a-f]{1,4}){1,7}|::)/gi;

const isIpAddress = (value) => {
  const host = String(value || "").trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!host) return false;
  if (host.includes(":")) return /^[0-9a-f:]+$/i.test(host);
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
};

/** Replaces IPv4 and IPv6 literals without dropping the surrounding diagnostic text. */
export const redactIpAddresses = (value) => {
  IPV6.lastIndex = 0;
  IPV4.lastIndex = 0;
  return String(value ?? "").replace(IPV6, "[redacted]").replace(IPV4, "[redacted]");
};

const safeText = (value, max = 80) => {
  const text = redactIpAddresses(value).trim().slice(0, max);
  if (!text || SECRET.test(text) || SDP.test(text)) return "";
  return text;
};

/** Public STUN/TURN hostname only. IP literals and userinfo are dropped. */
export const safeIceServerUrl = (value) => {
  const match = String(value || "").trim().match(/^(stuns?|turns?):([^/?#]+)/i);
  if (!match) return "";
  let host = match[2].replace(/^\[|\]$/g, "").split("%")[0];
  const colon = host.lastIndexOf(":");
  if (colon > -1 && /^\d+$/.test(host.slice(colon + 1))) host = host.slice(0, colon);
  host = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || isIpAddress(host) || !/^[a-z0-9.-]+$/i.test(host)) return "";
  return `${match[1].toLowerCase()}:${host}`;
};

const safeCode = (value) => {
  const code = Number(value);
  if (!Number.isInteger(code) || code < 0 || code > 999) return null;
  return code;
};

/**
 * Client diagnostics accepted by the backend.
 * Credentials, SDP, candidate lines, and IP addresses are removed.
 */
export const sanitizeCallDiagnostic = (body = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const entry = {};
  const callId = safeText(body.callId, 80);
  const phase = safeText(body.phase, 40);
  const signalingState = safeText(body.signalingState, 40);
  const connectionState = safeText(body.connectionState, 40);
  const iceConnectionState = safeText(body.iceConnectionState, 40);
  const localCandidateType = safeText(body.localCandidateType, 20);
  const remoteCandidateType = safeText(body.remoteCandidateType, 20);
  const relayProtocol = safeText(body.relayProtocol, 20);
  const signalType = safeText(body.signalType || body.type, 20);
  const delivery = safeText(body.delivery, 40);
  const event = safeText(body.event, 40);
  if (callId) entry.callId = callId;
  if (phase) entry.phase = phase;
  if (signalingState) entry.signalingState = signalingState;
  if (connectionState) entry.connectionState = connectionState;
  if (iceConnectionState) entry.iceConnectionState = iceConnectionState;
  if (localCandidateType) entry.localCandidateType = localCandidateType;
  if (remoteCandidateType) entry.remoteCandidateType = remoteCandidateType;
  if (relayProtocol) entry.relayProtocol = relayProtocol;
  if (signalType) entry.signalType = signalType;
  if (delivery) entry.delivery = delivery;
  if (event) entry.event = event;

  const errorCode = safeCode(body.errorCode);
  const errorText = safeText(body.errorText, 120);
  const url = safeIceServerUrl(body.url);
  if (errorCode != null) entry.errorCode = errorCode;
  if (errorText) entry.errorText = errorText;
  if (url) entry.url = url;

  return Object.keys(entry).length ? entry : null;
};
