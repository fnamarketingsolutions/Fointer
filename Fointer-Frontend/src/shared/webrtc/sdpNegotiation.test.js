import assert from "node:assert/strict";
import test from "node:test";
import { watchPeerConnection } from "./iceRestart.js";
import { applyPeerSignal } from "./applyPeerSignal.js";
import { createIceQueue } from "./iceQueue.js";
import {
  attachLocalMedia,
  bindTracksToOffer,
  canCreateOffer,
  claimOfferLock,
  mediaLineOrder,
  missingLocalKinds,
  mLineOrderPreserved,
  prepareForRemoteOffer,
  releaseOfferLock,
} from "./sdpNegotiation.js";

const track = (id, kind) => ({ id, kind, readyState: "live" });

const streamWith = (tracks) => ({
  getAudioTracks: () => tracks.filter((item) => item.kind === "audio"),
  getVideoTracks: () => tracks.filter((item) => item.kind === "video"),
  getTracks: () => tracks.slice(),
});

const peerConnection = () => {
  const transceivers = [];
  const added = [];
  return {
    added,
    signalingState: "stable",
    getTransceivers: () => transceivers,
    addTrack(next) {
      added.push(next.kind);
      transceivers.push({
        kind: next.kind,
        direction: "sendrecv",
        stopped: false,
        sender: { track: next },
        receiver: { track: { kind: next.kind } },
        stop() {
          this.stopped = true;
          this.direction = "stopped";
        },
      });
    },
  };
};

test("audio is attached before video when the stream lists video first", () => {
  const pc = peerConnection();
  const stream = streamWith([track("cam", "video"), track("mic", "audio")]);
  const first = attachLocalMedia(pc, stream);
  assert.deepEqual(pc.added, ["audio", "video"]);
  assert.deepEqual(first.order, ["audio", "video"]);

  const second = attachLocalMedia(pc, stream);
  assert.deepEqual(second.added, []);
  assert.deepEqual(pc.added, ["audio", "video"]);
  assert.equal(mLineOrderPreserved(first.order, mediaLineOrder(pc)), true);
  assert.equal(mLineOrderPreserved(["audio", "video"], ["video", "audio"]), false);
  assert.equal(mLineOrderPreserved(["audio"], ["audio", "video"]), true);
});

test("an answer binds local tracks without creating an m-line the offer omitted", async () => {
  const audio = track("mic", "audio");
  const transceivers = [{
    kind: "audio",
    direction: "recvonly",
    sender: {
      track: null,
      replaceTrack(next) {
        this.track = next;
        return Promise.resolve();
      },
    },
    receiver: { track: { kind: "audio" } },
  }];
  let adds = 0;
  const pc = {
    addTrack() {
      adds += 1;
    },
    getTransceivers: () => transceivers,
  };
  const stream = streamWith([track("cam", "video"), audio]);
  const bound = bindTracksToOffer(pc, stream);
  await bound.pending;
  assert.equal(adds, 0);
  assert.deepEqual(bound.bound, ["audio"]);
  assert.equal(transceivers[0].direction, "sendrecv");
  assert.equal(transceivers[0].sender.track, audio);
  assert.deepEqual(missingLocalKinds(pc, stream), ["video"]);

  const pcWithAdd = peerConnection();
  pcWithAdd.getTransceivers().push(transceivers[0]);
  const appended = attachLocalMedia(pcWithAdd, stream);
  assert.deepEqual(appended.added, ["video"]);
  assert.equal(mLineOrderPreserved(["audio"], appended.order), true);
});

test("a second offer is refused while the first is in flight or the signaling state is closed", () => {
  const peer = { offerLock: false };
  const pc = { signalingState: "stable" };
  assert.equal(claimOfferLock(peer, pc), true);
  assert.equal(claimOfferLock(peer, pc), false);
  assert.equal(canCreateOffer(pc, { makingOffer: true }), false);
  assert.equal(canCreateOffer({ signalingState: "have-local-offer" }), false);
  assert.equal(canCreateOffer({ signalingState: "closed" }), false);
  releaseOfferLock(peer);
  assert.equal(claimOfferLock(peer, { signalingState: "have-local-offer" }), false);
  assert.equal(claimOfferLock(peer, pc), true);
});

test("ICE restart waits while another offer holds the negotiation lock", async () => {
  const pc = new EventTarget();
  pc.signalingState = "stable";
  pc.connectionState = "connecting";
  pc.iceConnectionState = "checking";
  pc.localDescription = null;
  let offers = 0;
  pc.createOffer = async () => {
    offers += 1;
    return { type: "offer" };
  };
  pc.setLocalDescription = async () => {};
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 5,
    claimOffer: () => false,
    sendOffer: () => {
      throw new Error("locked restart must not send");
    },
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();
  assert.equal(offers, 0);
});

const audioSdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";

const failedPeer = () => {
  const pc = new EventTarget();
  pc.signalingState = "stable";
  pc.connectionState = "failed";
  pc.iceConnectionState = "failed";
  pc.localDescription = null;
  return pc;
};

test("an audio-only offer keeps audio first when the camera is enabled later", () => {
  const pc = peerConnection();
  const mic = track("mic", "audio");
  attachLocalMedia(pc, streamWith([mic]));
  pc.localDescription = { type: "answer", sdp: audioSdp };
  pc.remoteDescription = { type: "offer", sdp: audioSdp };
  const enabled = attachLocalMedia(pc, streamWith([mic, track("cam", "video")]));
  assert.deepEqual(enabled.added, ["video"]);
  assert.deepEqual(enabled.order, ["audio", "video"]);
  assert.equal(mLineOrderPreserved(["audio"], enabled.order), true);
  assert.equal(prepareForRemoteOffer(pc, pc.remoteDescription).stopped.length, 0);
});

test("a video transceiver created before an audio-only offer is retired", async () => {
  const pc = peerConnection();
  attachLocalMedia(pc, streamWith([track("mic", "audio"), track("cam", "video")]));
  assert.deepEqual(mediaLineOrder(pc), ["audio", "video"]);
  pc.setRemoteDescription = async (description) => {
    pc.remoteDescription = description;
  };
  pc.setLocalDescription = async (description) => {
    pc.localDescription = description;
    pc.signalingState = description?.type === "answer" ? "stable" : pc.signalingState;
  };
  pc.createAnswer = async () => ({ type: "answer", sdp: audioSdp });
  const peer = {
    pc,
    iceQueue: createIceQueue(),
    polite: true,
    iceGeneration: 0,
  };
  const applied = await applyPeerSignal(peer, {
    type: "offer",
    sdp: { type: "offer", sdp: audioSdp },
    messageId: "audio-offer",
  });
  assert.equal(applied, true);
  assert.deepEqual(mediaLineOrder(pc), ["audio"]);
  const enabled = attachLocalMedia(pc, streamWith([track("mic", "audio"), track("cam", "video")]));
  assert.deepEqual(enabled.added, ["video"]);
  assert.deepEqual(enabled.order, ["audio", "video"]);
  assert.equal(mLineOrderPreserved(["audio"], enabled.order), true);
});

test("ICE restart after an audio-only negotiation keeps the audio m-line", () => {
  const pc = peerConnection();
  attachLocalMedia(pc, streamWith([track("mic", "audio"), track("cam", "video")]));
  prepareForRemoteOffer(pc, { type: "offer", sdp: audioSdp });
  pc.localDescription = { type: "answer", sdp: audioSdp };
  pc.remoteDescription = { type: "offer", sdp: audioSdp };
  assert.deepEqual(mediaLineOrder(pc), ["audio"]);
  assert.deepEqual(prepareForRemoteOffer(pc, pc.remoteDescription).stopped, []);
  assert.equal(mLineOrderPreserved(["audio"], mediaLineOrder(pc)), true);
});

test("a busy offer lock defers the ICE restart until the negotiation finishes", async () => {
  const pc = failedPeer();
  let released = false;
  let offers = 0;
  pc.createOffer = async (options) => {
    offers += 1;
    assert.equal(options.iceRestart, true);
    return { type: "offer" };
  };
  pc.setLocalDescription = async () => {
    pc.signalingState = "have-local-offer";
  };
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 10,
    checkingTimeoutMs: 1000,
    claimOffer: () => released,
    sendOffer() {},
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(offers, 0);
  released = true;
  await new Promise((resolve) => setTimeout(resolve, 40));
  stop();
  assert.equal(offers, 1);
});

test("a closed peer connection cancels a queued ICE restart", async () => {
  const pc = failedPeer();
  let offers = 0;
  pc.createOffer = async () => {
    offers += 1;
    return { type: "offer" };
  };
  pc.setLocalDescription = async () => {};
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 10,
    checkingTimeoutMs: 1000,
    claimOffer: () => false,
    sendOffer() {},
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  stop();
  pc.connectionState = "closed";
  pc.iceConnectionState = "closed";
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(offers, 0);
});

test("a busy offer lock does not retry an ICE restart forever", async () => {
  const pc = failedPeer();
  let claims = 0;
  pc.createOffer = async () => {
    throw new Error("locked restart must not create an offer");
  };
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    maxAttempts: 4,
    checkingTimeoutMs: 1000,
    claimOffer: () => {
      claims += 1;
      return false;
    },
    sendOffer() {},
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 80));
  stop();
  assert.equal(claims, 4);
});
