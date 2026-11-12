import {
  iceRefreshDue,
  maybeRotateIce,
  rtcConfigFromIceResponse,
  TurnUnavailableError,
} from "./iceContract.js";
import { publishCallDiagnostic } from "./callDiagnostics.js";

export { TurnUnavailableError, iceRefreshDue, maybeRotateIce };

const sessions = new Map();
const inflight = new Map();
const released = new Set();
let claimToken = 0;
let applied = null;
let transport = null;
let requestSeq = 0;

const productionBuild = () => {
  try {
    return Boolean(import.meta.env?.PROD);
  } catch {
    return false;
  }
};

/** Starts a call-scoped ICE fetch. A newer claim wins over an older in-flight response. */
export const claimIceCall = () => {
  claimToken += 1;
  return claimToken;
};

/** Drops a finished call so a later call cannot reuse its configuration. */
export const releaseIceCall = (token, callKey = "") => {
  if (token) released.add(token);
  if (released.size > 50) released.delete(released.keys().next().value);
  if (callKey) sessions.delete(callKey);
  if (applied?.token === token) applied = null;
};

export const getIceSession = (callKey = "") => {
  if (callKey && sessions.has(callKey)) return sessions.get(callKey).session;
  if (!callKey && applied?.callKey && sessions.has(applied.callKey)) {
    return sessions.get(applied.callKey).session;
  }
  return null;
};

export const getIceRequestId = (callKey = "") => {
  if (callKey && sessions.has(callKey)) return sessions.get(callKey).requestId || "";
  if (!callKey && applied) return applied.requestId || "";
  return "";
};

const nextRequestId = () => {
  requestSeq += 1;
  return `ice${requestSeq.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

const trace = (fields) => {
  try {
    publishCallDiagnostic(fields);
  } catch {
    /* tracing must not break call setup */
  }
};

const rememberSession = (callKey, token, session, requestId) => {
  const existing = sessions.get(callKey);
  if (existing && existing.token > token) return;
  sessions.set(callKey, { token, session, requestId, rtc: session.rtc });
  if (sessions.size > 20) {
    const oldest = sessions.keys().next().value;
    if (oldest !== callKey) sessions.delete(oldest);
  }
  if (token === claimToken && !released.has(token)) {
    applied = { token, callKey, requestId };
  }
};

const httpClient = async () => {
  if (transport) return transport;
  const mod = await import("../services/http/client.js");
  return mod.default;
};

const failureCategory = (error) => {
  if (error instanceof TurnUnavailableError || error?.code === "TURN_UNAVAILABLE") return "turn_unavailable";
  if (Number(error?.response?.status) === 503) return "turn_unavailable";
  return "request_failed";
};

const httpStatusOf = (error) => {
  const status = Number(error?.response?.status);
  return Number.isInteger(status) && status > 0 ? status : undefined;
};

/**
 * Loads ICE configuration for one call.
 * A new call key or claim always asks the backend. The backend keeps the provider cache.
 * force asks the backend to bypass that cache for credential rotation only.
 */
export const getIceConfig = async ({
  force = false,
  callKey = "",
  token = 0,
  callType = "",
  direction = "",
} = {}) => {
  const key = callKey || applied?.callKey || "";
  const generation = token || applied?.token || 0;
  if (!key || !generation) {
    trace({
      event: "fetch_failed",
      callId: key,
      callType,
      direction,
      failureCategory: "turn_unavailable",
    });
    throw new TurnUnavailableError();
  }

  const stored = sessions.get(key);
  if (!force && stored && stored.token === generation && stored.rtc) {
    trace({
      event: "cache_hit",
      callId: key,
      requestId: stored.requestId,
      callType,
      direction,
      cacheStatus: "frontend_hit",
      serverCount: Array.isArray(stored.rtc.iceServers) ? stored.rtc.iceServers.length : 0,
    });
    return stored.rtc;
  }

  const flightKey = `${key}:${generation}:${force ? "1" : "0"}`;
  const pending = inflight.get(flightKey);
  if (pending) return pending.promise;

  const requestId = nextRequestId();
  const started = Date.now();
  trace({
    event: "fetch_started",
    callId: key,
    requestId,
    callType,
    direction,
    cacheStatus: "request",
  });

  let promise;
  promise = (async () => {
    try {
      const client = await httpClient();
      const response = await client.get("/webrtc/ice-servers", {
        timeout: 7000,
        params: force ? { fresh: "1" } : undefined,
      });
      const session = rtcConfigFromIceResponse(response.data, { production: productionBuild() });
      const providerCache = response.data?.providerCache === "hit" ? "provider_hit" : "provider_generated";
      if (!released.has(generation)) rememberSession(key, generation, session, requestId);
      trace({
        event: "fetch_success",
        callId: key,
        requestId,
        callType,
        direction,
        duration: Math.max(0, Date.now() - started),
        cacheStatus: providerCache,
        httpStatus: Number(response.status) || 200,
        serverCount: Array.isArray(session.rtc?.iceServers) ? session.rtc.iceServers.length : 0,
      });
      return session.rtc;
    } catch (error) {
      const current = sessions.get(key);
      if (current?.token === generation) sessions.delete(key);
      if (applied?.token === generation && applied?.callKey === key) applied = null;
      trace({
        event: "fetch_failed",
        callId: key,
        requestId,
        callType,
        direction,
        duration: Math.max(0, Date.now() - started),
        failureCategory: failureCategory(error),
        httpStatus: httpStatusOf(error),
      });
      if (error instanceof TurnUnavailableError) throw error;
      throw new TurnUnavailableError();
    } finally {
      if (inflight.get(flightKey)?.promise === promise) inflight.delete(flightKey);
    }
  })();

  inflight.set(flightKey, { promise, token: generation });
  return promise;
};

export const refreshIceConfigIfDue = async () => {
  if (iceRefreshDue(getIceSession())) return getIceConfig({ force: true });
  return getIceConfig();
};

export const setIceTransportForTests = (client) => {
  transport = client;
};

export const resetIceSessionsForTests = () => {
  sessions.clear();
  inflight.clear();
  released.clear();
  claimToken = 0;
  applied = null;
  transport = null;
};
