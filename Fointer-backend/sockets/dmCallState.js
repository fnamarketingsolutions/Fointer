import { randomUUID } from "node:crypto";
import { callerPayload } from "./callerPayload.js";
import { isRingingExpired } from "../utils/dmCallLifecycle.js";

const roomName = (conversationId) => `dm:${conversationId}`;

/** conversationId -> { status, mode, peers: Map, invitedBy, invitedAt, acceptedAt } */
const dmCalls = new Map();
const retiredCallIds = new Map();
const RETIRED_MS = 2 * 60 * 1000;

export const createDmCallId = () => randomUUID();

export const isRetiredDmCall = (callId) => {
  if (!callId) return false;
  const until = retiredCallIds.get(String(callId));
  if (!until) return false;
  if (Date.now() > until) {
    retiredCallIds.delete(String(callId));
    return false;
  }
  return true;
};

const rememberRetiredCall = (callId) => {
  if (!callId) return;
  retiredCallIds.set(String(callId), Date.now() + RETIRED_MS);
};

export const MAX_DM_CALLERS = 2;

export { callerPayload };

export const getDmCall = (conversationId) => dmCalls.get(String(conversationId));

export const ensureDmCall = (conversationId, seed = {}) => {
  const id = String(conversationId);
  let call = dmCalls.get(id);
  if (!call) {
    call = {
      status: "ringing",
      mode: seed.mode === "video" ? "video" : "audio",
      peers: new Map(),
      invitedBy: seed.invitedBy || null,
      invitedAt: seed.invitedAt || new Date(),
      acceptedAt: null,
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

const mapCallStatus = (reason, call) => {
  if (reason === "rejected") return "rejected";
  if (reason === "cancelled") return "cancelled";
  if (reason === "missed") return "missed";
  if (call?.status === "ringing") return "missed";
  return "completed";
};

export const clearDmCall = (
  io,
  conversationId,
  reason = "ended",
  notifyUserIds = []
) => {
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

  const endedAt = new Date();
  const status = mapCallStatus(reason, call);
  const durationSec =
    call.acceptedAt && status === "completed"
      ? Math.max(
          0,
          Math.floor(
            (endedAt.getTime() - new Date(call.acceptedAt).getTime()) / 1000
          )
        )
      : 0;
  const authorId =
    call.invitedBy || [...(call.peers?.values() || [])][0]?.userId;
  if (call.calleeId) userIds.add(String(call.calleeId));
  rememberRetiredCall(call.callId);

  dmCalls.delete(id);

  const payload = {
    conversationId: id,
    reason,
    callId: call.callId || "",
  };
  io?.to(roomName(id)).emit("dm_call_ended", payload);
  for (const uid of userIds) {
    io?.to(`user:${uid}`).emit("dm_call_ended", payload);
  }

  if (authorId) {
    import("../controllers/conversation.controller.js")
      .then(({ recordCallHistoryMessage }) =>
        recordCallHistoryMessage({
          conversationId: id,
          authorId,
          mode: call.mode,
          status,
          durationSec,
          startedAt: call.acceptedAt || call.invitedAt || null,
          endedAt,
          io,
        })
      )
      .catch(() => {});
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
    clearDmCall(io, id, call.status === "ringing" ? "missed" : "ended");
  } else {
    clearDmCall(io, id, "ended");
  }
  return true;
};

export const sweepExpiredDmCalls = (io, now = Date.now()) => {
  const expired = [];
  for (const [conversationId, call] of dmCalls.entries()) {
    if (isRingingExpired(call, now)) expired.push(conversationId);
  }
  for (const conversationId of expired) {
    clearDmCall(io, conversationId, "missed");
  }
  return expired.length;
};

let sweepTimer = null;

export const startDmCallSweep = (io) => {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => sweepExpiredDmCalls(io), 5000);
  sweepTimer.unref?.();
};

export const findDmCallBySocket = (socketId) => {
  for (const [conversationId, call] of dmCalls.entries()) {
    if (call.peers?.has(socketId)) {
      return { conversationId, call };
    }
  }
  return null;
};

/** Prefer the call that already contains both sockets. */
export const findDmCallForSignal = (fromSocketId, toSocketId) => {
  let fallback = null;
  for (const [conversationId, call] of dmCalls.entries()) {
    if (!call.peers?.has(fromSocketId)) continue;
    if (call.peers.has(toSocketId)) return { conversationId, call };
    if (!fallback) fallback = { conversationId, call };
  }
  return fallback;
};

export { roomName as dmRoomName };
