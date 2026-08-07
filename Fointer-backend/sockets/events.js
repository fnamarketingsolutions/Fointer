export const WATCH_GROUP_SOCKET_EVENTS = {
  JOIN_GROUP: "watchGroup:join",
  LEAVE_GROUP: "watchGroup:leave",
  MESSAGE_CREATED: "message:created",
  MESSAGE_UPDATED: "message:updated",
  MESSAGE_DELETED: "message:deleted",
};

export const toWatchGroupRoom = (groupId) => `watch-group:${groupId}`;
