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

const LOCAL_CANDIDATE_LIMIT = 40;

/** Keeps this peer's own candidates so they can be sent again after the remote description exists. */
export const pushLocalCandidate = (peer, candidate) => {
  if (!peer || !candidate) return;
  const list = peer.localCandidates || (peer.localCandidates = []);
  list.push({ candidate, replayed: peer.localIceReplayed === true });
  if (list.length > LOCAL_CANDIDATE_LIMIT) list.shift();
};

/** One extra send for candidates gathered before the other peer could apply them. */
export const replayLocalCandidates = (peer) => {
  if (!peer || peer.localIceReplayed) return [];
  peer.localIceReplayed = true;
  const pending = [];
  for (const item of peer.localCandidates || []) {
    if (item.replayed) continue;
    item.replayed = true;
    pending.push(item.candidate);
  }
  return pending;
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
