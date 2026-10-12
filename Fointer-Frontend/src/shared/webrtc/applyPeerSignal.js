import { markRemoteDescriptionSet, takeIceCandidate } from "./iceQueue.js";

const addCandidate = async (pc, candidate) => {
  try {
    await pc.addIceCandidate(candidate);
  } catch {
    /* stale or duplicate candidate */
  }
};

const flushIce = async (peer) => {
  const ready = markRemoteDescriptionSet(peer.iceQueue);
  for (const candidate of ready) {
    await addCandidate(peer.pc, candidate);
  }
};

/**
 * Applies one offer, answer, or ICE candidate.
 * Candidates that arrive before the remote description stay on peer.iceQueue.
 */
export const applyPeerSignal = async (
  peer,
  signal,
  { makingOffer = false, onAnswer } = {}
) => {
  if (!peer?.pc || !peer.iceQueue) return;
  const { type, sdp, candidate } = signal || {};

  if (type === "offer" && sdp) {
    const collision = makingOffer || peer.pc.signalingState !== "stable";
    peer.ignoreOffer = !peer.polite && collision;
    if (peer.ignoreOffer) return;

    if (collision) {
      await Promise.all([
        peer.pc.setLocalDescription({ type: "rollback" }),
        peer.pc.setRemoteDescription(sdp),
      ]);
    } else {
      await peer.pc.setRemoteDescription(sdp);
    }
    await flushIce(peer);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    if (typeof onAnswer === "function") onAnswer(peer.pc.localDescription);
    return;
  }

  if (type === "answer" && sdp) {
    if (peer.pc.signalingState === "have-local-offer") {
      await peer.pc.setRemoteDescription(sdp);
      await flushIce(peer);
    }
    return;
  }

  if (type === "ice" && candidate && !peer.ignoreOffer) {
    const ready = takeIceCandidate(peer.iceQueue, candidate);
    for (const item of ready) {
      await addCandidate(peer.pc, item);
    }
  }
};
