import { useNavigate, useParams } from 'react-router-dom';
import PostDetail from '../../../posts/pages/PostDetail';
import { postSegment } from '../../../../shared/services/entityLinks';
import useEntityId from '../../../../shared/hooks/useEntityId';

export default function AdminCommunityPostPage() {
  const { id: communityParam, postId: postParam } = useParams();
  const { id: postId } = useEntityId('post', postParam);
  const navigate = useNavigate();
  const backTo = `/admin/communities/${communityParam}`;

  return (
    <PostDetail
      postId={postId}
      embedded
      // backLabel="Back to community"
      onBack={() => navigate(backTo)}
      onDeleted={() => navigate(backTo)}
      postPathBuilder={(post) => `${backTo}/posts/${postSegment(post)}`}
    />
  );
}
