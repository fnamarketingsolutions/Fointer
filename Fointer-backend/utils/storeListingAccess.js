/** Pure rules for storefront listings. No database access. */

export const activeSlotRequired = ({
  previousStatus = null,
  nextStatus = null,
  previousStoreId = null,
  nextStoreId = null,
} = {}) => {
  const next = nextStoreId ? String(nextStoreId) : "";
  const previous = previousStoreId ? String(previousStoreId) : "";
  if (nextStatus !== "active" || !next) return false;
  if (previousStatus === "active" && previous === next) return false;
  return true;
};

/** Public browse keeps personal listings and listings from stores that are not suspended. */
export const publicListingStoreClause = (suspendedIds) => {
  if (!Array.isArray(suspendedIds) || suspendedIds.length === 0) return null;
  return {
    $or: [
      { store: null },
      { store: { $exists: false } },
      { store: { $nin: suspendedIds } },
    ],
  };
};

export const applyPublicStoreVisibility = (filter, suspendedIds) => {
  const clause = publicListingStoreClause(suspendedIds);
  if (!clause) return filter;
  if (!Array.isArray(filter.$and)) filter.$and = [];
  filter.$and.push(clause);
  return filter;
};
