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

export const logCallDiagnostic = (fields, writer = console.info) => {
  writer(JSON.stringify(safeCallDiagnostic(fields)));
};
