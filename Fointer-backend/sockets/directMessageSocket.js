import {
  findConversationByParam,
  sendDirectMessage,
  userInConversation,
} from "../controllers/conversation.controller.js";
import { isMessagingBlocked } from "../controllers/block.controller.js";
import { authenticateSocket } from "./socketAuth.js";
import { assertNoBannedKeywords } from "../utils/bannedKeywords.js";
import { acceptSignedMediaList } from "../utils/cloudinary.js";
import { notify, personName, userNotificationRoom } from "../utils/notify.js";
import {
  MAX_DM_CALLERS,
  callerPayload,
  clearDmCall,
  dmCallRoster,
  dmRoomName,
  ensureDmCall,
  findDmCallBySocket,
  getDmCall,
  removeDmCaller,
} from "./dmCallState.js";

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
    let joinedConversationId = null;

    const joinDmRoom = async (conversationId) => {
      const id = String(conversationId);
      if (joinedConversationId && joinedConversationId !== id) {
        socket.leave(roomName(joinedConversationId));
      }
      await socket.join(roomName(id));
      joinedConversationId = id;
      return id;
    };

    socket.on("join_conversation", async (payload = {}, ack) => {
      try {
        const conversationIdParam = payload.conversationId;
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        if (!userInConversation(conversation, socket.user._id)) {
          throw new Error("You do not have access to this conversation.");
        }

        const conversationId = await joinDmRoom(conversation._id);

        if (typeof ack === "function") {
          ack({ success: true, conversationId });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("leave_conversation", async (payload = {}) => {
      const conversationId = payload.conversationId || joinedConversationId;
      if (!conversationId) return;
      await socket.leave(roomName(conversationId));
      if (joinedConversationId === String(conversationId)) {
        joinedConversationId = null;
      }
    });

    socket.on("send_dm", async (payload = {}, ack) => {
      try {
        const conversationIdParam =
          payload.conversationId || joinedConversationId;
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

        if (text) await assertNoBannedKeywords(text);

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

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        if (!userInConversation(conversation, socket.user._id)) {
          throw new Error("You do not have access to this conversation.");
        }

        const otherId = getOtherParticipantId(conversation, socket.user._id);
        if (otherId && (await isMessagingBlocked(socket.user._id, otherId))) {
          throw new Error("You cannot message this user.");
        }

        const { message } = await sendDirectMessage({
          conversation,
          author: socket.user,
          text,
          media,
          io,
        });

        if (typeof ack === "function") {
          ack({ success: true, message });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("dm_call_invite", async (payload = {}, ack) => {
      try {
        const conversationIdParam =
          payload.conversationId || joinedConversationId;
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
        });

        const invite = {
          conversationId,
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
          ack({ success: true, conversationId, mode: call.mode, self: callerPayload(caller) });
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
          payload.conversationId || joinedConversationId;
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        await assertCanCall(conversation, socket.user._id);
        const conversationId = await joinDmRoom(conversation._id);

        const call = getDmCall(conversationId);
        if (!call || call.status !== "ringing") {
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

        const accepted = {
          conversationId,
          mode: call.mode,
          peer: callerPayload(callee),
          peers: existingPeers,
        };

        socket.to(roomName(conversationId)).emit("dm_call_accepted", accepted);

        if (typeof ack === "function") {
          ack({
            success: true,
            conversationId,
            mode: call.mode,
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
          payload.conversationId || joinedConversationId;
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");
        if (!userInConversation(conversation, socket.user._id)) {
          throw new Error("You do not have access to this conversation.");
        }

        const conversationId = String(conversation._id);
        const call = getDmCall(conversationId);
        if (!call || call.status !== "ringing") {
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
          payload.conversationId || joinedConversationId;
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        const conversationId = String(conversation._id);
        const call = getDmCall(conversationId);
        if (!call?.peers?.has(socket.id)) {
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
        payload.conversationId || joinedConversationId;
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

    socket.on("dm_call_signal", async (payload = {}) => {
      const conversationIdParam =
        payload.conversationId || joinedConversationId;
      const to = payload.to;
      if (!conversationIdParam || !to) return;

      try {
        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) return;
        const conversationId = String(conversation._id);
        const call = getDmCall(conversationId);
        if (!call?.peers?.has(socket.id) || !call.peers.has(to)) return;

        io.to(to).emit("dm_call_signal", {
          conversationId,
          from: socket.id,
          type: payload.type,
          sdp: payload.sdp,
          candidate: payload.candidate,
        });
      } catch {
        /* ignore */
      }
    });

    socket.on("dm_call_presence", async (payload = {}) => {
      const conversationIdParam =
        payload.conversationId || joinedConversationId;
      if (!conversationIdParam) return;

      try {
        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) return;
        const conversationId = String(conversation._id);
        const call = getDmCall(conversationId);
        const caller = call?.peers?.get(socket.id);
        if (!caller) return;

        if (typeof payload.mic === "boolean") caller.mic = payload.mic;
        if (typeof payload.camera === "boolean") caller.camera = payload.camera;
        if (payload.mode === "audio" || payload.mode === "video") {
          caller.mode = payload.mode;
        }

        io.to(roomName(conversationId)).emit("dm_call_presence", {
          conversationId,
          socketId: socket.id,
          mic: caller.mic,
          camera: caller.camera,
          mode: caller.mode,
        });
      } catch {
        /* ignore */
      }
    });

    socket.on("dm_call_sync", async (payload = {}, ack) => {
      try {
        const conversationIdParam =
          payload.conversationId || joinedConversationId;
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");
        if (!userInConversation(conversation, socket.user._id)) {
          throw new Error("You do not have access to this conversation.");
        }

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
      if (joinedConversationId) {
        socket.leave(roomName(joinedConversationId));
      }
    });
  });
};
