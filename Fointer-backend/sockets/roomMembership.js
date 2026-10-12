/**
 * One room subscription per socket.
 * A newer join token wins: an older leave cannot unsubscribe that join,
 * even when the leave's socket.leave resolves after the new join.
 */
export function createRoomMembership() {
  let token = null;
  let roomId = null;

  const same = (nextToken) => nextToken == null || nextToken === token;

  return {
    roomId: () => roomId,
    note(nextToken) {
      if (nextToken != null) token = nextToken;
    },
    isCurrent(nextToken) {
      return same(nextToken);
    },
    force(id) {
      roomId = id == null ? null : String(id);
    },
    async claim(socket, toRoom, nextToken, id) {
      const nextId = String(id);
      if (!same(nextToken)) return false;
      if (roomId && roomId !== nextId) {
        await socket.leave(toRoom(roomId));
        if (!same(nextToken)) {
          if (roomId) await socket.join(toRoom(roomId));
          return false;
        }
      }
      await socket.join(toRoom(nextId));
      if (!same(nextToken)) {
        await socket.leave(toRoom(nextId));
        if (roomId && roomId !== nextId) await socket.join(toRoom(roomId));
        return false;
      }
      roomId = nextId;
      return true;
    },
    async drop(socket, toRoom, nextToken) {
      if (!same(nextToken)) return null;
      const current = roomId;
      if (!current) return "";
      await socket.leave(toRoom(current));
      if (!same(nextToken)) {
        if (roomId) await socket.join(toRoom(roomId));
        return null;
      }
      if (roomId === current) roomId = null;
      return current;
    },
  };
}
