import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { fetchAdminCommunityDetail } from '../../../../api/dashboard';
import { deleteCommunity } from '../../../../api/communities';
import { fetchPosts } from '../../../../api/posts';
import PostMediaGallery from '../../../../shared/components/media/PostMediaGallery';
import ConfirmDeleteModal from '../../../../shared/components/modals/ConfirmDeleteModal';
import EditCommunityModal from '../../../../shared/components/modals/EditCommunityModal';
import { formatCommunityType } from '../../../../shared/utils/community';
import { timeAgo } from '../../../../shared/utils/date';
import { formatCount } from '../../../../shared/utils/format';
import { getErrorMessage } from '../../../../shared/utils/errors';

const formatType = formatCommunityType;

export default function CommunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);
  const [heroPreview, setHeroPreview] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState('latest');
  const [editingCommunity, setEditingCommunity] = useState(null);
  const [communityToDelete, setCommunityToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminCommunityDetail(id);
      setDetail(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load community detail.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadPosts = useCallback(async () => {
    if (!id) return;
    setPostsLoading(true);
    try {
      const data = await fetchPosts({ communityId: id });
      setPosts(data?.posts || []);
    } catch (err) {
      setPosts([]);
      setError((prev) => prev || err?.response?.data?.message || 'Failed to load posts.');
    } finally {
      setPostsLoading(false);
    }
  }, [id]);

  const handleRefresh = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const data = await fetchAdminCommunityDetail(id);
      setDetail(data);
      await loadPosts();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to refresh community.');
    }
  }, [id, loadPosts]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    setHeroPreview(null);
    loadPosts();
  }, [loadPosts]);

  const moderators = useMemo(
    () => (detail?.members || []).filter((m) => m.role === 'moderator'),
    [detail]
  );

  const community = detail?.community;
  const galleryImages = community?.galleryImages || [];
  const heroImage = heroPreview || community?.coverImage || galleryImages[0] || '';

  const sortedPosts = useMemo(() => {
    const list = [...posts];
    // if (feedFilter === 'trending') {
    //   return list.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    // }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [feedFilter, posts]);

  const handleConfirmDelete = async () => {
    if (!communityToDelete) return;
    setDeleting(true);
    setError('');
    try {
      await deleteCommunity(communityToDelete.id);
      setCommunityToDelete(null);
      navigate('/admin/communities');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete community.'));
    } finally {
      setDeleting(false);
    }
  };

  const openPost = (postId) => {
    if (!id || !postId) return;
    navigate(`/admin/communities/${id}/posts/${postId}`);
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/communities')}
          className="inline-flex items-center gap-1.5 text-xs text-[#A69B8D] hover:text-[#D4AF37] transition-colors self-start"
        >
          <ArrowLeft size={14} /> Back to communities
        </button>

        {community && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleRefresh}
              className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              type="button"
              onClick={() => setEditingCommunity(community)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setCommunityToDelete(community)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-stone-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading community detail...
        </div>
      ) : !detail?.community ? (
        <div className="border border-dashed border-stone-800 rounded-xl py-12 text-center text-stone-500 text-sm">
          Community not found.
        </div>
      ) : (
        <>
          <section className="relative rounded-xl overflow-hidden border border-stone-800/60">
            <div className="relative h-48 sm:h-64 lg:h-80">
              {heroImage ? (
                <img src={heroImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-stone-900 to-[#0E0C0A]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E0C0A] via-[#0E0C0A]/65 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 lg:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                    <Shield size={10} />
                    Admin View
                  </span>
                  <span className="text-[10px] sm:text-xs uppercase tracking-wider text-amber-300/80">
                    {formatType(community?.type)}
                  </span>
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-semibold text-amber-50 leading-tight">
                  {community?.name}
                </h1>
                {community?.description && (
                  <p className="mt-1.5 max-w-3xl text-xs sm:text-sm text-stone-200/85 line-clamp-3 sm:line-clamp-none">
                    {community.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] sm:text-xs text-stone-300">
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} className="text-amber-300" />
                    {(community?.memberCount ?? 0).toLocaleString()} members
                  </span>
                  {community?.owner && (
                    <span>
                      Owner: {community.owner.name || community.owner.username || 'Unknown'}
                    </span>
                  )}
                  {community?.createdAt && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={12} className="text-amber-300" />
                      {new Date(community.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {(community?.coverImage || galleryImages.length > 0) && (
            <section>
              <h2 className="mb-2 text-[10px] sm:text-xs uppercase tracking-wider text-stone-500">
                Community Images
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
                {community?.coverImage && (
                  <button
                    type="button"
                    onClick={() => setHeroPreview(community.coverImage)}
                    className={`relative aspect-[4/3] overflow-hidden rounded-lg border transition-all ${
                      heroImage === community.coverImage
                        ? 'border-amber-400 ring-1 ring-amber-400/50'
                        : 'border-stone-800/60 hover:border-amber-500/40'
                    }`}
                  >
                    <img src={community.coverImage} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[8px] text-amber-300">
                      Cover
                    </span>
                  </button>
                )}
                {galleryImages.map((img) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setHeroPreview(img)}
                    className={`aspect-[4/3] overflow-hidden rounded-lg border transition-all ${
                      heroImage === img
                        ? 'border-amber-400 ring-1 ring-amber-400/50'
                        : 'border-stone-800/60 hover:border-amber-500/40'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:gap-6">
            <section className="rounded-xl border border-stone-800/60 bg-[#141210] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-amber-200">
                <Users size={16} />
                <h2 className="font-semibold text-sm sm:text-base">
                  Members ({community?.memberCount || detail.members?.length || 0})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMembersOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs text-stone-300 hover:text-amber-300"
              >
                {membersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {membersOpen ? 'Hide members' : 'Show members'}
              </button>

              {membersOpen && (
                <div className="mt-4 space-y-2">
                  {detail.members?.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col gap-3 rounded-lg border border-stone-800/60 bg-[#0E0C0A] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-amber-50">
                          {member.user?.name || member.user?.username}
                        </p>
                        <p className="truncate text-[11px] text-stone-500">
                          @{member.user?.username} · {member.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {moderators.length > 0 && (
                <p className="mt-3 text-xs text-stone-500">
                  Active moderators:{' '}
                  {moderators.map((m) => m.user?.username).filter(Boolean).join(', ')}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-stone-800/60 bg-[#141210] p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Shield size={16} className="text-amber-300" />
                <h2 className="font-serif text-lg font-semibold text-amber-50">
                  Community Overview
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-stone-800/60 bg-[#0E0C0A] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-stone-500">Type</p>
                  <p className="mt-1 text-sm font-semibold text-amber-50">
                    {formatType(community?.type)}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-800/60 bg-[#0E0C0A] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-stone-500">Members</p>
                  <p className="mt-1 text-sm font-semibold text-amber-50">
                    {(community?.memberCount ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-800/60 bg-[#0E0C0A] p-3 col-span-2 sm:col-span-1">
                  <p className="text-[10px] uppercase tracking-wider text-stone-500">Posts</p>
                  <p className="mt-1 text-sm font-semibold text-amber-50">
                    {postsLoading ? '...' : posts.length}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4 border-t border-stone-800/60 pt-4">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-stone-500">
                    Owner
                  </div>
                  <p className="text-sm text-stone-200">
                    {community?.owner?.name || community?.owner?.username || 'Unknown owner'}
                  </p>
                  {community?.owner?.username && (
                    <p className="mt-0.5 text-xs text-stone-500">
                      @{community.owner.username}
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-stone-500">
                    Description
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-300">
                    {community?.description || 'No description available.'}
                  </p>
                </div>

                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-stone-500">
                    Rules
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-300">
                    {community?.rules || 'No rules added yet.'}
                  </p>
                </div>

                {community?.tags?.length > 0 && (
                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-stone-500">
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {community.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section>
            <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-amber-50">
                Community Posts
              </h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'latest', label: 'Latest' },
                  // { id: 'trending', label: 'Trending' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setFeedFilter(filter.id)}
                    className={`rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-colors ${
                      feedFilter === filter.id
                        ? 'bg-amber-400 text-black'
                        : 'border border-stone-800/60 bg-[#141210] text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {postsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-stone-400">
                <Loader2 size={14} className="animate-spin" />
                Loading posts...
              </div>
            ) : sortedPosts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-800/60 px-4 py-12 text-center text-xs text-stone-500">
                No posts found for this community yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {sortedPosts.map((post) => {
                  const authorName = post.author?.name || post.author?.username || 'Member';
                  const initial = authorName.charAt(0).toUpperCase();
                  return (
                    <article
                      key={post.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openPost(post.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openPost(post.id);
                      }}
                      className="cursor-pointer flex flex-col justify-between rounded-xl border border-stone-800/60 bg-[#141210] p-3.5 transition-all hover:border-amber-500/40 hover:bg-[#181512]"
                    >
                      <div>
                        <div className="mb-2.5 flex items-center gap-2.5">
                          {post.author?.avatar ? (
                            <img
                              src={post.author.avatar}
                              alt=""
                              className="h-7 w-7 shrink-0 rounded-full border border-stone-800/60 object-cover"
                            />
                          ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-xs font-semibold text-amber-300">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-amber-50">{authorName}</div>
                            <div className="text-[10px] text-stone-500">{timeAgo(post.createdAt)}</div>
                          </div>
                        </div>

                        {post.title && (
                          <h3 className="mb-1 line-clamp-1 font-serif text-xs font-semibold text-stone-100 sm:text-sm">
                            {post.title}
                          </h3>
                        )}

                        {post.text && (
                          <p className="line-clamp-2 text-xs leading-relaxed text-stone-400">
                            {post.text}
                          </p>
                        )}

                        {post.media?.length > 0 && (
                          <div className="mt-2.5 max-h-40 overflow-hidden rounded-lg border border-stone-800/60">
                            <PostMediaGallery media={post.media} />
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-3 border-t border-stone-800/60 pt-2.5 text-[10px] text-stone-500">
                        <span className="inline-flex items-center gap-1">
                          <Heart size={12} className="text-amber-300/80" />
                          {formatCount(post.likeCount)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle size={12} className="text-amber-300/80" />
                          {formatCount(post.commentCount)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <EditCommunityModal
        community={editingCommunity}
        onClose={() => setEditingCommunity(null)}
        onSuccess={handleRefresh}
      />

      <ConfirmDeleteModal
        open={Boolean(communityToDelete)}
        title="Delete Community"
        variant="dashboard"
        error={error}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setCommunityToDelete(null)}
      >
        <p>
          Are you sure you want to delete{' '}
          <span className="text-[#E5E0D8] font-semibold">
            {communityToDelete?.name}
          </span>
          ? This action cannot be undone.
        </p>
      </ConfirmDeleteModal>
    </div>
  );
}