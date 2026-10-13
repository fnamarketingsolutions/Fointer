import assert from "node:assert/strict";
import test from "node:test";
import { createSocketRateLimit } from "./socketRateLimit.js";

test("a socket can send the allowed burst and is then rejected", () => {
  let now = 1_000;
  const allow = createSocketRateLimit({
    limit: 2,
    windowMs: 10_000,
    now: () => now,
  });
  assert.equal(allow("socket-a:dm"), true);
  assert.equal(allow("socket-a:dm"), true);
  assert.equal(allow("socket-a:dm"), false);
  assert.equal(allow("socket-b:dm"), true);
  now = 11_001;
  assert.equal(allow("socket-a:dm"), true);
});

test("an empty key is rejected", () => {
  const allow = createSocketRateLimit({ limit: 5, windowMs: 1000 });
  assert.equal(allow(""), false);
});
