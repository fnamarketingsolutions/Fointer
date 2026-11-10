import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  maybeRotateIce,
  rtcConfigFromIceResponse,
  scheduleCredentialRotation,
  TurnUnavailableError,
} from "./iceContract.js";

const turnResponse = {
  success: true,
  version: 1,
  issuedAt: "2026-11-10T10:00:00.000Z",
  expiresAt: null,
  refreshAt: "2026-11-10T10:05:00.000Z",
  credentialUpdate: "next-peer-connection",
  restartBefore: null,
  relay: { available: true, required: true },
  fallback: null,
  transportPolicy: "all",
  rtc: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: ["turn:turn.example.com:3478", "turns:turn.example.com:443?transport=tcp"],
        username: "user",
        credential: "pass",
      },
    ],
    bundlePolicy: "max-bundle",
    iceTransportPolicy: "all",
  },
};

test("the web client uses the backend RTC config without adding a relay policy", () => {
  const parsed = rtcConfigFromIceResponse(turnResponse, { production: true });
  assert.deepEqual(parsed.rtc, turnResponse.rtc);
  assert.equal(parsed.rtc.iceTransportPolicy, "all");
  assert.equal(parsed.credentialUpdate, "next-peer-connection");
  assert.equal(parsed.expiresAt, null);
});

test("a relay policy without TURN is rejected", () => {
  const data = {
    ...turnResponse,
    relay: { available: false, required: false },
    rtc: {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      iceTransportPolicy: "relay",
      bundlePolicy: "max-bundle",
    },
  };
  assert.throws(() => rtcConfigFromIceResponse(data), TurnUnavailableError);
});

test("production refuses a STUN-only configuration", () => {
  const data = {
    ...turnResponse,
    relay: { available: false, required: true },
    fallback: "development-stun",
    rtc: {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
    },
  };
  assert.throws(() => rtcConfigFromIceResponse(data, { production: true }), TurnUnavailableError);
  const development = rtcConfigFromIceResponse(data, { production: false });
  assert.equal(development.fallback, "development-stun");
  assert.equal(development.rtc.iceTransportPolicy, "all");
});

test("an expiring credential is applied with setConfiguration and still needs ICE restart", async () => {
  const session = {
    expiresAt: "2026-11-10T10:00:30.000Z",
    credentialUpdate: "renegotiate",
    restartBefore: "2026-11-10T10:00:00.000Z",
  };
  const next = {
    iceServers: [{ urls: "turn:turn.example.com:3478", username: "next", credential: "next" }],
    bundlePolicy: "max-bundle",
    iceTransportPolicy: "all",
  };
  let configured = null;
  const pc = {
    setConfiguration(config) {
      configured = config;
    },
  };
  const result = await maybeRotateIce(
    pc,
    session,
    async () => next,
    Date.parse("2026-11-10T10:00:01.000Z")
  );
  assert.equal(result.action, "restart");
  assert.deepEqual(configured, next);

  const idle = await maybeRotateIce(
    pc,
    { expiresAt: null, credentialUpdate: "next-peer-connection", restartBefore: null },
    async () => next,
    Date.parse("2026-11-10T12:00:00.000Z")
  );
  assert.equal(idle.action, "none");

  const unknownExpiry = await maybeRotateIce(
    pc,
    { expiresAt: null, credentialUpdate: "renegotiate", restartBefore: "2026-11-10T10:00:00.000Z" },
    async () => {
      throw new Error("unknown expiry must not fetch");
    },
    Date.parse("2026-11-10T10:00:01.000Z")
  );
  assert.equal(unknownExpiry.action, "none");
});

const dueSession = {
  expiresAt: "2026-11-10T10:00:30.000Z",
  credentialUpdate: "renegotiate",
  restartBefore: "2026-11-10T10:00:00.000Z",
};

const fakeTimers = () => {
  const active = new Map();
  let seq = 0;
  return {
    active,
    setTimer(fn, ms) {
      const id = ++seq;
      active.set(id, { fn, ms });
      return id;
    },
    clearTimer(id) {
      active.delete(id);
    },
  };
};

test("a healthy call rotates once when restartBefore is reached", async () => {
  const timers = fakeTimers();
  let now = Date.parse("2026-11-10T09:59:00.000Z");
  let session = { ...dueSession };
  const pc = {
    setConfiguration(config) {
      pc.configured = config;
    },
  };
  let restarts = 0;
  const watch = scheduleCredentialRotation({
    getSession: () => session,
    now: () => now,
    ...timers,
    retryDelayMs: 1_000,
    rotate: async () => {
      const result = await maybeRotateIce(pc, session, async () => ({
        iceServers: [{ urls: "turn:turn.example.com:3478", username: "next", credential: "next" }],
        bundlePolicy: "max-bundle",
        iceTransportPolicy: "all",
      }), now);
      if (result.action !== "restart") return "skipped";
      restarts += 1;
      session = {
        expiresAt: "2026-11-10T11:00:30.000Z",
        credentialUpdate: "renegotiate",
        restartBefore: "2026-11-10T11:00:00.000Z",
      };
      return "restarted";
    },
  });
  assert.equal(timers.active.size, 1);
  const first = [...timers.active.values()][0];
  assert.equal(first.ms, 60_000);
  now = Date.parse(dueSession.restartBefore);
  first.fn();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(restarts, 1);
  assert.deepEqual(pc.configured.iceServers[0].username, "next");
  assert.equal(timers.active.size, 1);
  const next = [...timers.active.values()][0];
  assert.equal(next.ms, 60 * 60 * 1000);
  watch.arm();
  watch.arm();
  assert.equal(timers.active.size, 1);
  watch.stop();
  assert.equal(timers.active.size, 0);
});

test("a second rotation is not armed while the first is still running", async () => {
  const timers = fakeTimers();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let started = 0;
  const watch = scheduleCredentialRotation({
    getSession: () => dueSession,
    now: () => Date.parse("2026-11-10T10:00:01.000Z"),
    ...timers,
    rotate: () => {
      started += 1;
      return gate;
    },
  });
  assert.equal(timers.active.size, 1);
  [...timers.active.values()][0].fn();
  await new Promise((resolve) => setTimeout(resolve, 0));
  watch.arm();
  watch.arm();
  assert.equal(started, 1);
  assert.equal(timers.active.size, 0);
  release("restarted");
  await gate;
  assert.equal(started, 1);
  watch.stop();
});

test("a failed credential refresh does not restart forever", async () => {
  const timers = fakeTimers();
  let attempts = 0;
  const watch = scheduleCredentialRotation({
    getSession: () => dueSession,
    now: () => Date.parse("2026-11-10T10:00:01.000Z"),
    ...timers,
    retryDelayMs: 5_000,
    maxRefreshFailures: 2,
    rotate: async () => {
      attempts += 1;
      throw new Error("refresh failed");
    },
  });
  const fire = async () => {
    const pending = [...timers.active.values()];
    assert.equal(pending.length, 1);
    pending[0].fn();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  await fire();
  assert.equal(attempts, 1);
  assert.equal([...timers.active.values()][0].ms, 5_000);
  await fire();
  assert.equal(attempts, 2);
  assert.equal(timers.active.size, 0);
  watch.stop();
});

test("unknown expiry and next-peer-connection do not schedule rotation", () => {
  const timers = fakeTimers();
  const unknown = scheduleCredentialRotation({
    getSession: () => ({ expiresAt: null, credentialUpdate: "next-peer-connection", restartBefore: null }),
    ...timers,
    rotate: async () => {
      throw new Error("must not rotate");
    },
  });
  const mismatched = scheduleCredentialRotation({
    getSession: () => ({
      expiresAt: null,
      credentialUpdate: "renegotiate",
      restartBefore: "2026-11-10T10:00:00.000Z",
    }),
    ...timers,
    rotate: async () => {
      throw new Error("must not rotate");
    },
  });
  assert.equal(timers.active.size, 0);
  unknown.stop();
  mismatched.stop();
});

test("the ICE loader does not embed provider policy or demo credentials", () => {
  const source = readFileSync(new URL("./iceServers.js", import.meta.url), "utf8");
  assert.equal(source.includes("metered"), false);
  assert.equal(source.includes("openrelay"), false);
  assert.equal(source.includes("iceTransportPolicy"), false);
  assert.equal(source.includes("localStorage"), false);
  assert.equal(source.includes("expiresAt"), false);
  assert.equal(source.includes("stun.l.google.com"), false);
});
