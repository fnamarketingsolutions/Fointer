/**
 * The peer that created the first offer retries ICE when the path dies.
 * The other peer only answers, so the two sides do not restart at once.
 */
export const DEFAULT_CHECKING_TIMEOUT_MS = 25_000;
export const MAX_RESTART_ATTEMPTS = 4;

export const classifyConnection = ({
  iceConnectionState = "",
  connectionState = "",
  everConnected = false,
} = {}) => {
  if (connectionState === "closed" || iceConnectionState === "closed") return "closed";
  if (
    connectionState === "connected" ||
    iceConnectionState === "connected" ||
    iceConnectionState === "completed"
  ) {
    return "connected";
  }
  if (connectionState === "failed" || iceConnectionState === "failed") return "failed";
  if (connectionState === "disconnected" || iceConnectionState === "disconnected") {
    return "disconnected";
  }
  if (
    !everConnected &&
    (iceConnectionState === "checking" || iceConnectionState === "new" || connectionState === "connecting")
  ) {
    return "checking";
  }
  if (everConnected && (iceConnectionState === "checking" || connectionState === "connecting")) {
    return "disconnected";
  }
  return "idle";
};

export const restartDelayMs = (
  attempt,
  { baseMs = 800, capMs = 12_000, jitterRatio = 0.2, random = Math.random } = {}
) => {
  const exponent = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
  const swing = exponent * jitterRatio * ((random() * 2) - 1);
  return Math.max(0, Math.round(exponent + swing));
};

export const watchPeerConnection = (
  pc,
  {
    polite = false,
    sendOffer,
    isActive,
    onStatus,
    checkingTimeoutMs = DEFAULT_CHECKING_TIMEOUT_MS,
    maxAttempts = MAX_RESTART_ATTEMPTS,
    disconnectedGraceMs = 4_000,
    recoveryDelayMs = null,
    random = Math.random,
  } = {}
) => {
  if (!pc?.addEventListener) return () => {};
  let attempts = 0;
  let timer = null;
  let timerKind = "";
  let restarting = false;
  let stopped = false;
  let everConnected = false;

  const reportStatus = (status, reason) => {
    onStatus?.(status, { reason, attempts, everConnected });
  };

  const inactive = () => stopped || (isActive && !isActive()) || classifyConnection(pc) === "closed";

  const clearRestartTimer = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    timerKind = "";
  };

  const recoveryDelay = (attempt) => recoveryDelayMs ?? restartDelayMs(attempt, { random });

  const schedule = (kind, delay) => {
    if (inactive()) return;
    if (polite) {
      reportStatus("reconnecting", "waiting_for_peer_restart");
      return;
    }
    if (timer && timerKind === "checking" && kind === "checking") return;
    if (timer && kind !== "failed") return;
    if (kind === "failed" && (timerKind === "checking" || timerKind === "media")) clearRestartTimer();
    if (timer) return;
    if (attempts >= maxAttempts) {
      reportStatus("failed", "restart_attempts_exhausted");
      return;
    }
    timerKind = kind;
    reportStatus(
      kind === "checking" ? "connecting" : "reconnecting",
      kind === "checking" ? "initial_checking" : kind === "disconnected" ? "temporarily_disconnected" : "restart_scheduled"
    );
    timer = setTimeout(() => {
      timer = null;
      timerKind = "";
      if (inactive()) return;
      const health = classifyConnection({ ...pc, everConnected });
      if (health === "connected" || health === "idle" || health === "closed") return;
      if (pc.signalingState !== "stable") {
        schedule(kind, recoveryDelay(attempts));
        return;
      }
      void restart();
    }, delay);
  };

  const restart = async ({ force = false } = {}) => {
    if (inactive() || restarting || pc.signalingState !== "stable") return;
    if (!force && classifyConnection({ ...pc, everConnected }) === "connected") return;
    restarting = true;
    reportStatus("reconnecting", "ice_restart");
    let offered = false;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      if (!inactive() && pc.signalingState === "stable") {
        await pc.setLocalDescription(offer);
        attempts += 1;
        sendOffer?.(pc.localDescription);
        offered = true;
      }
    } catch {
      attempts += 1;
      reportStatus(attempts >= maxAttempts ? "failed" : "reconnecting", "restart_error");
    } finally {
      restarting = false;
    }
    if (inactive()) return;
    if (!offered && pc.signalingState !== "stable") {
      schedule("failed", recoveryDelay(attempts));
      return;
    }
    const after = classifyConnection({ ...pc, everConnected });
    if (after === "failed" || after === "disconnected") {
      schedule(after, recoveryDelay(attempts));
    }
  };

  const onState = () => {
    if (inactive()) {
      clearRestartTimer();
      return;
    }
    const health = classifyConnection({ ...pc, everConnected });
    if (health === "connected") {
      everConnected = true;
      attempts = 0;
      clearRestartTimer();
      reportStatus("connected", "ice_connected");
      return;
    }
    if (health === "checking") {
      schedule("checking", checkingTimeoutMs);
      return;
    }
    if (health === "disconnected") {
      schedule(
        "disconnected",
        everConnected ? disconnectedGraceMs : recoveryDelay(attempts)
      );
      return;
    }
    if (health === "failed") schedule("failed", recoveryDelay(attempts));
  };

  pc.addEventListener("connectionstatechange", onState);
  pc.addEventListener("iceconnectionstatechange", onState);

  const stop = () => {
    stopped = true;
    clearRestartTimer();
    pc.removeEventListener?.("connectionstatechange", onState);
    pc.removeEventListener?.("iceconnectionstatechange", onState);
  };
  stop.request = () => {
    if (inactive() || polite || restarting || timer) return;
    if (attempts >= maxAttempts) {
      reportStatus("failed", "restart_attempts_exhausted");
      return;
    }
    timerKind = "media";
    timer = setTimeout(() => {
      timer = null;
      timerKind = "";
      if (inactive()) return;
      if (pc.signalingState !== "stable") {
        schedule("failed", recoveryDelay(attempts));
        return;
      }
      void restart({ force: true });
    }, recoveryDelay(attempts));
  };
  return stop;
};
