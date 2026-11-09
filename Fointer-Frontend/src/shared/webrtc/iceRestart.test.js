import assert from "node:assert/strict";
import test from "node:test";
import { restartDelayMs, watchPeerConnection } from "./iceRestart.js";

const makePeerConnection = () => {
  const pc = new EventTarget();
  pc.signalingState = "stable";
  pc.connectionState = "connecting";
  pc.iceConnectionState = "checking";
  pc.localDescription = null;
  pc.createOffer = async (options) => ({
    type: "offer",
    options,
  });
  pc.setLocalDescription = async (description) => {
    pc.localDescription = description;
  };
  return pc;
};

test("restarts ICE after an initial connection stays checking", async () => {
  const pc = makePeerConnection();
  const sent = [];
  const statuses = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 5,
    sendOffer: (offer) => sent.push(offer),
    onStatus: (status) => statuses.push(status),
  });

  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.iceRestart, true);
  assert.ok(statuses.includes("reconnecting"));
});

test("a successful ICE connection cancels the pending initial restart", async () => {
  const pc = makePeerConnection();
  const sent = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 5,
    sendOffer: (offer) => sent.push(offer),
  });

  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  pc.dispatchEvent(new Event("connectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();

  assert.equal(sent.length, 0);
});

test("a slow TURN path that connects during checking is not restarted", async () => {
  const pc = makePeerConnection();
  const sent = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 40,
    sendOffer: (offer) => sent.push(offer),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 40));
  stop();
  assert.equal(sent.length, 0);
});

test("a failed connection restarts once and a later success clears the retry count", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    maxAttempts: 3,
    random: () => 0,
    sendOffer: (offer) => sent.push(offer),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 8));
  assert.equal(sent.length, 1);
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 8));
  stop();
  assert.equal(sent.length, 2);
});

test("temporary disconnection waits, then one restart is sent", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    disconnectedGraceMs: 10,
    recoveryDelayMs: 40,
    sendOffer: (offer) => sent.push(offer),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  pc.iceConnectionState = "disconnected";
  pc.connectionState = "disconnected";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 25));
  stop();
  assert.equal(sent.length, 1);
});

test("retry delay grows and the attempt limit stops further restarts", async () => {
  assert.ok(restartDelayMs(2, { random: () => 0 }) > restartDelayMs(0, { random: () => 0 }));
  const pc = makePeerConnection();
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  const statuses = [];
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    maxAttempts: 2,
    random: () => 0,
    sendOffer: (offer) => sent.push(offer),
    onStatus: (status) => statuses.push(status),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 40));
  stop();
  assert.equal(sent.length, 2);
  assert.ok(statuses.includes("failed"));
});

test("an unstable signaling state does not consume a restart attempt", async () => {
  const pc = makePeerConnection();
  pc.signalingState = "have-local-offer";
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    maxAttempts: 1,
    sendOffer: (offer) => sent.push(offer),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 8));
  assert.equal(sent.length, 0);
  pc.signalingState = "stable";
  await new Promise((resolve) => setTimeout(resolve, 15));
  stop();
  assert.equal(sent.length, 1);
});

test("ending the call and closing the peer cancels recovery listeners", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  let active = true;
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    isActive: () => active,
    sendOffer: (offer) => sent.push(offer),
  });
  active = false;
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  stop();
  pc.connectionState = "closed";
  pc.dispatchEvent(new Event("connectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(sent.length, 0);
});

test("a connected media stall can request one restart without looping", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    maxAttempts: 2,
    random: () => 0,
    sendOffer: (offer) => sent.push(offer),
  });
  stop.request();
  stop.request();
  await new Promise((resolve) => setTimeout(resolve, 8));
  assert.equal(sent.length, 1);
  stop();
});

test("the polite peer never sends a competing restart offer", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    polite: true,
    recoveryDelayMs: 5,
    sendOffer: (offer) => sent.push(offer),
  });
  stop.request();
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();
  assert.equal(sent.length, 0);
});
