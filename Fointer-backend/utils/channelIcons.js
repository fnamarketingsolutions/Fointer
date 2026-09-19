/** Allowed Lucide icon keys for channels. Keep in sync with admin + frontend catalogs. */
export const CHANNEL_ICON_IDS = [
  "palette",
  "camera",
  "music",
  "clapperboard",
  "car",
  "sparkles",
  "leaf",
  "briefcase",
  "chart",
  "graduation",
  "book",
  "heart",
  "users",
  "home",
  "utensils",
  "dumbbell",
  "heart-pulse",
  "cpu",
  "smartphone",
  "plane",
  "map",
  "globe",
  "shopping-bag",
  "trophy",
  "gamepad",
  "newspaper",
  "message",
  "hash",
];

export const normalizeChannelIcon = (value, fallback = "") => {
  const icon = String(value ?? fallback ?? "")
    .trim()
    .toLowerCase();
  if (!icon) return "";
  return CHANNEL_ICON_IDS.includes(icon) ? icon : "";
};
