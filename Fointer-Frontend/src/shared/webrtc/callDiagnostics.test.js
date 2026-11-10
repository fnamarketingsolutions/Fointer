import assert from "node:assert/strict";
import test from "node:test";
import { safeCallDiagnostic, sanitizeIceCandidateError } from "./callDiagnostics.js";

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

test("ICE error text redacts embedded addresses and keeps the failure reason", () => {
  const entry = sanitizeIceCandidateError({
    errorCode: 701,
    errorText: "relay failed for 203.0.113.10, 192.168.0.12, 2001:db8::8, fe80::1, and ::1",
    url: "turn:203.0.113.10:3478?transport=udp",
    username: "turn-user",
    credential: "turn-pass",
    candidate: "candidate:1 1 udp 198.51.100.20 3478 typ srflx",
  });
  const serialized = JSON.stringify(entry);
  assert.equal(entry.errorCode, 701);
  assert.equal(entry.errorText.includes("relay failed"), true);
  for (const secret of ["203.0.113.10", "192.168.0.12", "2001:db8::8", "fe80::1", "::1", "198.51.100.20", "turn-user", "turn-pass", "candidate:"]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  assert.equal(entry.url, undefined);
  assert.equal(entry.username, undefined);
  assert.equal(entry.credential, undefined);
});
