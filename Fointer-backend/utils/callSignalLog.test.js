import assert from "node:assert/strict";
import test from "node:test";
import { callSignalLogFields, shouldLogCallSignal } from "./callSignalLog.js";

test("signal logs keep the acknowledgement and omit candidate material", () => {
  const entry = callSignalLogFields({
    callId: "call-1",
    type: "offer",
    delivery: "emitted",
    sdp: "v=0",
    candidate: "candidate:1 1 udp 203.0.113.5 3478 typ host",
    username: "turn-user",
    password: "turn-pass",
  }, new Date("2026-11-10T00:00:00.000Z"));
  const serialized = JSON.stringify(entry);
  assert.equal(entry.type, "offer");
  assert.equal(entry.delivery, "emitted");
  assert.equal(entry.at, "2026-11-10T00:00:00.000Z");
  assert.equal(serialized.includes("203.0.113.5"), false);
  assert.equal(serialized.includes("candidate:"), false);
  assert.equal(serialized.includes("turn-user"), false);
  assert.equal(serialized.includes("turn-pass"), false);
  assert.equal(serialized.includes("v=0"), false);
});

test("an initial ICE notice is logged once per call", () => {
  assert.equal(shouldLogCallSignal("call-a", "offer"), true);
  assert.equal(shouldLogCallSignal("call-a", "ice"), true);
  assert.equal(shouldLogCallSignal("call-a", "ice"), false);
  assert.equal(shouldLogCallSignal("call-b", "ice"), true);
});
