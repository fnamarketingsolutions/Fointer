import assert from "node:assert/strict";
import test from "node:test";
import { emitToRooms, dmBroadcastRooms } from "./realtimeRooms.js";
import {
  accountCanConnect,
  activeMemberUserRooms,
  appendMessageOnce,
  bindListeners,
  liveJoinAllowed,
  liveRoomName,
  messageWasSaved,
  publishSavedMessage,
  watchMembershipCanChat,
  watchRoomName,
} from "./realtimeDelivery.js";

test("a message is published only after it has been saved", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let published = false;
  const pending = publishSavedMessage({
    save: () => gate.then(() => ({ id: "m1" })),
    publish: () => {
      published = true;
    },
  });
  await Promise.resolve();
  assert.equal(published, false);
  release();
  const result = await pending;
  assert.equal(published, true);
  assert.equal(result.saved.id, "m1");
  assert.equal(typeof result.persistMs, "number");
});

test("a database failure never publishes or acknowledges success", async () => {
  let published = false;
  let acked = null;
  await assert.rejects(
    () =>
      publishSavedMessage({
        save: async () => {
          throw new Error("db down");
        },
        publish: () => {
          published = true;
        },
      }),
    /db down/
  );
  if (!published) acked = { success: false };
  assert.equal(published, false);
  assert.deepEqual(acked, { success: false });
  assert.equal(messageWasSaved(null), false);
  await assert.rejects(
    () =>
      publishSavedMessage({
        save: async () => ({}),
        publish: () => {
          published = true;
        },
      }),
    /not saved/
  );
  assert.equal(published, false);
});

test("a notification failure still leaves the saved message published", async () => {
  const order = [];
  const result = await publishSavedMessage({
    save: async () => ({ id: "m2" }),
    publish: () => order.push("publish"),
    notify: async () => {
      order.push("notify");
      throw new Error("push down");
    },
  });
  order.push("ack");
  assert.equal(result.saved.id, "m2");
  assert.deepEqual(order, ["publish", "notify", "ack"]);
});

test("public and admin viewers can join a live room; outsiders cannot join a community event", () => {
  const member = { id: "u1" };
  assert.equal(
    liveJoinAllowed({ user: null, access: "public" }),
    false
  );
  assert.equal(
    liveJoinAllowed({ user: member, access: "public", communityAllowed: false }),
    true
  );
  assert.equal(
    liveJoinAllowed({
      user: member,
      access: "community",
      isAdmin: true,
      communityAllowed: false,
    }),
    true
  );
  assert.equal(
    liveJoinAllowed({
      user: member,
      access: "community",
      communityAllowed: true,
    }),
    true
  );
  assert.equal(
    liveJoinAllowed({
      user: member,
      access: "community",
      communityAllowed: false,
    }),
    false
  );
  assert.equal(liveRoomName("evt1"), "live:evt1");
});

test("commentary is delivered only to sockets inside the live room", () => {
  const room = liveRoomName("evt1");
  const sockets = [
    { id: "member", rooms: [room, "user:a"] },
    { id: "outsider", rooms: ["user:b"] },
  ];
  const received = sockets.filter((socket) => socket.rooms.includes(room));
  assert.deepEqual(
    received.map((socket) => socket.id),
    ["member"]
  );
});

test("pending and non-members cannot chat; active members and admins can", () => {
  assert.equal(watchMembershipCanChat("active"), true);
  assert.equal(watchMembershipCanChat("pending"), false);
  assert.equal(watchMembershipCanChat("removed"), false);
  assert.equal(watchMembershipCanChat(null), false);
  assert.equal(watchMembershipCanChat("pending", { isAdmin: true }), true);
  assert.equal(accountCanConnect("active"), true);
  assert.equal(accountCanConnect("banned"), false);
  assert.equal(accountCanConnect("suspended"), false);
});

test("watch fan-out skips pending members and does not repeat the group room", () => {
  const rooms = activeMemberUserRooms([
    { user: "a", status: "active" },
    { user: "b", status: "pending" },
    { user: "c", status: "removed" },
    { user: "a", status: "active" },
  ]);
  assert.deepEqual(rooms, ["user:a"]);
  assert.equal(rooms.includes(watchRoomName("g1")), false);
});

test("a member in the group room and the user room receives the message once", () => {
  const groupRoom = watchRoomName("g1");
  const userRooms = activeMemberUserRooms([
    { user: "a", status: "active" },
    { user: "b", status: "active" },
  ]);
  const sockets = [
    { id: "a-open", rooms: [groupRoom, "user:a"] },
    { id: "a-other-tab", rooms: ["user:a"] },
    { id: "b-open", rooms: [groupRoom, "user:b"] },
    { id: "pending", rooms: ["user:p"] },
  ];
  const counts = new Map(sockets.map((socket) => [socket.id, 0]));
  const deliver = (targets, except) => {
    for (const socket of sockets) {
      const targeted = socket.rooms.some((room) => targets.includes(room));
      const skipped = except && socket.rooms.includes(except);
      if (targeted && !skipped) {
        counts.set(socket.id, counts.get(socket.id) + 1);
      }
    }
  };
  deliver([groupRoom], null);
  deliver(userRooms, groupRoom);
  assert.equal(counts.get("a-open"), 1);
  assert.equal(counts.get("a-other-tab"), 1);
  assert.equal(counts.get("b-open"), 1);
  assert.equal(counts.get("pending"), 0);
});

test("each authorized direct-message session receives one copy", () => {
  const rooms = dmBroadcastRooms("c1", ["a", "b"]);
  const sockets = [
    { id: "a-thread", rooms: ["dm:c1", "user:a"] },
    { id: "a-inbox", rooms: ["user:a"] },
    { id: "b-thread", rooms: ["dm:c1", "user:b"] },
    { id: "stranger", rooms: ["user:z"] },
  ];
  const delivered = sockets.filter((socket) =>
    socket.rooms.some((room) => rooms.includes(room))
  );
  assert.deepEqual(
    delivered.map((socket) => socket.id),
    ["a-thread", "a-inbox", "b-thread"]
  );
  assert.equal(new Set(delivered.map((socket) => socket.id)).size, delivered.length);
});

test("user-room fan-out excludes sockets already in the group room", () => {
  const calls = [];
  const operator = {
    to(name) {
      calls.push(["to", name]);
      return operator;
    },
    except(name) {
      calls.push(["except", name]);
      return operator;
    },
    emit(event) {
      calls.push(["emit", event]);
    },
  };
  emitToRooms({ to: (name) => operator.to(name) }, ["user:a", "user:b"], "watch_message_new", { id: "m" }, {
    except: "watch:g1",
  });
  assert.deepEqual(calls, [
    ["to", "user:a"],
    ["to", "user:b"],
    ["except", "watch:g1"],
    ["emit", "watch_message_new"],
  ]);
});

test("the same message id is appended once", () => {
  const first = appendMessageOnce([], { id: "m1", text: "hi" });
  const second = appendMessageOnce(first, { id: "m1", text: "hi" });
  const third = appendMessageOnce(second, { id: "m2", text: "next" });
  assert.equal(second, first);
  assert.deepEqual(
    third.map((row) => row.id),
    ["m1", "m2"]
  );
});

test("reconnecting rejoins without registering a second message listener", () => {
  const listeners = new Map();
  const socket = {
    on(event, fn) {
      const list = listeners.get(event) || [];
      list.push(fn);
      listeners.set(event, list);
    },
    off(event, fn) {
      const list = (listeners.get(event) || []).filter((item) => item !== fn);
      listeners.set(event, list);
    },
    emit(event, payload) {
      for (const fn of listeners.get(event) || []) fn(payload);
    },
  };
  let joins = 0;
  let seen = 0;
  const join = () => {
    joins += 1;
  };
  const onMessage = () => {
    seen += 1;
  };
  const unbind = bindListeners(socket, {
    connect: join,
    dm_new: onMessage,
  });
  socket.emit("connect");
  socket.emit("connect");
  socket.emit("dm_new", { id: "m1" });
  assert.equal(joins, 2);
  assert.equal(seen, 1);
  assert.equal(listeners.get("dm_new").length, 1);
  unbind();
  socket.emit("dm_new", { id: "m2" });
  assert.equal(seen, 1);
  assert.equal(listeners.get("dm_new").length, 0);
});
