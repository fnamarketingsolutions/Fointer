import assert from "node:assert/strict";
import test from "node:test";
import {
  callLinkFailureMessage,
  callLinkLabel,
  deriveCallLink,
} from "./callLink.js";

test("accepting a call does not mark media as connected", () => {
  const status = deriveCallLink({
    phase: "active",
    peers: [{ connectionState: "new", iceConnectionState: "new", isLocal: false }],
  });
  assert.equal(status, "connecting");
  assert.equal(callLinkLabel(status), "Connecting…");
  assert.notEqual(callLinkLabel(status), "Connected");
});

test("an established ICE connection updates the call label", () => {
  const status = deriveCallLink({
    phase: "active",
    peers: [{ connectionState: "connected", iceConnectionState: "connected", isLocal: false }],
  });
  assert.equal(status, "connected");
  assert.equal(callLinkLabel(status), "Connected");
});

test("a failed ICE connection shows a failure instead of a connected call", () => {
  const status = deriveCallLink({
    phase: "active",
    peers: [{ connectionState: "failed", iceConnectionState: "failed", isLocal: false }],
  });
  assert.equal(status, "failed");
  assert.equal(callLinkLabel(status), "Failed");
  assert.match(callLinkFailureMessage(status), /could not connect/i);
});

test("disconnected before the first connection stays on Connecting", () => {
  const peer = {
    connectionState: "disconnected",
    iceConnectionState: "disconnected",
    networkStatus: "connecting",
    isLocal: false,
  };
  assert.equal(deriveCallLink({ phase: "active", peers: [peer] }), "connecting");
  assert.equal(callLinkLabel("connecting"), "Connecting…");
});

test("disconnected after a connection shows Reconnecting", () => {
  const peer = {
    connectionState: "disconnected",
    iceConnectionState: "disconnected",
    networkStatus: "reconnecting",
    everConnected: true,
    isLocal: false,
  };
  assert.equal(deriveCallLink({ phase: "active", peers: [peer] }), "reconnecting");
});

test("a one-way peer connection can be established before inbound media arrives", () => {
  const status = deriveCallLink({
    phase: "active",
    peers: [
      {
        connectionState: "connected",
        iceConnectionState: "completed",
        mediaStats: { audio: { receiving: false }, video: { receiving: false } },
      },
    ],
  });
  assert.equal(status, "connected");
});
