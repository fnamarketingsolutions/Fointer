import assert from "node:assert/strict";
import test from "node:test";
import {
  applyParticipantMedia,
  callerCanCancel,
  isRingingExpired,
  RING_MS,
  signalMatchesCall,
} from "./dmCallLifecycle.js";

test("a ringing call expires and a newer call does not", () => {
  const now = 1_000_000;
  const oldCall = { status: "ringing", invitedAt: new Date(now - RING_MS) };
  const fresh = { status: "ringing", invitedAt: new Date(now - 1000) };
  assert.equal(isRingingExpired(oldCall, now), true);
  assert.equal(isRingingExpired(fresh, now), false);
  assert.equal(isRingingExpired({ status: "active", invitedAt: oldCall.invitedAt }, now), false);
});

test("the inviter can cancel after their socket id changes", () => {
  const peers = new Map([["old-socket", { userId: "a" }]]);
  const call = { status: "ringing", invitedBy: "a", peers };
  assert.equal(callerCanCancel(call, { socketId: "new-socket", userId: "a" }), true);
  assert.equal(callerCanCancel(call, { socketId: "new-socket", userId: "b" }), false);
  assert.equal(callerCanCancel({ ...call, status: "active" }, { socketId: "old-socket", userId: "a" }), false);
});

const videoPair = () => ({
  status: "active",
  mode: "video",
  callId: "call-b",
  peers: new Map([
    ["web", { socketId: "web", userId: "site-user", mode: "video", camera: true, mic: true }],
    ["app", { socketId: "app", userId: "app-user", mode: "video", camera: true, mic: true }],
  ]),
});

test("a website camera switch is stored without changing the app user's camera", () => {
  const call = videoPair();
  const caller = applyParticipantMedia(call, "web", { mode: "audio", camera: false });
  assert.equal(caller.mode, "audio");
  assert.equal(caller.camera, false);
  assert.equal(call.peers.get("app").mode, "video");
  assert.equal(call.peers.get("app").camera, true);
  assert.equal(call.mode, "video");
});

test("the stored call becomes audio after both cameras are off", () => {
  const call = videoPair();
  applyParticipantMedia(call, "web", { mode: "audio", camera: false });
  applyParticipantMedia(call, "app", { mode: "audio", camera: false });
  assert.equal(call.mode, "audio");
  assert.equal(call.peers.get("web").camera, false);
  assert.equal(call.peers.get("app").camera, false);
});

test("a socket outside the call cannot change the mode", () => {
  const call = videoPair();
  assert.equal(applyParticipantMedia(call, "stranger", { mode: "audio" }), null);
  assert.equal(applyParticipantMedia({ ...call, status: "ended" }, "web", { mode: "audio" }), null);
  assert.equal(call.mode, "video");
  assert.equal(call.peers.get("web").mode, "video");
});

test("signals for a different or ended call id are rejected", () => {
  const call = { status: "ringing", callId: "call-b" };
  assert.equal(signalMatchesCall(call, "call-a"), false);
  assert.equal(signalMatchesCall(call, "call-b"), true);
  assert.equal(signalMatchesCall({ status: "ended", callId: "call-b" }, "call-b"), false);
});
