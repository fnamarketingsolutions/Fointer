import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import PostDetail from "../../../posts/pages/PostDetail";
import { postSegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";

export default function DashboardPostPage() {
  const { postId: postParam } = useParams();
  const { id: postId } = useEntityId("post", postParam);
  const navigate = useNavigate();
  const backTo = "/dashboard/posts";

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
