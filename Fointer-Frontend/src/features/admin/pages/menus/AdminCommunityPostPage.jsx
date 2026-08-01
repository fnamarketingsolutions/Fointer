import { useNavigate, useParams } from 'react-router-dom';
import PostDetail from '../../../posts/pages/PostDetail';

export default function AdminCommunityPostPage() {
  const { id, postId } = useParams();
  const navigate = useNavigate();
  const backTo = `/admin/communities/${id}`;

  return (
    <PostDetail
      postId={postId}
      embedded
      // backLabel="Back to community"
      onBack={() => navigate(backTo)}
      onDeleted={() => navigate(backTo)}
      postPathBuilder={(pid) => `/admin/communities/${id}/posts/${pid}`}
    />
  );
}
