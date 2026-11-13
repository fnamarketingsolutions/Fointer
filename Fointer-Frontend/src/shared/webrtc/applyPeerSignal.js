import { markRemoteDescriptionSet, takeIceCandidate } from "./iceQueue.js";
import { prepareForRemoteOffer } from "./sdpNegotiation.js";
import { isStaleIce, rememberSignal } from "./signalDelivery.js";

const addCandidate = async (pc, candidate) => {
  try {
    await pc.addIceCandidate(candidate);
    return true;
  } catch {
    return false;
  }
};

const flushIce = async (peer) => {
  const ready = markRemoteDescriptionSet(peer.iceQueue);
  let applied = 0;
  for (const candidate of ready) {
    if (await addCandidate(peer.pc, candidate)) applied += 1;
  }
  return applied;
};

/** Plain offer/answer init. Prototype-only RTCSessionDescription fields are copied. */
export const plainSessionDescription = (description) => {
  if (!description || typeof description !== "object") return null;
  const type = description.type;
  const sdp = description.sdp;
  if ((type === "offer" || type === "answer") && typeof sdp === "string" && sdp) {
    return { type, sdp };
  }
  return description;
};

/**
 * Applies one offer, answer, or ICE candidate.
 * Candidates that arrive before the remote description stay on peer.iceQueue.
 * An answer that arrives before the local offer is kept and applied once that offer exists.
 * An ignored glare offer does not block later ICE for this peer's own offer.
 */
export const applyPeerSignal = async (
  peer,
  signal,
  { makingOffer = false, onAnswer, beforeAnswer, onTrace } = {}
) => {
  if (!peer?.pc || !peer.iceQueue) return false;
  const { type, sdp, candidate, messageId, generation } = signal || {};
  if (type === "answer" && sdp && peer.pc.signalingState !== "have-local-offer") {
    if (messageId && peer.seenSignals?.has(messageId)) return false;
    peer.queuedAnswer = { type, sdp, messageId, generation };
    onTrace?.({ event: "answer_received", result: "queued" });
    return false;
  }

  peer.seenSignals = peer.seenSignals || new Set();
  if (!rememberSignal(peer.seenSignals, messageId)) return false;
  if (isStaleIce({ type, generation, currentGeneration: peer.iceGeneration ?? 0 })) return false;
  if (type === "offer" && generation != null) peer.iceGeneration = Number(generation);

  if (type === "offer" && sdp) {
    const description = plainSessionDescription(sdp);
    const collision = makingOffer || peer.pc.signalingState !== "stable";
    peer.ignoreOffer = !peer.polite && collision;
    if (peer.ignoreOffer) {
      onTrace?.({ event: "offer_received", result: "ignored" });
      return false;
    }

    try {
      if (collision) await peer.pc.setLocalDescription({ type: "rollback" });
      prepareForRemoteOffer(peer.pc, description);
      await peer.pc.setRemoteDescription(description);
    } catch (error) {
      if (peer.localAnswer && peer.pc.signalingState === "stable") {
        onAnswer?.(peer.localAnswer);
        onTrace?.({ event: "answer_created", result: "resent" });
        return true;
      }
      onTrace?.({ event: "offer_received", result: error?.name || "failed" });
      throw error;
    }
    await flushIce(peer);
    if (typeof beforeAnswer === "function") await beforeAnswer(peer);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    peer.localAnswer = plainSessionDescription(peer.pc.localDescription) || plainSessionDescription(answer);
    onTrace?.({ event: "offer_applied" });
    if (typeof onAnswer === "function") onAnswer(peer.localAnswer);
    onTrace?.({ event: "answer_created" });
    return true;
  }

  if (type === "answer" && sdp) {
    if (peer.pc.signalingState !== "have-local-offer") return false;
    peer.queuedAnswer = null;
    await peer.pc.setRemoteDescription(plainSessionDescription(sdp));
    await flushIce(peer);
    onTrace?.({ event: "answer_applied" });
    return true;
  }

  if (type === "ice" && candidate) {
    const ready = takeIceCandidate(peer.iceQueue, candidate);
    if (!ready.length) {
      onTrace?.({ event: "ice_candidate_received", result: "queued" });
      return true;
    }
    let applied = 0;
    for (const item of ready) {
      if (await addCandidate(peer.pc, item)) applied += 1;
    }
    onTrace?.({
      event: applied ? "ice_candidate_applied" : "ice_candidate_received",
      result: applied ? "applied" : "rejected",
    });
    return applied > 0;
  }
  return false;
};

/** Applies an answer that arrived before setLocalDescription(offer). */
export const applyQueuedAnswer = async (peer, hooks) => {
  const queued = peer?.queuedAnswer;
  if (!queued || peer.pc?.signalingState !== "have-local-offer") return false;
  peer.queuedAnswer = null;
  return applyPeerSignal(peer, queued, hooks);
};
