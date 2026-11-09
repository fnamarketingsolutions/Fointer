import assert from "node:assert/strict";
import test from "node:test";
import { getIceServers } from "./webrtc.controller.js";

const TURN_ENV_KEYS = [
  "METERED_DOMAIN",
  "METERED_API_KEY",
  "TURN_URL",
  "TURN_SHARED_SECRET",
  "TURN_USERNAME",
  "TURN_CREDENTIAL",
];

const withClearedTurnEnv = async (run) => {
  const saved = Object.fromEntries(TURN_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of TURN_ENV_KEYS) delete process.env[key];
  try {
    await run();
  } finally {
    for (const key of TURN_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
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

test("ICE setup reports relay unavailable when no TURN provider is configured", async () => {
  await withClearedTurnEnv(async () => {
    const response = mockResponse();
    await getIceServers({ user: { _id: "user-1" } }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, "TURN_NOT_CONFIGURED");
    assert.equal(response.body.success, false);
  });
});
