import LiveMessage from "../models/liveMessage.js";
import {
  findLiveEventByParam,
  formatLiveMessage,
  userCanAccessLiveEvent,
  userCanModerateLiveEvent,
} from "../controllers/liveEvent.controller.js";
import { authenticateSocket } from "./socketAuth.js";
import { createRoomMembership } from "./roomMembership.js";
import { logRealtime } from "../utils/realtimeLog.js";
import { canRelayCallSignal } from "../utils/callRelay.js";
import { publishSavedMessage } from "../utils/realtimeDelivery.js";
import { applyParticipantMedia } from "../utils/dmCallLifecycle.js";
import { emitToRooms } from "../utils/realtimeRooms.js";
import { userNotificationRoom } from "../utils/notify.js";
import { allowChatMessage, chatRateLimited } from "../utils/socketRateLimit.js";
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
    const membership = createRoomMembership();

    socket.on("join_event", async (payload = {}, ack) => {
      const joinToken = payload.joinToken ?? null;
      membership.note(joinToken);
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
        const previous = membership.roomId();
        const joined = await membership.claim(
          socket,
          roomName,
          joinToken,
          eventId
        );
        if (!joined) {
          if (typeof ack === "function") ack({ success: true, ignored: true });
          return;
        }
        if (previous && previous !== eventId) emitViewerCount(io, previous);

        const canModerate = await userCanModerateLiveEvent(event, socket.user);
        emitViewerCount(io, eventId);
        logRealtime("live_joined", {
          userId: String(socket.user._id),
          eventId,
        });

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
        if (membership.isCurrent(joinToken)) {
          await membership.drop(socket, roomName, joinToken);
        }
        logRealtime("live_join_denied", {
          userId: String(socket.user?._id || ""),
          reason: String(error.message || "join_failed").slice(0, 180),
        });
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("leave_event", async (payload = {}) => {
      const dropped = await membership.drop(
        socket,
        roomName,
        payload.joinToken ?? null
      );
      if (!dropped) return;
      removeCaller(io, dropped, socket.id);
      emitViewerCount(io, dropped);
      logRealtime("live_left", {
        userId: String(socket.user?._id || ""),
        eventId: dropped,
      });
    });

    const canonicalEventId = async (param) => {
      if (membership.roomId()) return membership.roomId();
      const raw = param || "";
      if (!raw) return null;
      const event = await findLiveEventByParam(raw);
      return event ? String(event._id) : null;
    };

    socket.on("call_sync", async (payload = {}, ack) => {
      try {
        const eventIdParam = payload.eventId || membership.roomId();
        if (!eventIdParam) {
          if (typeof ack === "function") {
            ack({ success: true, peers: [] });
          }
          return;
        }

        const event = await findLiveEventByParam(eventIdParam);
        if (!event) {
          if (typeof ack === "function") {
            ack({ success: false, message: "Live event not found.", peers: [] });
          }
          return;
        }

        if (!(await userCanAccessLiveEvent(event, socket.user))) {
          if (typeof ack === "function") {
            ack({
              success: false,
              message: "You do not have access to this live event.",
              peers: [],
            });
          }
          return;
        }

        const eventId = String(event._id);
        if (typeof ack === "function") {
          ack({ success: true, peers: callRoster(eventId) });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({
            success: false,
            message: error?.message || "Failed to sync call.",
            peers: [],
          });
        }
      }
    });

    socket.on("call_join", async (payload = {}, ack) => {
      try {
        const eventIdParam = payload.eventId || membership.roomId();
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
          membership.force(eventId);
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

    socket.on("call_signal", (payload = {}) => {
      const to = payload.to;
      if (!to) return;

      const relay = (eventId) => {
        if (!eventId) return;
        const room = getCallMap(eventId);
        if (!canRelayCallSignal(room, socket.id, to)) return;
        io.to(to).emit("call_signal", {
          eventId,
          from: socket.id,
          type: payload.type,
          sdp: payload.sdp,
          candidate: payload.candidate,
        });
      };

      const known = membership.roomId();
      if (known) {
        relay(known);
        return;
      }

      canonicalEventId(payload.eventId)
        .then((eventId) => relay(eventId))
        .catch(() => {});
    });

    socket.on("call_presence", async (payload = {}) => {
      const eventId = await canonicalEventId(payload.eventId);
      const room = getCallMap(eventId);
      if (!room) return;
      const caller = applyParticipantMedia(
        { status: "active", peers: room },
        socket.id,
        payload
      );
      if (!caller) return;
      const rooms = [roomName(eventId)];
      const seen = new Set();
      for (const peer of room.values()) {
        const userId = String(peer.userId || "");
        if (!userId || seen.has(userId)) continue;
        seen.add(userId);
        rooms.push(userNotificationRoom(userId));
      }
      emitToRooms(io, rooms, "call_presence", {
        eventId,
        socketId: socket.id,
        userId: caller.userId,
        mic: caller.mic,
        camera: caller.camera,
        mode: caller.mode,
        peer: callerPayload(caller),
        peers: callRoster(eventId),
      });
    });

    socket.on("send_message", async (payload = {}, ack) => {
      if (!allowChatMessage(`${socket.id}:live`)) {
        chatRateLimited(ack);
        return;
      }
      try {
        const eventIdParam = payload.eventId || membership.roomId();
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

        const { saved: formatted } = await publishSavedMessage({
          save: async () => {
            const message = await LiveMessage.create({
              event: event._id,
              author: socket.user._id,
              text,
            });
            const [, canModerate] = await Promise.all([
              message.populate("author", "username name avatar"),
              userCanModerateLiveEvent(event, socket.user),
            ]);
            return formatLiveMessage(message, { canDelete: canModerate });
          },
          publish: (next, savedMs) => {
            const eventId = String(event._id);
            io.to(roomName(eventId)).emit("message_new", {
              eventId,
              message: {
                ...next,
                canDelete: undefined,
              },
            });
            logRealtime("live_message_published", {
              userId: String(socket.user._id),
              eventId,
              messageId: String(next.id || next._id),
              persistMs: savedMs,
            });
          },
        });

        if (typeof ack === "function") {
          ack({ success: true, message: formatted });
        }
      } catch (error) {
        logRealtime("live_message_failed", {
          userId: String(socket.user?._id || ""),
          reason: String(error.message || "send_failed").slice(0, 180),
        });
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("disconnect", () => {
      const eventId = membership.roomId();
      if (eventId) {
        removeCaller(io, eventId, socket.id);
        emitViewerCount(io, eventId);
      }
    });
  });
};
