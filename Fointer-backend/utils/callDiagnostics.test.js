import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeCallDiagnostic, safeIceServerUrl } from "./callDiagnostics.js";

test("call diagnostics keep ICE errors and drop secrets, SDP, and addresses", () => {
  const entry = sanitizeCallDiagnostic({
    callId: "call-1",
    phase: "active",
    iceConnectionState: "checking",
    localCandidateType: "relay",
    event: "ice_candidate_error",
    errorCode: 400,
    errorText: "Bad Request",
    url: "turn:global.relay.metered.ca:443?transport=tcp",
    address: "192.168.1.20",
    username: "turn-user",
    credential: "turn-pass",
    sdp: "v=0",
    candidate: "candidate:1 1 udp 203.0.113.8 3478 typ host",
  });
  const serialized = JSON.stringify(entry);
  assert.equal(entry.callId, "call-1");
  assert.equal(entry.errorCode, 400);
  assert.equal(entry.errorText, "Bad Request");
  assert.equal(entry.url, "turn:global.relay.metered.ca");
  assert.equal(entry.address, undefined);
  assert.equal(entry.username, undefined);
  assert.equal(entry.credential, undefined);
  assert.equal(serialized.includes("192.168.1.20"), false);
  assert.equal(serialized.includes("203.0.113.8"), false);
  assert.equal(serialized.includes("turn-user"), false);
  assert.equal(serialized.includes("turn-pass"), false);
  assert.equal(serialized.includes("v=0"), false);
  assert.equal(safeIceServerUrl("stun:10.0.0.1:3478"), "");
});

test("embedded public, private, and IPv6 addresses are removed from error text", () => {
  const entry = sanitizeCallDiagnostic({
    callId: "call-2",
    event: "ice_candidate_error",
    errorCode: 701,
    errorText: "relay failed for 203.0.113.10, 10.8.0.2, 192.168.1.50, 2001:db8::10, fe80::abcd:1, and ::1",
    url: "turn:203.0.113.10:3478",
    username: "turn-user",
    credential: "turn-pass",
    token: "session-token",
    sdp: "v=0",
    candidate: "candidate:1 1 udp 198.51.100.8 3478 typ host",
  });
  const serialized = JSON.stringify(entry);
  assert.equal(entry.errorText.includes("relay failed"), true);
  for (const secret of [
    "203.0.113.10",
    "10.8.0.2",
    "192.168.1.50",
    "2001:db8::10",
    "fe80::abcd:1",
    "::1",
    "198.51.100.8",
    "turn-user",
    "turn-pass",
    "session-token",
    "v=0",
    "candidate:",
  ]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  assert.equal(entry.username, undefined);
  assert.equal(entry.credential, undefined);
  assert.equal(entry.url, undefined);

  const mixed = sanitizeCallDiagnostic({
    errorText: "check failed at 8.8.8.8 and 2001:0db8:85a3:0000:0000:8a2e:0370:7334 while media stayed up",
    errorCode: 400,
  });
  const mixedText = JSON.stringify(mixed);
  assert.equal(mixed.errorText.includes("check failed"), true);
  assert.equal(mixed.errorText.includes("media stayed up"), true);
  assert.equal(mixedText.includes("8.8.8.8"), false);
  assert.equal(mixedText.includes("2001:0db8:85a3:0000:0000:8a2e:0370:7334"), false);
  assert.equal(mixed.errorText.includes("candidate:"), false);
});

test("camera toggle diagnostics keep track state and drop SDP and secrets", () => {
  const entry = sanitizeCallDiagnostic({
    callId: "call-7",
    event: "camera_toggle",
    cameraAction: "enabled",
    videoReadyState: "live",
    videoEnabled: "true",
    audioReadyState: "live",
    audioEnabled: "true",
    videoSender: "yes",
    videoSenderState: "live",
    audioSender: "yes",
    connectionBefore: "connected",
    connectionAfter: "connected",
    iceBefore: "completed",
    iceAfter: "completed",
    renegotiation: "no",
    iceRestart: "no",
    sdp: "v=0",
    candidate: "candidate:1 1 udp 203.0.113.8 3478 typ host",
    username: "turn-user",
    credential: "turn-pass",
    token: "session-token",
  });
  const serialized = JSON.stringify(entry);
  assert.equal(entry.cameraAction, "enabled");
  assert.equal(entry.videoReadyState, "live");
  assert.equal(entry.videoEnabled, "true");
  assert.equal(entry.audioReadyState, "live");
  assert.equal(entry.audioEnabled, "true");
  assert.equal(entry.videoSender, "yes");
  assert.equal(entry.videoSenderState, "live");
  assert.equal(entry.audioSender, "yes");
  assert.equal(entry.connectionBefore, "connected");
  assert.equal(entry.connectionAfter, "connected");
  assert.equal(entry.iceBefore, "completed");
  assert.equal(entry.iceAfter, "completed");
  assert.equal(entry.renegotiation, "no");
  assert.equal(entry.iceRestart, "no");
  assert.equal(entry.sdp, undefined);
  assert.equal(entry.username, undefined);
  assert.equal(entry.credential, undefined);
  for (const secret of ["v=0", "candidate:", "203.0.113.8", "turn-user", "turn-pass", "session-token"]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test("signaling timeline keeps safe fields and drops SDP, secrets, and addresses", () => {
  const entry = sanitizeCallDiagnostic({
    callId: "call-9",
    requestId: "ice1ab12cd",
    event: "ice_candidate_applied",
    signalType: "ice",
    delivery: "applied",
    result: "applied",
    signalSeq: 6,
    iceGatheringState: "gathering",
    transportPolicy: "all",
    credentialPresent: "yes",
    usernamePresent: "yes",
    addressClass: "private",
    stunCount: 1,
    turnCount: 3,
    address: "192.168.1.20",
    sdp: "v=0",
    username: "metered-user",
    credential: "metered-secret",
    token: "session-token",
  });
  const serialized = JSON.stringify(entry);
  assert.equal(entry.event, "ice_candidate_applied");
  assert.equal(entry.requestId, "ice1ab12cd");
  assert.equal(entry.signalSeq, 6);
  assert.equal(entry.addressClass, "private");
  assert.equal(entry.credentialPresent, "yes");
  assert.equal(entry.usernamePresent, "yes");
  assert.equal(entry.stunCount, 1);
  assert.equal(entry.turnCount, 3);
  assert.equal(entry.address, undefined);
  for (const secret of ["192.168.1.20", "v=0", "metered-user", "metered-secret", "session-token"]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});
