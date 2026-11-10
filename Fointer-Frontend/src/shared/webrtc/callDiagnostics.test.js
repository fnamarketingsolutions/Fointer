import assert from "node:assert/strict";
import test from "node:test";
import { safeCallDiagnostic } from "./callDiagnostics.js";

test("call diagnostics keep state and candidate type without secrets", () => {
  const entry = safeCallDiagnostic({
    callId: "call-1",
    phase: "active",
    signalingState: "have-local-offer",
    connectionState: "connecting",
    iceConnectionState: "checking",
    localCandidateType: "relay",
    remoteCandidateType: "relay",
    relayProtocol: "tls",
    signalType: "offer",
    delivery: "server_ack",
    sdp: "v=0",
    candidate: "candidate:1 1 udp 1.2.3.4",
    username: "turn-user",
    password: "turn-pass",
    apiKey: "secret",
  }, new Date("2026-11-10T00:00:00.000Z"));

  assert.equal(entry.callId, "call-1");
  assert.equal(entry.localCandidateType, "relay");
  assert.equal(entry.relayProtocol, "tls");
  assert.equal(entry.delivery, "server_ack");
  assert.equal(entry.at, "2026-11-10T00:00:00.000Z");
  const serialized = JSON.stringify(entry);
  assert.equal(serialized.includes("1.2.3.4"), false);
  assert.equal(serialized.includes("candidate:"), false);
  assert.equal(serialized.includes("turn-user"), false);
  assert.equal(serialized.includes("turn-pass"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("v=0"), false);
});
