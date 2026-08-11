export const WATCH_GROUP_SOCKET_EVENTS = {
  JOIN_GROUP: "watchGroup:join",
  LEAVE_GROUP: "watchGroup:leave",
  MESSAGE_CREATED: "message:created",
  MESSAGE_UPDATED: "message:updated",
  MESSAGE_DELETED: "message:deleted",
  GROUP_STATUS_UPDATED: "group:statusUpdated",
};

export const toWatchGroupRoom = (groupId) => `watch-group:${groupId}`;

export const LIVE_EVENT_SOCKET_EVENTS = {
  JOIN_EVENT: "liveEvent:join",
  LEAVE_EVENT: "liveEvent:leave",
  MESSAGE_CREATED: "liveEvent:message:created",
  MESSAGE_UPDATED: "liveEvent:message:updated",
  MESSAGE_DELETED: "liveEvent:message:deleted",
  EVENT_STATUS_UPDATED: "liveEvent:statusUpdated",
};

export const toLiveEventRoom = (eventId) => `live-event:${eventId}`;
