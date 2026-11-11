import assert from "node:assert/strict";
import test from "node:test";
import {
  configureCallDiagnostics,
  flushCallDiagnostics,
  logCallDiagnostic,
  pendingDiagnosticCount,
  publishCallDiagnostic,
  reportIceCandidateError,
  resetCallDiagnosticsForTests,
  safeCallDiagnostic,
} from "./callDiagnostics.js";

const timers = [];
const posts = [];

const install = (options = {}) => {
  timers.length = 0;
  posts.length = 0;
  resetCallDiagnosticsForTests();
  configureCallDiagnostics({
    maxQueue: 6,
    maxBatch: 3,
    flushMs: 1_000,
    retryMs: 25,
    maxAttempts: 3,
    timeoutMs: 5_000,
    post: async (payload) => {
      posts.push(payload);
    },
    schedule: (fn, ms) => {
      const id = { fn, ms };
      timers.push(id);
      return id;
    },
    clearSchedule: (id) => {
      const index = timers.indexOf(id);
      if (index >= 0) timers.splice(index, 1);
    },
    ...options,
  });
};

test.afterEach(() => {
  resetCallDiagnosticsForTests();
});

test("multiple events are sent as one batch on the interval", async () => {
  install({ maxBatch: 10 });
  logCallDiagnostic({ callId: "direct-1", phase: "active", connectionState: "connecting", iceConnectionState: "checking" });
  logCallDiagnostic({ callId: "event-9", phase: "active", connectionState: "connected", iceConnectionState: "connected" });
  assert.equal(posts.length, 0);
  assert.equal(timers.filter((timer) => timer.ms === 1_000).length, 1);
  timers.find((timer) => timer.ms === 1_000).fn();
  await flushCallDiagnostics();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].events.length, 2);
  assert.equal(posts[0].events.some((entry) => entry.callId === "direct-1"), true);
  assert.equal(posts[0].events.some((entry) => entry.callId === "event-9"), true);
  assert.match(posts[0].batchId, /^[A-Za-z0-9_-]{8,64}$/);
});

test("the batch stops at the configured size and a second flush sends the rest", async () => {
  install({ maxBatch: 2, maxQueue: 10 });
  logCallDiagnostic({ callId: "c", phase: "a", connectionState: "new" });
  logCallDiagnostic({ callId: "c", phase: "b", connectionState: "connecting" });
  logCallDiagnostic({ callId: "c", phase: "c", connectionState: "connected" });
  await flushCallDiagnostics();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].events.length, 2);
  timers.find((timer) => timer.ms === 1_000).fn();
  await flushCallDiagnostics();
  assert.equal(posts.length, 2);
  assert.equal(posts[1].events.length, 1);
});

test("duplicate candidate errors collapse and distinct errors stay", async () => {
  install({ maxBatch: 10 });
  reportIceCandidateError({ errorCode: 701, errorText: "relay refused", url: "turn:relay.example.com:443" }, { callId: "call-1" });
  reportIceCandidateError({ errorCode: 701, errorText: "relay refused", url: "turn:relay.example.com:443" }, { callId: "call-1" });
  reportIceCandidateError({ errorCode: 401, errorText: "unauthorized", url: "turn:relay.example.com:443" }, { callId: "call-1" });
  timers.find((timer) => timer.ms === 1_000).fn();
  await flushCallDiagnostics();
  const errors = posts[0].events.filter((entry) => entry.event === "ice_candidate_error");
  assert.equal(errors.length, 2);
  assert.equal(errors.some((entry) => entry.errorCode === 701), true);
  assert.equal(errors.some((entry) => entry.errorCode === 401), true);
});

test("a full queue keeps a critical failure and counts the dropped event", async () => {
  install({ maxQueue: 2, maxBatch: 10 });
  logCallDiagnostic({ callId: "c", phase: "one", connectionState: "new" });
  logCallDiagnostic({ callId: "c", phase: "two", connectionState: "connecting" });
  logCallDiagnostic({ callId: "c", phase: "three", connectionState: "disconnected", iceConnectionState: "failed" });
  await flushCallDiagnostics();
  const events = posts[0].events;
  assert.equal(events.some((entry) => entry.iceConnectionState === "failed"), true);
  assert.equal(posts[0].dropped >= 1, true);
  assert.equal(pendingDiagnosticCount() <= 2, true);
});

test("a failed batch is retried a limited number of times and then dropped", async () => {
  let attempts = 0;
  install({
    maxBatch: 10,
    post: async () => {
      attempts += 1;
      throw new Error("diagnostics down");
    },
  });
  logCallDiagnostic({ callId: "c", connectionState: "failed", iceConnectionState: "failed" });
  await flushCallDiagnostics();
  assert.equal(attempts, 1);
  const fireRetry = async () => {
    const retry = timers.find((timer) => timer.ms === 25);
    assert.ok(retry, "retry timer");
    timers.splice(timers.indexOf(retry), 1);
    retry.fn();
    await flushCallDiagnostics();
  };
  await fireRetry();
  await fireRetry();
  assert.equal(attempts, 3);
  assert.equal(timers.some((timer) => timer.ms === 25), false);
  logCallDiagnostic({ callId: "later", connectionState: "failed", iceConnectionState: "disconnected" });
  await flushCallDiagnostics();
  assert.equal(attempts, 4);
});

test("a flush returns on its timeout while delivery is still hanging", async () => {
  resetCallDiagnosticsForTests();
  configureCallDiagnostics({
    maxBatch: 1,
    timeoutMs: 30,
    post: () => new Promise(() => {}),
  });
  publishCallDiagnostic({ callId: "c", event: "fetch_failed", failureCategory: "request_failed" });
  const started = Date.now();
  const result = await flushCallDiagnostics({ timeoutMs: 40 });
  assert.equal(Date.now() - started < 300, true);
  assert.equal(result.timedOut || result.sent === false || result.sent === true, true);
});

test("an in-flight batch is not submitted twice", async () => {
  let release;
  let calls = 0;
  install({
    maxBatch: 1,
    post: () => {
      calls += 1;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  publishCallDiagnostic({ callId: "c", event: "fetch_failed", failureCategory: "turn_unavailable" });
  const first = flushCallDiagnostics();
  const second = flushCallDiagnostics();
  assert.equal(calls, 1);
  release();
  await first;
  await second;
  assert.equal(calls, 1);
});

test("queued diagnostics omit credentials, SDP, candidates, and addresses", async () => {
  install({ maxBatch: 10 });
  publishCallDiagnostic({
    callId: "call-1",
    phase: "active",
    event: "fetch_failed",
    failureCategory: "request_failed",
    username: "turn-user",
    credential: "turn-pass",
    password: "turn-pass",
    apiKey: "mk_live_secret",
    token: "jwt-token",
    cookie: "sid=abc",
    authorization: "Bearer secret",
    sdp: "v=0\r\na=ice-ufrag:abc",
    candidate: "candidate:1 1 udp 203.0.113.8 3478 typ host",
    address: "192.168.1.20",
    errorText: "check 8.8.8.8 and 2001:db8::10",
  });
  const entry = safeCallDiagnostic({
    phase: "host 10.1.1.1",
    callId: "token-call",
    connectionState: "connected",
  });
  assert.equal(entry.phase, undefined);
  assert.equal(entry.callId, undefined);
  timers.find((timer) => timer.ms === 1_000)?.fn();
  await flushCallDiagnostics();
  const serialized = JSON.stringify(posts);
  for (const secret of [
    "turn-user",
    "turn-pass",
    "mk_live_secret",
    "jwt-token",
    "sid=abc",
    "Bearer",
    "v=0",
    "candidate:",
    "203.0.113.8",
    "192.168.1.20",
    "8.8.8.8",
    "2001:db8::10",
    "10.1.1.1",
  ]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  assert.equal(serialized.includes("fetch_failed"), true);
});
