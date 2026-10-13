/** ICE candidates that arrive before setRemoteDescription must wait. */
export const createIceQueue = () => ({
  remoteReady: false,
  pending: [],
});

export const takeIceCandidate = (queue, candidate) => {
  if (!candidate || !queue) return [];
  if (!queue.remoteReady) {
    queue.pending.push(candidate);
    return [];
  }
  return [candidate];
};

export const markRemoteDescriptionSet = (queue) => {
  if (!queue) return [];
  queue.remoteReady = true;
  return queue.pending.splice(0, queue.pending.length);
};

export const callPhaseCanSignal = (phase) =>
  phase === "active" || phase === "connecting" || phase === "ringing_out";

/** Runs signaling tasks one at a time so ICE cannot pass an in-flight offer. */
export const enqueueSerial = (holder, task) => {
  const previous = holder.chain || Promise.resolve();
  const run = previous.then(() => task(), () => task());
  holder.chain = run.then(
    () => {},
    () => {}
  );
  return run;
};
