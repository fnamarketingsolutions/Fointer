import Post from "../models/post.js";
import Store from "../models/store.js";
import { canViewPost } from "./post.controller.js";
import { resolveDocumentId } from "../utils/shortCode.js";
import { getPublicApiUrl, getPublicFrontendUrl } from "../utils/publicAppUrls.js";
import {
  assertFointerMediaUrl,
  extractVideoPoster,
  fetchFointerMedia,
  fitPosterToFrame,
  watermarkImage,
} from "../utils/mediaWatermark.js";
import {
  applyPlayerFrameHeaders,
  buildPostShareHtml,
  buildVideoPlayerHtml,
  collapseText,
  shareCardImageUrl,
  shareCardTitle,
  sharePlayerUrl,
  storeShareCopy,
} from "../utils/sharePreview.js";
import { resolvePlayerFrame } from "../utils/videoFrameSize.js";

const SHARE_BADGE = {
  enabled: true,
  opacity: 100,
  sizePercent: 22,
  position: "top-right",
  marginPercent: 3,
  imageUrl: "",
};

const bylineFor = (post) => {
  const author =
    collapseText(post.author?.name) ||
    collapseText(post.author?.username) ||
    "Someone";
  const community = collapseText(post.community?.name);
  return community ? `${author} in ${community} on Fointer` : `${author} on Fointer`;
};

const statsFor = (post) => {
  const parts = [];
  const likes = Number(post.likeCount) || 0;
  const comments = Number(post.commentCount) || 0;
  if (likes > 0) parts.push(`${likes} likes`);
  if (comments > 0) parts.push(`${comments} comments`);
  return parts.join(" · ");
};

const loadPublicPost = async (segment) => {
  const id = await resolveDocumentId(Post, segment);
  if (!id) return null;
  const post = await Post.findById(id)
    .populate("author", "username name")
    .populate("community", "name type")
    .lean();
  if (!post || !(await canViewPost(post, null))) return null;
  return post;
};

const playableVideoUrl = (video) => {
  if (!video?.url) return "";
  try {
    return assertFointerMediaUrl(video.url).toString();
  } catch {
    return "";
  }
};

const previewFromPost = async (post, siteUrl, pageUrl, segment) => {
  const title = collapseText(post.title);
  const text = collapseText(post.text);
  const byline = bylineFor(post);
  const stats = statsFor(post);
  const hasImage = (post.media || []).some((item) => item?.type === "image" && item.url);
  const video = (post.media || []).find((item) => item?.type === "video" && item.url);
  const imageUrls = hasImage || video ? [shareCardImageUrl(getPublicApiUrl(), segment)] : [];
  const videoUrl = playableVideoUrl(video);
  const hasVideo = Boolean(video);
  const frame = videoUrl ? await resolvePlayerFrame(videoUrl) : null;

  const authorName =
    collapseText(post.author?.name) || collapseText(post.author?.username);
  const ogTitle = shareCardTitle({
    title,
    text,
    authorName,
    communityName: post.community?.name,
  });
  let ogDescription = text || byline;

  if (hasVideo && imageUrls.length === 0) {
    ogDescription = `Video · ${ogDescription}`;
  }
  if (stats) ogDescription = `${ogDescription} · ${stats}`;

  return buildPostShareHtml({
    siteUrl,
    pageUrl,
    title: ogTitle,
    description: ogDescription,
    imageUrls,
    videoUrl,
    playerUrl: videoUrl ? sharePlayerUrl(getPublicApiUrl(), segment) : "",
    playerWidth: frame?.width || 0,
    playerHeight: frame?.height || 0,
  });
};

const genericPreview = (siteUrl, pageUrl) =>
  buildPostShareHtml({
    siteUrl,
    pageUrl,
    title: "Post on Fointer",
    description: "Open this post on Fointer.",
  });

/** HTML card for social crawlers. Humans are rewritten only when the UA matches. */
export const sharePostPreview = async (req, res) => {
  const siteUrl = getPublicFrontendUrl();
  const segment = String(req.params.segment || "").trim();
  const pageUrl = segment
    ? `${siteUrl}/post/${encodeURIComponent(segment)}`
    : siteUrl;

  res.set("Cache-Control", "public, max-age=300");
  res.set("X-Robots-Tag", "noindex");
  res.type("html");

  if (!segment) {
    return res.status(200).send(genericPreview(siteUrl, pageUrl));
  }

  try {
    const post = await loadPublicPost(segment);
    if (!post) {
      return res.status(200).send(genericPreview(siteUrl, pageUrl));
    }

    return res.status(200).send(await previewFromPost(post, siteUrl, pageUrl, segment));
  } catch (error) {
    console.error(error);
    return res.status(200).send(genericPreview(siteUrl, pageUrl));
  }
};

/** Video page X frames inside a post. No chrome, so the whole frame stays visible. */
export const sharePostPlayer = async (req, res) => {
  const segment = String(req.params.segment || "").trim();
  const siteUrl = getPublicFrontendUrl();
  const pageUrl = segment
    ? `${siteUrl}/post/${encodeURIComponent(segment)}`
    : siteUrl;

  applyPlayerFrameHeaders(res);
  res.set("Cache-Control", "public, max-age=300");
  res.set("X-Robots-Tag", "noindex");
  res.type("html");

  try {
    const post = await loadPublicPost(segment);
    const video = (post?.media || []).find((item) => item?.type === "video" && item.url);
    const videoUrl = playableVideoUrl(video);
    if (!videoUrl) return res.status(404).end();
    return res.status(200).send(buildVideoPlayerHtml({ videoUrl, pageUrl }));
  } catch {
    console.error("Share player failed");
    return res.status(404).end();
  }
};

/** Post photo with the transparent Fointer mark in the corner, for og:image. */
export const sharePostImage = async (req, res) => {
  const segment = String(req.params.segment || "").trim();
  try {
    const post = await loadPublicPost(segment);
    const media = (post?.media || []).find((item) => item?.type === "image" && item.url)
      || (post?.media || []).find((item) => item?.type === "video" && item.url);
    if (!media) return res.status(404).end();

    const source = await fetchFointerMedia(media.url);
    const poster = source.isVideo
      ? await extractVideoPoster(source.buffer)
      : source.buffer;

    let jpeg = await watermarkImage(poster, SHARE_BADGE);
    if (source.isVideo) {
      const frame = await resolvePlayerFrame(media.url);
      jpeg = await fitPosterToFrame(jpeg, frame.width, frame.height);
    }
    res.set("Cache-Control", "public, max-age=86400");
    return res.type("image/jpeg").send(jpeg);
  } catch (error) {
    console.error(error);
    return res.status(404).end();
  }
};

const genericStorePreview = (siteUrl, pageUrl) =>
  buildPostShareHtml({
    siteUrl,
    pageUrl,
    title: "Store on Fointer",
    description: "Open this store on Fointer.",
  });

/** HTML card for a public store link. Suspended stores stay unnamed. */
export const shareStorePreview = async (req, res) => {
  const siteUrl = getPublicFrontendUrl();
  const slug = String(req.params.slug || "").trim().toLowerCase();
  const pageUrl = slug ? `${siteUrl}/store/${encodeURIComponent(slug)}` : siteUrl;

  res.set("Cache-Control", "public, max-age=300");
  res.set("X-Robots-Tag", "noindex");
  res.type("html");

  if (!slug) return res.status(200).send(genericStorePreview(siteUrl, pageUrl));

  try {
    const store = await Store.findOne({ slug, status: "active" })
      .select("name description coverImage logo")
      .lean();
    if (!store) return res.status(200).send(genericStorePreview(siteUrl, pageUrl));

    const copy = storeShareCopy(store);
    const image = [store.coverImage, store.logo].find((url) =>
      /^https?:\/\//i.test(String(url || ""))
    );

    return res.status(200).send(
      buildPostShareHtml({
        siteUrl,
        pageUrl,
        title: copy.title,
        description: copy.description,
        imageUrls: image ? [image] : [],
      })
    );
  } catch (error) {
    console.error(error);
    return res.status(200).send(genericStorePreview(siteUrl, pageUrl));
  }
};
