import { Link } from "react-router-dom";
import { LuUsers as Users } from "react-icons/lu";
import PostActions from "./PostActions";
import UserProfileLink from "./UserProfileLink";
import PostMediaGallery from "./media/PostMediaGallery";
import { communitySegment } from "../services/entityLinks";
import { timeAgo } from "../utils/date";

/**
 * Shared feed post card.
 * - variant="card": full media gallery + optional community badge (dashboard feed)
 * - variant="row": compact row with side thumbnail (community lists)
 */
export default function FeedPostRow({
  post,
  onOpen,
  active = false,
  showCommunity = false,
  variant = "row",
  onLike,
  onReshare,
  onComment,
}) {
  const authorName =
    post?.author?.name || post?.author?.username || "Anonymous";
  const communityName = post?.community?.name;
  const communityTo = post?.community
    ? `/communities/${communitySegment(post.community) || post.community.id}`
    : null;
  const media = post?.media || [];
  const title = post?.title || "Untitled";
  const coverImage = media.find((m) => m.type === "image");

  const activate = () => onOpen?.(post);

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  const borderClass = active
    ? "border-fo-accent/50"
    : "border-fo-border hover:border-fo-accent/35";

  if (variant === "card") {
    return (
      <article
        role="link"
        tabIndex={0}
        onClick={activate}
        onKeyDown={onKeyDown}
        aria-label={`Open post: ${title}`}
        className={`group bg-fo-surface border rounded-xl overflow-hidden cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${borderClass}`}
      >
        <div className="p-3 sm:p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-fo-subtle flex-wrap">
            <UserProfileLink
              author={post?.author}
              className="font-semibold text-fo-muted hover:text-fo-accent transition-colors"
            >
              {authorName}
            </UserProfileLink>
            <span aria-hidden>·</span>
            <span>{timeAgo(post?.createdAt)}</span>
            {showCommunity && communityName ? (
              <>
                <span aria-hidden>·</span>
                {communityTo ? (
                  <Link
                    to={communityTo}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-fo-accent/80 hover:text-fo-accent transition-colors"
                  >
                    <Users size={10} aria-hidden />
                    {communityName}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 text-fo-accent/80">
                    <Users size={10} aria-hidden />
                    {communityName}
                  </span>
                )}
              </>
            ) : null}
          </div>

          <h3 className="text-sm sm:text-base font-semibold text-fo-text leading-snug group-hover:text-fo-accent transition-colors line-clamp-2">
            {title}
          </h3>

          {post?.text ? (
            <p className="text-xs sm:text-sm text-fo-muted line-clamp-2 leading-relaxed">
              {post.text}
            </p>
          ) : null}
        </div>

        {media.length > 0 ? (
          <div
            className="bg-fo-surface-2 border-t border-fo-border"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <PostMediaGallery
              media={media}
              counterOverlay={media.length > 1}
              heightClass="h-56 sm:h-80"
            />
          </div>
        ) : null}

        <div
          className="px-3 sm:px-4 py-2.5 border-t border-fo-border"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <PostActions
            post={post}
            compact
            onLike={onLike}
            onReshare={onReshare}
            onComment={onComment}
          />
        </div>
      </article>
    );
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={activate}
      onKeyDown={onKeyDown}
      aria-label={`Open post: ${title}`}
      className={`group flex gap-3 bg-fo-surface border rounded-xl overflow-hidden cursor-pointer transition-colors p-3 sm:p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${borderClass}`}
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-fo-subtle flex-wrap">
          <UserProfileLink
            author={post?.author}
            className="font-semibold text-fo-muted hover:text-fo-accent transition-colors"
          >
            {authorName}
          </UserProfileLink>
          <span aria-hidden>·</span>
          <span>{timeAgo(post?.createdAt)}</span>
        </div>

        <h2 className="text-sm sm:text-base font-semibold text-fo-text leading-snug group-hover:text-fo-accent transition-colors line-clamp-2">
          {title}
        </h2>

        {post?.text ? (
          <p className="text-xs sm:text-sm text-fo-muted line-clamp-2 leading-relaxed">
            {post.text}
          </p>
        ) : null}

        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
          <PostActions
            post={post}
            compact
            onLike={onLike}
            onReshare={onReshare}
            onComment={onComment}
          />
        </div>
      </div>

      {coverImage ? (
        <div className="hidden sm:block w-24 h-20 shrink-0 rounded-lg overflow-hidden bg-fo-surface-2 border border-fo-border">
          <img
            src={coverImage.url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ) : null}
    </article>
  );
}
