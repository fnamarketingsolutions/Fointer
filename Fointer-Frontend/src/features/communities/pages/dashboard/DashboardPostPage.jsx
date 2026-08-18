import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LuLoaderCircle as Loader2 } from "react-icons/lu";
import PostDetail from "../../../posts/pages/PostDetail";
import { postSegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";

export default function DashboardPostPage() {
  const { postId: postParam } = useParams();
  const { id: postId, resolving, notFound } = useEntityId("post", postParam);
  const navigate = useNavigate();
  const backTo = "/post-management";

  if (resolving) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#A69B8D]">
        <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
        Loading post…
      </div>
    );
  }

  if (notFound || !postId) {
    return (
      <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
        Post not found.
      </div>
    );
  }

  return (
    <PostDetail
      postId={postId}
      embedded
      onBack={() => navigate(backTo)}
      onDeleted={() => navigate(backTo)}
      postPathBuilder={(post) => `${backTo}/${postSegment(post)}`}
    />
  );
}
