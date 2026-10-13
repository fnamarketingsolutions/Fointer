import assert from "node:assert/strict";
import test from "node:test";
import { remoteStatusLabel, shouldShowRemoteVideo } from "./mediaTile.js";
import {
  applyRemoteCameraState,
  audioStillLive,
  cameraControlAction,
  cameraControlLabel,
  cameraFailureMessage,
  cameraPresencePayload,
  countVideoTransceivers,
  createSwitchLock,
  disableLocalCamera,
  enableLocalCamera,
  findVideoTransceiver,
  renegotiatePeer,
  shouldAcceptCameraSignal,
} from "./mediaSwitch.js";

const makeTrack = (id, kind) => ({
  id,
  kind,
  readyState: "live",
  enabled: true,
  stop() {
    this.readyState = "ended";
  },
});

const makeStream = (tracks) => ({
  tracks: tracks.slice(),
  getTracks() {
    return this.tracks.slice();
  },
  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === "audio");
  },
  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === "video");
  },
  addTrack(track) {
    this.tracks.push(track);
  },
  removeTrack(track) {
    this.tracks = this.tracks.filter((item) => item !== track);
  },
});

const makePc = (audioTrack) => {
  const transceivers = [];
  const add = (track) => {
    const sender = {
      track,
      replaceTrack(next) {
        this.track = next;
        return Promise.resolve();
      },
    };
    const transceiver = {
      kind: track.kind,
      direction: "sendrecv",
      sender,
      receiver: { track: { kind: track.kind, readyState: "live" } },
    };
    transceivers.push(transceiver);
    return sender;
  };
  add(audioTrack);
  return {
    closed: false,
    signalingState: "stable",
    local: null,
    close() {
      this.closed = true;
    },
    getTransceivers() {
      return transceivers;
    },
    getSenders() {
      return transceivers.map((item) => item.sender);
    },
    addTrack(track) {
      return add(track);
    },
    async createOffer() {
      return { type: "offer", sdp: "offer" };
    },
    async setLocalDescription(description) {
      this.local = description;
      this.signalingState = "have-local-offer";
    },
    get localDescription() {
      return this.local;
    },
  };
};

const audioCall = () => {
  const audio = makeTrack("mic", "audio");
  const stream = makeStream([audio]);
  const pc = makePc(audio);
  return { audio, stream, pc };
};

let videoSeq = 0;
const videoUserMedia = async () => {
  videoSeq += 1;
  return makeStream([makeTrack(`cam-${videoSeq}`, "video")]);
};

test("audio to video adds one camera track and keeps the microphone", async () => {
  const { audio, stream, pc } = audioCall();
  const result = await enableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
    getUserMedia: videoUserMedia,
  });
  assert.equal(result.ok, true);
  assert.equal(result.audioPreserved, true);
  assert.equal(audio.readyState, "live");
  assert.equal(countVideoTransceivers(pc), 1);
  assert.equal(stream.getVideoTracks()[0].readyState, "live");
  assert.equal(pc.closed, false);
});

test("video to audio releases the camera and leaves audio on the same connection", async () => {
  const { audio, stream, pc } = audioCall();
  await enableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
    getUserMedia: videoUserMedia,
  });
  const result = await disableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
  });
  assert.equal(result.ok, true);
  assert.equal(result.audioPreserved, true);
  assert.equal(audio.readyState, "live");
  assert.equal(audioStillLive(stream), true);
  assert.equal(stream.getVideoTracks().length, 0);
  const video = findVideoTransceiver(pc);
  assert.equal(video.direction, "recvonly");
  assert.equal(video.sender.track, null);
  assert.equal(pc.closed, false);
});

test("the remote participant follows camera presence", () => {
  const peer = { mic: true, camera: false, mode: "audio", stream: makeStream([]) };
  applyRemoteCameraState(peer, cameraPresencePayload(true));
  peer.stream.addTrack(makeTrack("remote-cam", "video"));
  assert.equal(peer.mode, "video");
  assert.equal(peer.camera, true);
  assert.equal(shouldShowRemoteVideo(peer), true);
  applyRemoteCameraState(peer, cameraPresencePayload(false));
  assert.equal(shouldShowRemoteVideo(peer), false);
  assert.equal(remoteStatusLabel(peer, "avatar"), "Camera off");
});

test("camera permission denial preserves the audio call", async () => {
  const { audio, stream, pc } = audioCall();
  const result = await enableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
    getUserMedia: async () => {
      const error = new Error("denied");
      error.name = "NotAllowedError";
      throw error;
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.audioPreserved, true);
  assert.equal(audio.readyState, "live");
  assert.equal(countVideoTransceivers(pc), 0);
  assert.equal(result.message, cameraFailureMessage({ name: "NotAllowedError" }));
  assert.match(result.message, /audio call is still on/);
});

test("repeated switching reuses the video transceiver", async () => {
  const { stream, pc } = audioCall();
  await enableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
    getUserMedia: videoUserMedia,
  });
  await disableLocalCamera({ localStream: stream, peerConnections: [pc] });
  await enableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
    getUserMedia: videoUserMedia,
  });
  assert.equal(countVideoTransceivers(pc), 1);
  assert.equal(findVideoTransceiver(pc).sender.track.kind, "video");
  assert.equal(audioStillLive(stream), true);
});

test("simultaneous switches are serialized and do not duplicate video", async () => {
  const { stream, pc } = audioCall();
  const lock = createSwitchLock();
  const order = [];
  await Promise.all([
    lock(async () => {
      order.push("first");
      await enableLocalCamera({
        localStream: stream,
        peerConnections: [pc],
        getUserMedia: videoUserMedia,
      });
    }),
    lock(async () => {
      order.push("second");
      await enableLocalCamera({
        localStream: stream,
        peerConnections: [pc],
        getUserMedia: videoUserMedia,
      });
    }),
  ]);
  assert.deepEqual(order, ["first", "second"]);
  assert.equal(countVideoTransceivers(pc), 1);
});

test("renegotiation waits while an offer is already in flight", async () => {
  let sent = false;
  const busy = await renegotiatePeer(
    {
      pc: {
        signalingState: "have-local-offer",
        createOffer() {
          throw new Error("should not offer");
        },
      },
    },
    {
      sendOffer() {
        sent = true;
      },
    }
  );
  assert.equal(busy.ok, false);
  assert.equal(busy.reason, "glare");
  assert.equal(sent, false);

  const pc = {
    signalingState: "stable",
    local: null,
    async createOffer() {
      return { type: "offer", sdp: "video" };
    },
    async setLocalDescription(description) {
      this.local = description;
    },
    get localDescription() {
      return this.local;
    },
  };
  let offer;
  const ready = await renegotiatePeer(
    { pc },
    {
      sendOffer(description) {
        offer = description;
      },
    }
  );
  assert.equal(ready.ok, true);
  assert.equal(offer.sdp, "video");
});

test("an ended or different call rejects a late camera switch", () => {
  assert.equal(
    shouldAcceptCameraSignal({ inCall: false, activeCallId: "call-a", signalCallId: "call-a" }),
    false
  );
  assert.equal(
    shouldAcceptCameraSignal({ inCall: true, activeCallId: "call-b", signalCallId: "call-a" }),
    false
  );
  assert.equal(
    shouldAcceptCameraSignal({ inCall: true, activeCallId: "call-b", signalCallId: "call-b" }),
    true
  );
});

test("mobile camera controls choose turn on, turn off, or wait", () => {
  assert.equal(cameraControlAction({ inCall: true, cameraOn: false, busy: false }), "enable");
  assert.equal(cameraControlAction({ inCall: true, cameraOn: true, busy: false }), "disable");
  assert.equal(cameraControlAction({ inCall: true, cameraOn: true, busy: true }), "wait");
  assert.equal(cameraControlAction({ inCall: false, cameraOn: false, busy: false }), "unavailable");
  assert.equal(cameraControlLabel({ cameraOn: false, busy: false }), "Turn on camera");
  assert.equal(cameraControlLabel({ cameraOn: true, busy: false }), "Turn off camera");
  assert.equal(cameraControlLabel({ cameraOn: false, busy: true }), "Turning camera on…");
});
