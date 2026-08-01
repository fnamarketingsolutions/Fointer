import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import PostDetail from "../../../posts/pages/PostDetail";

export default function ManagePostPage() {
  const { communityId, postId } = useParams();
  const navigate = useNavigate();
  const backTo = `/dashboard/manage/${communityId}`;

  return (
    <PostDetail
      postId={postId}
      embedded
      // backLabel="Back to community"
      onBack={() => navigate(backTo)}
      onDeleted={() => navigate(backTo)}
      postPathBuilder={(id) =>
        `/dashboard/manage/${communityId}/posts/${id}`
      }
    />
  );
}
