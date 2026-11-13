import assert from "node:assert/strict";
import test from "node:test";
import { getIceServers, postCallDiagnostic } from "./webrtc.controller.js";
import { clearIceConfigCache } from "../services/webrtc/iceConfig.service.js";

const TURN_ENV_KEYS = [
  "METERED_DOMAIN",
  "METERED_API_KEY",
  "METERED_SECRET_KEY",
  "TURN_URL",
  "TURN_SHARED_SECRET",
  "TURN_USERNAME",
  "TURN_CREDENTIAL",
  "NODE_ENV",
  "ICE_RELAY_ONLY",
  "ICE_ALLOW_STUN_FALLBACK",
  "ICE_REQUIRE_TURN",
  "WEBRTC_TURN_PROVIDER",
  "CLOUDFLARE_TURN_KEY_ID",
  "CLOUDFLARE_TURN_API_TOKEN",
  "CLOUDFLARE_TURN_TTL",
];

const withTurnEnv = async (values, run) => {
  const saved = Object.fromEntries(TURN_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of TURN_ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  clearIceConfigCache();
  try {
    await run();
  } finally {
    for (const key of TURN_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    clearIceConfigCache();
  }
};

const mockResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    set() {
      return response;
    },
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(body) {
      response.body = body;
      return response;
    },
  };
  return response;
};

test("production cloudflare selection fails closed when the provider is not configured", async () => {
  await withTurnEnv({ NODE_ENV: "production", WEBRTC_TURN_PROVIDER: "cloudflare" }, async () => {
    const response = mockResponse();
    await getIceServers({ user: { _id: "user-1" }, query: {} }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, "TURN_NOT_CONFIGURED");
    assert.equal(response.body.success, false);
    assert.equal(JSON.stringify(response.body).includes("iceServers"), false);
  });
});

test("production ICE setup fails closed when no TURN provider is configured", async () => {
  await withTurnEnv({ NODE_ENV: "production" }, async () => {
    const response = mockResponse();
    await getIceServers({ user: { _id: "user-1" }, query: {} }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, "TURN_NOT_CONFIGURED");
    assert.equal(response.body.success, false);
  });
});

test("development can return STUN without calling it a relay", async () => {
  await withTurnEnv({ NODE_ENV: "development", ICE_RELAY_ONLY: "1" }, async () => {
    const response = mockResponse();
    await getIceServers({ user: { _id: "user-1" }, query: { relayTest: "1" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.fallback, "development-stun");
    assert.equal(response.body.relay.available, false);
    assert.equal(response.body.transportPolicy, "all");
  });
});

test("static TURN stays relay-capable and production ignores relay-only testing", async () => {
  await withTurnEnv({
    NODE_ENV: "production",
    ICE_RELAY_ONLY: "1",
    TURN_URL: "turn:turn.example.com:3478,turns:turn.example.com:443?transport=tcp",
    TURN_USERNAME: "static-user",
    TURN_CREDENTIAL: "static-pass",
  }, async () => {
    const response = mockResponse();
    await getIceServers({ user: { _id: "user-1" }, query: { relayTest: "1" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.relay.available, true);
    assert.equal(response.body.expiresAt, null);
    assert.equal(response.body.credentialUpdate, "next-peer-connection");
    assert.equal(response.body.transportPolicy, "all");
    assert.equal(response.body.version, 1);
  });
});

test("diagnostics drop credentials before they are recorded", async () => {
  const response = mockResponse();
  const lines = [];
  const original = console.info;
  console.info = (line) => lines.push(String(line));
  try {
    postCallDiagnostic({
      body: {
        callId: "call-1",
        event: "ice_candidate_error",
        errorCode: 400,
        errorText: "allocation failed at 10.1.1.1 and 2001:db8::5",
        url: "stun:stun.l.google.com:19302",
        username: "turn-user",
        credential: "secret",
        address: "10.1.1.1",
      },
    }, response);
  } finally {
    console.info = original;
  }
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  const logged = lines.join("\n");
  assert.equal(logged.includes("secret"), false);
  assert.equal(logged.includes("turn-user"), false);
  assert.equal(logged.includes("10.1.1.1"), false);
  assert.equal(logged.includes("2001:db8::5"), false);
  assert.equal(logged.includes("allocation failed"), true);
  assert.equal(logged.includes("stun:stun.l.google.com"), true);
});

test("a diagnostics batch keeps every safe event and drops secrets", async () => {
  const response = mockResponse();
  const lines = [];
  const original = console.info;
  console.info = (line) => lines.push(String(line));
  try {
    postCallDiagnostic({
      body: {
        batchId: "batch_ice_1001",
        dropped: 2,
        events: [
          {
            callId: "call-a",
            event: "fetch_success",
            requestId: "ice1ab12",
            callType: "direct",
            direction: "outgoing",
            cacheStatus: "provider_hit",
            httpStatus: 200,
            duration: 12,
            serverCount: 2,
          },
          {
            callId: "call-b",
            event: "ice_candidate_error",
            errorCode: 701,
            errorText: "failed at 8.8.8.8 and 2001:db8::9",
            url: "turn:user:pass@10.0.0.8:3478",
            username: "turn-user",
            credential: "turn-pass",
            apiKey: "mk_live_secret",
            token: "jwt-token",
            cookie: "session=abc",
            sdp: "v=0",
            candidate: "candidate:1 1 udp 198.51.100.8 3478 typ host",
          },
        ],
      },
    }, response);
  } finally {
    console.info = original;
  }
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.accepted, 2);
  const logged = lines.join("\n");
  assert.equal(logged.includes("provider_hit"), true);
  assert.equal(logged.includes("call-b"), true);
  for (const secret of ["8.8.8.8", "2001:db8::9", "10.0.0.8", "turn-user", "turn-pass", "mk_live_secret", "jwt-token", "session=abc", "v=0", "candidate:", "198.51.100.8"]) {
    assert.equal(logged.includes(secret), false, secret);
  }

  const duplicate = mockResponse();
  postCallDiagnostic({
    body: {
      batchId: "batch_ice_1001",
      events: [{ callId: "call-a", event: "fetch_success" }],
    },
  }, duplicate);
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.body.duplicate, true);
});
