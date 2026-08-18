import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LuLoaderCircle as Loader2 } from "react-icons/lu";
import PostDetail from "../PostDetail";
import { fetchPublicPost } from "../../../../api/posts";
import { postSegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";

export default function PublicPostPage() {
  const { postId: postParam } = useParams();
  const { id: postId, resolving, notFound } = useEntityId("post", postParam);
  const navigate = useNavigate();
  const backTo = "/";
  const postBase = "/posts";

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8]">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {resolving ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#A69B8D]">
            <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
            Loading post…
          </div>
        ) : notFound || !postId ? (
          <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
            Post not found.
          </div>
        ) : (
          <PostDetail
            postId={postId}
            onBack={() => navigate(backTo)}
            onDeleted={() => navigate(backTo)}
            postPathBuilder={(post) => `${postBase}/${postSegment(post)}`}
            fetchPostFn={fetchPublicPost}
          />
        )}
      </div>
    </div>
  );
}
