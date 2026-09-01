/**
 * Shared pagination helpers for list endpoints.
 */

export const parsePagination = (
  query = {},
  { defaultLimit = 10, maxLimit = 100 } = {}
) => {
  const enabled = query.page !== undefined && query.page !== "";
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = query.limit !== undefined ? Number(query.limit) : defaultLimit;
  const limit = Math.min(
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : defaultLimit),
    maxLimit
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip, enabled };
};

export const resolveSort = (sortBy, sortMap, fallback) => {
  const key = String(sortBy || "").trim().toLowerCase();
  if (key && sortMap[key]) return sortMap[key];
  return fallback;
};

export const buildPaginationMeta = ({ page, limit, total, hasMore } = {}) => {
  const safeTotal = total == null ? 0 : Math.max(0, Number(total) || 0);
  const totalPages = limit > 0 ? Math.ceil(safeTotal / limit) : 0;

  return {
    page,
    limit,
    total: safeTotal,
    totalPages,
    hasMore:
      hasMore !== undefined ? Boolean(hasMore) : page < totalPages,
  };
};

/** Fetch limit+1 rows, then drop the extra to know if another page exists. */
export const takePage = (rows = [], limit) => {
  const hasMore = rows.length > limit;
  return {
    rows: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
};
