import LiveMessage from "../models/liveMessage.js";
import {
  findLiveEventByParam,
  formatLiveMessage,
  userCanAccessLiveEvent,
  userCanModerateLiveEvent,
} from "../controllers/liveEvent.controller.js";
import { authenticateSocket } from "./socketAuth.js";
import { assertNoBannedKeywords } from "../utils/bannedKeywords.js";

const roomName = (eventId) => `live:${eventId}`;

const emitViewerCount = (io, eventId) => {
  const room = io.sockets.adapter.rooms.get(roomName(eventId));
  const count = room ? room.size : 0;
  io.to(roomName(eventId)).emit("viewer_count", {
    eventId: String(eventId),
    count,
  });
};

export const initLiveSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      socket.user = await authenticateSocket(socket);
      next();
    } catch (error) {
      next(new Error(error.message || "Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    let joinedEventId = null;

    socket.on("join_event", async (payload = {}, ack) => {
      try {
        const eventIdParam = payload.eventId;
        if (!eventIdParam) {
          throw new Error("eventId is required.");
        }

        const event = await findLiveEventByParam(eventIdParam);
        if (!event) {
          throw new Error("Live event not found.");
        }
        if (!(await userCanAccessLiveEvent(event, socket.user))) {
          throw new Error("You do not have access to this live event.");
        }

        const eventId = String(event._id);
        if (joinedEventId && joinedEventId !== eventId) {
          socket.leave(roomName(joinedEventId));
          emitViewerCount(io, joinedEventId);
        }

        await socket.join(roomName(eventId));
        joinedEventId = eventId;

        const canModerate = await userCanModerateLiveEvent(event, socket.user);
        emitViewerCount(io, eventId);

        if (typeof ack === "function") {
          ack({
            success: true,
            eventId,
            status: event.status,
            canModerate,
          });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("leave_event", async (payload = {}) => {
      const eventId = payload.eventId || joinedEventId;
      if (!eventId) return;
      await socket.leave(roomName(eventId));
      if (joinedEventId === String(eventId)) joinedEventId = null;
      emitViewerCount(io, eventId);
    });

    socket.on("send_message", async (payload = {}, ack) => {
      try {
        const eventIdParam = payload.eventId || joinedEventId;
        const text = String(payload.text || "").trim();

        if (!eventIdParam) throw new Error("eventId is required.");
        if (!text) throw new Error("Message cannot be empty.");
        if (text.length > 1000) {
          throw new Error("Message is too long (max 1000 characters).");
        }

        await assertNoBannedKeywords(text);

        const event = await findLiveEventByParam(eventIdParam);
        if (!event) throw new Error("Live event not found.");
        if (event.status !== "live") {
          throw new Error("This live event has ended.");
        }
        if (!(await userCanAccessLiveEvent(event, socket.user))) {
          throw new Error("You do not have access to this live event.");
        }

        const message = await LiveMessage.create({
          event: event._id,
          author: socket.user._id,
          text,
        });

        await message.populate("author", "username name avatar");
        const canModerate = await userCanModerateLiveEvent(event, socket.user);
        const formatted = formatLiveMessage(message, {
          canDelete: canModerate,
        });

        io.to(roomName(event._id)).emit("message_new", {
          eventId: String(event._id),
          message: {
            ...formatted,
            canDelete: undefined,
          },
        });

        if (typeof ack === "function") {
          ack({ success: true, message: formatted });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("disconnect", () => {
      if (joinedEventId) {
        emitViewerCount(io, joinedEventId);
      }
    });
  });
};
