import StoreFollow from "../models/storeFollow.js";
import { notifyMany, snippet } from "./notify.js";

/** Tell store followers that a product just became active on this store. */
export const notifyStoreFollowersOfListing = async ({
  store,
  listing,
  actor,
  io,
}) => {
  if (!store?._id || store.status !== "active") return;
  if (!listing || listing.status !== "active") return;

  const rows = await StoreFollow.find({ store: store._id })
    .select("follower")
    .lean();
  if (!rows.length) return;

  const storeName = String(store.name || "A store").trim();
  const product = String(listing.title || "a product").trim();

  await notifyMany(
    rows.map((row) => row.follower),
    {
      io,
      actor,
      type: "store_listing",
      title: snippet(`${storeName} added ${product}`, 200),
      body: snippet(listing.description || "", 140),
      entity: {
        kind: "store",
        _id: store._id,
        shortCode: store.slug || "",
        title: product,
        name: storeName,
      },
    }
  );
};
