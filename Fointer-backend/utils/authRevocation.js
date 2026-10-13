/** In-process block list. A ban takes effect before the 45s auth cache expires. */
const revokedUserIds = new Set();

export const revokeAuthUser = (userId) => {
  const key = String(userId || "");
  if (!key) return;
  revokedUserIds.add(key);
};

export const restoreAuthUser = (userId) => {
  const key = String(userId || "");
  if (!key) return;
  revokedUserIds.delete(key);
};

export const isAuthUserRevoked = (userId) =>
  revokedUserIds.has(String(userId || ""));

/** Closes sockets that already joined this user's notification room. */
export const disconnectRevokedSockets = (io, userId) => {
  const key = String(userId || "");
  if (!io || !key || typeof io.in !== "function") return;
  const room = io.in(`user:${key}`);
  if (typeof room?.disconnectSockets === "function") room.disconnectSockets(true);
};
