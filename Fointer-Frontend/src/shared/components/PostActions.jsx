import { useNavigate } from "react-router-dom";
import {
  LuHeart as Heart,
  LuMessageCircle as MessageCircle,
  LuRepeat2 as Repeat2,
} from "react-icons/lu";
import { useAuth } from "../../context/AuthContext";

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

  const requireAuth = (event) => {
    event?.stopPropagation?.();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: window.location.pathname } });
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

  const itemClass = (active) =>
    `inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
      active ? "text-[#D4AF37]" : "text-[#A69B8D] hover:text-[#E5E0D8]"
    }`;

  return (
    <div className={`flex items-center gap-5 ${className}`}>
      <button
        type="button"
        onClick={handleLike}
        className={itemClass(post?.likedByMe)}
        title="Like"
      >
        <Heart
          size={compact ? 14 : 16}
          className={post?.likedByMe ? "fill-current" : ""}
        />
        <span>
          {post?.likeCount || 0}
          {compact ? "" : " Likes"}
        </span>
      </button>

      <button
        type="button"
        onClick={handleReshare}
        className={itemClass(post?.resharedByMe)}
        title={post?.resharedByMe ? "Undo repost" : "Repost"}
      >
        <Repeat2 size={compact ? 14 : 16} />
        <span>
          {post?.reshareCount || 0}
          {compact ? "" : " Reposts"}
        </span>
      </button>

      <button
        type="button"
        onClick={handleComment}
        className={itemClass(false)}
        title="Comment"
      >
        <MessageCircle size={compact ? 14 : 16} />
        <span>
          {post?.commentCount || 0}
          {compact ? "" : " Comments"}
        </span>
      </button>
    </div>
  );
}
