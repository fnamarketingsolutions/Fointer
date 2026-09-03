export const getSafeReturnPath = (from) => {
  let path = null;

  if (typeof from === "string") {
    path = from;
  } else if (from && typeof from === "object" && typeof from.pathname === "string") {
    path = from.pathname;
  }

  if (!path) return null;

  const bare = path.split("?")[0].split("#")[0].trim();

  if (!bare.startsWith("/")) return null;
  if (bare.startsWith("//")) return null;
  if (bare.includes("\\")) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(bare)) return null;
  if (!/^\/[A-Za-z0-9/_-]*$/.test(bare)) return null;

  if (bare === "/login" || bare === "/signup") return null;

  const allowed =
    bare === "/" ||
    bare === "/explore" ||
    bare === "/feed" ||
    bare.startsWith("/admin") ||
    bare.startsWith("/communities") ||
    bare.startsWith("/manage-community") ||
    bare.startsWith("/live-events") ||
    bare.startsWith("/watch-groups") ||
    bare.startsWith("/my-activity") ||
    bare.startsWith("/support") ||
    bare.startsWith("/profile") ||
    bare.startsWith("/notifications") ||
    bare.startsWith("/users") ||
    bare.startsWith("/search") ||
    bare.startsWith("/post");

  return allowed ? bare : null;
};
