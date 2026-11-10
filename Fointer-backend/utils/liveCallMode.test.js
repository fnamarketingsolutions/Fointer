import assert from "node:assert/strict";
import test from "node:test";
import { clampLivePresence, resolveLiveJoinMode } from "./liveCallMode.js";

test("an audio live event stays voice only", () => {
  assert.deepEqual(resolveLiveJoinMode("audio", "video"), {
    ok: true,
    mode: "audio",
    camera: false,
  });
  assert.deepEqual(clampLivePresence("audio", { mode: "video", camera: true, mic: true }), {
    mode: "audio",
    camera: false,
    mic: true,
  });
});

test("a video live event rejects an audio-only join", () => {
  assert.deepEqual(resolveLiveJoinMode("video", "audio"), {
    ok: false,
    message: "This live event is a video call.",
  });
  assert.deepEqual(resolveLiveJoinMode("video", "video"), {
    ok: true,
    mode: "video",
    camera: true,
  });
  assert.deepEqual(clampLivePresence("video", { mode: "audio", camera: false }), {
    mode: "audio",
    camera: false,
  });
});

test("commentary can join with either audio or video", () => {
  assert.equal(resolveLiveJoinMode("chat", "audio").mode, "audio");
  assert.equal(resolveLiveJoinMode("chat", "video").mode, "video");
  assert.equal(resolveLiveJoinMode(undefined, "video").camera, true);
});
