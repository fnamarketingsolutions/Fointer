import assert from "node:assert/strict";
import test from "node:test";
import { remoteMediaStatus, remoteStatusLabel, shouldShowRemoteVideo } from "./mediaTile.js";
import { safeCallDiagnostic } from "./callDiagnostics.js";
import {
  applyRemoteCameraState,
  audioStillLive,
  cameraControlAction,
  cameraControlLabel,
  cameraFailureMessage,
  cameraPresencePayload,
  cameraToggleRecord,
  countVideoTransceivers,
  createSwitchLock,
  disableLocalCamera,
  enableLocalCamera,
  findVideoTransceiver,
  renegotiatePeer,
  shouldAcceptCameraSignal,
  watchRemoteTrack,
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
  const pc = {
    closed: false,
    signalingState: "stable",
    connectionState: "connected",
    iceConnectionState: "connected",
    local: null,
    offers: 0,
    iceRestarts: 0,
    descriptions: 0,
    adds: 0,
    removes: 0,
    replaces: 0,
    close() {
      this.closed = true;
      this.connectionState = "closed";
    },
    getTransceivers() {
      return transceivers;
    },
    getSenders() {
      return transceivers.map((item) => item.sender);
    },
    addTrack(track) {
      this.adds += 1;
      return add(track);
    },
    removeTrack() {
      this.removes += 1;
    },
    async createOffer(options) {
      this.offers += 1;
      if (options?.iceRestart) this.iceRestarts += 1;
      return { type: "offer", sdp: "offer" };
    },
    async setLocalDescription(description) {
      this.descriptions += 1;
      this.local = description;
      this.signalingState = "have-local-offer";
    },
    get localDescription() {
      return this.local;
    },
  };
  const add = (track) => {
    const sender = {
      track,
      replaceTrack(next) {
        pc.replaces += 1;
        this.track = next;
        return Promise.resolve();
      },
    };
    const transceiver = {
      kind: track.kind,
      direction: "sendrecv",
      sender,
      receiver: { track: { kind: track.kind, readyState: "live", muted: false } },
    };
    transceivers.push(transceiver);
    return sender;
  };
  add(audioTrack);
  return pc;
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

test("camera off mutes the existing video track and leaves the peer connection alone", async () => {
  const { audio, stream, pc } = audioCall();
  const started = await enableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
    getUserMedia: videoUserMedia,
  });
  const video = stream.getVideoTracks()[0];
  pc.offers = 0;
  pc.adds = 0;
  pc.replaces = 0;
  const result = await disableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
  });
  assert.equal(result.ok, true);
  assert.equal(result.action, "disabled");
  assert.equal(result.renegotiate, false);
  assert.equal(result.iceRestart, false);
  assert.equal(result.audioPreserved, true);
  assert.equal(audio.readyState, "live");
  assert.equal(audio.enabled, true);
  assert.equal(audioStillLive(stream), true);
  assert.equal(video.readyState, "live");
  assert.equal(video.enabled, false);
  assert.equal(video.id, started.track.id);
  const sender = findVideoTransceiver(pc);
  assert.equal(sender.direction, "sendrecv");
  assert.equal(sender.sender.track, video);
  assert.equal(countVideoTransceivers(pc), 1);
  assert.equal(pc.offers, 0);
  assert.equal(pc.iceRestarts, 0);
  assert.equal(pc.descriptions, 0);
  assert.equal(pc.adds, 0);
  assert.equal(pc.removes, 0);
  assert.equal(pc.replaces, 0);
  assert.equal(pc.closed, false);
  assert.equal(pc.connectionState, "connected");
  assert.equal(pc.iceConnectionState, "connected");
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

test("repeated camera off and on reuses the same track, sender, and connection", async () => {
  const { audio, stream, pc } = audioCall();
  let captures = 0;
  const countingMedia = async () => {
    captures += 1;
    return videoUserMedia();
  };
  const started = await enableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
    getUserMedia: countingMedia,
  });
  pc.offers = 0;
  pc.adds = 0;
  pc.replaces = 0;
  for (let cycle = 0; cycle < 4; cycle += 1) {
    const off = await disableLocalCamera({ localStream: stream, peerConnections: [pc] });
    assert.equal(off.renegotiate, false);
    assert.equal(off.iceRestart, false);
    assert.equal(started.track.enabled, false);
    const on = await enableLocalCamera({
      localStream: stream,
      peerConnections: [pc],
      getUserMedia: countingMedia,
    });
    assert.equal(on.ok, true);
    assert.equal(on.action, "enabled");
    assert.equal(on.renegotiate, false);
    assert.equal(on.iceRestart, false);
    assert.equal(on.track, started.track);
    assert.equal(started.track.enabled, true);
    assert.equal(started.track.readyState, "live");
  }
  assert.equal(captures, 1);
  assert.equal(countVideoTransceivers(pc), 1);
  assert.equal(findVideoTransceiver(pc).sender.track, started.track);
  assert.equal(audio.readyState, "live");
  assert.equal(audio.enabled, true);
  assert.equal(pc.offers, 0);
  assert.equal(pc.iceRestarts, 0);
  assert.equal(pc.adds, 0);
  assert.equal(pc.removes, 0);
  assert.equal(pc.replaces, 0);
  assert.equal(pc.closed, false);
  assert.equal(pc.connectionState, "connected");
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

test("a denied camera after the device ends keeps audio and the same sender", async () => {
  const { audio, stream, pc } = audioCall();
  const started = await enableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
    getUserMedia: videoUserMedia,
  });
  started.track.readyState = "ended";
  pc.offers = 0;
  pc.adds = 0;
  pc.replaces = 0;
  const denied = await enableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
    getUserMedia: async () => {
      const error = new Error("denied");
      error.name = "NotAllowedError";
      throw error;
    },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.action, "failed");
  assert.equal(denied.renegotiate, false);
  assert.equal(denied.iceRestart, false);
  assert.equal(denied.audioPreserved, true);
  assert.equal(audio.readyState, "live");
  assert.equal(audio.enabled, true);
  assert.equal(countVideoTransceivers(pc), 1);
  assert.equal(pc.offers, 0);
  assert.equal(pc.replaces, 0);
  assert.equal(pc.closed, false);

  const recovered = await enableLocalCamera({
    localStream: stream,
    peerConnections: [pc],
    getUserMedia: videoUserMedia,
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.action, "replaced");
  assert.equal(recovered.renegotiate, false);
  assert.equal(recovered.iceRestart, false);
  assert.equal(recovered.track.readyState, "live");
  assert.equal(recovered.track.enabled, true);
  assert.equal(findVideoTransceiver(pc).sender.track, recovered.track);
  assert.equal(countVideoTransceivers(pc), 1);
  assert.equal(pc.adds, 0);
  assert.equal(pc.removes, 0);
  assert.equal(pc.replaces, 1);
  assert.equal(pc.offers, 0);
  assert.equal(pc.iceRestarts, 0);
  assert.equal(pc.connectionState, "connected");
  assert.equal(audio.readyState, "live");
  assert.equal(audio.enabled, true);
});

test("remote video hides while the camera is muted and shows again when it unmutes", () => {
  const track = makeTrack("remote-cam", "video");
  track.muted = false;
  const peer = {
    camera: true,
    mode: "video",
    stream: makeStream([track]),
    streamVersion: 0,
  };
  watchRemoteTrack(track, peer, () => {});
  track.onunmute();
  assert.equal(shouldShowRemoteVideo(peer), true);

  applyRemoteCameraState(peer, cameraPresencePayload(false));
  track.muted = true;
  track.onmute();
  assert.equal(peer.camera, false);
  assert.equal(shouldShowRemoteVideo(peer), false);
  assert.equal(remoteStatusLabel(peer, "avatar"), "Camera off");

  applyRemoteCameraState(peer, cameraPresencePayload(true));
  track.muted = false;
  track.enabled = true;
  track.onunmute();
  assert.equal(peer.camera, true);
  assert.equal(peer.mode, "video");
  assert.equal(shouldShowRemoteVideo(peer), true);
  assert.equal(remoteMediaStatus(peer), "video");
});

test("camera toggle diagnostics keep transport state and drop SDP and addresses", () => {
  const { stream, pc } = audioCall();
  stream.addTrack(makeTrack("cam", "video"));
  stream.getVideoTracks()[0].enabled = false;
  const record = cameraToggleRecord({
    callId: "call-7",
    action: "disabled",
    localStream: stream,
    pc,
    connectionBefore: "connected",
    iceBefore: "connected",
    renegotiation: false,
    iceRestart: false,
  });
  const entry = safeCallDiagnostic({
    ...record,
    sdp: "v=0",
    candidate: "candidate:1 1 udp 203.0.113.8 3478 typ host",
    password: "turn-pass",
    videoReadyState: "live at 198.51.100.20",
  });
  const serialized = JSON.stringify(entry);
  assert.equal(entry.callId, "call-7");
  assert.equal(entry.event, "camera_toggle");
  assert.equal(entry.cameraAction, "disabled");
  assert.equal(entry.videoEnabled, "false");
  assert.equal(entry.audioReadyState, "live");
  assert.equal(entry.audioEnabled, "true");
  assert.equal(entry.videoSender, "no");
  assert.equal(entry.audioSender, "yes");
  assert.equal(entry.connectionBefore, "connected");
  assert.equal(entry.connectionAfter, "connected");
  assert.equal(entry.iceBefore, "connected");
  assert.equal(entry.iceAfter, "connected");
  assert.equal(entry.renegotiation, "no");
  assert.equal(entry.iceRestart, "no");
  assert.equal(entry.sdp, undefined);
  assert.equal(entry.password, undefined);
  assert.equal(entry.videoReadyState, undefined);
  assert.equal(serialized.includes("203.0.113.8"), false);
  assert.equal(serialized.includes("198.51.100.20"), false);
  assert.equal(serialized.includes("candidate:"), false);
  assert.equal(serialized.includes("turn-pass"), false);
  assert.equal(serialized.includes("v=0"), false);
});
