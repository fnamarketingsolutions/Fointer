export const createMessageId = (random = Math.random) =>
  `sig_${Date.now().toString(36)}_${Math.floor(random() * 1e9).toString(36)}`;

export const retryDelayMs = (attempt, { baseMs = 400, capMs = 4_000, random = Math.random } = {}) => {
  const exponent = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponent + exponent * 0.2 * random());
};

export const rememberSignal = (seen, messageId, limit = 200) => {
  if (!messageId) return true;
  if (seen.has(messageId)) return false;
  seen.add(messageId);
  while (seen.size > limit) {
    const oldest = seen.values().next().value;
    seen.delete(oldest);
  }
  return true;
};

export const isStaleIce = ({ type, generation, currentGeneration } = {}) => {
  if (type !== "ice") return false;
  if (generation == null || currentGeneration == null) return false;
  return Number(generation) !== Number(currentGeneration);
};

const terminalFailure = (ack) =>
  ack && ack.success === false && /ended|not ready|unauthorized|not in this call/i.test(String(ack.message || ""));

/**
 * Acked delivery with a bounded retry. ICE for an older generation is not replayed.
 */
export const createSignalCourier = ({
  emit,
  isActive = () => true,
  maxAttempts = 3,
  timeoutMs = 1_200,
  baseDelayMs = 400,
  random = Math.random,
  onFailure = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) => {
  const timers = new Set();
  const state = new Map();

  const later = (fn, delay) => {
    const timer = setTimer(() => {
      timers.delete(timer);
      fn();
    }, delay);
    timers.add(timer);
    return timer;
  };

  const cancelPending = () => {
    for (const timer of timers) clearTimer(timer);
    timers.clear();
    state.clear();
  };

  const dropOlder = (generation) => {
    for (const [messageId, entry] of state) {
      if (entry.generation != null && Number(entry.generation) !== Number(generation)) {
        entry.dropped = true;
        state.set(messageId, entry);
      }
    }
  };

  const send = (payload) => {
    if (!isActive()) return null;
    const messageId = payload.messageId || createMessageId(random);
    const message = { ...payload, messageId };
    state.set(messageId, { generation: message.generation ?? null, dropped: false });
    let attempt = 0;

    const giveUp = (reason) => {
      state.delete(messageId);
      onFailure({ messageId, type: message.type || "", reason });
    };

    const tryOnce = () => {
      const entry = state.get(messageId);
      if (!entry || entry.dropped || !isActive()) {
        state.delete(messageId);
        return;
      }
      attempt += 1;
      let settled = false;
      const timer = later(() => {
        if (settled) return;
        settled = true;
        if (attempt >= maxAttempts) {
          giveUp("timeout");
          return;
        }
        later(tryOnce, retryDelayMs(attempt, { baseMs: baseDelayMs, random }));
      }, timeoutMs);
      emit(message, (ack) => {
        if (settled) return;
        const current = state.get(messageId);
        if (!current || current.dropped) {
          settled = true;
          clearTimer(timer);
          timers.delete(timer);
          return;
        }
        settled = true;
        clearTimer(timer);
        timers.delete(timer);
        if (ack?.success) {
          state.delete(messageId);
          return;
        }
        if (terminalFailure(ack)) {
          giveUp("rejected");
          return;
        }
        if (attempt >= maxAttempts) {
          giveUp("failed");
          return;
        }
        later(tryOnce, retryDelayMs(attempt, { baseMs: baseDelayMs, random }));
      });
    };

    tryOnce();
    return messageId;
  };

  return { send, cancelPending, dropOlder };
};
