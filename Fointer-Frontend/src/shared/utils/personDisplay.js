/** Canonical label when a referenced account no longer exists. */
export const DELETED_USER_LABEL = "Deleted User";

/**
 * Display name for a user/author/seller object from the API.
 * Prefer real name/username; fall back to Deleted User when missing or flagged.
 */
export function personDisplayName(person, fallback = DELETED_USER_LABEL) {
  if (person == null) return fallback;
  if (typeof person === "string" || typeof person === "number") {
    return fallback;
  }
  if (person.isDeleted) return DELETED_USER_LABEL;

  const name = String(person.name || "").trim();
  if (name) return name;

  const username = String(person.username || "")
    .trim()
    .replace(/^@+/, "");
  if (username) return username;

  return fallback;
}

export function isDeletedPerson(person) {
  if (person == null) return true;
  if (typeof person !== "object") return true;
  if (person.isDeleted) return true;
  const name = String(person.name || "").trim();
  const username = String(person.username || "").trim();
  return !name && !username;
}
