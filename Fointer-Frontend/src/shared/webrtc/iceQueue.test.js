import assert from "node:assert/strict";
import test from "node:test";
import { applyPeerSignal, applyQueuedAnswer } from "./applyPeerSignal.js";
import {
  callPhaseCanSignal,
  createIceQueue,
  markRemoteDescriptionSet,
  pushLocalCandidate,
  replayLocalCandidates,
  takeIceCandidate,
} from "./iceQueue.js";
import { addRemoteTracks } from "./remoteTracks.js";

const fakePeer = () => {
  const pc = {
    signalingState: "stable",
    remote: null,
    local: null,
    ice: [],
    async setRemoteDescription(sdp) {
      this.remote = sdp;
      this.signalingState = "stable";
    },
    async setLocalDescription(description) {
      this.local = description;
      if (description?.type === "rollback") this.signalingState = "stable";
    },
    get localDescription() {
      return this.local;
    },
    async createAnswer() {
      return { type: "answer", sdp: "answer" };
    },
    async addIceCandidate(candidate) {
      if (!this.remote) throw new Error("remote description missing");
      this.ice.push(candidate);
    },
  };
  return {
    pc,
    iceQueue: createIceQueue(),
    polite: true,
    ignoreOffer: false,
  };
};

test("ICE before the remote description is applied after the offer", async () => {
  const peer = fakePeer();
  const answers = [];
  await applyPeerSignal(
    peer,
    { type: "ice", candidate: { candidate: "early" } },
    {}
  );
  assert.equal(peer.pc.ice.length, 0);
  assert.equal(peer.iceQueue.pending.length, 1);

  await applyPeerSignal(
    peer,
    { type: "offer", sdp: { type: "offer", sdp: "offer" } },
    { onAnswer: (description) => answers.push(description) }
  );

  assert.equal(peer.pc.remote.sdp, "offer");
  assert.deepEqual(peer.pc.ice, [{ candidate: "early" }]);
  assert.equal(answers.length, 1);
  assert.equal(answers[0].type, "answer");
});

test("ICE after the remote description is applied immediately", async () => {
  const queue = createIceQueue();
  markRemoteDescriptionSet(queue);
  assert.deepEqual(takeIceCandidate(queue, { candidate: "later" }), [
    { candidate: "later" },
  ]);
});

test("an answer that arrives before the local offer is applied once that offer exists", async () => {
  const peer = fakePeer();
  const queued = await applyPeerSignal(peer, {
    type: "answer",
    sdp: { type: "answer", sdp: "early-answer" },
    messageId: "answer-1",
  });
  assert.equal(queued, false);
  assert.equal(peer.pc.remote, null);
  assert.ok(peer.queuedAnswer);

  peer.pc.signalingState = "have-local-offer";
  assert.equal(await applyQueuedAnswer(peer), true);
  assert.equal(peer.pc.remote.sdp, "early-answer");
  assert.equal(peer.pc.signalingState, "stable");
  assert.equal(peer.queuedAnswer, null);
  assert.equal(await applyQueuedAnswer(peer), false);
});

test("an ignored glare offer does not block later ICE", async () => {
  const peer = fakePeer();
  peer.polite = false;
  peer.pc.signalingState = "have-local-offer";
  peer.pc.remote = { type: "offer", sdp: "local-offer" };
  peer.iceQueue.remoteReady = true;
  const ignored = await applyPeerSignal(peer, {
    type: "offer",
    sdp: { type: "offer", sdp: "glare" },
    messageId: "offer-glare",
  });
  assert.equal(ignored, false);
  assert.equal(peer.ignoreOffer, true);
  const applied = await applyPeerSignal(peer, {
    type: "ice",
    candidate: { candidate: "after-glare" },
    messageId: "ice-after",
  });
  assert.equal(applied, true);
  assert.deepEqual(peer.pc.ice, [{ candidate: "after-glare" }]);
});

test("local candidates are sent again once after the remote description is applied", () => {
  const peer = {};
  pushLocalCandidate(peer, { candidate: "one" });
  pushLocalCandidate(peer, { candidate: "two" });
  assert.deepEqual(
    replayLocalCandidates(peer).map((item) => item.candidate),
    ["one", "two"]
  );
  pushLocalCandidate(peer, { candidate: "three" });
  assert.deepEqual(replayLocalCandidates(peer), []);
});

test("ringing_in cannot apply media signals yet", () => {
  assert.equal(callPhaseCanSignal("ringing_in"), false);
  assert.equal(callPhaseCanSignal("idle"), false);
  assert.equal(callPhaseCanSignal("connecting"), true);
  assert.equal(callPhaseCanSignal("active"), true);
});

test("remote track events without a stream are still attached", () => {
  const tracks = [];
  const stream = {
    getTracks: () => tracks,
    addTrack: (track) => tracks.push(track),
  };
  const added = addRemoteTracks(stream, { track: { id: "audio-1" }, streams: [] });
  assert.equal(added, true);
  assert.equal(tracks.length, 1);
  assert.equal(addRemoteTracks(stream, { track: { id: "audio-1" } }), false);
});
