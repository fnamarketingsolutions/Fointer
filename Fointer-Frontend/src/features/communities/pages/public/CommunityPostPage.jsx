import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import PostDetail from "../../../posts/pages/PostDetail";
import { postSegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";

export default function CommunityPostPage() {
  const { communityId, postId: postParam } = useParams();
  const { id: postId } = useEntityId("post", postParam);
  const navigate = useNavigate();

  const backTo = `/communities/${communityId}`;

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8]">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <PostDetail
          postId={postId}
          backTo={backTo}
          backLabel="Back to community"
          onBack={() => navigate(backTo)}
          onDeleted={() => navigate(backTo)}
          postPathBuilder={(post) => `${backTo}/posts/${postSegment(post)}`}
        />
      </div>
    </div>
  );
}
