import assert from "node:assert/strict";
import test from "node:test";
import { assessMediaHealth } from "./callStats.js";
import { recoveryNeededAfterNetworkChange } from "./networkRecovery.js";
import { planMeshOffers } from "./meshPlan.js";

const summary = (overrides = {}) => ({
  connectionState: "connected",
  iceConnectionState: "connected",
  audio: { bytesReceived: 10, bytesSent: 10, packetsLost: 0, receiving: true, sending: true },
  video: { bytesReceived: 10, bytesSent: 10, packetsLost: 0, framesReceived: 4, framesDropped: 0 },
  ...overrides,
});

test("a network change does not restart a healthy connection", () => {
  assert.equal(recoveryNeededAfterNetworkChange({
    connectionState: "connected",
    iceConnectionState: "connected",
  }), false);
  assert.equal(recoveryNeededAfterNetworkChange({
    connectionState: "disconnected",
    iceConnectionState: "disconnected",
  }), true);
});

test("one-way audio requests recovery and poor video does not", () => {
  const previous = summary();
  const stalled = summary({
    audio: { bytesReceived: 10, bytesSent: 20, packetsLost: 0, receiving: true, sending: true },
  });
  const poorVideo = summary({
    audio: { bytesReceived: 20, bytesSent: 20, packetsLost: 0, receiving: true, sending: true },
    video: { bytesReceived: 10, bytesSent: 10, packetsLost: 30, framesReceived: 4, framesDropped: 8 },
  });
  assert.equal(assessMediaHealth(previous, stalled).restart, true);
  assert.equal(assessMediaHealth(previous, stalled).direction, "send-only");
  assert.equal(assessMediaHealth(previous, poorVideo).restart, false);
  assert.equal(assessMediaHealth(previous, poorVideo).status, "poor-video");
  assert.equal(assessMediaHealth(null, summary()).restart, false);
});

test("a rejoining event participant replaces one peer and leaves the others", () => {
  const roster = [
    { socketId: "a1", userId: "a" },
    { socketId: "b", userId: "b" },
    { socketId: "c", userId: "c" },
  ];
  const replaced = roster
    .filter((peer) => peer.userId !== "a")
    .concat({ socketId: "a2", userId: "a" });
  const offers = planMeshOffers("z", replaced, new Set(["b"]));
  assert.deepEqual(offers.map((peer) => peer.socketId).sort(), ["a2", "c"]);
  assert.equal(offers.some((peer) => peer.socketId === "b"), false);
  assert.equal(offers.some((peer) => peer.socketId === "old-a"), false);
});
