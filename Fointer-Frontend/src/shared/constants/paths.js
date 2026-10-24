export const EXPLORE_PATH = "/explore";

/** Personalized feed for logged-in members (not indexed). */
export const FEED_PATH = "/feed";

/** Peer-to-peer marketplace browse (guests allowed). */
export const MARKETPLACE_PATH = "/marketplace";

/** Vendor storefronts. */
export const STORES_MANAGE_PATH = "/stores/manage";

export const storePath = (slug) => `/store/${encodeURIComponent(slug || "")}`;

/** Private messages inbox. */
export const MESSAGES_PATH = "/messages";
