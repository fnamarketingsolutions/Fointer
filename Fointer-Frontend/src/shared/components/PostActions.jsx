import { useNavigate } from "react-router-dom";
import {
  LuHeart as Heart,
  LuMessageCircle as MessageCircle,
  LuRepeat2 as Repeat2,
  LuShare2 as Share2,
} from "react-icons/lu";
import { useAuth } from "../../context/AuthContext";
import { communitySegment, postSegment } from "../services/entityLinks";
import { useToast } from "./feedback/ToastContext";

function postSharePath(post) {
  const postSeg = postSegment(post) || post?.id;
  if (!postSeg) return `${window.location.pathname}${window.location.search}`;
  const communitySeg = post?.community
    ? communitySegment(post.community) || post.community.id
    : null;
  return communitySeg
    ? `/communities/${communitySeg}/posts/${postSeg}`
    : `/post/${postSeg}`;
}

export default function PostActions({
  post,
  onLike,
  onReshare,
  onComment,
  compact = false,
  className = "",
}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const requireAuth = (event) => {
    event?.stopPropagation?.();
    if (!isAuthenticated) {
      navigate("/login", {
        state: {
          from: `${window.location.pathname}${window.location.search}`,
        },
      });
      return false;
    }
    return true;
  };

  const handleLike = (event) => {
    if (!requireAuth(event)) return;
    onLike?.(event);
  };

  const handleReshare = (event) => {
    if (!requireAuth(event)) return;
    onReshare?.(event);
  };

  const handleComment = (event) => {
    event?.stopPropagation?.();
    onComment?.(event);
  };

  const handleShare = async (event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    const url = `${window.location.origin}${postSharePath(post)}`;
    const title = post?.title || "Fointer post";
    const text = String(post?.text || post?.content || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text: text || title, url });
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied.");
    } catch {
      showToast("Could not copy link.");
    }
  };

  const iconSize = compact ? 15 : 16;

  const itemClass = (active) =>
    `inline-flex items-center gap-1 text-xs font-medium transition-colors rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
      active ? "text-fo-accent" : "text-fo-muted hover:text-fo-text"
    }`;

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <button
        type="button"
        onClick={handleLike}
        className={itemClass(post?.likedByMe)}
        title="Like"
      >
        <Heart
          size={iconSize}
          className={post?.likedByMe ? "fill-current" : ""}
        />
        <span>{post?.likeCount || 0}</span>
      </button>

      <button
        type="button"
        onClick={handleComment}
        className={itemClass(false)}
        title="Comment"
      >
        <MessageCircle size={iconSize} />
        <span>{post?.commentCount || 0}</span>
      </button>

      <button
        type="button"
        onClick={handleReshare}
        className={itemClass(post?.resharedByMe)}
        title={post?.resharedByMe ? "Undo repost" : "Repost"}
      >
        <Repeat2 size={iconSize} />
        <span>{post?.reshareCount || 0}</span>
      </button>

      <button
        type="button"
        onClick={handleShare}
        className={itemClass(false)}
        title="Share"
      >
        <Share2 size={iconSize} />
        <span>Share</span>
      </button>
    </div>
  );
}
