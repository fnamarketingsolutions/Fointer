/**
 * The peer that created the first offer retries ICE when the path dies.
 * The other peer only answers, so the two sides do not restart at once.
 */
export const watchPeerConnection = (pc, { polite = false, sendOffer, isActive } = {}) => {
  if (!pc?.addEventListener) return;
  let attempts = 0;
  let timer = null;

  const restart = async () => {
    if (isActive && !isActive()) return;
    if (!pc.signalingState || pc.signalingState !== "stable") return;
    if (pc.connectionState === "connected") return;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      if (pc.signalingState !== "stable") return;
      await pc.setLocalDescription(offer);
      sendOffer?.(pc.localDescription);
    } catch {
      /* a later failure can try again */
    }
  };

  pc.addEventListener("connectionstatechange", () => {
    if (polite) return;
    const state = pc.connectionState;
    if (state !== "failed" && state !== "disconnected") {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return;
    }
    if (attempts >= 2 || timer) return;
    const delay = state === "disconnected" ? 2000 : 400;
    timer = setTimeout(() => {
      timer = null;
      attempts += 1;
      void restart();
    }, delay);
  });
};
