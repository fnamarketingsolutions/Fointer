import {
  findConversationByParam,
  sendDirectMessage,
  userInConversation,
} from "../controllers/conversation.controller.js";
import { isMessagingBlocked } from "../controllers/block.controller.js";
import { authenticateSocket } from "./socketAuth.js";
import { createRoomMembership } from "./roomMembership.js";
import { logRealtime } from "../utils/realtimeLog.js";
import { canRelayCallSignal } from "../utils/callRelay.js";
import { allowChatMessage, chatRateLimited } from "../utils/socketRateLimit.js";
import { assertNoBannedKeywords } from "../utils/bannedKeywords.js";
import { acceptSignedMediaList } from "../utils/s3.js";
import { notify, personName, userNotificationRoom } from "../utils/notify.js";
import {
  MAX_DM_CALLERS,
  callerPayload,
  clearDmCall,
  createDmCallId,
  dmCallRoster,
  dmRoomName,
  ensureDmCall,
  findDmCallBySocket,
  findDmCallForSignal,
  getDmCall,
  removeDmCaller,
  startDmCallSweep,
  sweepExpiredDmCalls,
  isRetiredDmCall,
} from "./dmCallState.js";
import { applyParticipantMedia, callerCanCancel, signalMatchesCall } from "../utils/dmCallLifecycle.js";
import { dmBroadcastRooms, emitToRooms } from "../utils/realtimeRooms.js";

const roomName = dmRoomName;
const DM_MEDIA_MAX = 4;

const getOtherParticipantId = (conversation, userId) => {
  const uid = String(userId);
  const other = (conversation.participants || []).find(
    (row) => String(row.user?._id || row.user) !== uid
  );
  return other?.user?._id || other?.user || null;
};

const buildCaller = (socket, mode) => ({
  socketId: socket.id,
  userId: String(socket.user._id),
  name: socket.user.name || socket.user.username || "Member",
  username: socket.user.username || "",
  avatar: socket.user.avatar || "",
  mode: mode === "video" ? "video" : "audio",
  mic: true,
  camera: mode === "video",
});

const assertCanCall = async (conversation, userId) => {
  if (!userInConversation(conversation, userId)) {
    throw new Error("You do not have access to this conversation.");
  }
  const otherId = getOtherParticipantId(conversation, userId);
  if (!otherId) throw new Error("Conversation participant not found.");
  if (await isMessagingBlocked(userId, otherId)) {
    throw new Error("You cannot call this user.");
  }
  return otherId;
};

export const initDirectMessageSocket = (io) => {
  startDmCallSweep(io);
  io.use(async (socket, next) => {
    try {
      if (!socket.user) {
        socket.user = await authenticateSocket(socket);
      }
      next();
    } catch (error) {
      next(new Error(error.message || "Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const membership = createRoomMembership();

    const joinDmRoom = async (conversationId) => {
      const id = String(conversationId);
      const current = membership.roomId();
      if (current && current !== id) {
        await socket.leave(roomName(current));
      }
      await socket.join(roomName(id));
      membership.force(id);
      return id;
    };

    socket.on("join_conversation", async (payload = {}, ack) => {
      const joinToken = payload.joinToken ?? null;
      membership.note(joinToken);
      try {
        const conversationIdParam = payload.conversationId;
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        if (!userInConversation(conversation, socket.user._id)) {
          throw new Error("You do not have access to this conversation.");
        }

        const joined = await membership.claim(
          socket,
          roomName,
          joinToken,
          conversation._id
        );
        if (!joined) {
          if (typeof ack === "function") ack({ success: true, ignored: true });
          return;
        }
        const conversationId = String(conversation._id);
        const otherId = getOtherParticipantId(conversation, socket.user._id);
        if (!socket.data.dmPeers) socket.data.dmPeers = new Map();
        const peerRecord = {
          id: conversationId,
          otherId: otherId ? String(otherId) : "",
        };
        socket.data.dmPeers.set(conversationId, peerRecord);
        socket.data.dmPeers.set(String(conversationIdParam), peerRecord);
        logRealtime("dm_joined", {
          userId: String(socket.user._id),
          conversationId,
        });

        if (typeof ack === "function") {
          ack({ success: true, conversationId });
        }
      } catch (error) {
        if (membership.isCurrent(joinToken)) {
          await membership.drop(socket, roomName, joinToken);
        }
        logRealtime("dm_join_denied", {
          userId: String(socket.user?._id || ""),
          reason: String(error.message || "join_failed").slice(0, 180),
        });
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("leave_conversation", async (payload = {}) => {
      const dropped = await membership.drop(
        socket,
        roomName,
        payload.joinToken ?? null
      );
      if (!dropped) return;
      if (socket.data.dmPeers) {
        for (const [key, value] of socket.data.dmPeers) {
          if (key === dropped || value?.id === dropped) {
            socket.data.dmPeers.delete(key);
          }
        }
      }
      logRealtime("dm_left", {
        userId: String(socket.user?._id || ""),
        conversationId: dropped,
      });
    });

    socket.on("send_dm", async (payload = {}, ack) => {
      if (!allowChatMessage(`${socket.id}:dm`)) {
        chatRateLimited(ack);
        return;
      }
      const started = Date.now();
      try {
        const conversationIdParam =
          payload.conversationId || membership.roomId();
        const text = String(payload.text || "").trim();
        const mediaList = Array.isArray(payload.media) ? payload.media : [];

        if (!conversationIdParam) throw new Error("conversationId is required.");
        if (!text && !mediaList.length) {
          throw new Error("Message cannot be empty.");
        }
        if (text.length > 2000) {
          throw new Error("Message is too long (max 2000 characters).");
        }
        if (mediaList.length > DM_MEDIA_MAX) {
          throw new Error(
            `You can attach up to ${DM_MEDIA_MAX} photos or videos.`
          );
        }

        let bannedMs = 0;
        if (text) {
          const bannedStarted = Date.now();
          await assertNoBannedKeywords(text);
          bannedMs = Date.now() - bannedStarted;
        }

        let media = [];
        if (mediaList.length) {
          const accepted = acceptSignedMediaList(
            socket.user._id,
            mediaList,
            []
          );
          if (!accepted.ok) {
            throw new Error(accepted.message || "Invalid media upload.");
          }
          media = accepted.items || [];
        }

        const authStarted = Date.now();
        const hinted = socket.data.dmPeers?.get(String(conversationIdParam));
        const blockPromise = hinted?.otherId
          ? isMessagingBlocked(socket.user._id, hinted.otherId)
          : null;
        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        if (!userInConversation(conversation, socket.user._id)) {
          throw new Error("You do not have access to this conversation.");
        }

        const otherId = getOtherParticipantId(conversation, socket.user._id);
        const blocked =
          blockPromise && String(otherId || "") === String(hinted.otherId)
            ? await blockPromise
            : otherId
              ? await isMessagingBlocked(socket.user._id, otherId)
              : false;
        const authMs = Date.now() - authStarted;
        if (blocked) {
          throw new Error("You cannot message this user.");
        }

        const { message, persistMs } = await sendDirectMessage({
          conversation,
          author: socket.user,
          text,
          media,
          replyTo: payload.replyTo || null,
          io,
        });

        logRealtime("dm_send_timing", {
          conversationId: String(conversation._id),
          messageId: String(message?.id || ""),
          bannedMs,
          authMs,
          persistMs,
          totalMs: Date.now() - started,
        });

        if (typeof ack === "function") {
          ack({ success: true, message });
        }
      } catch (error) {
        logRealtime("dm_message_failed", {
          userId: String(socket.user?._id || ""),
          reason: String(error.message || "send_failed").slice(0, 180),
        });
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("dm_call_invite", async (payload = {}, ack) => {
      try {
        const conversationIdParam =
          payload.conversationId || membership.roomId();
        const mode = payload.mode === "video" ? "video" : "audio";
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        const otherId = await assertCanCall(conversation, socket.user._id);
        const conversationId = await joinDmRoom(conversation._id);

        const existing = getDmCall(conversationId);
        if (existing) {
          throw new Error("A call is already in progress.");
        }

        const caller = buildCaller(socket, mode);
        const call = ensureDmCall(conversationId, {
          status: "ringing",
          mode,
          peers: new Map([[socket.id, caller]]),
          invitedBy: String(socket.user._id),
          invitedAt: new Date(),
          acceptedAt: null,
          callId: createDmCallId(),
          calleeId: String(otherId),
        });

        const invite = {
          conversationId,
          callId: call.callId,
          mode: call.mode,
          from: callerPayload(caller),
        };

        // User room only — avoids duplicate if callee is already in the DM room.
        io.to(userNotificationRoom(otherId)).emit("dm_call_incoming", invite);

        // Phone-style push (FCM) when app is backgrounded / locked (web notification).
        notify({
          io,
          recipientId: otherId,
          actor: socket.user,
          type: "direct_call",
          title:
            call.mode === "video"
              ? "Incoming video call"
              : "Incoming audio call",
          body: `${personName(socket.user)} is calling you`,
          entity: {
            kind: "conversation",
            _id: conversation._id,
            id: conversation._id,
          },
          collapse: true,
        }).catch(() => {});

        if (typeof ack === "function") {
          ack({ success: true, conversationId, callId: call.callId, mode: call.mode, self: callerPayload(caller) });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("dm_call_accept", async (payload = {}, ack) => {
      try {
        const conversationIdParam =
          payload.conversationId || membership.roomId();
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        await assertCanCall(conversation, socket.user._id);
        const conversationId = await joinDmRoom(conversation._id);

        sweepExpiredDmCalls(io);
        const call = getDmCall(conversationId);
        if (!call || call.status !== "ringing" || !signalMatchesCall(call, payload.callId)) {
          throw new Error("No incoming call to accept.");
        }
        if (call.peers.has(socket.id)) {
          throw new Error("You are already in this call.");
        }
        if (call.peers.size >= MAX_DM_CALLERS) {
          throw new Error("This call is full.");
        }

        const callee = buildCaller(socket, call.mode);
        const existingPeers = dmCallRoster(conversationId);
        call.peers.set(socket.id, callee);
        call.status = "active";
        call.acceptedAt = new Date();

        const accepted = {
          conversationId,
          callId: call.callId,
          mode: call.mode,
          peer: callerPayload(callee),
          peers: existingPeers,
        };

        for (const peer of existingPeers) {
          if (!peer.socketId || peer.socketId === socket.id) continue;
          io.to(peer.socketId).emit("dm_call_accepted", accepted);
        }

        if (typeof ack === "function") {
          ack({
            success: true,
            conversationId,
            mode: call.mode,
            callId: call.callId,
            peers: existingPeers,
            self: callerPayload(callee),
          });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("dm_call_reject", async (payload = {}, ack) => {
      try {
        const conversationIdParam =
          payload.conversationId || membership.roomId();
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");
        if (!userInConversation(conversation, socket.user._id)) {
          throw new Error("You do not have access to this conversation.");
        }

        sweepExpiredDmCalls(io);
        const conversationId = String(conversation._id);
        const call = getDmCall(conversationId);
        if (!call || call.status !== "ringing" || !signalMatchesCall(call, payload.callId)) {
          if (typeof ack === "function") ack({ success: true });
          return;
        }

        clearDmCall(io, conversationId, "rejected", [
          getOtherParticipantId(conversation, socket.user._id),
        ]);

        if (typeof ack === "function") ack({ success: true });
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("dm_call_cancel", async (payload = {}, ack) => {
      try {
        const conversationIdParam =
          payload.conversationId || membership.roomId();
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        sweepExpiredDmCalls(io);
        const conversationId = String(conversation._id);
        const call = getDmCall(conversationId);
        if (!callerCanCancel(call, { socketId: socket.id, userId: socket.user._id })) {
          if (typeof ack === "function") ack({ success: true });
          return;
        }

        const otherId = getOtherParticipantId(conversation, socket.user._id);
        clearDmCall(io, conversationId, "cancelled", [otherId]);

        if (typeof ack === "function") ack({ success: true });
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("dm_call_leave", async (payload = {}) => {
      const conversationIdParam =
        payload.conversationId || membership.roomId();
      if (!conversationIdParam) {
        const found = findDmCallBySocket(socket.id);
        if (found) removeDmCaller(io, found.conversationId, socket.id);
        return;
      }
      try {
        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) return;
        removeDmCaller(io, conversation._id, socket.id);
      } catch {
        /* ignore */
      }
    });

    socket.on("dm_call_signal", (payload = {}) => {
      const to = payload.to;
      if (!to) return;
      if (isRetiredDmCall(payload.callId)) return;
      const found = findDmCallForSignal(socket.id, to);
      if (!found || !canRelayCallSignal(found.call.peers, socket.id, to)) return;
      if (!signalMatchesCall(found.call, payload.callId)) return;

      io.to(to).emit("dm_call_signal", {
        conversationId: found.conversationId,
        callId: found.call.callId,
        from: socket.id,
        type: payload.type,
        sdp: payload.sdp,
        candidate: payload.candidate,
      });
    });

    socket.on("dm_call_presence", async (payload = {}) => {
      const conversationIdParam =
        payload.conversationId || membership.roomId();
      if (!conversationIdParam) return;

      try {
        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) return;
        const conversationId = String(conversation._id);
        const call = getDmCall(conversationId);
        if (isRetiredDmCall(payload.callId) || !signalMatchesCall(call, payload.callId)) return;
        const caller = applyParticipantMedia(call, socket.id, payload);
        if (!caller) return;

        const participantIds = [
          ...[...call.peers.values()].map((peer) => peer.userId),
          call.calleeId,
          call.invitedBy,
        ];
        emitToRooms(io, dmBroadcastRooms(conversationId, participantIds), "dm_call_presence", {
          conversationId,
          callId: call.callId,
          callMode: call.mode,
          socketId: socket.id,
          userId: caller.userId,
          mic: caller.mic,
          camera: caller.camera,
          mode: caller.mode,
          peer: callerPayload(caller),
          peers: dmCallRoster(conversationId),
        });
      } catch {
        /* ignore */
      }
    });

    socket.on("dm_call_sync", async (payload = {}, ack) => {
      try {
        const conversationIdParam =
          payload.conversationId || membership.roomId();
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");
        if (!userInConversation(conversation, socket.user._id)) {
          throw new Error("You do not have access to this conversation.");
        }

        sweepExpiredDmCalls(io);
        const conversationId = String(conversation._id);
        const call = getDmCall(conversationId);
        if (!call) {
          if (typeof ack === "function") {
            ack({ success: true, call: null });
          }
          return;
        }

        const selfInCall = call.peers.has(socket.id);
        const peers = dmCallRoster(conversationId);
        const from = peers.find(
          (peer) => peer.userId !== String(socket.user._id)
        );

        if (typeof ack === "function") {
          ack({
            success: true,
            call: {
              conversationId,
              callId: call.callId,
              status: call.status,
              mode: call.mode,
              selfInCall,
              peers,
              from: from || peers[0] || null,
            },
          });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("disconnect", () => {
      const found = findDmCallBySocket(socket.id);
      if (found) {
        removeDmCaller(io, found.conversationId, socket.id);
      }
      if (membership.roomId()) {
        socket.leave(roomName(membership.roomId()));
      }
    });
  });
};
