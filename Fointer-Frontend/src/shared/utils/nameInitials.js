 
export function getNameInitials(name, fallback = "?") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return fallback;
  if (parts.length === 1) {
    const word = parts[0];
    return word.slice(0, Math.min(2, word.length)).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

/** Pick a readable text size from a Tailwind width class on the avatar. */
export function initialsTextClass(className = "") {
  if (/\bw-2[0-9]\b|\bw-1[6-9]\b/.test(className)) return "text-2xl";
  if (/\bw-1[2-5]\b/.test(className)) return "text-base";
  if (/\bw-10\b|\bw-11\b/.test(className)) return "text-sm";
  return "text-xs";
}
