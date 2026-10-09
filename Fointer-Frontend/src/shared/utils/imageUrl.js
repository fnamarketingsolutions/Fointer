/**
 * Shrink remote images before they reach the phone.
 * Original Cloudinary uploads are often 1–2 MB PNGs; a 800px auto
 * version is a few dozen KB, which is what mobile LCP can afford.
 */
export function displayImageUrl(url, width = 800) {
  const raw = String(url || "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return raw;
  if (raw.includes("/video/upload/")) return raw;

  const px = Math.max(64, Math.round(Number(width) || 800));
  const cloudinary = raw.match(
    /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/i
  );
  if (cloudinary) {
    const rest = cloudinary[2];
    if (/^(?:f_|q_|w_|c_|g_)/.test(rest)) return raw;
    return `${cloudinary[1]}f_auto,q_auto,w_${px},c_limit/${rest}`;
  }

  if (raw.includes("images.unsplash.com")) {
    try {
      const next = new URL(raw);
      next.searchParams.set("w", String(px));
      next.searchParams.set("q", "60");
      next.searchParams.set("auto", "format");
      next.searchParams.set("fit", "crop");
      return next.toString();
    } catch {
      return raw;
    }
  }

  return raw;
}
