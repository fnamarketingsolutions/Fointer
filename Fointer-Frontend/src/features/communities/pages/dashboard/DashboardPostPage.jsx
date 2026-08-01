import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import PostDetail from "../../../posts/pages/PostDetail";

export default function DashboardPostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const backTo = "/dashboard/posts";

  return (
    <PostDetail
      postId={postId}
      embedded
      onBack={() => navigate(backTo)}
      onDeleted={() => navigate(backTo)}
      postPathBuilder={(id) => `/dashboard/posts/${id}`}
    />
  );
}
