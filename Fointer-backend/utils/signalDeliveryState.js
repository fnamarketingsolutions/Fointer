const STATES = new Set([
  "emitted",
  "delivered",
  "applied",
  "rejected",
  "timed-out",
  "queued",
]);

/**
 * Server emission, socket delivery, and remote application are different states.
 * `applied` is only true when a client reports that it used the signal.
 */
export const serverSignalObservation = (delivery) => {
  const raw = delivery === "timeout" ? "timed-out" : String(delivery || "rejected");
  const state = STATES.has(raw) ? raw : "rejected";
  return {
    delivery: state,
    remoteApplied: state === "applied",
  };
};

/**
 * Acknowledgement and retry policy for a call signal.
 * A successful server ack means the server accepted or queued the packet.
 * It does not mean the remote peer applied it. Timeouts retry until the cap.
 * A rejected ack is terminal.
 */
export const nextSignalAttempt = ({
  attempt = 0,
  maxAttempts = 3,
  ack = null,
  timedOut = false,
} = {}) => {
  if (timedOut) {
    if (attempt >= maxAttempts) return { action: "stop", delivery: "timed-out", remoteApplied: false };
    return { action: "retry", delivery: "timed-out", remoteApplied: false };
  }
  if (ack?.success === true) {
    return { action: "stop", delivery: "emitted", remoteApplied: false };
  }
  if (ack && ack.success === false) {
    return { action: "stop", delivery: "rejected", remoteApplied: false };
  }
  if (attempt >= maxAttempts) return { action: "stop", delivery: "timed-out", remoteApplied: false };
  return { action: "retry", delivery: "timed-out", remoteApplied: false };
};
