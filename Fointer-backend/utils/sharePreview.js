const SITE_NAME = "Fointer";

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const collapseText = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

export const clipText = (value, max) => {
  const clean = collapseText(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

const isHttpUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

/**
 * HTML document social apps read before JavaScript runs.
 * Twitter/X, Facebook, WhatsApp, LinkedIn, and Discord use these tags
 * to draw the link card. They do not render the React app.
 */
export const buildPostShareHtml = ({
  siteUrl = "https://fointer.net",
  pageUrl,
  title,
  description,
  imageUrls = [],
} = {}) => {
  const site = String(siteUrl || "https://fointer.net").replace(/\/$/, "");
  const canonical = isHttpUrl(pageUrl) ? String(pageUrl) : site;
  const images = [];
  for (const raw of imageUrls) {
    if (!isHttpUrl(raw)) continue;
    images.push(String(raw));
    if (images.length >= 4) break;
  }
  const usingLogo = images.length === 0;
  if (usingLogo) images.push(`${site}/fointer-logo1.jpeg`);

  const safeTitle = clipText(title, 90) || "Post on Fointer";
  const safeDescription = clipText(description, 220) || "A post on Fointer";
  const card = usingLogo ? "summary" : "summary_large_image";
  const imageTags = images
    .map((src) => `<meta property="og:image" content="${escapeHtml(src)}" />`)
    .join("\n");
  const redirectTarget = JSON.stringify(canonical).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(safeTitle)}</title>
<meta name="description" content="${escapeHtml(safeDescription)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:title" content="${escapeHtml(safeTitle)}" />
<meta property="og:description" content="${escapeHtml(safeDescription)}" />
${imageTags}
<meta name="twitter:card" content="${card}" />
<meta name="twitter:title" content="${escapeHtml(safeTitle)}" />
<meta name="twitter:description" content="${escapeHtml(safeDescription)}" />
<meta name="twitter:image" content="${escapeHtml(images[0])}" />
<meta name="twitter:image:alt" content="${escapeHtml(safeTitle)}" />
</head>
<body>
<p><a href="${escapeHtml(canonical)}">${escapeHtml(safeTitle)}</a></p>
<script>location.replace(${redirectTarget});</script>
</body>
</html>`;
};
