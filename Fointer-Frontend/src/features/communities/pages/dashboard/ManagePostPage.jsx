import { useNavigate, useParams } from "react-router-dom";
import { PageLoader } from "../../../../shared/components/ThemeSpinner";
import PostDetail from "../../../posts/pages/PostDetail";
import { postSegment } from "../../../../shared/services/entityLinks";
import useEntityId from "../../../../shared/hooks/useEntityId";

export default function ManagePostPage() {
  const { communityId, postId: postParam } = useParams();
  const { id: postId, resolving, notFound } = useEntityId("post", postParam);
  const navigate = useNavigate();
  const backTo = `/communities/manage/${communityId}`;

  if (resolving) {
    return <PageLoader minHeight="py-20" size="md" />;
  }

  if (notFound || !postId) {
    return (
      <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
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
      postPathBuilder={(post) => `${backTo}/posts/${postSegment(post)}`}
    />
  );
}
