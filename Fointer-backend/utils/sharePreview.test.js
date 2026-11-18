import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPlayerFrameHeaders,
  buildPostShareHtml,
  buildVideoPlayerHtml,
  clipText,
  escapeHtml,
  shareCardImageUrl,
  shareCardTitle,
  sharePlayerUrl,
  storeShareCopy,
} from "./sharePreview.js";

test("store share card uses the store name and cover", () => {
  const copy = storeShareCopy({
    name: "Ada's Fashion",
    description: "Clothes & accessories",
  });
  assert.equal(copy.title, "Ada's Fashion on Fointer");
  const html = buildPostShareHtml({
    siteUrl: "https://fointer.net",
    pageUrl: "https://fointer.net/store/adas-fashion",
    title: copy.title,
    description: copy.description,
    imageUrls: ["https://cdn.example.com/cover.jpg"],
  });
  assert.match(html, /og:title" content="Ada&#39;s Fashion on Fointer"/);
  assert.match(html, /og:image" content="https:\/\/cdn\.example\.com\/cover\.jpg"/);
  assert.match(html, /og:url" content="https:\/\/fointer\.net\/store\/adas-fashion"/);
});

test("share preview escapes title and description", () => {
  const html = buildPostShareHtml({
    siteUrl: "https://fointer.net",
    pageUrl: "https://fointer.net/post/ff2xtv3",
    title: `Hello <script>alert("x")</script>`,
    description: `A & B "quote"`,
    imageUrls: ["https://cdn.example.com/photo.jpg"],
  });

  assert.equal(html.includes("<script>alert"), false);
  assert.match(html, /og:title" content="Hello &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;"/);
  assert.match(html, /og:description" content="A &amp; B &quot;quote&quot;"/);
  assert.match(html, /twitter:card" content="summary_large_image"/);
  assert.match(html, /og:image" content="https:\/\/cdn\.example\.com\/photo\.jpg"/);
  assert.match(html, /og:url" content="https:\/\/fointer\.net\/post\/ff2xtv3"/);
});

test("share preview falls back to the site logo when the post has no image", () => {
  const html = buildPostShareHtml({
    pageUrl: "https://fointer.net/post/abc",
    title: "Text only",
    description: "Just words",
  });
  assert.match(html, /twitter:card" content="summary"/);
  assert.match(html, /fointer-logo1\.jpeg/);
});

test("share preview ignores non-http image urls", () => {
  const html = buildPostShareHtml({
    pageUrl: "https://fointer.net/post/abc",
    title: "Post",
    description: "Body",
    imageUrls: ["javascript:alert(1)", "/relative.jpg"],
  });
  assert.equal(html.includes("javascript:"), false);
  assert.match(html, /fointer-logo1\.jpeg/);
});

test("video share uses one player card at the video's own shape", () => {
  const html = buildPostShareHtml({
    pageUrl: "https://fointer.net/post/abc",
    title: "From Amelia on Fointer: a very long headline that must stay inside the player card limit",
    description: "Watch this",
    imageUrls: ["https://api.fointer.net/share/post/abc/image"],
    videoUrl: "https://cdn.example.com/video.mp4",
    playerUrl: "https://api.fointer.net/share/post/abc/player",
    playerWidth: 720,
    playerHeight: 1280,
  });
  assert.equal(html.match(/twitter:card/g).length, 1);
  assert.match(html, /twitter:card" content="player"/);
  assert.match(html, /twitter:player" content="https:\/\/api\.fointer\.net\/share\/post\/abc\/player"/);
  assert.match(html, /twitter:player:width" content="720"/);
  assert.match(html, /twitter:player:height" content="1280"/);
  assert.equal(html.includes("twitter:player:stream"), false);
  assert.match(html, /og:video" content="https:\/\/cdn\.example\.com\/video\.mp4"/);
  assert.equal(html.includes("summary_large_image"), false);
});

test("player card names the site when X_SITE_HANDLE is set", () => {
  const previous = process.env.X_SITE_HANDLE;
  process.env.X_SITE_HANDLE = "fointer";
  try {
    const html = buildPostShareHtml({
      pageUrl: "https://fointer.net/post/abc",
      title: "Video post",
      description: "Watch this",
      imageUrls: ["https://api.fointer.net/share/post/abc/image"],
      videoUrl: "https://cdn.example.com/video.mp4",
      playerUrl: "https://api.fointer.net/share/post/abc/player",
      playerWidth: 1280,
      playerHeight: 720,
    });
    assert.match(html, /twitter:site" content="@fointer"/);
  } finally {
    if (previous === undefined) delete process.env.X_SITE_HANDLE;
    else process.env.X_SITE_HANDLE = previous;
  }
});

test("an http player address does not become a player card", () => {
  const html = buildPostShareHtml({
    pageUrl: "https://fointer.net/post/abc",
    title: "Video post",
    description: "Watch this",
    imageUrls: ["https://api.fointer.net/share/post/abc/image"],
    videoUrl: "https://cdn.example.com/video.mp4",
    playerUrl: "http://api.fointer.net/share/post/abc/player",
    playerWidth: 720,
    playerHeight: 1280,
  });
  assert.match(html, /twitter:card" content="summary_large_image"/);
  assert.equal(html.includes("twitter:player"), false);
});

test("the framed player page is only the full video", () => {
  const html = buildVideoPlayerHtml({
    videoUrl: `https://cdn.example.com/clip.mp4?token=a&b="x"`,
    pageUrl: "https://fointer.net/post/abc",
  });
  assert.match(html, /object-fit:contain/);
  assert.match(html, /<video src="https:\/\/cdn\.example\.com\/clip\.mp4\?token=a&amp;b=&quot;x&quot;"/);
  assert.equal(html.includes("location.replace"), false);
  assert.equal(html.includes("<header"), false);
});

test("player route drops the frame-blocking header", () => {
  const headers = new Map([["x-frame-options", "SAMEORIGIN"]]);
  applyPlayerFrameHeaders({
    removeHeader(name) {
      headers.delete(String(name).toLowerCase());
    },
    set(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
  });
  assert.equal(headers.has("x-frame-options"), false);
  assert.match(headers.get("content-security-policy"), /https:\/\/x\.com/);
  assert.match(headers.get("content-security-policy"), /https:\/\/twitter\.com/);
});

test("share player url points at the video page", () => {
  assert.equal(
    sharePlayerUrl("https://api.fointer.net/", "ff2xtv3"),
    "https://api.fointer.net/share/post/ff2xtv3/player"
  );
});

test("share preview exposes a public video URL for compatible social cards", () => {
  const html = buildPostShareHtml({
    pageUrl: "https://fointer.net/post/abc",
    title: "Video post",
    description: "Watch this",
    imageUrls: ["https://api.fointer.net/share/post/abc/image"],
    videoUrl: "https://cdn.example.com/video.mp4",
  });
  assert.match(html, /og:video" content="https:\/\/cdn\.example\.com\/video\.mp4"/);
  assert.match(html, /og:video:type" content="video\/mp4"/);
});

test("share card title names Fointer the way Reddit names Reddit", () => {
  assert.equal(
    shareCardTitle({
      title: "जय श्री राम",
      communityName: "IndianArtAI",
      authorName: "Ashhad",
    }),
    "From the IndianArtAI community on Fointer: जय श्री राम"
  );
  assert.equal(
    shareCardTitle({
      title: "Delegation Dilemma",
      authorName: "Ashhad Ali",
    }),
    "From Ashhad Ali on Fointer: Delegation Dilemma"
  );
});

test("share card image points at the branded file", () => {
  assert.equal(
    shareCardImageUrl("https://api.fointer.net/", "ff2xtv3"),
    "https://api.fointer.net/share/post/ff2xtv3/image"
  );
});

test("clipText and escapeHtml", () => {
  assert.equal(escapeHtml(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
  assert.equal(clipText("abcdef", 4), "abc…");
});
