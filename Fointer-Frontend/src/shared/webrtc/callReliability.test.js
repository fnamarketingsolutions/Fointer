import assert from "node:assert/strict";
import test from "node:test";
import { hasProfilePhoto, mergeCallTiles, remoteMediaStatus, remoteStatusLabel, shouldShowRemoteVideo } from "./mediaTile.js";
import { expectedMeshConnections, planMeshOffers } from "./meshPlan.js";
import { shouldApplyEnd, shouldIgnoreSignal, shouldStartRing, showVideoJoinControl } from "./callSession.js";
import { addRemoteTracks } from "./remoteTracks.js";

const videoPeer = (overrides = {}) => ({
  mode: "video",
  camera: true,
  stream: {
    getVideoTracks: () => [{ readyState: "live", enabled: true }],
  },
  ...overrides,
});

test("profile photo is used only for a real url", () => {
  assert.equal(hasProfilePhoto(""), false);
  assert.equal(hasProfilePhoto("null"), false);
  assert.equal(hasProfilePhoto("https://cdn.example/a.jpg"), true);
});

test("avatar stays until a live video track exists, then returns when the camera turns off", () => {
  assert.equal(remoteMediaStatus(videoPeer({ stream: { getVideoTracks: () => [] } })), "connecting");
  assert.equal(shouldShowRemoteVideo(videoPeer()), true);
  const cameraOff = videoPeer({
    camera: false,
    stream: { getVideoTracks: () => [{ readyState: "live", enabled: false }] },
  });
  assert.equal(shouldShowRemoteVideo(cameraOff), false);
  assert.equal(remoteMediaStatus(cameraOff), "avatar");
  assert.equal(remoteMediaStatus(videoPeer({ mode: "audio", camera: false, stream: { getVideoTracks: () => [] } })), "avatar");
  assert.equal(shouldShowRemoteVideo(videoPeer({ mode: "audio", camera: true })), true);
  assert.equal(shouldShowRemoteVideo(videoPeer({ mode: "audio", camera: false })), false);
  assert.equal(remoteMediaStatus(videoPeer({ mode: "audio", camera: false })), "avatar");
  assert.equal(remoteStatusLabel(videoPeer({ mode: "audio", camera: false }), "avatar"), "Camera off");
  assert.equal(
    remoteStatusLabel(
      videoPeer({ mode: "audio", camera: false, stream: { getVideoTracks: () => [] } }),
      "avatar"
    ),
    "Audio"
  );
});

test("four callers keep their own names and video, including a socket-only peer", () => {
  const local = { socketId: "me", name: "You", isLocal: true };
  const roster = [
    { socketId: "me", name: "You", mode: "video", camera: true },
    { socketId: "s2", name: "Afzal", mode: "video", camera: true, avatar: "https://cdn.example/a.jpg" },
    { socketId: "s3", name: "Fundzz", mode: "video", camera: true },
    { socketId: "s4", name: "West", mode: "video", camera: true },
  ];
  const video = { getVideoTracks: () => [{ readyState: "live", enabled: true }] };
  const peers = [
    { socketId: "s2", name: "Member", mode: "audio", camera: false, stream: video, streamVersion: 2 },
    { socketId: "s3", name: "Member", mode: "audio", camera: false },
  ];
  const tiles = mergeCallTiles({ local, roster, peers });
  assert.equal(tiles.length, 4);
  assert.deepEqual(
    tiles.map((tile) => tile.name),
    ["You", "Afzal", "Fundzz", "West"]
  );
  assert.equal(tiles[1].stream, video);
  assert.equal(tiles[1].mode, "video");
  assert.equal(shouldShowRemoteVideo(tiles[1]), true);
  assert.equal(remoteMediaStatus(tiles[2]), "connecting");
});

test("a track without event.streams is attached and an ended track of the same kind is replaced", () => {
  const tracks = [{ id: "old", kind: "video", readyState: "ended" }];
  const stream = {
    getTracks: () => tracks.slice(),
    addTrack: (track) => tracks.push(track),
    removeTrack: (track) => {
      const index = tracks.indexOf(track);
      if (index >= 0) tracks.splice(index, 1);
    },
  };
  addRemoteTracks(stream, { track: { id: "new", kind: "video" }, streams: [] });
  assert.deepEqual(tracks.map((track) => track.id), ["new"]);
});

test("a cancelled call does not ring again, and an older end does not stop a newer call", () => {
  const retired = new Set(["call-a"]);
  assert.equal(
    shouldStartRing({
      phase: "idle",
      call: { status: "ringing", callId: "call-a", selfInCall: false },
      retired,
    }),
    false
  );
  assert.equal(
    shouldStartRing({
      phase: "idle",
      call: null,
      retired,
    }),
    false
  );
  assert.equal(
    shouldStartRing({
      phase: "idle",
      call: { status: "ringing", callId: "call-b", selfInCall: false },
      retired,
    }),
    true
  );
  assert.equal(
    shouldApplyEnd({ activeCallId: "call-b", endedCallId: "call-a", phase: "ringing_in" }),
    false
  );
  assert.equal(
    shouldApplyEnd({ activeCallId: "call-b", endedCallId: "call-b", phase: "ringing_in" }),
    true
  );
  assert.equal(
    shouldIgnoreSignal({ activeCallId: "call-b", signalCallId: "call-a" }),
    true
  );
});

test("video join is available only for an authorized viewer who is not already in the call", () => {
  assert.equal(showVideoJoinControl({ isLive: true, inCall: false, authorized: true }), true);
  assert.equal(showVideoJoinControl({ isLive: true, inCall: true, authorized: true }), false);
  assert.equal(showVideoJoinControl({ isLive: false, inCall: false, authorized: true }), false);
  assert.equal(showVideoJoinControl({ isLive: true, inCall: false, authorized: false }), false);
});

test("four participants produce six unique mesh connections", () => {
  const ids = ["s1", "s2", "s3", "s4"];
  const pairs = [];
  for (const localId of ids) {
    const roster = ids.map((socketId) => ({ socketId }));
    const offers = planMeshOffers(localId, roster, new Set());
    for (const peer of offers) pairs.push([localId, peer.socketId].sort().join(":"));
  }
  assert.equal(expectedMeshConnections(4), 6);
  assert.equal(pairs.length, 6);
  assert.equal(new Set(pairs).size, 6);
  const again = planMeshOffers(
    "s4",
    [{ socketId: "s2" }, { socketId: "s1" }, { socketId: "s3" }],
    new Set(["s1"])
  );
  assert.deepEqual(
    again.map((peer) => peer.socketId),
    ["s2", "s3"]
  );
});
