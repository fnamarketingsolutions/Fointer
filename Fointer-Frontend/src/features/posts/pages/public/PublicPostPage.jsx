import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import PostDetail from "../PostDetail";
import { fetchPublicPost } from "../../../../api/posts";

export default function PublicPostPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const backTo = "/posts";

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8]">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <PostDetail
          postId={postId}
          onBack={() => navigate(backTo)}
          onDeleted={() => navigate(backTo)}
          postPathBuilder={(id) => `/posts/${id}`}
          fetchPostFn={fetchPublicPost}
        />
      </div>
    </div>
  );
}
