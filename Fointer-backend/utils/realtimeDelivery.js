import { logRealtime } from "./realtimeLog.js";

/** A saved document is the only thing that may be acknowledged or published. */
export const messageWasSaved = (message) =>
  Boolean(message && (message._id || message.id));

/**
 * save() must resolve with a stored message before publish or notify runs.
 * notify is intentionally not awaited and cannot turn a saved message into a failure.
 */
export const publishSavedMessage = async ({ save, publish, notify }) => {
  const started = Date.now();
  const saved = await save();
  if (!messageWasSaved(saved)) {
    throw new Error("Message was not saved.");
  }
  const persistMs = Date.now() - started;
  publish(saved, persistMs);
  if (typeof notify === "function") {
    Promise.resolve()
      .then(() => notify(saved))
      .catch((error) => {
        logRealtime("notify_failed", {
          reason: String(error?.message || "notify_failed").slice(0, 180),
        });
      });
  }
  return { saved, persistMs };
};

export const liveJoinAllowed = ({
  user,
  access,
  isAdmin = false,
  communityAllowed = false,
}) => {
  if (!user) return false;
  if (isAdmin) return true;
  if (access === "public") return true;
  if (access === "community") return Boolean(communityAllowed);
  return false;
};

/** Pending, removed, and missing memberships cannot chat. Admins can. */
export const watchMembershipCanChat = (status, { isAdmin = false } = {}) => {
  if (isAdmin) return true;
  return status === "active";
};

export const accountCanConnect = (status) =>
  status !== "suspended" && status !== "banned";

export const watchRoomName = (groupId) => `watch:${String(groupId)}`;

export const liveRoomName = (eventId) => `live:${String(eventId)}`;

/** User rooms for active members only. Pending and removed rows are skipped. */
export const activeMemberUserRooms = (rows = []) => {
  const rooms = [];
  const seen = new Set();
  for (const row of rows) {
    const status = row?.status;
    if (status && status !== "active") continue;
    const pid = String(row?.user?._id || row?.user || "");
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    rooms.push(`user:${pid}`);
  }
  return rooms;
};

export const appendMessageOnce = (prev, message) => {
  if (!message || message.id == null) return prev;
  if ((prev || []).some((row) => String(row.id) === String(message.id))) {
    return prev;
  }
  return [...(prev || []), message];
};

/** Registers each handler once. The returned function removes those same functions. */
export const bindListeners = (socket, handlers) => {
  const pairs = Object.entries(handlers || {}).filter(
    ([, fn]) => typeof fn === "function"
  );
  for (const [event, fn] of pairs) socket.on(event, fn);
  return () => {
    for (const [event, fn] of pairs) socket.off(event, fn);
  };
};
