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

/**
 * X draws this string on the image. Reddit uses the same slot:
 * "From the {community} community on Reddit: {title}".
 */
export const shareCardTitle = ({
  title = "",
  text = "",
  authorName = "",
  communityName = "",
} = {}) => {
  const headline = collapseText(title) || clipText(text, 80) || "Post";
  const community = collapseText(communityName);
  const author = collapseText(authorName);
  if (community) return `From the ${community} community on Fointer: ${headline}`;
  if (author) return `From ${author} on Fointer: ${headline}`;
  return `On Fointer: ${headline}`;
};

export const storeShareCopy = ({ name = "", description = "" } = {}) => {
  const storeName = collapseText(name) || "Store";
  return {
    title: clipText(`${storeName} on Fointer`, 90),
    description:
      clipText(description, 220) || `Shop ${storeName} on Fointer.`,
  };
};

/** Image X fetches. The transparent mark is composited onto this file. */
export const shareCardImageUrl = (apiUrl, segment) => {
  const api = String(apiUrl || "https://api.fointer.net").replace(/\/$/, "");
  return `${api}/share/post/${encodeURIComponent(String(segment || ""))}/image`;
};

/** Page X frames when a video post is opened. Video only, no site chrome. */
export const sharePlayerUrl = (apiUrl, segment) => {
  const api = String(apiUrl || "https://api.fointer.net").replace(/\/$/, "");
  return `${api}/share/post/${encodeURIComponent(String(segment || ""))}/player`;
};

export const PLAYER_FRAME_CSP =
  "frame-ancestors 'self' https://x.com https://*.x.com https://twitter.com https://*.twitter.com";

/** Helmet's X-Frame-Options would stop X from showing this page inside a post. */
export const applyPlayerFrameHeaders = (res) => {
  res.removeHeader("X-Frame-Options");
  res.set("Content-Security-Policy", PLAYER_FRAME_CSP);
  res.set("Cross-Origin-Opener-Policy", "unsafe-none");
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
const httpsUrl = (value) => isHttpUrl(value) && String(value).startsWith("https:");

const twitterSite = () => {
  const raw = String(process.env.X_SITE_HANDLE || "").trim();
  if (!raw) return "";
  const handle = raw.startsWith("@") ? raw : `@${raw}`;
  return /^@[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : "";
};

/**
 * HTML document social apps read before JavaScript runs.
 * Twitter/X, Facebook, WhatsApp, LinkedIn, and Discord use these tags
 * to draw the link card. They do not render the React app.
 * A video post uses one player card so X can frame the video page
 * at the video's own shape.
 */
export const buildPostShareHtml = ({
  siteUrl = "https://fointer.net",
  pageUrl,
  title,
  description,
  imageUrls = [],
  videoUrl = "",
  playerUrl = "",
  playerWidth = 0,
  playerHeight = 0,
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

  const safeVideoUrl = isHttpUrl(videoUrl) ? String(videoUrl) : "";
  const safePlayerUrl = httpsUrl(playerUrl) ? String(playerUrl) : "";
  const usePlayer = Boolean(safeVideoUrl && safePlayerUrl);
  const width = Math.max(2, Math.round(Number(playerWidth)) || 720);
  const height = Math.max(2, Math.round(Number(playerHeight)) || 1280);
  const safeTitle = clipText(title, usePlayer ? 70 : 90) || "Post on Fointer";
  const safeDescription = clipText(description, usePlayer ? 200 : 220) || "A post on Fointer";
  const card = usePlayer ? "player" : usingLogo ? "summary" : "summary_large_image";
  const imageTags = images
    .map((src) => `<meta property="og:image" content="${escapeHtml(src)}" />`)
    .join("\n");
  const videoTags = safeVideoUrl
    ? `<meta property="og:video" content="${escapeHtml(safeVideoUrl)}" />
<meta property="og:video:secure_url" content="${escapeHtml(safeVideoUrl)}" />
<meta property="og:video:type" content="video/mp4" />`
    : "";
  const siteHandle = usePlayer ? twitterSite() : "";
  const siteTag = siteHandle
    ? `<meta name="twitter:site" content="${escapeHtml(siteHandle)}" />`
    : "";
  const playerTags = usePlayer
    ? `<meta name="twitter:player" content="${escapeHtml(safePlayerUrl)}" />
<meta name="twitter:player:width" content="${width}" />
<meta name="twitter:player:height" content="${height}" />`
    : "";
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
${videoTags}
<meta name="twitter:card" content="${card}" />
${siteTag}
<meta name="twitter:title" content="${escapeHtml(safeTitle)}" />
<meta name="twitter:description" content="${escapeHtml(safeDescription)}" />
<meta name="twitter:image" content="${escapeHtml(images[0])}" />
<meta name="twitter:image:alt" content="${escapeHtml(safeTitle)}" />
${playerTags}
</head>
<body>
<p><a href="${escapeHtml(canonical)}">${escapeHtml(safeTitle)}</a></p>
<script>location.replace(${redirectTarget});</script>
</body>
</html>`;
};

/** The only document X is allowed to frame: the video, edge to edge, uncropped. */
export const buildVideoPlayerHtml = ({ videoUrl, pageUrl } = {}) => {
  const src = httpsUrl(videoUrl) ? String(videoUrl) : "";
  const canonical = isHttpUrl(pageUrl) ? String(pageUrl) : "https://fointer.net";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<title>Fointer video</title>
<style>
html,body{margin:0;height:100%;background:#000;overflow:hidden}
video{display:block;width:100%;height:100%;object-fit:contain;background:#000}
</style>
</head>
<body>
<video src="${escapeHtml(src)}" controls playsinline preload="metadata"></video>
<script>
(function () {
  var video = document.querySelector("video");
  if (!video) return;
  var params = new URLSearchParams(location.search);
  var asked = params.get("autoplay") === "1" || params.get("auto_play") === "true";
  var framed = window.self !== window.top;
  if (!asked && !framed) return;
  var start = function () {
    video.play().catch(function () {
      video.muted = true;
      video.play().catch(function () {});
    });
  };
  if (video.readyState >= 2) start();
  else video.addEventListener("loadeddata", start, { once: true });
})();
</script>
</body>
</html>`;
};
