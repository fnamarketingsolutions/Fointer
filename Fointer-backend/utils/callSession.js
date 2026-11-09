export const CALL_REJOIN_GRACE_MS = 20_000;

export const shouldDropDisconnectedPeer = ({
  disconnectedAt,
  now = Date.now(),
  graceMs = CALL_REJOIN_GRACE_MS,
  socketStillConnected = false,
} = {}) => {
  if (socketStillConnected) return false;
  if (!disconnectedAt) return false;
  return now - disconnectedAt >= graceMs;
};

/**
 * Move a participant onto a new socket without adding a second roster entry.
 * A user who is not already in the call is rejected.
 */
export const rebindParticipant = (peers, { userId, nextSocketId, nextPeer } = {}) => {
  if (!peers || typeof peers.has !== "function") return { ok: false, reason: "missing" };
  const uid = String(userId || "");
  const nextId = String(nextSocketId || "");
  if (!uid || !nextId) return { ok: false, reason: "missing" };

  if (peers.has(nextId)) {
    const occupant = peers.get(nextId);
    if (String(occupant?.userId || "") !== uid) return { ok: false, reason: "duplicate" };
    return { ok: true, replaced: false, peer: occupant, replacedSocketId: null };
  }

  let previousId = null;
  for (const [socketId, peer] of peers) {
    if (String(peer?.userId || "") === uid) {
      previousId = socketId;
      break;
    }
  }
  if (!previousId) return { ok: false, reason: "unauthorized" };

  const previous = peers.get(previousId);
  const peer = { ...previous, ...(nextPeer || {}), userId: uid, socketId: nextId };
  peers.delete(previousId);
  peers.set(nextId, peer);
  return {
    ok: true,
    replaced: previousId !== nextId,
    replacedSocketId: previousId === nextId ? null : previousId,
    peer,
  };
};
