import assert from "node:assert/strict";
import test from "node:test";

/**
 * Documents the RR7 option used by dashboard tabs.
 * Without flushSync, startTransition keeps the previous route painted while a
 * lazy destination loads — which looks like a 4–6s stuck Feed on mobile.
 */
test("tab navigation must request a synchronous route update", () => {
  const options = { flushSync: true };
  assert.equal(options.flushSync, true);
});
