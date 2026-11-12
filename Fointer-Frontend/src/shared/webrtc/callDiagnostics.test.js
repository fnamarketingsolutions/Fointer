import assert from "node:assert/strict";
import test from "node:test";
import { describeIceConfiguration, safeCallDiagnostic, sanitizeIceCandidateError } from "./callDiagnostics.js";

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

test("call timeline keeps signaling steps and drops SDP, secrets, and addresses", () => {
  const entry = safeCallDiagnostic({
    callId: "call-7",
    requestId: "ice1ab12cd",
    event: "answer_applied",
    signalType: "answer",
    delivery: "applied",
    result: "applied",
    signalSeq: 4,
    iceGatheringState: "complete",
    transportPolicy: "all",
    credentialPresent: "yes",
    usernamePresent: "yes",
    stunCount: 1,
    turnCount: 3,
    sdp: "v=0\r\no=- 1 1 IN IP4 192.168.1.9",
    username: "metered-user",
    credential: "metered-secret",
    token: "session-token",
  });
  const serialized = JSON.stringify(entry);
  assert.equal(entry.event, "answer_applied");
  assert.equal(entry.requestId, "ice1ab12cd");
  assert.equal(entry.signalSeq, 4);
  assert.equal(entry.transportPolicy, "all");
  assert.equal(entry.credentialPresent, "yes");
  assert.equal(entry.usernamePresent, "yes");
  assert.equal(entry.stunCount, 1);
  assert.equal(entry.turnCount, 3);
  assert.equal(entry.iceGatheringState, "complete");
  for (const secret of ["v=0", "192.168.1.9", "metered-user", "metered-secret", "session-token"]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test("ICE configuration description counts servers without copying secrets", () => {
  const described = describeIceConfiguration({
    iceTransportPolicy: "all",
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: [
          "turn:relay.example:3478?transport=udp",
          "turn:relay.example:3478?transport=tcp",
          "turns:relay.example:443?transport=tcp",
        ],
        username: "metered-user",
        credential: "metered-secret",
      },
    ],
  });
  const serialized = JSON.stringify(described);
  assert.deepEqual(described, {
    transportPolicy: "all",
    credentialPresent: "yes",
    usernamePresent: "yes",
    stunCount: 1,
    turnCount: 3,
  });
  assert.equal(serialized.includes("metered-user"), false);
  assert.equal(serialized.includes("metered-secret"), false);
  assert.equal(serialized.includes("relay.example"), false);
});

test("ICE candidate errors keep an address class and omit the address", () => {
  const entry = sanitizeIceCandidateError({
    errorCode: 701,
    errorText: "STUN binding request timed out",
    url: "stun:stun.l.google.com:19302",
    address: "192.168.1.20",
    username: "metered-user",
    credential: "metered-secret",
  });
  const serialized = JSON.stringify(entry);
  assert.equal(entry.errorCode, 701);
  assert.equal(entry.addressClass, "private");
  assert.equal(entry.address, undefined);
  assert.equal(serialized.includes("192.168.1.20"), false);
  assert.equal(serialized.includes("metered-user"), false);
  assert.equal(serialized.includes("metered-secret"), false);
  assert.equal(sanitizeIceCandidateError({ address: "203.0.113.10" }).addressClass, "public");
  assert.equal(sanitizeIceCandidateError({ address: "host.local" }).addressClass, "mdns");
  assert.equal(sanitizeIceCandidateError({ address: "relay.example" }).addressClass, "hostname");
});
