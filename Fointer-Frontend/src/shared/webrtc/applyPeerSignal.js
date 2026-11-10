import { markRemoteDescriptionSet, takeIceCandidate } from "./iceQueue.js";
import { isStaleIce, rememberSignal } from "./signalDelivery.js";

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
  { makingOffer = false, onAnswer, beforeAnswer } = {}
) => {
  if (!peer?.pc || !peer.iceQueue) return false;
  const { type, sdp, candidate, messageId, generation } = signal || {};
  peer.seenSignals = peer.seenSignals || new Set();
  if (!rememberSignal(peer.seenSignals, messageId)) return false;
  if (isStaleIce({ type, generation, currentGeneration: peer.iceGeneration ?? 0 })) return false;
  if (type === "offer" && generation != null) peer.iceGeneration = Number(generation);

  if (type === "offer" && sdp) {
    const collision = makingOffer || peer.pc.signalingState !== "stable";
    peer.ignoreOffer = !peer.polite && collision;
    if (peer.ignoreOffer) return false;

    if (collision) {
      await Promise.all([
        peer.pc.setLocalDescription({ type: "rollback" }),
        peer.pc.setRemoteDescription(sdp),
      ]);
    } else {
      await peer.pc.setRemoteDescription(sdp);
    }
    await flushIce(peer);
    if (typeof beforeAnswer === "function") await beforeAnswer(peer);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    if (typeof onAnswer === "function") onAnswer(peer.pc.localDescription);
    return true;
  }

  if (type === "answer" && sdp) {
    if (peer.pc.signalingState !== "have-local-offer") return false;
    await peer.pc.setRemoteDescription(sdp);
    await flushIce(peer);
    return true;
  }

  if (type === "ice" && candidate && !peer.ignoreOffer) {
    const ready = takeIceCandidate(peer.iceQueue, candidate);
    for (const item of ready) {
      await addCandidate(peer.pc, item);
    }
    return true;
  }
  return false;
};
