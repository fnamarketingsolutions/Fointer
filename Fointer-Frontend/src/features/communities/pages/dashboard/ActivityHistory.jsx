import React, { useCallback, useEffect, useState } from "react";
import {
  Edit3,
  Trash2,
  Clock,
  Loader2,
} from "lucide-react";
import { fetchPosts, deletePost } from "../../../../api/posts";
import PostDetail from "../../../posts/pages/PostDetail";
import ConfirmDeleteModal from "../../../../shared/components/modals/ConfirmDeleteModal";
import { timeAgo } from "../../../../shared/utils/date";

const EDIT_WINDOW_MS = 60 * 60 * 1000;

const getEditWindowLabel = (createdAt, canEdit) => {
  if (!createdAt) return "Edit window expired";
  if (!canEdit) return "Edit window expired";
  const elapsed = Date.now() - new Date(createdAt).getTime();
  const remaining = EDIT_WINDOW_MS - elapsed;
  if (remaining <= 0) return "Edit window expired";
  const mins = Math.ceil(remaining / 60000);
  return `${mins} min${mins === 1 ? "" : "s"} left to edit/delete`;
};

export default function ActivityHistory() {
  const [subTab, setSubTab] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletePostId, setDeletePostId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPosts({ mine: "1" });
      setPosts(data?.posts || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load your posts.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === "posts") {
      loadPosts();
    }
  }, [subTab, loadPosts]);

  const handleDelete = async () => {
    if (!deletePostId) return;
    setDeleting(true);
    setError("");
    try {
      await deletePost(deletePostId);
      setDeletePostId(null);
      await loadPosts();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete post.");
    } finally {
      setDeleting(false);
    }
  };

  if (editingPostId) {
    return (
      <PostDetail
        postId={editingPostId}
        onBack={() => {
          setEditingPostId(null);
          loadPosts();
        }}
        onDeleted={() => {
          setEditingPostId(null);
          loadPosts();
        }}
        backLabel="Back to activity"
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-serif font-bold text-[#E5E0D8]">My Activity History</h2>
        <p className="text-xs text-[#8C8070] mt-1">Manage your authored posts, edit windows, comments, and saved likes.</p>
      </div>

      <div className="flex border-b border-[#2A241E] gap-6 text-sm">
        <button
          onClick={() => setSubTab("posts")}
          className={`pb-3 font-semibold transition-all ${subTab === "posts" ? "text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-[#8C8070] hover:text-[#E5E0D8]"}`}
        >
          My Posts
        </button>
        <button
          onClick={() => setSubTab("comments")}
          className={`pb-3 font-semibold transition-all ${subTab === "comments" ? "text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-[#8C8070] hover:text-[#E5E0D8]"}`}
        >
          Comments & Liked Posts
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {subTab === "posts" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[#A69B8D] text-sm">
              <Loader2 size={16} className="animate-spin" />
              Loading your posts...
            </div>
          ) : posts.length === 0 ? (
            <div className="border border-dashed border-[#2A241E] rounded-xl py-12 text-center text-[#8C8070] text-sm">
              You have not created any posts yet.
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-[#14100D] border border-[#2A241E] p-5 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-[#D4AF37] uppercase">
                      {post.community?.name || "Community"}
                    </span>
                    <h3 className="font-serif font-bold text-base text-[#E5E0D8]">
                      {post.title || "Untitled"}
                    </h3>
                    <p className="text-[10px] text-[#8C8070] mt-1">
                      Posted {timeAgo(post.createdAt)}
                    </p>
                  </div>

                  {post.canEdit ? (
                    <span className="bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 text-[11px] px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5 shrink-0">
                      <Clock size={12} /> {getEditWindowLabel(post.createdAt, post.canEdit)}
                    </span>
                  ) : (
                    <span className="bg-[#2A241E] text-[#8C8070] text-[11px] px-2.5 py-1 rounded-full font-mono shrink-0">
                      {getEditWindowLabel(post.createdAt, post.canEdit)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#2A241E]/40 text-xs text-[#8C8070]">
                  <div className="flex gap-4">
                    <span>{post.likeCount || 0} Likes</span>
                    <span>{post.commentCount || 0} Comments</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!post.canEdit}
                      onClick={() => setEditingPostId(post.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                        post.canEdit
                          ? "border-[#3D3123] text-[#E5E0D8] hover:border-[#D4AF37] hover:text-[#D4AF37]"
                          : "border-[#2A241E] text-[#4A4036] cursor-not-allowed"
                      }`}
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      disabled={!post.canEdit}
                      onClick={() => setDeletePostId(post.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                        post.canEdit
                          ? "border-red-900/40 text-red-400 hover:bg-red-950/40"
                          : "border-[#2A241E] text-[#4A4036] cursor-not-allowed"
                      }`}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === "comments" && (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-12 text-center text-[#8C8070] text-sm px-4">
          Comments and liked posts will appear here in a future update.
        </div>
      )}

      <ConfirmDeleteModal
        open={Boolean(deletePostId)}
        title="Delete post?"
        variant="post"
        loading={deleting}
        disableCloseWhileLoading
        onConfirm={handleDelete}
        onClose={() => setDeletePostId(null)}
      >
        This cannot be undone. Comments and likes will also be removed.
      </ConfirmDeleteModal>
    </div>
  );
}
