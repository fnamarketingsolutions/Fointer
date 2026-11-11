import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { configureCallDiagnostics, flushCallDiagnostics, resetCallDiagnosticsForTests } from "./callDiagnostics.js";
import {
  claimIceCall,
  getIceConfig,
  getIceSession,
  resetIceSessionsForTests,
  setIceTransportForTests,
} from "./iceServers.js";

const posts = [];

const iceBody = (username, providerCache = "hit") => ({
  success: true,
  version: 1,
  issuedAt: "2026-11-10T10:00:00.000Z",
  expiresAt: null,
  refreshAt: "2099-11-10T10:05:00.000Z",
  credentialUpdate: "next-peer-connection",
  restartBefore: null,
  relay: { available: true, required: false },
  fallback: null,
  providerCache,
  rtc: {
    iceServers: [
      { urls: "turn:turn.example.com:3478", username, credential: "pass" },
    ],
    bundlePolicy: "max-bundle",
    iceTransportPolicy: "all",
  },
});

const settle = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};

const usernameOf = (value) => (value?.rtc || value).iceServers[0].username;

const reset = () => {
  posts.length = 0;
  resetIceSessionsForTests();
  resetCallDiagnosticsForTests();
  configureCallDiagnostics({
    maxBatch: 20,
    flushMs: 60_000,
    timeoutMs: 60_000,
    post: async (payload) => {
      posts.push(payload);
    },
  });
};

test.beforeEach(() => {
  reset();
});

test.afterEach(() => {
  reset();
});

test("a new call always asks the backend and a later call does not reuse that configuration", async () => {
  const seen = [];
  setIceTransportForTests({
    get: (_url, config) => {
      seen.push(config?.params?.fresh || "");
      const username = seen.length === 1 ? "outgoing-user" : "second-user";
      return Promise.resolve({ status: 200, data: iceBody(username) });
    },
  });
  const firstToken = claimIceCall();
  const first = await getIceConfig({
    callKey: "direct:conv:1",
    token: firstToken,
    callType: "direct",
    direction: "outgoing",
  });
  const secondToken = claimIceCall();
  const second = await getIceConfig({
    callKey: "direct:conv:2",
    token: secondToken,
    callType: "direct",
    direction: "outgoing",
  });
  assert.equal(seen.length, 2);
  assert.deepEqual(seen, ["", ""]);
  assert.equal(usernameOf(first), "outgoing-user");
  assert.equal(usernameOf(second), "second-user");
  assert.notEqual(usernameOf(getIceSession()), usernameOf(first));
});

test("the same call shares one request and a different call id does not", async () => {
  const gates = [];
  const names = ["shared-user", "other-user"];
  setIceTransportForTests({
    get: () => new Promise((resolve) => {
      gates.push(resolve);
    }),
  });
  const token = claimIceCall();
  const left = getIceConfig({ callKey: "direct:same", token, callType: "direct", direction: "incoming" });
  const right = getIceConfig({ callKey: "direct:same", token, callType: "direct", direction: "incoming" });
  const otherToken = claimIceCall();
  const other = getIceConfig({ callKey: "event:live:1", token: otherToken, callType: "event", direction: "join" });
  await settle();
  assert.equal(gates.length, 2);
  gates[0]({ status: 200, data: iceBody(names[0]) });
  gates[1]({ status: 200, data: iceBody(names[1], "generated") });
  const [leftRtc, rightRtc, otherRtc] = await Promise.all([left, right, other]);
  assert.equal(usernameOf(leftRtc), usernameOf(rightRtc));
  assert.equal(usernameOf(otherRtc), "other-user");
  assert.equal(JSON.stringify(leftRtc).includes("other-user"), false);
  assert.equal(JSON.stringify(otherRtc).includes("shared-user"), false);
  const again = await getIceConfig({ callKey: "direct:same", token, callType: "direct", direction: "incoming" });
  assert.equal(gates.length, 2);
  assert.equal(usernameOf(again), "shared-user");
});

test("a failed request is forgotten and the next attempt can succeed", async () => {
  let fail = true;
  let calls = 0;
  setIceTransportForTests({
    get: () => {
      calls += 1;
      if (fail) {
        const error = new Error("down");
        error.response = { status: 503 };
        return Promise.reject(error);
      }
      return Promise.resolve({ status: 200, data: iceBody("retry-user", "generated") });
    },
  });
  const token = claimIceCall();
  await assert.rejects(
    () => getIceConfig({ callKey: "direct:retry", token, callType: "direct", direction: "incoming" }),
    (error) => error?.name === "TurnUnavailableError"
  );
  fail = false;
  const rtc = await getIceConfig({ callKey: "direct:retry", token, callType: "direct", direction: "incoming" });
  assert.equal(calls, 2);
  assert.equal(usernameOf(rtc), "retry-user");
  assert.equal(usernameOf(getIceSession("direct:retry")), "retry-user");
});

test("an older response cannot replace the newer call configuration", async () => {
  const gates = [];
  setIceTransportForTests({
    get: () => new Promise((resolve) => {
      gates.push(resolve);
    }),
  });
  const olderToken = claimIceCall();
  const older = getIceConfig({ callKey: "call-old", token: olderToken, callType: "direct", direction: "outgoing" });
  const newerToken = claimIceCall();
  const newer = getIceConfig({ callKey: "call-new", token: newerToken, callType: "direct", direction: "outgoing" });
  await settle();
  gates[1]({ status: 200, data: iceBody("newer-user") });
  const newerRtc = await newer;
  gates[0]({ status: 200, data: iceBody("older-user") });
  const olderRtc = await older;
  assert.equal(usernameOf(olderRtc), "older-user");
  assert.equal(usernameOf(newerRtc), "newer-user");
  assert.equal(usernameOf(getIceSession()), "newer-user");
  assert.equal(usernameOf(getIceSession("call-new")), "newer-user");
  assert.equal(JSON.stringify(getIceSession("call-new")).includes("older-user"), false);
});

test("credential rotation is the only request that bypasses the backend cache", async () => {
  const params = [];
  setIceTransportForTests({
    get: (_url, config) => {
      params.push(config?.params);
      return Promise.resolve({ status: 200, data: iceBody("rotate-user", params.length === 1 ? "hit" : "generated") });
    },
  });
  const token = claimIceCall();
  await getIceConfig({ callKey: "direct:rotate", token, callType: "direct", direction: "outgoing" });
  await getIceConfig({
    force: true,
    callKey: "direct:rotate",
    token,
    callType: "direct",
    direction: "outgoing",
  });
  assert.equal(params[0], undefined);
  assert.equal(params[1].fresh, "1");
});

test("ICE lifecycle traces share a request id and do not include secrets", async () => {
  setIceTransportForTests({
    get: () => Promise.resolve({ status: 200, data: iceBody("trace-user", "hit") }),
  });
  const token = claimIceCall();
  await getIceConfig({ callKey: "direct:trace", token, callType: "direct", direction: "outgoing" });
  await flushCallDiagnostics();
  const events = posts.flatMap((batch) => batch.events);
  const started = events.find((entry) => entry.event === "fetch_started");
  const success = events.find((entry) => entry.event === "fetch_success");
  assert.ok(started);
  assert.equal(success.requestId, started.requestId);
  assert.equal(success.cacheStatus, "provider_hit");
  assert.equal(success.callType, "direct");
  assert.equal(success.direction, "outgoing");
  assert.equal(success.httpStatus, 200);
  assert.equal(typeof success.duration, "number");
  const serialized = JSON.stringify(posts);
  assert.equal(serialized.includes("trace-user"), false);
  assert.equal(serialized.includes("turn:"), false);
  assert.equal(events.some((entry) => "credential" in entry || "username" in entry), false);
});

test("a hanging diagnostics post does not block ICE setup", async () => {
  configureCallDiagnostics({
    maxBatch: 1,
    timeoutMs: 30_000,
    post: () => new Promise(() => {}),
  });
  setIceTransportForTests({
    get: () => Promise.resolve({ status: 200, data: iceBody("fast-user") }),
  });
  const token = claimIceCall();
  const rtc = await getIceConfig({ callKey: "direct:fast", token, callType: "direct", direction: "outgoing" });
  assert.equal(usernameOf(rtc), "fast-user");
});

test("direct and event call setup requests a fresh configuration for each new attempt", () => {
  const direct = readFileSync(new URL("../../features/messages/components/DirectCall.jsx", import.meta.url), "utf8");
  const eventCall = readFileSync(new URL("../../features/communities/pages/dashboard/EventCall.jsx", import.meta.url), "utf8");
  const start = direct.slice(direct.indexOf("const start ="), direct.indexOf("const acceptIncoming"));
  const accept = direct.slice(direct.indexOf("const acceptIncoming"), direct.indexOf("useImperativeHandle("));
  const join = eventCall.slice(eventCall.indexOf("const joinCall"), eventCall.indexOf("const toggleMic"));
  assert.equal(start.includes('loadIceForCall({ fresh: true, direction: "outgoing" })'), true);
  assert.equal(start.indexOf("loadIceForCall") < start.indexOf("acquireMedia"), true);
  assert.equal(accept.includes('loadIceForCall({ fresh: true, direction: "incoming" })'), true);
  assert.equal(accept.indexOf("loadIceForCall") < accept.indexOf("acquireMedia"), true);
  assert.equal(join.includes("loadIceForCall({ fresh: true })"), true);
  assert.equal(join.indexOf("loadIceForCall") < join.indexOf("getUserMedia"), true);
  assert.equal(direct.includes("flushCallDiagnostics"), true);
  assert.equal(eventCall.includes("flushCallDiagnostics"), true);
  assert.equal(direct.includes('from "../../../shared/webrtc/callDiagnostics"'), true);
  assert.equal(eventCall.includes('from "../../../../shared/webrtc/callDiagnostics"'), true);
  assert.equal(direct.includes("new RTCPeerConnection"), true);
  assert.equal(eventCall.includes("new RTCPeerConnection"), true);
});
