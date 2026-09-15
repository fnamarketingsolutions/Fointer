/** Soft phone-like ring using Web Audio (no asset file). */
export const createCallRingtone = () => {
  let ctx = null;
  let timer = null;
  let stopped = false;

  const beep = () => {
    if (stopped) return;
    try {
      if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        ctx = new AudioCtx();
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(980, now + 0.18);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch {
      /* autoplay / unsupported */
    }
  };

  const tick = () => {
    beep();
    window.setTimeout(beep, 450);
  };

  tick();
  timer = window.setInterval(tick, 1800);

  return () => {
    stopped = true;
    if (timer) window.clearInterval(timer);
    timer = null;
    try {
      ctx?.close();
    } catch {
      /* ignore */
    }
    ctx = null;
  };
};

export const closeCallPushNotification = (conversationId) => {
  const tag = `call:${String(conversationId || "")}`;
  if (!tag || tag === "call:" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      reg.active?.postMessage({ type: "CLOSE_CALL_NOTIFICATION", tag });
      return reg.getNotifications({ tag });
    })
    .then((list) => list?.forEach((n) => n.close()))
    .catch(() => {});
};
