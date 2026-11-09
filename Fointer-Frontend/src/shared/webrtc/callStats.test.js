import assert from "node:assert/strict";
import test from "node:test";
import { remoteMediaStatus, remoteStatusLabel } from "./mediaTile.js";
import { summarizeCallStats, toPublicMediaLog } from "./callStats.js";

const stats = () =>
  new Map([
    [
      "pair",
      {
        id: "pair",
        type: "candidate-pair",
        state: "succeeded",
        selected: true,
        nominated: true,
        localCandidateId: "local",
        remoteCandidateId: "remote",
        currentRoundTripTime: 0.18,
        bytesSent: 10,
        bytesReceived: 12,
      },
    ],
    [
      "local",
      {
        id: "local",
        type: "local-candidate",
        candidateType: "relay",
        protocol: "udp",
        relayProtocol: "tls",
        address: "203.0.113.8",
        port: 54000,
        url: "turns:global.relay.metered.ca:443?transport=tcp",
        usernameFragment: "secret-user",
      },
    ],
    [
      "remote",
      {
        id: "remote",
        type: "remote-candidate",
        candidateType: "relay",
        protocol: "udp",
        address: "198.51.100.20",
        relatedAddress: "192.0.2.10",
      },
    ],
    [
      "audio-in",
      {
        id: "audio-in",
        type: "inbound-rtp",
        kind: "audio",
        packetsReceived: 40,
        bytesReceived: 4000,
        packetsLost: 2,
        jitter: 0.01,
      },
    ],
    [
      "video-in",
      {
        id: "video-in",
        type: "inbound-rtp",
        kind: "video",
        packetsReceived: 0,
        bytesReceived: 0,
        packetsLost: 7,
        jitter: 0.04,
      },
    ],
    [
      "audio-out",
      { id: "audio-out", type: "outbound-rtp", kind: "audio", packetsSent: 12, bytesSent: 900 },
    ],
  ]);

test("audio and video RTP statistics stay independent and omit addresses", () => {
  const summary = summarizeCallStats(stats(), {
    connectionState: "connected",
    iceConnectionState: "connected",
  });
  assert.equal(summary.audio.receiving, true);
  assert.equal(summary.audio.packetsReceived, 40);
  assert.equal(summary.audio.bytesReceived, 4000);
  assert.equal(summary.audio.packetsLost, 2);
  assert.equal(summary.audio.jitter, 0.01);
  assert.equal(summary.audio.sending, true);
  assert.equal(summary.video.receiving, false);
  assert.equal(summary.video.packetsLost, 7);
  assert.equal(summary.video.jitter, 0.04);
  assert.equal(summary.candidate.localType, "relay");
  assert.equal(summary.candidate.remoteType, "relay");
  assert.equal(summary.candidate.protocol, "udp");
  assert.equal(summary.candidate.relayProtocol, "tls");
  assert.equal(summary.candidate.roundTripTime, 0.18);

  const log = JSON.stringify(toPublicMediaLog(summary));
  assert.equal(log.includes("203.0.113.8"), false);
  assert.equal(log.includes("198.51.100.20"), false);
  assert.equal(log.includes("192.0.2.10"), false);
  assert.equal(log.includes("secret-user"), false);
  assert.equal(log.includes("turns:"), false);
  assert.equal(JSON.stringify(summary).includes("203.0.113.8"), false);
});

test("audio can be shown as flowing while video packets have not arrived", () => {
  const summary = summarizeCallStats(stats(), {
    connectionState: "connected",
    iceConnectionState: "connected",
  });
  const peer = {
    mode: "video",
    camera: true,
    connectionState: "connected",
    iceConnectionState: "connected",
    stream: { getVideoTracks: () => [] },
    mediaStats: summary,
  };
  assert.equal(remoteMediaStatus(peer), "audio");
  assert.equal(remoteStatusLabel(peer, "audio"), "Audio");
  assert.notEqual(remoteStatusLabel(peer, "audio"), "Connecting…");
});

test("a connected audio call does not claim audio before inbound RTP", () => {
  const peer = {
    mode: "audio",
    camera: false,
    connectionState: "connected",
    iceConnectionState: "connected",
    stream: { getVideoTracks: () => [] },
    mediaStats: {
      audio: { receiving: false, packetsReceived: 0, bytesReceived: 0 },
      video: { receiving: false },
    },
  };
  assert.equal(remoteMediaStatus(peer), "avatar");
  assert.equal(remoteStatusLabel(peer, "avatar"), "Waiting for audio…");
});
