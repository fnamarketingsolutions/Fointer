const UNSAFE = /candidate:|\ba=|password|username|apiKey|api_key|authorization|cookie|token|turns?:|stun:/i;
const IPV4 = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;
const IPV6 = /(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,7}:|(?:[0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,5}(?::[0-9a-f]{1,4}){1,2}|(?:[0-9a-f]{1,4}:){1,4}(?::[0-9a-f]{1,4}){1,3}|(?:[0-9a-f]{1,4}:){1,3}(?::[0-9a-f]{1,4}){1,4}|(?:[0-9a-f]{1,4}:){1,2}(?::[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:(?::[0-9a-f]{1,4}){1,6}|:(?::[0-9a-f]{1,4}){1,7}|::)/gi;

const redactIpAddresses = (value) => {
  IPV6.lastIndex = 0;
  IPV4.lastIndex = 0;
  return String(value ?? "").replace(IPV6, "[redacted]").replace(IPV4, "[redacted]");
};

const TEXT_FIELDS = [
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
  "event",
  "requestId",
  "callType",
  "direction",
  "cacheStatus",
  "failureCategory",
];

const NUMBER_FIELDS = [
  ["errorCode", 999],
  ["httpStatus", 599],
  ["duration", 600_000],
  ["serverCount", 20],
  ["dropped", 100_000],
];

const CRITICAL_EVENTS = new Set([
  "fetch_failed",
  "ice_connection_failed",
  "peer_connection_failed",
  "signaling_rejected",
  "ice_restart_failed",
  "turn_unavailable",
]);

const DEFAULTS = {
  maxQueue: 40,
  maxBatch: 8,
  flushMs: 2_000,
  retryMs: 400,
  maxAttempts: 3,
  timeoutMs: 1_500,
};

let maxQueue = DEFAULTS.maxQueue;
let maxBatch = DEFAULTS.maxBatch;
let flushMs = DEFAULTS.flushMs;
let retryMs = DEFAULTS.retryMs;
let maxAttempts = DEFAULTS.maxAttempts;
let timeoutMs = DEFAULTS.timeoutMs;
let poster = null;
let scheduleImpl = (fn, ms) => {
  const id = setTimeout(fn, ms);
  if (typeof id?.unref === "function") id.unref();
  return id;
};
let clearScheduleImpl = (id) => clearTimeout(id);

let queue = [];
let droppedNonCritical = 0;
let seen = new Map();
let timer = null;
let heldBatch = null;
let delivering = null;
let batchSeq = 0;

const safeCount = (value, max) => {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0 || count > max) return null;
  return count;
};

/** Structured call log. Drops SDP, candidate strings, secrets, and addresses. */
export const safeCallDiagnostic = (fields = {}, now = new Date()) => {
  const entry = { scope: "call", at: now.toISOString() };
  for (const key of TEXT_FIELDS) {
    const value = fields[key];
    if (value == null || value === "") continue;
    const text = redactIpAddresses(value).trim().slice(0, key === "requestId" ? 40 : 80);
    if (!text || UNSAFE.test(text) || text.includes("[redacted]")) continue;
    entry[key] = text;
  }
  for (const [key, max] of NUMBER_FIELDS) {
    const count = safeCount(fields[key], max);
    if (count == null) continue;
    entry[key] = count;
  }
  return entry;
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

const isCritical = (entry) => {
  if (!entry || typeof entry !== "object") return false;
  if (entry.iceConnectionState === "failed" || entry.connectionState === "failed") return true;
  if (entry.delivery === "rejected") return true;
  if (entry.failureCategory === "turn_unavailable") return true;
  return CRITICAL_EVENTS.has(entry.event);
};

const dedupeKey = (entry) => {
  if (entry.event === "ice_candidate_error") {
    return [
      "ice",
      entry.callId || "",
      entry.errorCode ?? "",
      entry.errorText || "",
      entry.url || "",
    ].join("|");
  }
  if (entry.requestId && entry.event) {
    return ["life", entry.callId || "", entry.event, entry.requestId].join("|");
  }
  return [
    entry.callId || "",
    entry.event || "",
    entry.phase || "",
    entry.connectionState || "",
    entry.iceConnectionState || "",
    entry.signalType || "",
    entry.delivery || "",
    entry.errorCode ?? "",
    entry.failureCategory || "",
  ].join("|");
};

const alreadySeen = (key) => {
  if (seen.has(key)) return true;
  seen.set(key, 1);
  if (seen.size > 200) seen.delete(seen.keys().next().value);
  return false;
};

const clearTimer = () => {
  if (timer == null) return;
  clearScheduleImpl(timer);
  timer = null;
};

const scheduleFlush = (delay) => {
  if (timer != null || delivering) return;
  timer = scheduleImpl(() => {
    timer = null;
    void flushCallDiagnostics();
  }, delay);
};

const createBatchId = () => {
  batchSeq += 1;
  return `b${batchSeq.toString(36)}${Date.now().toString(36)}`.slice(0, 64);
};

const takeBatch = () => {
  if (heldBatch || !queue.length) return heldBatch;
  const events = queue.splice(0, maxBatch);
  const dropped = droppedNonCritical;
  droppedNonCritical = 0;
  heldBatch = {
    batchId: createBatchId(),
    events,
    dropped,
    attempts: 0,
  };
  return heldBatch;
};

const withBudget = (promise, budget) => new Promise((resolve, reject) => {
  let settled = false;
  const id = scheduleImpl(() => {
    if (settled) return;
    settled = true;
    reject(new Error("diagnostic-timeout"));
  }, budget);
  promise.then(
    (value) => {
      if (settled) return;
      settled = true;
      clearScheduleImpl(id);
      resolve(value);
    },
    (error) => {
      if (settled) return;
      settled = true;
      clearScheduleImpl(id);
      reject(error);
    }
  );
});

const postBatch = async (batch, budget) => {
  const payload = {
    batchId: batch.batchId,
    dropped: batch.dropped,
    events: batch.events,
  };
  const send = poster
    ? poster(payload, budget)
    : import("../services/http/client.js").then(({ default: api }) => (
      api.post("/webrtc/diagnostics", payload, { timeout: budget })
    ));
  await withBudget(Promise.resolve(send), budget);
};

const settleDelivery = (batch, ok) => {
  if (heldBatch !== batch) return;
  if (ok) {
    heldBatch = null;
    return;
  }
  batch.attempts += 1;
  if (batch.attempts >= maxAttempts) heldBatch = null;
};

const startDelivery = () => {
  if (delivering) return delivering;
  clearTimer();
  const batch = takeBatch();
  if (!batch) return null;
  const budget = timeoutMs;
  delivering = postBatch(batch, budget)
    .then(() => {
      settleDelivery(batch, true);
    })
    .catch(() => {
      settleDelivery(batch, false);
    })
    .finally(() => {
      delivering = null;
      if (heldBatch) scheduleFlush(retryMs);
      else if (queue.length >= maxBatch) void flushCallDiagnostics();
      else if (queue.length) scheduleFlush(flushMs);
    });
  return delivering;
};

/**
 * Sends the queued diagnostics. Callers that are tearing a call down must not await this.
 * The returned promise settles on delivery or on the bounded timeout, whichever is first.
 */
export const flushCallDiagnostics = ({ timeoutMs: budget = timeoutMs } = {}) => {
  const work = startDelivery();
  if (!work) return Promise.resolve({ sent: false });
  return Promise.race([
    work.then(() => ({ sent: true })),
    new Promise((resolve) => {
      const id = scheduleImpl(() => resolve({ sent: false, timedOut: true }), budget);
      work.finally(() => clearScheduleImpl(id));
    }),
  ]);
};

const evictNonCritical = () => {
  const index = queue.findIndex((item) => !isCritical(item));
  if (index === -1) return false;
  queue.splice(index, 1);
  droppedNonCritical += 1;
  return true;
};

const enqueue = (entry) => {
  if (!entry || typeof entry !== "object") return;
  const key = dedupeKey(entry);
  if (alreadySeen(key)) return;
  if (queue.length >= maxQueue && !evictNonCritical()) {
    if (!isCritical(entry)) {
      droppedNonCritical += 1;
      return;
    }
    queue.shift();
    droppedNonCritical += 1;
  }
  queue.push(entry);
  if (isCritical(entry) || queue.length >= maxBatch) void flushCallDiagnostics();
  else scheduleFlush(flushMs);
};

export const publishCallDiagnostic = (entry) => {
  if (!entry || typeof entry !== "object") return;
  try {
    const safe = entry.event === "ice_candidate_error"
      ? { ...sanitizeIceCandidateError(entry), ...safeCallDiagnostic(entry) }
      : safeCallDiagnostic(entry);
    if (safe.event === "ice_candidate_error" || Object.keys(safe).length > 2) enqueue(safe);
  } catch {
    /* diagnostics must never affect the call */
  }
};

export const logCallDiagnostic = (fields, writer = console.info) => {
  const entry = safeCallDiagnostic(fields);
  try {
    writer(JSON.stringify(entry));
  } catch {
    /* ignore a broken log writer */
  }
  publishCallDiagnostic(entry);
};

export const reportIceCandidateError = (event, fields = {}) => {
  const entry = sanitizeIceCandidateError(event);
  const safe = safeCallDiagnostic({ callId: fields.callId });
  if (safe.callId) entry.callId = safe.callId;
  try {
    console.info(JSON.stringify(entry));
  } catch {
    /* ignore */
  }
  publishCallDiagnostic(entry);
};

export const noteIceConfigurationApplied = (fields = {}) => {
  publishCallDiagnostic({ ...fields, event: "configuration_applied", cacheStatus: "applied" });
};

export const configureCallDiagnostics = (options = {}) => {
  if (typeof options.post === "function") poster = options.post;
  if (typeof options.schedule === "function") scheduleImpl = options.schedule;
  if (typeof options.clearSchedule === "function") clearScheduleImpl = options.clearSchedule;
  if (Number.isInteger(options.maxQueue) && options.maxQueue > 0) maxQueue = options.maxQueue;
  if (Number.isInteger(options.maxBatch) && options.maxBatch > 0) maxBatch = options.maxBatch;
  if (Number.isInteger(options.flushMs) && options.flushMs > 0) flushMs = options.flushMs;
  if (Number.isInteger(options.retryMs) && options.retryMs >= 0) retryMs = options.retryMs;
  if (Number.isInteger(options.maxAttempts) && options.maxAttempts > 0) maxAttempts = options.maxAttempts;
  if (Number.isInteger(options.timeoutMs) && options.timeoutMs > 0) timeoutMs = options.timeoutMs;
};

export const resetCallDiagnosticsForTests = () => {
  clearTimer();
  queue = [];
  droppedNonCritical = 0;
  seen = new Map();
  heldBatch = null;
  delivering = null;
  poster = null;
  maxQueue = DEFAULTS.maxQueue;
  maxBatch = DEFAULTS.maxBatch;
  flushMs = DEFAULTS.flushMs;
  retryMs = DEFAULTS.retryMs;
  maxAttempts = DEFAULTS.maxAttempts;
  timeoutMs = DEFAULTS.timeoutMs;
  scheduleImpl = (fn, ms) => {
    const id = setTimeout(fn, ms);
    if (typeof id?.unref === "function") id.unref();
    return id;
  };
  clearScheduleImpl = (id) => clearTimeout(id);
};

export const pendingDiagnosticCount = () => queue.length + (heldBatch?.events?.length || 0);
