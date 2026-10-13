/** Allows `limit` events per key inside each window. */
export const createSocketRateLimit = ({
  limit,
  windowMs,
  now = Date.now,
} = {}) => {
  const buckets = new Map();
  const max = Math.max(1, Number(limit) || 1);
  const span = Math.max(1, Number(windowMs) || 1);
  return (key) => {
    const id = String(key || "");
    if (!id) return false;
    const time = now();
    const bucket = buckets.get(id);
    if (!bucket || time - bucket.start >= span) {
      buckets.set(id, { start: time, count: 1 });
      return true;
    }
    if (bucket.count >= max) return false;
    bucket.count += 1;
    return true;
  };
};

/** Shared chat budget: 20 messages per 10 seconds per socket and channel. */
export const allowChatMessage = createSocketRateLimit({
  limit: 20,
  windowMs: 10_000,
});

export const chatRateLimited = (ack) => {
  if (typeof ack === "function") {
    ack({
      success: false,
      message: "You are sending messages too quickly.",
    });
  }
};
