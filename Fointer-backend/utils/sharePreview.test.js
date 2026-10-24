import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPostShareHtml,
  clipText,
  escapeHtml,
  shareCardImageUrl,
  shareCardTitle,
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
