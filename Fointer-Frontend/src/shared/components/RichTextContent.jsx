const ALLOWED_TAGS = new Set(["A", "B", "BLOCKQUOTE", "BR", "CODE", "DIV", "EM", "H1", "H2", "H3", "I", "LI", "OL", "P", "PRE", "S", "STRIKE", "STRONG", "U", "UL"]);
const MENTION_RE = /@([A-Za-z][A-Za-z0-9_]{1,49})/g;

function safeHtml(value) {
  const source = String(value || "");
  if (typeof DOMParser === "undefined") return source;
  const documentNode = new DOMParser().parseFromString(source, "text/html");
  const clean = (node, allowMentions = true) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (!allowMentions || !text) return document.createTextNode(text);
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      for (const match of text.matchAll(MENTION_RE)) {
        if (match.index > lastIndex) {
          fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const username = match[1];
        const mention = document.createElement("a");
        mention.setAttribute("href", `/users/${encodeURIComponent(username)}`);
        mention.setAttribute("data-mention", "true");
        mention.textContent = match[0];
        fragment.append(mention);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) fragment.append(document.createTextNode(text.slice(lastIndex)));
      return lastIndex ? fragment : document.createTextNode(text);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
    if (!ALLOWED_TAGS.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      [...node.childNodes].forEach((child) => fragment.append(clean(child, allowMentions)));
      return fragment;
    }
    const element = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === "A") {
      const rawHref = String(node.getAttribute("href") || "").trim();
      const href = /[\s\\]/.test(rawHref) || rawHref.startsWith("//")
        ? ""
        : /^(https?:|mailto:|\/)/i.test(rawHref)
          ? rawHref
          : /^(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[/?#]|$)/i.test(rawHref)
            ? `https://${rawHref}`
            : "";
      if (/^(https?:|mailto:|\/)/i.test(href) && !href.startsWith("//")) {
        element.setAttribute("href", href);
        if (!href.startsWith("/")) {
          element.setAttribute("rel", "noopener noreferrer");
          element.setAttribute("target", "_blank");
        }
      }
    }
    const childMentions = allowMentions && !["A", "CODE", "PRE"].includes(node.tagName);
    [...node.childNodes].forEach((child) => element.append(clean(child, childMentions)));
    return element;
  };
  const output = document.createElement("div");
  [...documentNode.body.childNodes].forEach((child) => output.append(clean(child)));
  return output.innerHTML;
}

export default function RichTextContent({ text, className = "" }) {
  const html = safeHtml(text);
  return (
    <div
      className={`rich-text-content whitespace-pre-wrap [&_a]:font-medium [&_a]:text-fo-accent [&_a]:underline [&_a]:decoration-fo-accent/70 [&_a]:underline-offset-2 hover:[&_a]:text-fo-accent-hover ${className}`}
      onClick={(event) => {
        if (event.target.closest("a")) event.stopPropagation();
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
