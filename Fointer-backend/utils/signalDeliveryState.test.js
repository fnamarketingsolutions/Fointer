import assert from "node:assert/strict";
import test from "node:test";
import { nextSignalAttempt, serverSignalObservation } from "./signalDeliveryState.js";

test("server emission is not remote application", () => {
  assert.deepEqual(serverSignalObservation("emitted"), {
    delivery: "emitted",
    remoteApplied: false,
  });
  assert.deepEqual(serverSignalObservation("delivered"), {
    delivery: "delivered",
    remoteApplied: false,
  });
  assert.deepEqual(serverSignalObservation("applied"), {
    delivery: "applied",
    remoteApplied: true,
  });
  assert.deepEqual(serverSignalObservation("rejected"), {
    delivery: "rejected",
    remoteApplied: false,
  });
  assert.deepEqual(serverSignalObservation("timeout"), {
    delivery: "timed-out",
    remoteApplied: false,
  });
});

test("a successful ack stops retries without claiming the peer applied the signal", () => {
  const result = nextSignalAttempt({ attempt: 1, ack: { success: true } });
  assert.equal(result.action, "stop");
  assert.equal(result.delivery, "emitted");
  assert.equal(result.remoteApplied, false);
});

test("a rejected ack is terminal and a timeout retries until the cap", () => {
  const rejected = nextSignalAttempt({
    attempt: 1,
    ack: { success: false, message: "Call is not ready." },
  });
  assert.equal(rejected.action, "stop");
  assert.equal(rejected.delivery, "rejected");

  const retry = nextSignalAttempt({ attempt: 1, maxAttempts: 3, timedOut: true });
  assert.equal(retry.action, "retry");
  assert.equal(retry.delivery, "timed-out");

  const exhausted = nextSignalAttempt({ attempt: 3, maxAttempts: 3, timedOut: true });
  assert.equal(exhausted.action, "stop");
  assert.equal(exhausted.delivery, "timed-out");
  assert.equal(exhausted.remoteApplied, false);
});
