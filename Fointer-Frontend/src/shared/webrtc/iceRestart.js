import { scheduleCredentialRotation } from "./iceContract.js";

/**
 * The peer that created the first offer retries ICE when the path dies.
 * The other peer only answers, so the two sides do not restart at once.
 */
export const DEFAULT_CHECKING_TIMEOUT_MS = 25_000;
export const MAX_RESTART_ATTEMPTS = 4;
export const MAX_INITIAL_OFFER_RESENDS = 2;

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
  // iOS can report disconnected while the first candidate check, including TURN, is still running.
  if (
    !everConnected &&
    (
      iceConnectionState === "checking" ||
      iceConnectionState === "new" ||
      iceConnectionState === "disconnected" ||
      connectionState === "connecting" ||
      connectionState === "disconnected"
    )
  ) {
    return "checking";
  }
  if (connectionState === "disconnected" || iceConnectionState === "disconnected") {
    return "disconnected";
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
    retryInitialOffer = false,
    maxOfferResends = MAX_INITIAL_OFFER_RESENDS,
    disconnectedGraceMs = 4_000,
    recoveryDelayMs = null,
    random = Math.random,
    beforeRestart = null,
    claimOffer = null,
    releaseOffer = null,
    getCredentialSession = null,
    credentialRetryMs = 5_000,
    maxCredentialFailures = 2,
  } = {}
) => {
  if (!pc?.addEventListener) return () => {};
  let attempts = 0;
  let offerResends = 0;
  let lockWaits = 0;
  let timer = null;
  let timerKind = "";
  let restarting = false;
  let stopped = false;
  let everConnected = false;
  let credentialWatch = { stop() {}, arm() {} };

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
      reportStatus(everConnected ? "reconnecting" : "connecting", everConnected ? "waiting_for_peer_restart" : "initial_checking");
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
      if (
        retryInitialOffer &&
        kind === "checking" &&
        !everConnected &&
        pc.signalingState === "have-local-offer"
      ) {
        resendCurrentOffer();
        return;
      }
      if (pc.signalingState !== "stable") {
        schedule(kind, recoveryDelay(attempts));
        return;
      }
      void restart();
    }, delay);
  };

  const deferLockedRestart = () => {
    if (inactive() || attempts >= maxAttempts || lockWaits >= maxAttempts) return;
    lockWaits += 1;
    if (lockWaits >= maxAttempts) return;
    schedule("failed", recoveryDelay(lockWaits - 1));
  };

  const resendCurrentOffer = () => {
    if (polite || inactive() || everConnected) return;
    if (pc.signalingState !== "have-local-offer" || !pc.localDescription) {
      reportStatus("failed", "initial_offer_missing");
      return;
    }
    if (offerResends >= maxOfferResends) {
      reportStatus("failed", "initial_offer_unanswered");
      return;
    }
    offerResends += 1;
    reportStatus("connecting", "resend_local_offer");
    sendOffer?.(pc.localDescription, { resend: true });
    schedule("checking", checkingTimeoutMs);
  };

  const restart = async ({ force = false, credential = false } = {}) => {
    if (inactive() || restarting || pc.signalingState !== "stable") {
      return credential ? "skipped" : undefined;
    }
    if (credential && (polite || classifyConnection({ ...pc, everConnected }) !== "connected")) {
      return "skipped";
    }
    if (!force && !credential && classifyConnection({ ...pc, everConnected }) === "connected") return;
    let claimed = false;
    if (typeof claimOffer === "function") {
      claimed = claimOffer() === true;
      if (!claimed) {
        if (!credential) deferLockedRestart();
        return credential ? "skipped" : undefined;
      }
    }
    restarting = true;
    let offered = false;
    let credentialOutcome = "failed";
    try {
      if (credential) {
        let rotation = { action: "restart" };
        try {
          if (typeof beforeRestart === "function") {
            rotation = (await beforeRestart(pc)) || { action: "none" };
          }
        } catch {
          return "failed";
        }
        if (inactive()) return "inactive";
        if (rotation?.action !== "restart") return "skipped";
      } else if (typeof beforeRestart === "function") {
        await beforeRestart(pc);
      }
      if (inactive() || pc.signalingState !== "stable") {
        return credential ? "skipped" : undefined;
      }
      reportStatus("reconnecting", credential ? "credential_refresh" : "ice_restart");
      const offer = await pc.createOffer({ iceRestart: true });
      if (!inactive() && pc.signalingState === "stable") {
        await pc.setLocalDescription(offer);
        lockWaits = 0;
        if (!credential) attempts += 1;
        sendOffer?.(pc.localDescription, credential ? { credential: true } : undefined);
        offered = true;
        credentialOutcome = "restarted";
      }
    } catch {
      if (credential) {
        if (classifyConnection({ ...pc, everConnected }) === "connected") {
          reportStatus("connected", "credential_refresh_failed");
        }
        return "failed";
      }
      attempts += 1;
      reportStatus(attempts >= maxAttempts ? "failed" : "reconnecting", "restart_error");
    } finally {
      restarting = false;
      if (claimed) releaseOffer?.();
      if (!credential) credentialWatch.arm();
    }
    if (credential) {
      if (inactive()) return "inactive";
      return offered ? "restarted" : credentialOutcome;
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

  if (typeof getCredentialSession === "function") {
    credentialWatch = scheduleCredentialRotation({
      getSession: getCredentialSession,
      isActive: () => !inactive() && !polite,
      isHealthy: () =>
        !restarting
        && pc.signalingState === "stable"
        && classifyConnection({ ...pc, everConnected }) === "connected",
      rotate: () => restart({ credential: true }),
      retryDelayMs: credentialRetryMs,
      maxRefreshFailures: maxCredentialFailures,
    });
  }

  const onState = () => {
    if (inactive()) {
      clearRestartTimer();
      return;
    }
    const health = classifyConnection({ ...pc, everConnected });
    if (health === "connected") {
      everConnected = true;
      attempts = 0;
      offerResends = 0;
      lockWaits = 0;
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
    credentialWatch.stop();
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
