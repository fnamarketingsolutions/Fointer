/** Rooms that should receive a direct-message event exactly once per socket. */
export const dmBroadcastRooms = (conversationId, participantIds = []) => {
  const rooms = [`dm:${String(conversationId)}`];
  const seen = new Set();
  for (const id of participantIds) {
    const pid = String(id || "");
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    rooms.push(`user:${pid}`);
  }
  return rooms;
};

/**
 * Socket.IO delivers a chained to() emit once per socket, even if that
 * socket is in more than one of the rooms.
 */
export const emitToRooms = (io, rooms, event, payload, options = {}) => {
  if (!io || !rooms?.length) return;
  let chain = io.to(rooms[0]);
  for (let i = 1; i < rooms.length; i += 1) {
    chain = chain.to(rooms[i]);
  }
  const except = options.except;
  if (except) {
    const skipped = Array.isArray(except) ? except : [except];
    for (const room of skipped) {
      if (room) chain = chain.except(room);
    }
  }
  chain.emit(event, payload);
};
