import assert from "node:assert/strict";
import test from "node:test";
import { rebindParticipant, shouldDropDisconnectedPeer } from "./callSession.js";

test("a participant can rejoin the same call on a new socket", () => {
  const peers = new Map([
    ["old", { userId: "user-1", socketId: "old", name: "Asha" }],
    ["other", { userId: "user-2", socketId: "other", name: "Ben" }],
  ]);
  const result = rebindParticipant(peers, { userId: "user-1", nextSocketId: "new" });
  assert.equal(result.ok, true);
  assert.equal(result.replacedSocketId, "old");
  assert.equal(peers.has("old"), false);
  assert.equal(peers.has("new"), true);
  assert.equal(peers.size, 2);
  assert.equal(peers.get("new").name, "Asha");
});

test("a stranger cannot rejoin and an existing socket is not duplicated", () => {
  const peers = new Map([["mine", { userId: "user-1", socketId: "mine" }]]);
  assert.equal(rebindParticipant(peers, { userId: "stranger", nextSocketId: "other" }).reason, "unauthorized");
  const same = rebindParticipant(peers, { userId: "user-1", nextSocketId: "mine" });
  assert.equal(same.ok, true);
  assert.equal(same.replaced, false);
  assert.equal(peers.size, 1);
});

test("an abandoned call is dropped only after the grace period", () => {
  assert.equal(shouldDropDisconnectedPeer({
    disconnectedAt: 1_000,
    now: 5_000,
    graceMs: 20_000,
  }), false);
  assert.equal(shouldDropDisconnectedPeer({
    disconnectedAt: 1_000,
    now: 22_000,
    graceMs: 20_000,
    socketStillConnected: true,
  }), false);
  assert.equal(shouldDropDisconnectedPeer({
    disconnectedAt: 1_000,
    now: 22_000,
    graceMs: 20_000,
  }), true);
});
