import WatchGroupMessage from "../models/watchGroupMessage.js";
import WatchGroupMember from "../models/watchGroupMember.js";
import {
  findWatchGroupByParam,
  formatWatchMessage,
  userCanAccessWatchGroup,
  userCanModerateWatchGroup,
  userIsMember,
} from "../controllers/watchGroup.controller.js";
import { authenticateSocket } from "./socketAuth.js";
import { createRoomMembership } from "./roomMembership.js";
import { assertNoBannedKeywords } from "../utils/bannedKeywords.js";
import { logRealtime } from "../utils/realtimeLog.js";
import { emitToRooms } from "../utils/realtimeRooms.js";
import {
  activeMemberUserRooms,
  publishSavedMessage,
  watchRoomName,
} from "../utils/realtimeDelivery.js";

const roomName = (groupId) => `watch:${groupId}`;

const emitParticipantPresence = (io, groupId) => {
  const room = io.sockets.adapter.rooms.get(roomName(groupId));
  const onlineCount = room ? room.size : 0;
  io.to(roomName(groupId)).emit("watch_online_count", {
    groupId: String(groupId),
    count: onlineCount,
  });
};

const fanoutWatchMessage = (io, groupId, payload, membersPromise) => {
  const groupRoom = watchRoomName(groupId);
  membersPromise
    .then((rows) => {
      const rooms = activeMemberUserRooms(rows);
      if (!rooms.length) return;
      // Sockets already in the group room received the room emit.
      // except() keeps that copy from being delivered a second time.
      emitToRooms(io, rooms, "watch_message_new", payload, {
        except: groupRoom,
      });
    })
    .catch((error) => {
      logRealtime("watch_fanout_failed", {
        groupId: String(groupId),
        reason: String(error?.message || "fanout_failed").slice(0, 180),
      });
    });
};

export const initWatchGroupSocket = (io) => {
  // Explicit auth — do not rely on liveSocket registering io.use first.
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

    socket.on("join_watch_group", async (payload = {}, ack) => {
      const joinToken = payload.joinToken ?? null;
      membership.note(joinToken);
      try {
        const groupIdParam = payload.groupId;
        if (!groupIdParam) throw new Error("groupId is required.");

        const group = await findWatchGroupByParam(groupIdParam);
        if (!group) throw new Error("Watch group not found.");

        if (!(await userCanAccessWatchGroup(group, socket.user))) {
          throw new Error("You do not have access to this watch group.");
        }

        // Must be a member to chat (admins can join without membership)
        const isMember = await userIsMember(group, socket.user);
        if (!isMember) {
          throw new Error("Join the watch group before entering chat.");
        }

        const groupId = String(group._id);
        const previous = membership.roomId();
        const joined = await membership.claim(
          socket,
          roomName,
          joinToken,
          groupId
        );
        if (!joined) {
          if (typeof ack === "function") ack({ success: true, ignored: true });
          return;
        }
        if (previous && previous !== groupId) {
          emitParticipantPresence(io, previous);
        }

        const canModerate = await userCanModerateWatchGroup(group, socket.user);
        emitParticipantPresence(io, groupId);
        logRealtime("watch_joined", {
          userId: String(socket.user._id),
          groupId,
        });

        if (typeof ack === "function") {
          ack({
            success: true,
            groupId,
            canModerate,
          });
        }
      } catch (error) {
        if (membership.isCurrent(joinToken)) {
          await membership.drop(socket, roomName, joinToken);
        }
        logRealtime("watch_join_denied", {
          userId: String(socket.user?._id || ""),
          reason: String(error.message || "join_failed").slice(0, 180),
        });
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("leave_watch_group", async (payload = {}) => {
      const dropped = await membership.drop(
        socket,
        roomName,
        payload.joinToken ?? null
      );
      if (!dropped) return;
      emitParticipantPresence(io, dropped);
      logRealtime("watch_left", {
        userId: String(socket.user?._id || ""),
        groupId: dropped,
      });
    });

    socket.on("send_watch_message", async (payload = {}, ack) => {
      try {
        const groupIdParam = payload.groupId || membership.roomId();
        const text = String(payload.text || "").trim();

        if (!groupIdParam) throw new Error("groupId is required.");
        if (!text) throw new Error("Message cannot be empty.");
        if (text.length > 1000) {
          throw new Error("Message is too long (max 1000 characters).");
        }

        await assertNoBannedKeywords(text);

        const group = await findWatchGroupByParam(groupIdParam);
        if (!group) throw new Error("Watch group not found.");

        const isMember = await userIsMember(group, socket.user);
        if (!isMember) {
          throw new Error("Join the watch group to chat.");
        }

        let membersPromise = Promise.resolve([]);
        const { saved: formatted } = await publishSavedMessage({
          save: async () => {
            const message = await WatchGroupMessage.create({
              group: group._id,
              author: socket.user._id,
              text,
            });
            membersPromise = WatchGroupMember.find({
              group: group._id,
              status: "active",
            })
              .select("user status")
              .lean()
              .catch((error) => {
                logRealtime("watch_fanout_failed", {
                  groupId: String(group._id),
                  reason: String(error?.message || "fanout_failed").slice(0, 180),
                });
                return [];
              });
            const [, canModerate] = await Promise.all([
              message.populate("author", "username name avatar"),
              userCanModerateWatchGroup(group, socket.user),
            ]);
            return formatWatchMessage(message, { canDelete: canModerate });
          },
          publish: (next, savedMs) => {
            const groupId = String(group._id);
            const payloadOut = {
              groupId,
              message: { ...next, canDelete: undefined },
            };
            io.to(roomName(groupId)).emit("watch_message_new", payloadOut);
            fanoutWatchMessage(io, group._id, payloadOut, membersPromise);
            logRealtime("watch_message_published", {
              userId: String(socket.user._id),
              groupId,
              messageId: String(next.id || next._id),
              persistMs: savedMs,
            });
          },
        });

        if (typeof ack === "function") {
          ack({ success: true, message: formatted });
        }
      } catch (error) {
        logRealtime("watch_message_failed", {
          userId: String(socket.user?._id || ""),
          reason: String(error.message || "send_failed").slice(0, 180),
        });
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("disconnect", () => {
      const groupId = membership.roomId();
      if (groupId) {
        emitParticipantPresence(io, groupId);
      }
    });
  });
};
