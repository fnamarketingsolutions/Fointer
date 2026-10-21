import assert from "node:assert/strict";
import test from "node:test";
import { createSignalBuffer } from "./callSignalBuffer.js";

test("an early offer is kept until the other person joins, then released once", () => {
  const buffer = createSignalBuffer();
  const now = 1_000_000;
  assert.equal(
    buffer.push("room", { to: "callee", from: "caller", type: "offer", callId: "c1" }, now),
    true
  );
  assert.deepEqual(
    buffer.takeReady("room", () => false, now + 1000),
    []
  );
  const ready = buffer.takeReady("room", (item) => item.to === "callee", now + 1000);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].type, "offer");
  assert.deepEqual(buffer.takeReady("room", () => true, now + 1000), []);
});

test("a signal older than 15 seconds is dropped", () => {
  const buffer = createSignalBuffer();
  buffer.push("room", { to: "callee", from: "caller", type: "ice" }, 0);
  assert.deepEqual(buffer.takeReady("room", () => true, 15001), []);
});
