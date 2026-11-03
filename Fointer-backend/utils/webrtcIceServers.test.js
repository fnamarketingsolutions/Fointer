import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  createTimeLimitedTurnServer,
  normalizeTurnServers,
} from "./webrtcIceServers.js";

test("TURN REST credentials are user-scoped and expire at the configured time", () => {
  const nowMs = 1_700_000_000_000;
  const result = createTimeLimitedTurnServer({
    urls: "turn:turn.example.com:3478,turns:turn.example.com:443?transport=tcp",
    sharedSecret: "test-secret",
    userId: "user-123",
    nowMs,
    ttlSeconds: 1800,
  });
  const expectedUsername = `${Math.floor(nowMs / 1000) + 1800}:user-123`;
  const expectedCredential = createHmac("sha1", "test-secret")
    .update(expectedUsername)
    .digest("base64");

  assert.deepEqual(result.iceServer.urls, [
    "turn:turn.example.com:3478",
    "turns:turn.example.com:443?transport=tcp",
  ]);
  assert.equal(result.iceServer.username, expectedUsername);
  assert.equal(result.iceServer.credential, expectedCredential);
  assert.equal(result.expiresAt, (Math.floor(nowMs / 1000) + 1800) * 1000);
});

test("TURN provider responses discard STUN-only and incomplete entries", () => {
  assert.deepEqual(
    normalizeTurnServers([
      { urls: "stun:stun.example.com:3478" },
      { urls: "turn:turn.example.com:3478", username: "u" },
      {
        urls: ["stun:stun.example.com:3478", "turns:turn.example.com:443"],
        username: "u",
        credential: "p",
      },
    ]),
    [{
      urls: "turns:turn.example.com:443",
      username: "u",
      credential: "p",
    }]
  );
});