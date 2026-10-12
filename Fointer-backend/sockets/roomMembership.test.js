import assert from "node:assert/strict";
import test from "node:test";
import { createRoomMembership } from "./roomMembership.js";
import { dmBroadcastRooms, emitToRooms } from "../utils/realtimeRooms.js";

const room = (id) => `live:${id}`;

const fakeSocket = () => {
  const rooms = new Set();
  const socket = {
    rooms,
    leaveGate: null,
    async join(name) {
      rooms.add(name);
    },
    async leave(name) {
      if (socket.leaveGate && name === "live:a") {
        const gate = socket.leaveGate;
        socket.leaveGate = null;
        await gate;
      }
      rooms.delete(name);
    },
  };
  return socket;
};

test("current leave removes only the room owned by that join", async () => {
  const membership = createRoomMembership();
  const socket = fakeSocket();
  membership.note(1);
  assert.equal(await membership.claim(socket, room, 1, "a"), true);
  assert.equal(await membership.drop(socket, room, 1), "a");
  assert.equal(membership.roomId(), null);
  assert.equal(socket.rooms.has("live:a"), false);
});

test("an older leave cannot unsubscribe a newer join", async () => {
  const membership = createRoomMembership();
  const socket = fakeSocket();
  let release;
  socket.leaveGate = new Promise((resolve) => {
    release = resolve;
  });

  membership.note(1);
  await membership.claim(socket, room, 1, "a");

  const dropping = membership.drop(socket, room, 1);
  membership.note(2);
  assert.equal(await membership.claim(socket, room, 2, "b"), true);
  release();
  assert.equal(await dropping, null);
  assert.equal(membership.roomId(), "b");
  assert.equal(socket.rooms.has("live:b"), true);
  assert.equal(socket.rooms.has("live:a"), false);
});

test("a stale token is ignored once a newer join is noted", async () => {
  const membership = createRoomMembership();
  const socket = fakeSocket();
  membership.note(1);
  await membership.claim(socket, room, 1, "a");
  membership.note(2);
  assert.equal(await membership.drop(socket, room, 1), null);
  assert.equal(membership.roomId(), "a");
  assert.equal(socket.rooms.has("live:a"), true);
});

test("direct message delivery includes both participants and not outsiders", () => {
  const rooms = dmBroadcastRooms("conv1", ["user-a", "user-b", "user-a", ""]);
  assert.deepEqual(rooms, ["dm:conv1", "user:user-a", "user:user-b"]);
  assert.equal(rooms.includes("user:stranger"), false);
});

test("a socket in several target rooms is emitted once", () => {
  const calls = [];
  const operator = {
    to(name) {
      calls.push(["to", name]);
      return operator;
    },
    emit(event, payload) {
      calls.push(["emit", event, payload]);
    },
  };
  const io = { to: (name) => operator.to(name) };
  emitToRooms(io, ["dm:1", "user:a", "user:b"], "dm_new", { ok: true });
  assert.deepEqual(calls, [
    ["to", "dm:1"],
    ["to", "user:a"],
    ["to", "user:b"],
    ["emit", "dm_new", { ok: true }],
  ]);
});
