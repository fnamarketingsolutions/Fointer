export const TURN_UNAVAILABLE_MESSAGE =
  "Reliable calling is temporarily unavailable. Please try again in a moment.";

export class TurnUnavailableError extends Error {
  constructor(message = TURN_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "TurnUnavailableError";
    this.code = "TURN_UNAVAILABLE";
  }
}

const urlsOf = (server) => {
  const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
  return urls.map((url) => String(url || "")).filter(Boolean);
};

const hasTurnServer = (servers) =>
  (servers || []).some((server) => urlsOf(server).some((url) => /^turns?:/i.test(url)));

/** True only when the backend says this credential must be rotated before it expires. */
export const iceRefreshDue = (session, now = Date.now()) => {
  if (!session || session.expiresAt == null || session.credentialUpdate !== "renegotiate") return false;
  const deadline = Date.parse(session.restartBefore || "");
  return Number.isFinite(deadline) && deadline <= now;
};

const credentialCanRotate = (session) =>
  Boolean(session)
  && session.expiresAt != null
  && session.credentialUpdate === "renegotiate"
  && Number.isFinite(Date.parse(session.restartBefore || ""));

/**
 * Arms one timer for a healthy call whose credential has a real restartBefore.
 * Unknown expiry and next-peer-connection sessions do not arm a timer.
 * A failed refresh retries a bounded number of times and does not loop.
 */
export const scheduleCredentialRotation = ({
  getSession,
  isActive = () => true,
  isHealthy = () => true,
  rotate,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  retryDelayMs = 5_000,
  maxRefreshFailures = 2,
} = {}) => {
  let timer = null;
  let pending = false;
  let stopped = false;
  let failures = 0;

  const disarm = () => {
    if (timer == null) return;
    clearTimer(timer);
    timer = null;
  };

  const arm = () => {
    if (pending || stopped) return;
    disarm();
    if (!isActive()) return;
    const session = getSession?.() || null;
    if (!credentialCanRotate(session)) return;
    const deadline = Date.parse(session.restartBefore);
    const delay = Math.max(0, deadline - now());
    const id = setTimer(() => {
      if (timer === id) timer = null;
      clearTimer(id);
      void tick();
    }, delay);
    timer = id;
  };

  const retryLater = () => {
    failures += 1;
    if (stopped || failures >= maxRefreshFailures) return;
    disarm();
    const id = setTimer(() => {
      if (timer === id) timer = null;
      clearTimer(id);
      void tick();
    }, retryDelayMs);
    timer = id;
  };

  const tick = async () => {
    if (stopped || pending || !isActive()) return;
    const session = getSession?.() || null;
    if (!credentialCanRotate(session)) return;
    if (!iceRefreshDue(session, now())) {
      arm();
      return;
    }
    if (!isHealthy()) {
      retryLater();
      return;
    }
    pending = true;
    disarm();
    let outcome = "failed";
    try {
      outcome = await rotate();
    } catch {
      outcome = "failed";
    } finally {
      pending = false;
    }
    if (stopped || !isActive()) return;
    if (outcome === "failed" || outcome === "skipped") {
      retryLater();
      return;
    }
    failures = 0;
    const next = getSession?.() || null;
    const nextDeadline = Date.parse(next?.restartBefore || "");
    if (credentialCanRotate(next) && Number.isFinite(nextDeadline) && nextDeadline > now()) {
      arm();
    }
  };

  arm();
  return {
    arm,
    stop() {
      stopped = true;
      pending = false;
      disarm();
    },
  };
};

/**
 * Turns the backend ICE contract into an RTCPeerConnection config.
 * The client does not choose relay policy, STUN servers, or credential lifetime.
 */
export const rtcConfigFromIceResponse = (data, { production = false } = {}) => {
  const iceServers = data?.rtc?.iceServers;
  if (!data?.success || !Array.isArray(iceServers) || iceServers.length === 0) {
    throw new TurnUnavailableError();
  }
  const relayAvailable = data.relay?.available === true;
  const hasRelay = hasTurnServer(iceServers);
  const transportPolicy = data.rtc.iceTransportPolicy === "relay" ? "relay" : "all";
  if (transportPolicy === "relay" && (!relayAvailable || !hasRelay)) {
    throw new TurnUnavailableError();
  }
  if (production && !hasRelay) throw new TurnUnavailableError();
  return {
    rtc: {
      iceServers,
      bundlePolicy: data.rtc.bundlePolicy || "max-bundle",
      iceTransportPolicy: transportPolicy,
    },
    version: data.version ?? null,
    issuedAt: data.issuedAt || null,
    expiresAt: data.expiresAt ?? null,
    refreshAt: data.refreshAt || null,
    credentialUpdate: data.credentialUpdate === "renegotiate" ? "renegotiate" : "next-peer-connection",
    restartBefore: data.restartBefore || null,
    relayAvailable,
    fallback: data.fallback || null,
  };
};

/**
 * Refreshing the ICE API does not change an existing peer connection.
 * When the backend marks the credential for renegotiation, apply the new
 * config with setConfiguration and let the caller run ICE restart.
 * Without setConfiguration the active connection cannot take the new credential.
 */
export const maybeRotateIce = async (pc, session, fetchConfig, now = Date.now()) => {
  if (!iceRefreshDue(session, now)) return { action: "none" };
  const rtc = await fetchConfig({ force: true });
  if (pc && typeof pc.setConfiguration === "function") {
    pc.setConfiguration({
      iceServers: rtc.iceServers,
      bundlePolicy: rtc.bundlePolicy,
      iceTransportPolicy: rtc.iceTransportPolicy,
    });
    return { action: "restart", rtc };
  }
  return { action: "replace-peer-connection", rtc };
};
