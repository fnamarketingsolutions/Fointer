import assert from "node:assert/strict";
import test from "node:test";
import { canRelayCallSignal } from "./callRelay.js";

test("relays only between the two sockets already in the call", () => {
  const peers = new Map([
    ["caller", { userId: "a" }],
    ["callee", { userId: "b" }],
  ]);
  assert.equal(canRelayCallSignal(peers, "caller", "callee"), true);
  assert.equal(canRelayCallSignal(peers, "callee", "caller"), true);
});

test("drops signals to sockets outside the call and to self", () => {
  const peers = new Map([["caller", { userId: "a" }]]);
  assert.equal(canRelayCallSignal(peers, "caller", "stranger"), false);
  assert.equal(canRelayCallSignal(peers, "stranger", "caller"), false);
  assert.equal(canRelayCallSignal(peers, "caller", "caller"), false);
  assert.equal(canRelayCallSignal(null, "caller", "callee"), false);
});
