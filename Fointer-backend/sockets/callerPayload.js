/** Shared shape for live / DM WebRTC peer payloads. */
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
