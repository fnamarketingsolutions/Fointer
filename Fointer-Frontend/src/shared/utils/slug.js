const MAX_SLUG_LENGTH = 60;

export const slugify = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');

/**
 * Builds a single readable path segment such as
 * `champions-league-fans-a3f9c2q`, where the trailing part is the record's
 * short code.
 */
export const toSlugParam = (title, code) => {
  if (!code) return '';
  const slug = slugify(title);
  return slug ? `${slug}-${code}` : String(code);
};

/**
 * Reads the trailing code back out of a segment. Older `slug--id` links and
 * bare ids both fall out of this correctly, so existing links keep working.
 */
export const parseSlugParam = (param) => {
  if (!param) return param;
  const value = String(param);
  const separatorIndex = value.lastIndexOf('-');
  return separatorIndex === -1 ? value : value.slice(separatorIndex + 1);
};
