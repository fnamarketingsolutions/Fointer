/**
 * The peer that created the first offer retries ICE when the path dies.
 * The other peer only answers, so the two sides do not restart at once.
 */
export const watchPeerConnection = (
  pc,
  {
    polite = false,
    sendOffer,
    isActive,
    checkingTimeoutMs = 10_000,
  } = {}
) => {
  if (!pc?.addEventListener) return () => {};
  let attempts = 0;
  let timer = null;
  let restarting = false;
  let everConnected = false;

  const restart = async () => {
    if (
      (isActive && !isActive()) ||
      pc.signalingState !== "stable" ||
      pc.connectionState === "connected" ||
      restarting
    ) {
      return;
    }
    restarting = true;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      if (pc.signalingState !== "stable") return;
      await pc.setLocalDescription(offer);
      sendOffer?.(pc.localDescription);
    } catch {
      // Another state change may retry if the connection is still unhealthy.
    } finally {
      restarting = false;
    }
  };

  const clearRestartTimer = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  };

  const scheduleRestart = (delay) => {
    if (
      polite ||
      attempts >= 2 ||
      timer ||
      restarting ||
      (isActive && !isActive())
    ) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      if (isActive && !isActive()) return;
      attempts += 1;
      void restart();
    }, delay);
  };

  const onConnectionStateChange = () => {
    const state = pc.connectionState;
    if (state === "connected") {
      everConnected = true;
      attempts = 0;
      clearRestartTimer();
      return;
    }
    if (state === "failed" || state === "disconnected") {
      scheduleRestart(state === "disconnected" ? 2000 : 400);
    }
  };

  const onIceConnectionStateChange = () => {
    const state = pc.iceConnectionState;
    if (state === "connected" || state === "completed") {
      everConnected = true;
      attempts = 0;
      clearRestartTimer();
      return;
    }
    if (state === "failed" || state === "disconnected") {
      scheduleRestart(state === "disconnected" ? 2000 : 400);
    } else if (state === "checking" && !everConnected) {
      scheduleRestart(checkingTimeoutMs);
    }
  };

  pc.addEventListener("connectionstatechange", onConnectionStateChange);
  pc.addEventListener("iceconnectionstatechange", onIceConnectionStateChange);

  return () => {
    clearRestartTimer();
    pc.removeEventListener?.("connectionstatechange", onConnectionStateChange);
    pc.removeEventListener?.("iceconnectionstatechange", onIceConnectionStateChange);
  };
};
