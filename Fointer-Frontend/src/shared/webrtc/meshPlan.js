/** The higher socket id creates the offer so each pair negotiates once. */
export const shouldOfferToPeer = (localId, remoteId) =>
  Boolean(localId && remoteId && String(localId) > String(remoteId));

export const planMeshOffers = (localId, roster = [], connectedIds = new Set()) => {
  const targets = [];
  const seen = new Set();
  for (const peer of roster) {
    const id = peer?.socketId;
    if (!id || seen.has(id) || String(id) === String(localId)) continue;
    seen.add(id);
    if (connectedIds.has(id)) continue;
    if (shouldOfferToPeer(localId, id)) targets.push(peer);
  }
  return targets;
};

/** Full mesh: n people require n*(n-1)/2 peer connections. */
export const expectedMeshConnections = (participantCount) => {
  const count = Math.max(0, Number(participantCount) || 0);
  return (count * (count - 1)) / 2;
};
