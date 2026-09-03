export const normalizeUsername = (value) =>
  String(value || "")
    .trim()
    .replace(/^@+/, "");

export const userProfilePath = (author, currentUser) => {
  const username = normalizeUsername(
    typeof author === "string" ? author : author?.username
  );
  if (!username) return null;

  const me = normalizeUsername(currentUser?.username);
  if (currentUser && me && me === username) {
    return currentUser.role === "admin" ? "/admin/profile" : "/profile";
  }

  return `/users/${encodeURIComponent(username)}`;
};
