/** Fixed m-line order. Both peers must append kinds in this sequence. */
export const MEDIA_KINDS = ["audio", "video"];

export const transceiverKind = (transceiver) =>
  transceiver?.receiver?.track?.kind ||
  transceiver?.sender?.track?.kind ||
  transceiver?.kind ||
  "";

export const isStoppedTransceiver = (transceiver) =>
  !transceiver || transceiver.stopped === true || transceiver.direction === "stopped";

const activeTransceivers = (pc) =>
  (pc?.getTransceivers?.() || []).filter((transceiver) => !isStoppedTransceiver(transceiver));

export const mediaLineOrder = (pc) =>
  activeTransceivers(pc)
    .map(transceiverKind)
    .filter((kind) => kind === "audio" || kind === "video");

export const liveTrack = (stream, kind) => {
  const list = kind === "audio" ? stream?.getAudioTracks?.() : stream?.getVideoTracks?.();
  return (list || []).find((track) => track && track.readyState !== "ended") || null;
};

export const findKindTransceiver = (pc, kind) =>
  activeTransceivers(pc).find((item) => transceiverKind(item) === kind) || null;

/** Media kinds in offer order. The SDP text is not retained or logged. */
export const mLineKindsFromSdp = (description) => {
  const sdp = typeof description === "string" ? description : description?.sdp;
  if (typeof sdp !== "string" || !sdp) return [];
  const kinds = [];
  for (const line of sdp.split(/\r?\n/)) {
    const match = /^m=(audio|video)\b/i.exec(line);
    if (match) kinds.push(match[1].toLowerCase());
  }
  return kinds;
};

const negotiated = (pc) =>
  Boolean(
    pc?.currentLocalDescription
    || pc?.currentRemoteDescription
    || pc?.localDescription
    || pc?.remoteDescription
  );

const retireTransceiver = (transceiver) => {
  if (isStoppedTransceiver(transceiver)) return false;
  if (typeof transceiver.stop === "function") transceiver.stop();
  transceiver.stopped = true;
  transceiver.direction = "stopped";
  return true;
};

/**
 * Before the first remote offer is applied, drop local transceivers that are
 * not in that offer. A later camera enable appends video after audio.
 * A description that is already negotiated is left unchanged.
 */
export const prepareForRemoteOffer = (pc, description) => {
  const stopped = [];
  if (!pc?.getTransceivers || negotiated(pc)) return { stopped };
  const offerKinds = mLineKindsFromSdp(description);
  if (!offerKinds.length) return { stopped };
  const transceivers = pc.getTransceivers();
  let keep = offerKinds.length;
  for (let index = 0; index < offerKinds.length && index < transceivers.length; index += 1) {
    if (isStoppedTransceiver(transceivers[index])) continue;
    if (transceiverKind(transceivers[index]) !== offerKinds[index]) {
      keep = index;
      break;
    }
  }
  for (let index = keep; index < transceivers.length; index += 1) {
    const transceiver = transceivers[index];
    const kind = transceiverKind(transceiver);
    if (!retireTransceiver(transceiver)) continue;
    if (kind === "audio" || kind === "video") stopped.push(kind);
  }
  return { stopped };
};

/** A new offer is legal only while this connection is stable and idle. */
export const canCreateOffer = (pc, { makingOffer = false } = {}) => {
  if (makingOffer) return false;
  const state = pc?.signalingState || "stable";
  return state === "stable";
};

/**
 * True when the next offer keeps every previously negotiated m-line
 * and only appends new kinds after them.
 */
export const mLineOrderPreserved = (previous = [], next = []) => {
  if (next.length < previous.length) return false;
  return previous.every((kind, index) => next[index] === kind);
};

export const claimOfferLock = (peer, pc) => {
  if (!peer || peer.offerLock) return false;
  if (!canCreateOffer(pc)) return false;
  peer.offerLock = true;
  return true;
};

export const releaseOfferLock = (peer) => {
  if (peer) peer.offerLock = false;
};

/**
 * Attach each live local track once, audio before video.
 * A kind that already has a transceiver is reused. A new kind is appended.
 */
export const attachLocalMedia = (pc, stream) => {
  const added = [];
  if (!pc || !stream) return { added, order: mediaLineOrder(pc) };
  for (const kind of MEDIA_KINDS) {
    const track = liveTrack(stream, kind);
    if (!track) continue;
    const existing = findKindTransceiver(pc, kind);
    if (existing) {
      const current = existing.sender?.track;
      if (current?.id !== track.id && typeof existing.sender?.replaceTrack === "function") {
        existing.sender.replaceTrack(track);
      }
      continue;
    }
    if (typeof pc.addTrack === "function") pc.addTrack(track, stream);
    else pc.addTransceiver?.(track, { direction: "sendrecv" });
    added.push(kind);
  }
  return { added, order: mediaLineOrder(pc) };
};

/**
 * Bind local tracks onto the offer's existing transceivers.
 * This does not create an m-line the remote offer did not contain.
 */
export const bindTracksToOffer = (pc, stream) => {
  const bound = [];
  const pending = [];
  if (!pc || !stream) return { bound, pending: Promise.resolve() };
  for (const kind of MEDIA_KINDS) {
    const track = liveTrack(stream, kind);
    const existing = findKindTransceiver(pc, kind);
    if (!track || !existing) continue;
    const current = existing.sender?.track;
    if (current?.id !== track.id && typeof existing.sender?.replaceTrack === "function") {
      pending.push(existing.sender.replaceTrack(track));
    }
    if (!current || current.readyState === "ended") {
      if (existing.direction === "recvonly" || existing.direction === "inactive") {
        existing.direction = "sendrecv";
      }
    }
    bound.push(kind);
  }
  return { bound, pending: Promise.all(pending) };
};

export const missingLocalKinds = (pc, stream) =>
  MEDIA_KINDS.filter((kind) => liveTrack(stream, kind) && !findKindTransceiver(pc, kind));
