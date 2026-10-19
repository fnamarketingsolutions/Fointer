import Post from "../models/post.js";
import { canViewPost } from "./post.controller.js";
import { resolveDocumentId } from "../utils/shortCode.js";
import { getPublicApiUrl, getPublicFrontendUrl } from "../utils/publicAppUrls.js";
import { fetchFointerMedia, watermarkImage } from "../utils/mediaWatermark.js";
import {
  buildPostShareHtml,
  collapseText,
  shareCardImageUrl,
  shareCardTitle,
} from "../utils/sharePreview.js";

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

const previewFromPost = (post, siteUrl, pageUrl, segment) => {
  const title = collapseText(post.title);
  const text = collapseText(post.text);
  const byline = bylineFor(post);
  const stats = statsFor(post);
  const hasImage = (post.media || []).some((item) => item?.type === "image" && item.url);
  const imageUrls = hasImage ? [shareCardImageUrl(getPublicApiUrl(), segment)] : [];
  const hasVideo = (post.media || []).some((item) => item?.type === "video");

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

    return res.status(200).send(previewFromPost(post, siteUrl, pageUrl, segment));
  } catch (error) {
    console.error(error);
    return res.status(200).send(genericPreview(siteUrl, pageUrl));
  }
};

/** Post photo with the transparent Fointer mark in the corner, for og:image. */
export const sharePostImage = async (req, res) => {
  const segment = String(req.params.segment || "").trim();
  try {
    const post = await loadPublicPost(segment);
    const image = (post?.media || []).find((item) => item?.type === "image" && item.url);
    if (!image) return res.status(404).end();

    const source = await fetchFointerMedia(image.url);
    if (source.isVideo) return res.redirect(302, image.url);

    const jpeg = await watermarkImage(source.buffer, SHARE_BADGE);
    res.set("Cache-Control", "public, max-age=86400");
    return res.type("image/jpeg").send(jpeg);
  } catch (error) {
    console.error(error);
    return res.status(404).end();
  }
};
