import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import PostDetail from "../../../posts/pages/PostDetail";
import { postSegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";

export default function ManagePostPage() {
  const { communityId, postId: postParam } = useParams();
  const { id: postId, resolving } = useEntityId("post", postParam);
  const navigate = useNavigate();
  const backTo = `/dashboard/manage/${communityId}`;

  return (
    <PostDetail
      postId={postId}
      resolving={resolving}
      embedded
      // backLabel="Back to community"
      onBack={() => navigate(backTo)}
      onDeleted={() => navigate(backTo)}
      postPathBuilder={(post) => `${backTo}/posts/${postSegment(post)}`}
    />
  );
}
