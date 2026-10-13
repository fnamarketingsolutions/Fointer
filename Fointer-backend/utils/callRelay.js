/**
 * A signaling packet may be forwarded only to the other socket already in this call.
 * The caller must resolve membership from the in-memory call map, not from a database read.
 */
export const canRelayCallSignal = (peers, fromSocketId, toSocketId) => {
  if (!peers || typeof peers.has !== "function") return false;
  if (!fromSocketId || !toSocketId) return false;
  if (fromSocketId === toSocketId) return false;
  return peers.has(fromSocketId) && peers.has(toSocketId);
};
