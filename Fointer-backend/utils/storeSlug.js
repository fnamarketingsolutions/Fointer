/** Public store links: /store/{slug}. Slugs are lowercase and hyphenated. */

export const STORE_SLUG_MIN = 3;
export const STORE_SLUG_MAX = 60;

/** Path words the web app and API already use. */
export const RESERVED_STORE_SLUGS = new Set([
  "admin",
  "api",
  "communities",
  "community",
  "explore",
  "feed",
  "login",
  "manage",
  "marketplace",
  "me",
  "messages",
  "mine",
  "new",
  "settings",
  "signup",
  "slug",
  "store",
  "stores",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugifyStoreName = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, STORE_SLUG_MAX)
    .replace(/-+$/g, "");

export const validateStoreSlug = (slug) => {
  const value = String(slug ?? "").trim().toLowerCase();
  if (!value || !SLUG_PATTERN.test(value)) {
    return {
      ok: false,
      message: "Use a store link with letters, numbers, and hyphens.",
    };
  }
  if (value.length < STORE_SLUG_MIN || value.length > STORE_SLUG_MAX) {
    return {
      ok: false,
      message: `Store link must be ${STORE_SLUG_MIN}–${STORE_SLUG_MAX} characters.`,
    };
  }
  if (RESERVED_STORE_SLUGS.has(value)) {
    return { ok: false, message: "That store link is reserved." };
  }
  return { ok: true, slug: value };
};

/** Turn a store name into a slug, or explain why the name cannot be used. */
export const storeSlugFromName = (name) => validateStoreSlug(slugifyStoreName(name));
