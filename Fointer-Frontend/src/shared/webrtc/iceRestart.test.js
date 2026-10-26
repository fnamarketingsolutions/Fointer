import assert from "node:assert/strict";
import test from "node:test";
import { watchPeerConnection } from "./iceRestart.js";

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
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 5,
    sendOffer: (offer) => sent.push(offer),
  });

  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.iceRestart, true);
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
