import { Fragment, useMemo } from "react";
import { Link } from "react-router-dom";

/** Matches backend HASHTAG_RE in post.controller.js */
export const HASHTAG_RE = /#([A-Za-z][A-Za-z0-9_]{1,49})/g;

function buildNodes(text) {
  const source = String(text ?? "");
  if (!source) return null;

  const nodes = [];
  let lastIndex = 0;
  let key = 0;
  const re = new RegExp(HASHTAG_RE.source, HASHTAG_RE.flags);

  for (const match of source.matchAll(re)) {
    const full = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(
        <Fragment key={`t-${key++}`}>{source.slice(lastIndex, index)}</Fragment>
      );
    }
    nodes.push(
      <Link
        key={`h-${key++}`}
        to={`/search?q=${encodeURIComponent(full)}`}
        onClick={(e) => e.stopPropagation()}
        className="text-fo-accent hover:underline font-medium"
      >
        {full}
      </Link>
    );
    lastIndex = index + full.length;
  }

  if (lastIndex < source.length) {
    nodes.push(
      <Fragment key={`t-${key++}`}>{source.slice(lastIndex)}</Fragment>
    );
  }

  return nodes.length ? nodes : source;
}

/**
 * Renders plain text with #hashtags linked to /search?q=#tag.
 */
export default function LinkifiedText({ text }) {
  const nodes = useMemo(() => buildNodes(text), [text]);
  return <>{nodes}</>;
}
