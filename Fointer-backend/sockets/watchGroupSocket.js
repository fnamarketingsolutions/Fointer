import WatchGroupMessage from "../models/watchGroupMessage.js";
import {
  findWatchGroupByParam,
  formatWatchMessage,
  userCanAccessWatchGroup,
  userCanModerateWatchGroup,
  userIsMember,
} from "../controllers/watchGroup.controller.js";
import { authenticateSocket } from "./socketAuth.js";

const roomName = (groupId) => `watch:${groupId}`;

const emitParticipantPresence = (io, groupId) => {
  const room = io.sockets.adapter.rooms.get(roomName(groupId));
  const onlineCount = room ? room.size : 0;
  io.to(roomName(groupId)).emit("watch_online_count", {
    groupId: String(groupId),
    count: onlineCount,
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
    let joinedGroupId = null;

    socket.on("join_watch_group", async (payload = {}, ack) => {
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
        if (!isMember && socket.user.role !== "admin") {
          throw new Error("Join the watch group before entering chat.");
        }

        const groupId = String(group._id);
        if (joinedGroupId && joinedGroupId !== groupId) {
          socket.leave(roomName(joinedGroupId));
          emitParticipantPresence(io, joinedGroupId);
        }

        await socket.join(roomName(groupId));
        joinedGroupId = groupId;

        const canModerate = await userCanModerateWatchGroup(group, socket.user);
        emitParticipantPresence(io, groupId);

        if (typeof ack === "function") {
          ack({
            success: true,
            groupId,
            canModerate,
          });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: error.message });
        }
      }
    });

    socket.on("leave_watch_group", async (payload = {}) => {
      const groupId = payload.groupId || joinedGroupId;
      if (!groupId) return;
      await socket.leave(roomName(groupId));
      if (joinedGroupId === String(groupId)) joinedGroupId = null;
      emitParticipantPresence(io, groupId);
    });

    socket.on("send_watch_message", async (payload = {}, ack) => {
      try {
        const groupIdParam = payload.groupId || joinedGroupId;
        const text = String(payload.text || "").trim();

        if (!groupIdParam) throw new Error("groupId is required.");
        if (!text) throw new Error("Message cannot be empty.");
        if (text.length > 1000) {
          throw new Error("Message is too long (max 1000 characters).");
        }

        const group = await findWatchGroupByParam(groupIdParam);
        if (!group) throw new Error("Watch group not found.");

        const isMember = await userIsMember(group, socket.user);
        if (!isMember && socket.user.role !== "admin") {
          throw new Error("Join the watch group to chat.");
        }

        const message = await WatchGroupMessage.create({
          group: group._id,
          author: socket.user._id,
          text,
        });

        await message.populate("author", "username name avatar");
        const canModerate = await userCanModerateWatchGroup(group, socket.user);
        const formatted = formatWatchMessage(message, {
          canDelete: canModerate,
        });

        io.to(roomName(group._id)).emit("watch_message_new", {
          groupId: String(group._id),
          message: { ...formatted, canDelete: undefined },
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
      if (joinedGroupId) {
        emitParticipantPresence(io, joinedGroupId);
      }
    });
  });
};
