import LiveMessage from "../models/liveMessage.js";
import {
  findLiveEventByParam,
  formatLiveMessage,
  userCanAccessLiveEvent,
  userCanModerateLiveEvent,
} from "../controllers/liveEvent.controller.js";
import { authenticateSocket } from "./socketAuth.js";
import { assertNoBannedKeywords } from "../utils/bannedKeywords.js";
import {
  MAX_CALLERS,
  callerPayload,
  callRoster,
  emitCallRoster,
  getCallMap,
  getCallRoom,
  removeCaller,
} from "./liveCallState.js";

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
            callPeers: callRoster(eventId),
          });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("leave_event", async (payload = {}) => {
      const eventId = joinedEventId || payload.eventId;
      if (!eventId) return;
      removeCaller(io, String(eventId), socket.id);
      await socket.leave(roomName(eventId));
      joinedEventId = null;
      emitViewerCount(io, eventId);
    });

    const canonicalEventId = async (param) => {
      if (joinedEventId) return joinedEventId;
      const raw = param || "";
      if (!raw) return null;
      const event = await findLiveEventByParam(raw);
      return event ? String(event._id) : null;
    };

    socket.on("call_sync", async (payload = {}, ack) => {
      const eventId = await canonicalEventId(payload.eventId);
      if (typeof ack === "function") {
        ack({ success: true, peers: eventId ? callRoster(eventId) : [] });
      }
    });

    socket.on("call_join", async (payload = {}, ack) => {
      try {
        const eventIdParam = payload.eventId || joinedEventId;
        const mode = payload.mode === "video" ? "video" : "audio";
        if (!eventIdParam) throw new Error("eventId is required.");

        const event = await findLiveEventByParam(eventIdParam);
        if (!event) throw new Error("Live event not found.");
        if (event.status !== "live") {
          throw new Error("This live event has ended.");
        }
        if (!(await userCanAccessLiveEvent(event, socket.user))) {
          throw new Error("You do not have access to this live event.");
        }

        const eventId = String(event._id);
        if (!socket.rooms.has(roomName(eventId))) {
          await socket.join(roomName(eventId));
          joinedEventId = eventId;
        }

        const room = getCallRoom(eventId);
        if (!room.has(socket.id) && room.size >= MAX_CALLERS) {
          throw new Error(`This call is full (${MAX_CALLERS} people).`);
        }

        const existing = [...room.values()]
          .filter((peer) => peer.socketId !== socket.id)
          .map(callerPayload);

        const caller = {
          socketId: socket.id,
          userId: String(socket.user._id),
          name: socket.user.name || socket.user.username || "Member",
          username: socket.user.username || "",
          avatar: socket.user.avatar || "",
          mode,
          mic: true,
          camera: mode === "video",
        };
        room.set(socket.id, caller);

        socket.to(roomName(eventId)).emit("call_peer_joined", {
          eventId,
          peer: callerPayload(caller),
        });
        emitCallRoster(io, eventId);

        if (typeof ack === "function") {
          ack({ success: true, peers: existing, self: callerPayload(caller) });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("call_leave", async (payload = {}) => {
      const eventId = await canonicalEventId(payload.eventId);
      if (!eventId) return;
      removeCaller(io, eventId, socket.id);
    });

    socket.on("call_signal", async (payload = {}) => {
      const eventId = await canonicalEventId(payload.eventId);
      const to = payload.to;
      if (!eventId || !to) return;
      const room = getCallMap(eventId);
      if (!room?.has(socket.id) || !room.has(to)) return;

      io.to(to).emit("call_signal", {
        eventId,
        from: socket.id,
        type: payload.type,
        sdp: payload.sdp,
        candidate: payload.candidate,
      });
    });

    socket.on("call_presence", async (payload = {}) => {
      const eventId = await canonicalEventId(payload.eventId);
      const room = getCallMap(eventId);
      const caller = room?.get(socket.id);
      if (!caller) return;
      if (typeof payload.mic === "boolean") caller.mic = payload.mic;
      if (typeof payload.camera === "boolean") caller.camera = payload.camera;
      if (payload.mode === "audio" || payload.mode === "video") {
        caller.mode = payload.mode;
      }
      io.to(roomName(eventId)).emit("call_presence", {
        eventId,
        socketId: socket.id,
        mic: caller.mic,
        camera: caller.camera,
        mode: caller.mode,
      });
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
        removeCaller(io, joinedEventId, socket.id);
        emitViewerCount(io, joinedEventId);
      }
    });
  });
};
