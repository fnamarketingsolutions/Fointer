import test from "node:test";
import assert from "node:assert/strict";
import {
  activeSlotRequired,
  applyPublicStoreVisibility,
  publicListingStoreClause,
} from "./storeListingAccess.js";

test("an active store product takes a slot only when it newly occupies that store", () => {
  assert.equal(
    activeSlotRequired({ nextStatus: "active", nextStoreId: "store-a" }),
    true
  );
  assert.equal(
    activeSlotRequired({
      previousStatus: "draft",
      nextStatus: "active",
      previousStoreId: "store-a",
      nextStoreId: "store-a",
    }),
    true
  );
  assert.equal(
    activeSlotRequired({
      previousStatus: "active",
      nextStatus: "active",
      previousStoreId: "store-a",
      nextStoreId: "store-b",
    }),
    true
  );
  assert.equal(
    activeSlotRequired({
      previousStatus: "active",
      nextStatus: "active",
      previousStoreId: "store-a",
      nextStoreId: "store-a",
    }),
    false
  );
  assert.equal(
    activeSlotRequired({ nextStatus: "draft", nextStoreId: "store-a" }),
    false
  );
  assert.equal(
    activeSlotRequired({ nextStatus: "active", nextStoreId: null }),
    false
  );
  assert.equal(
    activeSlotRequired({
      previousStatus: "active",
      nextStatus: "sold",
      previousStoreId: "store-a",
      nextStoreId: "store-a",
    }),
    false
  );
});

test("public browse hides listings that belong to suspended stores", () => {
  assert.equal(publicListingStoreClause([]), null);
  const filter = { status: "active" };
  applyPublicStoreVisibility(filter, ["store-a"]);
  assert.deepEqual(filter.$and[0].$or[2], { store: { $nin: ["store-a"] } });
  assert.equal(filter.status, "active");
});
