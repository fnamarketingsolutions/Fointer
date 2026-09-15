const roomName = (conversationId) => `dm:${conversationId}`;

/** conversationId -> { status, mode, peers: Map } */
const dmCalls = new Map();

export const MAX_DM_CALLERS = 2;

export const callerPayload = (caller) => ({
  socketId: caller.socketId,
  userId: caller.userId,
  name: caller.name,
  username: caller.username,
  avatar: caller.avatar,
  mode: caller.mode,
  mic: caller.mic,
  camera: caller.camera,
});

export const getDmCall = (conversationId) => dmCalls.get(String(conversationId));

export const ensureDmCall = (conversationId, seed = {}) => {
  const id = String(conversationId);
  let call = dmCalls.get(id);
  if (!call) {
    call = {
      status: "ringing",
      mode: seed.mode === "video" ? "video" : "audio",
      peers: new Map(),
      ...seed,
    };
    dmCalls.set(id, call);
  }
  return call;
};

export const dmCallRoster = (conversationId) =>
  [...(dmCalls.get(String(conversationId))?.peers.values() || [])].map(
    callerPayload
  );

export const clearDmCall = (io, conversationId, reason = "ended", notifyUserIds = []) => {
  const id = String(conversationId);
  const call = dmCalls.get(id);
  if (!call) return;

  const userIds = new Set(
    [...(call.peers?.values() || [])]
      .map((peer) => String(peer.userId || ""))
      .filter(Boolean)
  );
  for (const uid of notifyUserIds) {
    if (uid) userIds.add(String(uid));
  }

  dmCalls.delete(id);

  const payload = { conversationId: id, reason };
  io?.to(roomName(id)).emit("dm_call_ended", payload);
  for (const uid of userIds) {
    io?.to(`user:${uid}`).emit("dm_call_ended", payload);
  }
};

export const removeDmCaller = (io, conversationId, socketId) => {
  const id = String(conversationId);
  const call = dmCalls.get(id);
  if (!call?.peers?.has(socketId)) return false;

  call.peers.delete(socketId);
  io.to(roomName(id)).emit("dm_call_peer_left", {
    conversationId: id,
    socketId,
  });

  if (call.peers.size === 0 || call.status === "ringing") {
    clearDmCall(io, id, call.status === "ringing" ? "cancelled" : "ended");
  } else {
    // 1:1 — if one leaves while active, end for everyone
    clearDmCall(io, id, "ended");
  }
  return true;
};

export const findDmCallBySocket = (socketId) => {
  for (const [conversationId, call] of dmCalls.entries()) {
    if (call.peers?.has(socketId)) {
      return { conversationId, call };
    }
  }
  return null;
};

export { roomName as dmRoomName };
