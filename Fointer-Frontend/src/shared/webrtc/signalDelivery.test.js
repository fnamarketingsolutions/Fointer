import assert from "node:assert/strict";
import test from "node:test";
import { applyPeerSignal } from "./applyPeerSignal.js";
import { createIceQueue } from "./iceQueue.js";
import { createSignalCourier, isStaleIce, rememberSignal } from "./signalDelivery.js";

const peer = () => ({
  pc: {
    signalingState: "stable",
    addIceCandidate: async () => {},
    setRemoteDescription: async () => {},
    createAnswer: async () => ({ type: "answer" }),
    setLocalDescription: async () => {},
    localDescription: { type: "answer" },
  },
  iceQueue: createIceQueue(),
  iceGeneration: 1,
  polite: true,
});

test("an acknowledged signal is not retried", async () => {
  const sent = [];
  const courier = createSignalCourier({
    timeoutMs: 20,
    emit: (message, ack) => {
      sent.push(message);
      ack({ success: true });
    },
  });
  courier.send({ type: "offer", to: "peer" });
  await new Promise((resolve) => setTimeout(resolve, 40));
  courier.cancelPending();
  assert.equal(sent.length, 1);
});

test("a missing acknowledgement is retried up to the limit", async () => {
  const sent = [];
  const failures = [];
  const courier = createSignalCourier({
    timeoutMs: 10,
    baseDelayMs: 5,
    maxAttempts: 3,
    random: () => 0,
    onFailure: (failure) => failures.push(failure.reason),
    emit: (message, ack) => {
      sent.push(message.messageId);
      void ack;
    },
  });
  courier.send({ type: "offer" });
  await new Promise((resolve) => setTimeout(resolve, 250));
  courier.cancelPending();
  assert.equal(sent.length, 3);
  assert.deepEqual(failures, ["timeout"]);
});

test("duplicate signals are ignored and stale ICE is not applied", async () => {
  const seen = new Set();
  assert.equal(rememberSignal(seen, "same"), true);
  assert.equal(rememberSignal(seen, "same"), false);
  assert.equal(isStaleIce({ type: "ice", generation: 0, currentGeneration: 1 }), true);
  assert.equal(isStaleIce({ type: "offer", generation: 0, currentGeneration: 1 }), false);

  const target = peer();
  let added = 0;
  target.pc.addIceCandidate = async () => {
    added += 1;
  };
  target.iceQueue.remoteReady = true;
  await applyPeerSignal(target, { type: "ice", messageId: "ice-1", generation: 1, candidate: { candidate: "a" } });
  await applyPeerSignal(target, { type: "ice", messageId: "ice-1", generation: 1, candidate: { candidate: "a" } });
  await applyPeerSignal(target, { type: "ice", messageId: "ice-2", generation: 0, candidate: { candidate: "old" } });
  assert.equal(added, 1);
});

test("an older ICE generation is not replayed after recovery", async () => {
  const sent = [];
  const courier = createSignalCourier({
    timeoutMs: 30,
    baseDelayMs: 5,
    maxAttempts: 3,
    emit: (message, ack) => {
      sent.push(message.generation);
      if (message.generation === 2) ack({ success: true });
    },
  });
  courier.send({ type: "ice", generation: 1 });
  courier.dropOlder(2);
  courier.send({ type: "ice", generation: 2 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  courier.cancelPending();
  assert.deepEqual(sent, [1, 2]);
});
