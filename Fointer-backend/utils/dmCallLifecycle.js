export const RING_MS = 45_000;

export const isRingingExpired = (call, now = Date.now()) => {
  if (!call || call.status !== "ringing" || !call.invitedAt) return false;
  const started = new Date(call.invitedAt).getTime();
  if (!Number.isFinite(started)) return false;
  return now - started >= RING_MS;
};

/** The inviter can cancel  after a reconnect, when their socket id has changed. */
export const callerCanCancel = (call, { socketId, userId } = {}) => {
  if (!call || call.status !== "ringing") return false;
  if (socketId && call.peers?.has?.(socketId)) return true;
  return Boolean(userId) && String(call.invitedBy || "") === String(userId);
};

export const signalMatchesCall = (call, callId) => {
  if (!call || call.status === "ended") return false;
  if (!callId) return true;
  return String(call.callId || "") === String(callId);
};

/**
 * Stores one participant's camera switch on the server call.
 * The call stays video while any participant still has a camera on.
 * Returns null when the socket is not in this call.
 */
export const applyParticipantMedia = (call, socketId, patch = {}) => {
  if (!call || call.status === "ended" || !socketId) return null;
  const caller = call.peers?.get?.(socketId);
  if (!caller) return null;

  if (typeof patch.mic === "boolean") caller.mic = patch.mic;
  if (patch.mode === "audio" || patch.mode === "video") caller.mode = patch.mode;
  if (caller.mode === "audio") caller.camera = false;
  else if (typeof patch.camera === "boolean") caller.camera = patch.camera;
  else if (caller.mode === "video" && patch.mode === "video") caller.camera = true;

  if (call.status === "active") {
    const stillVideo = [...call.peers.values()].some(
      (peer) => peer.mode === "video" && peer.camera !== false
    );
    call.mode = stillVideo ? "video" : "audio";
  }
  return caller;
};
