export default function PostReference({ post, onClick }) {
  if (!post) return null;

  const subtitle = String(post.text || "")
    .replace(/\s+/g, " ")
    .trim();
  const label = post.communityName
    ? `Post · ${post.communityName}`
    : "Shared post";

  const content = (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-fo-border bg-fo-bg/80 max-w-sm">
      {post.imageUrl ? (
        <img
          src={post.imageUrl}
          alt=""
          className="w-14 h-14 rounded-lg object-cover border border-fo-border shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-fo-surface border border-fo-border shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-fo-subtle">
          {label}
        </p>
        <p className="text-sm font-medium text-fo-text truncate">
          {post.title || "Fointer post"}
        </p>
        {subtitle ? (
          <p className="text-xs text-fo-muted truncate">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left hover:opacity-90 transition-opacity"
      >
        {content}
      </button>
    );
  }

  return content;
}
