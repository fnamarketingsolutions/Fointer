import {
  findConversationByParam,
  sendDirectMessage,
  userInConversation,
} from "../controllers/conversation.controller.js";
import { authenticateSocket } from "./socketAuth.js";
import { assertNoBannedKeywords } from "../utils/bannedKeywords.js";

const roomName = (conversationId) => `dm:${conversationId}`;

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

    socket.on("join_conversation", async (payload = {}, ack) => {
      try {
        const conversationIdParam = payload.conversationId;
        if (!conversationIdParam) throw new Error("conversationId is required.");

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        if (!userInConversation(conversation, socket.user._id)) {
          throw new Error("You do not have access to this conversation.");
        }

        const conversationId = String(conversation._id);
        if (joinedConversationId && joinedConversationId !== conversationId) {
          socket.leave(roomName(joinedConversationId));
        }

        await socket.join(roomName(conversationId));
        joinedConversationId = conversationId;

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
        const conversationIdParam = payload.conversationId || joinedConversationId;
        const text = String(payload.text || "").trim();

        if (!conversationIdParam) throw new Error("conversationId is required.");
        if (!text) throw new Error("Message cannot be empty.");
        if (text.length > 2000) {
          throw new Error("Message is too long (max 2000 characters).");
        }

        await assertNoBannedKeywords(text);

        const conversation = await findConversationByParam(conversationIdParam);
        if (!conversation) throw new Error("Conversation not found.");

        if (!userInConversation(conversation, socket.user._id)) {
          throw new Error("You do not have access to this conversation.");
        }

        const { message } = await sendDirectMessage({
          conversation,
          author: socket.user,
          text,
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

    socket.on("disconnect", () => {
      if (joinedConversationId) {
        socket.leave(roomName(joinedConversationId));
      }
    });
  });
};
