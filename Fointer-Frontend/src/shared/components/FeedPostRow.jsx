import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LuBadgeCheck as BadgeCheck,
  LuEllipsis as Ellipsis,
  LuFlag as Flag,
  LuGlobe as Globe,
  LuLoaderCircle as Loader2,
  LuUsers as Users,
} from "react-icons/lu";
import PostActions from "./PostActions";
import UserProfileLink from "./UserProfileLink";
import PostMediaGallery from "./media/PostMediaGallery";
import ReportContentModal from "./modals/ReportContentModal";
import PostAuthorAvatar from "../../features/posts/components/PostAuthorAvatar";
import { createComment } from "../../api/posts";
import { communitySegment } from "../services/entityLinks";
import { timeAgo } from "../utils/date";
import {
  DELETED_USER_LABEL,
  personDisplayName,
} from "../utils/personDisplay";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "./feedback/ToastContext";

export function PostMoreMenu({ post }) {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const rootRef = useRef(null);
  const isOwn =
    user &&
    post?.author &&
    String(post.author.id || post.author._id) === String(user.id || user._id);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (isOwn || !isAuthenticated) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded-full text-fo-subtle hover:text-fo-text hover:bg-fo-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
        aria-label="Post options"
        title="More"
      >
        <Ellipsis size={18} />
      </button>
      {open ? (
        <div className="absolute right-0 top-8 z-20 min-w-[148px] rounded-xl border border-fo-border bg-fo-surface shadow-[0_8px_24px_rgba(26,22,18,0.08)] py-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              setReportOpen(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fo-muted hover:bg-fo-surface-hover hover:text-fo-text"
          >
            <Flag size={14} />
            Report
          </button>
        </div>
      ) : null}
      <div onClick={(e) => e.stopPropagation()}>
        <ReportContentModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="post"
          targetId={post?.id}
          targetLabel={post?.title || "this post"}
        />
      </div>
    </div>
  );
}

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
  showActions = true,
  variant = "row",
  onLike,
  onReshare,
  onComment,
  onSave,
  /** When true (default), Comment opens an inline composer instead of navigating away. */
  inlineComment = true,
  onCommentPosted,
}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const commentInputRef = useRef(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  useEffect(() => {
    if (!commentOpen) return undefined;
    const id = window.requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [commentOpen]);

  const authorName = personDisplayName(post?.author, DELETED_USER_LABEL);
  const username = String(post?.author?.username || "").replace(/^@+/, "");
  const isVerified = post?.author?.role === "admin";
  const communityName = post?.community?.name;
  const communityTo = post?.community
    ? `/communities/${communitySegment(post.community) || post.community.id}`
    : null;
  const media = post?.media || [];
  const title = String(post?.title || "").trim();
  const openLabel = title || post?.text || "Open post";
  const coverImage = media.find((m) => m.type === "image");
  const visibilityLabel = communityName || "Public";
  const VisibilityIcon = communityName ? Users : Globe;

  const activate = () => onOpen?.(post);

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  const borderClass = active
    ? "border-fo-accent/45"
    : "border-fo-border hover:border-fo-accent/25";

  const handleCommentClick = (event) => {
    event?.stopPropagation?.();
    if (!isAuthenticated) {
      navigate("/login", {
        state: {
          from: `${window.location.pathname}${window.location.search}`,
        },
      });
      return;
    }
    if (post?.canEngage === false) {
      showToast(
        post.community
          ? "Join this community to interact with posts."
          : "You cannot interact with this post."
      );
      return;
    }
    if (inlineComment) {
      setCommentOpen((open) => !open);
      return;
    }
    onComment?.(event);
  };

  const closeComposer = () => {
    setCommentOpen(false);
    setCommentText("");
  };

  const submitInlineComment = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const text = commentText.trim();
    if (!text || commentSaving) return;

    setCommentSaving(true);
    try {
      const data = await createComment(post.id, { text });
      const nextCount =
        data?.post?.commentCount ??
        data?.commentCount ??
        (post.commentCount || 0) + 1;
      onCommentPosted?.(post, {
        comment: data?.comment,
        commentCount: nextCount,
      });
      showToast(data?.message || "Comment posted.");
      closeComposer();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to post comment.");
    } finally {
      setCommentSaving(false);
    }
  };

  const commentComposer = commentOpen ? (
    <div
      className={variant === "card" ? "px-3.5 pb-3" : "mt-3"}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <form
        onSubmit={submitInlineComment}
        className="rounded-lg border border-fo-border bg-fo-bg p-3 space-y-2.5"
      >
        <textarea
          ref={commentInputRef}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          rows={2}
          placeholder="Write a comment…"
          className="w-full bg-transparent text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none resize-y min-h-[56px]"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(post);
            }}
            className="text-[11px] text-fo-subtle hover:text-fo-accent transition-colors"
          >
            Open full discussion
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeComposer}
              disabled={commentSaving}
              className="px-3 py-1.5 rounded-lg text-xs text-fo-muted hover:text-fo-text transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={commentSaving || !commentText.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-fo-accent text-black text-xs font-semibold hover:bg-fo-accent-hover disabled:opacity-50 transition-colors"
            >
              {commentSaving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : null}
              Post
            </button>
          </div>
        </div>
      </form>
    </div>
  ) : null;

  if (variant === "card") {
    return (
      <article
        role="link"
        tabIndex={0}
        onClick={activate}
        onKeyDown={onKeyDown}
        aria-label={`Open post: ${openLabel}`}
        className={`group bg-fo-surface border rounded-xl overflow-hidden cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${borderClass} ${
          showActions || commentOpen ? "" : "pb-3"
        }`}
      >
        <div className="px-3.5 py-3 space-y-2">
          <div className="flex items-start gap-2.5">
            <PostAuthorAvatar author={post?.author} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 min-w-0">
                <UserProfileLink
                  author={post?.author}
                  className="font-semibold text-sm text-fo-text hover:text-fo-accent transition-colors truncate"
                >
                  {authorName}
                </UserProfileLink>
                {isVerified ? (
                  <BadgeCheck
                    size={13}
                    className="text-fo-accent shrink-0"
                    aria-label="Verified"
                  />
                ) : null}
              </div>
              <div className="flex items-center gap-1 text-xs text-fo-subtle flex-wrap">
                {username ? <span>@{username}</span> : null}
                {username ? <span aria-hidden>·</span> : null}
                <span>{timeAgo(post?.createdAt)}</span>
                <span aria-hidden>·</span>
                {showCommunity && communityTo ? (
                  <Link
                    to={communityTo}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 hover:text-fo-accent transition-colors"
                  >
                    <VisibilityIcon size={11} aria-hidden />
                    {visibilityLabel}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <VisibilityIcon size={11} aria-hidden />
                    {visibilityLabel}
                  </span>
                )}
              </div>
            </div>
            <PostMoreMenu post={post} />
          </div>

          {title ? (
            <h3 className="text-sm font-semibold text-fo-text leading-snug group-hover:text-fo-accent transition-colors line-clamp-2">
              {title}
            </h3>
          ) : null}

          {post?.text ? (
            <p className="text-[13px] text-fo-muted line-clamp-2 leading-snug">
              {post.text}
            </p>
          ) : null}
        </div>

        {media.length > 0 ? (
          <div
            className="px-3 pb-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-lg">
              <PostMediaGallery
                media={media}
                counterOverlay={media.length > 1}
                heightClass="aspect-video"
                autoPlayOnView
              />
            </div>
          </div>
        ) : null}

        {showActions ? (
          <div
            className="px-3.5 py-2.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <PostActions
              post={post}
              compact
              onLike={onLike}
              onReshare={onReshare}
              onComment={handleCommentClick}
              onSave={onSave}
            />
          </div>
        ) : null}

        {commentComposer}
      </article>
    );
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={activate}
      onKeyDown={onKeyDown}
      aria-label={`Open post: ${openLabel}`}
      className={`group bg-fo-surface border rounded-[16px] overflow-hidden cursor-pointer transition-colors p-4 shadow-[0_1px_2px_rgba(26,22,18,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${borderClass}`}
    >
      <div className="flex gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-[12px] text-fo-subtle flex-wrap">
            <UserProfileLink
              author={post?.author}
              className="font-semibold text-fo-text hover:text-fo-accent transition-colors"
            >
              {authorName}
            </UserProfileLink>
            <span aria-hidden>·</span>
            <span>{timeAgo(post?.createdAt)}</span>
          </div>

          {title ? (
            <h2 className="text-sm sm:text-base font-semibold text-fo-text leading-snug group-hover:text-fo-accent transition-colors line-clamp-2">
              {title}
            </h2>
          ) : null}

          {post?.text ? (
            <p className="text-xs sm:text-sm text-fo-muted line-clamp-2 leading-relaxed">
              {post.text}
            </p>
          ) : null}

          {showActions ? (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <PostActions
                post={post}
                compact
                onLike={onLike}
                onReshare={onReshare}
                onComment={handleCommentClick}
                onSave={onSave}
              />
            </div>
          ) : null}
        </div>

        {coverImage ? (
          <div className="hidden sm:block w-24 h-20 shrink-0 rounded-xl overflow-hidden bg-fo-surface-2 border border-fo-border">
            <img
              src={coverImage.url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}
      </div>

      {commentComposer}
    </article>
  );
}
