import { callerPayload } from "./callerPayload.js";

const roomName = (eventId) => `live:${eventId}`;

/** eventId -> Map<socketId, caller> */
const eventCalls = new Map();

export const MAX_CALLERS = 6;

export { callerPayload };

export const getCallRoom = (eventId) => {
  if (!eventCalls.has(eventId)) eventCalls.set(eventId, new Map());
  return eventCalls.get(eventId);
};

export const callRoster = (eventId) =>
  [...(eventCalls.get(eventId)?.values() || [])].map(callerPayload);

export const emitCallRoster = (io, eventId) => {
  io.to(roomName(eventId)).emit("call_roster", {
    eventId: String(eventId),
    peers: callRoster(eventId),
  });
};

export const clearEventCall = (io, eventId) => {
  const id = String(eventId);
  if (!eventCalls.has(id)) return;
  eventCalls.delete(id);
  io?.to(roomName(id)).emit("call_ended", { eventId: id });
};

/** Keep one roster row per user when a reconnected socket replaces the old one. */
export const claimCallerSlot = (room, caller) => {
  if (!room || !caller?.socketId || !caller?.userId) return { ok: false, reason: "missing" };
  const uid = String(caller.userId);
  const nextId = String(caller.socketId);
  let replacedSocketId = null;
  for (const [socketId, peer] of room) {
    if (String(peer?.userId || "") === uid && socketId !== nextId) {
      room.delete(socketId);
      replacedSocketId = socketId;
    }
  }
  const already = room.has(nextId);
  room.set(nextId, { ...room.get(nextId), ...caller, socketId: nextId, userId: uid });
  return { ok: true, replacedSocketId, already };
};

export const removeCaller = (io, eventId, socketId) => {
  const room = eventCalls.get(eventId);
  if (!room?.has(socketId)) return false;
  room.delete(socketId);
  if (room.size === 0) eventCalls.delete(eventId);
  io.to(roomName(eventId)).emit("call_peer_left", {
    eventId: String(eventId),
    socketId,
  });
  emitCallRoster(io, eventId);
  return true;
};

export const getCallMap = (eventId) => eventCalls.get(eventId);
