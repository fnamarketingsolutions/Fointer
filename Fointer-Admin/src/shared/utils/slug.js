/**
 * Normalize a title into a URL-safe slug with every word kept
 * (no length cap — short code is appended separately).
 */
const slugify = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Builds a readable path segment: `{full-title-slug}-{shortCode}`.
 */
export const toSlugParam = (title, code) => {
  if (!code) return '';
  const slug = slugify(title);
  return slug ? `${slug}-${code}` : String(code);
};

/**
 * Reads the trailing short code (or bare ObjectId) out of a segment.
 * Short codes are 7 chars without hyphens, so the last `-` segment is the code.
 */
export const parseSlugParam = (param) => {
  if (!param) return param;
  const value = String(param);
  const separatorIndex = value.lastIndexOf('-');
  return separatorIndex === -1 ? value : value.slice(separatorIndex + 1);
};
