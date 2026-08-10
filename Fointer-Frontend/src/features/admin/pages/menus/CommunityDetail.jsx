import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Grid,
  Heart,
  Layers,
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
import {
  communitySegment,
  postSegment,
} from '../../../../shared/services/entityLinks';
import useEntityId from '../../../../shared/hooks/useEntityId';
import { useToast } from '../../../../shared/components/feedback/ToastContext';

const formatType = formatCommunityType;

function Collapsible({ open, collapsedHeight = 0, children }) {
  const innerRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(
    open ? 'none' : `${collapsedHeight}px`
  );

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    setMaxHeight(`${el.scrollHeight}px`);
    if (open) return;
    const id = requestAnimationFrame(() =>
      setMaxHeight(`${collapsedHeight}px`)
    );
    return () => cancelAnimationFrame(id);
  }, [open, collapsedHeight, children]);

  return (
    <div
      style={{ maxHeight }}
      onTransitionEnd={(e) => {
        if (
          open &&
          e.target === e.currentTarget &&
          e.propertyName === 'max-height'
        ) {
          setMaxHeight('none');
        }
      }}
      className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

export default function CommunityDetail() {
  const { id: communityParam } = useParams();
  const { id, notFound } = useEntityId('community', communityParam);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);
  const [heroPreview, setHeroPreview] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState('latest');
  const [editingCommunity, setEditingCommunity] = useState(null);
  const [communityToDelete, setCommunityToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [subchannelsExpanded, setSubchannelsExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchAdminCommunityDetail(id);
      setDetail(data);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to load community detail.');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  const loadPosts = useCallback(async () => {
    if (!id) return;
    setPostsLoading(true);
    try {
      const data = await fetchPosts({ communityId: id });
      setPosts(data?.posts || []);
    } catch (err) {
      setPosts([]);
      showToast(err?.response?.data?.message || 'Failed to load posts.');
    } finally {
      setPostsLoading(false);
    }
  }, [id, showToast]);

  const handleRefresh = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchAdminCommunityDetail(id);
      setDetail(data);
      await loadPosts();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to refresh community.');
    }
  }, [id, loadPosts, showToast]);

  const handleEditSuccess = useCallback(
    async (updatedCommunity) => {
      if (updatedCommunity?.id) {
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                community: {
                  ...(prev.community || {}),
                  ...updatedCommunity,
                },
              }
            : prev
        );
      }
      setEditingCommunity(null);
      await handleRefresh();
    },
    [handleRefresh]
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    setHeroPreview(null);
    setSubchannelsExpanded(false);
    loadPosts();
  }, [loadPosts]);

  const moderators = useMemo(
    () => (detail?.members || []).filter((m) => m.role === 'moderator'),
    [detail]
  );

  const community = detail?.community;
  const galleryImages = community?.galleryImages || [];
  const heroImage = heroPreview || community?.coverImage || galleryImages[0] || '';

  const channelName =
    typeof community?.channel === 'object'
      ? community?.channel?.name
      : community?.channel || '';
  const channelId =
    typeof community?.channel === 'object'
      ? community?.channel?.id
      : community?.channel || null;

  const rawSubchannels = Array.isArray(community?.subchannels)
    ? community.subchannels
    : [];
  const subchannelList = rawSubchannels.map((sub) =>
    typeof sub === 'object'
      ? { id: sub.id, name: sub.name || sub.id }
      : { id: sub, name: sub }
  );
  const primarySubchannels = subchannelList.slice(0, 2);
  const extraSubchannels = subchannelList.slice(2);

  const sortedPosts = useMemo(() => {
    const list = [...posts];
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [posts]);

  const openChannelManagement = () => {
    const params = new URLSearchParams();
    if (channelName) params.set('q', channelName);
    navigate(`/admin/channels${params.toString() ? `?${params}` : ''}`);
  };

  const openSubchannelManagement = (subName) => {
    const params = new URLSearchParams();
    params.set('tab', 'subchannels');
    if (subName) params.set('q', subName);
    else if (channelName) params.set('q', channelName);
    if (channelId) params.set('channelId', channelId);
    navigate(`/admin/channels?${params.toString()}`);
  };

  const handleConfirmDelete = async () => {
    if (!communityToDelete) return;
    setDeleting(true);
    try {
      await deleteCommunity(communityToDelete.id);
      setCommunityToDelete(null);
      navigate('/admin/communities');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete community.'));
    } finally {
      setDeleting(false);
    }
  };

  const openPost = (post) => {
    if (!id || !post?.id) return;
    const segment = community ? communitySegment(community) : communityParam;
    navigate(`/admin/communities/${segment}/posts/${postSegment(post)}`);
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full">
      {/* Top Header Actions */}
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

      {loading && !notFound ? (
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
          {/* Main Content Layout: Left 40% | Right 60% */}
          <div className="grid grid-cols-1 lg:grid-cols-[40%_1fr] gap-4 lg:gap-6">
            
            {/* LEFT COLUMN (40%): Hero Cover + Description + Members */}
            <div className="space-y-4">
              {/* Cover Image Block (No Text Overlay) */}
              <div className="relative rounded-xl overflow-hidden border border-[#2A241E] bg-[#0E0C0A]">
                <div className="relative h-64 sm:h-80 lg:h-[380px]">
                  {heroImage ? (
                    <img src={heroImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-stone-900 to-[#0E0C0A]" />
                  )}
                </div>
              </div>

              {/* Description Section (Below Cover Image) */}
              <section className="rounded-xl border border-[#2A241E] bg-[#141210] p-4 sm:p-5">
                <h3 className="text-xs uppercase tracking-wider text-[#A69B8D] mb-2 font-semibold">
                  Description
                </h3>
                <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-[#E5E0D8]">
                  {community?.description || 'No description available.'}
                </p>
              </section>

              {/* Members Section (Below Description) */}
              <section className="rounded-xl border border-[#2A241E] bg-[#141210] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[#D4AF37]">
                    <Users size={16} />
                    <h3 className="font-semibold text-xs sm:text-sm uppercase tracking-wider">
                      Members ({community?.memberCount || detail.members?.length || 0})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMembersOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-xs text-[#A69B8D] hover:text-[#D4AF37] transition-colors"
                  >
                    {membersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {membersOpen ? 'Hide' : 'Show'}
                  </button>
                </div>

                {membersOpen && (
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#2A241E]">
                    {detail.members?.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs sm:text-sm font-medium text-[#E5E0D8]">
                            {member.user?.name || member.user?.username}
                          </p>
                          <p className="truncate text-[10px] sm:text-[11px] text-[#8C8070]">
                            @{member.user?.username} · {member.role}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {moderators.length > 0 && (
                  <p className="mt-3 text-[11px] text-[#8C8070] border-t border-[#2A241E] pt-2">
                    Active moderators:{' '}
                    <span className="text-[#E5E0D8]">
                      {moderators.map((m) => m.user?.username).filter(Boolean).join(', ')}
                    </span>
                  </p>
                )}
              </section>
            </div>

            {/* RIGHT COLUMN (60%): Gallery + Overview + Owner + Channel/Subchannels + Rules + Tags */}
            <div className="space-y-4">
              
              {/* Header Title + Badges */}
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-[#D4AF37] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                    <Shield size={10} /> Admin View
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                    {formatType(community?.type)}
                  </span>
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#D4AF37] leading-tight mt-1">
                  {community?.name}
                </h1>
              </div>

              {/* Gallery Thumbnails */}
              {(community?.coverImage || galleryImages.length > 0) && (
                <div className="rounded-xl border border-[#2A241E] bg-[#141210] p-3.5">
                  <h3 className="text-[10px] uppercase tracking-wider text-[#A69B8D] mb-2 font-semibold">
                    Gallery Images
                  </h3>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {community?.coverImage && (
                      <button
                        type="button"
                        onClick={() => setHeroPreview(community.coverImage)}
                        className={`relative aspect-square overflow-hidden rounded-lg border transition-all ${
                          heroImage === community.coverImage
                            ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/50'
                            : 'border-[#2A241E] hover:border-[#D4AF37]/40'
                        }`}
                      >
                        <img src={community.coverImage} alt="" className="w-full h-full object-cover" />
                      </button>
                    )}
                    {galleryImages.map((img) => (
                      <button
                        key={img}
                        type="button"
                        onClick={() => setHeroPreview(img)}
                        className={`aspect-square overflow-hidden rounded-lg border transition-all ${
                          heroImage === img
                            ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/50'
                            : 'border-[#2A241E] hover:border-[#D4AF37]/40'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Community Overview Cards */}
              <section className="rounded-xl border border-[#2A241E] bg-[#141210] p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-[#D4AF37]" />
                  <h2 className="font-serif text-base sm:text-lg font-semibold text-[#E5E0D8]">
                    Community Overview
                  </h2>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-[#8C8070]">Type</p>
                    <p className="mt-1 text-xs sm:text-sm font-semibold text-[#D4AF37] truncate">
                      {formatType(community?.type)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-[#8C8070]">Members</p>
                    <p className="mt-1 text-xs sm:text-sm font-semibold text-[#E5E0D8]">
                      {(community?.memberCount ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-[#8C8070]">Posts</p>
                    <p className="mt-1 text-xs sm:text-sm font-semibold text-[#E5E0D8]">
                      {postsLoading ? '...' : posts.length}
                    </p>
                  </div>
                </div>

                {/* Owner Info Block */}
                <div className="pt-2 border-t border-[#2A241E]">
                  <div className="text-[10px] uppercase tracking-wider text-[#8C8070] mb-1 font-semibold">
                    Owner
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8]">
                    <span className="font-medium">
                      {community?.owner?.name || community?.owner?.username || 'Unknown owner'}
                    </span>
                    {community?.owner?.username && (
                      <span className="text-[#8C8070]">
                        (@{community.owner.username})
                      </span>
                    )}
                  </div>
                </div>

                {/* Channel & Subchannels Section */}
                {(channelName || subchannelList.length > 0) && (
                  <div className="space-y-3 pt-2 border-t border-[#2A241E]">
                    {channelName && (
                      <div>
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8C8070] mb-1 font-bold">
                          <Layers size={12} className="text-[#D4AF37]" />
                          Channel
                          <button
                          type="button"
                          onClick={openChannelManagement}
                          className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold hover:bg-[#D4AF37]/25 transition-colors"
                        >
                          {channelName}
                        </button>
                        </div>
                      
                      </div>
                    )}

                    {subchannelList.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8C8070] mb-1.5 font-bold">
                          <Grid size={12} className="text-[#D4AF37]" />
                          Subchannels ({subchannelList.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {primarySubchannels.map((sub) => (
                            <button
                              key={sub.id || sub.name}
                              type="button"
                              onClick={() => openSubchannelManagement(sub.name)}
                              className="px-2 py-0.5 rounded-md bg-[#1C1612] border border-[#2A241E] text-[#E5E0D8] text-[11px] font-medium hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-colors"
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>

                        {extraSubchannels.length > 0 && (
                          <>
                            <Collapsible open={subchannelsExpanded}>
                              <div className="flex flex-wrap gap-1.5 pt-1.5">
                                {extraSubchannels.map((sub) => (
                                  <button
                                    key={sub.id || sub.name}
                                    type="button"
                                    onClick={() => openSubchannelManagement(sub.name)}
                                    className="px-2 py-0.5 rounded-md bg-[#1C1612] border border-[#2A241E] text-[#E5E0D8] text-sm font-medium hover:border-[#D4AF37]/40 hover:text-[#D4AF37] transition-colors"
                                  >
                                    {sub.name}
                                  </button>
                                ))}
                              </div>
                            </Collapsible>
                            <button
                              type="button"
                              onClick={() => setSubchannelsExpanded((v) => !v)}
                              className="mt-2 text-[13px] font-medium text-[#D4AF37] hover:text-[#e0c04a] transition-colors"
                            >
                              {subchannelsExpanded
                                ? 'View less'
                                : `View more (${extraSubchannels.length})`}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Rules Section (Below Subchannels) */}
             {/* Rules Section */}
{community?.rules && (
  <div className="pt-2 border-t border-[#2A241E]">
    <div className="mb-1.5 text-[10px] uppercase text-[#8C8070] font-semibold">Rules</div>
    {(() => {
      const lines = community.rules.split('\n').map((r) => r.trim()).filter(Boolean);
      const main = lines.slice(0, 3);
      const extra = lines.slice(3);

      return (
        <>
          <ol className="space-y-1 text-sm text-[#E5E0D8]">
            {main.map((r, i) => <li key={i}><span className="text-[#D4AF37] font-bold">{i + 1}.</span> {r}</li>)}
          </ol>
          {extra.length > 0 && (
            <>
              <Collapsible open={rulesExpanded}>
                <ol className="space-y-1 pt-1 text-sm text-[#E5E0D8]">
                  {extra.map((r, i) => <li key={i + 3}><span className="text-[#D4AF37] font-bold">{i + 4}.</span> {r}</li>)}
                </ol>
              </Collapsible>
              <button type="button" onClick={() => setRulesExpanded(!rulesExpanded)} className="mt-1 text-[13px] text-[#D4AF37]">
                {rulesExpanded ? 'View less' : `View more (${extra.length})`}
              </button>
            </>
          )}
        </>
      );
    })()}
  </div>
)}

                {/* Tags Section (Below Rules) */}
                {community?.tags?.length > 0 && (
                  <div className="pt-2 border-t border-[#2A241E]">
                    <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[#8C8070] font-semibold">
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {community.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-2 py-0.5 text-[11px] text-[#D4AF37]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Posts Feed Section */}
          <section className="pt-4">
            <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#D4AF37]">
                Community Posts
              </h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'latest', label: 'Latest' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setFeedFilter(filter.id)}
                    className={`rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-colors ${
                      feedFilter === filter.id
                        ? 'bg-[#D4AF37] text-black'
                        : 'border border-[#2A241E] bg-[#141210] text-[#A69B8D] hover:text-[#E5E0D8]'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {postsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#A69B8D]">
                <Loader2 size={14} className="animate-spin" />
                Loading posts...
              </div>
            ) : sortedPosts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#2A241E] px-4 py-12 text-center text-xs text-[#8C8070]">
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
                      onClick={() => openPost(post)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openPost(post);
                      }}
                      className="cursor-pointer flex flex-col justify-between rounded-xl border border-[#2A241E] bg-[#141210] p-3.5 transition-all hover:border-[#D4AF37]/40 hover:bg-[#181512]"
                    >
                      <div>
                        <div className="mb-2.5 flex items-center gap-2.5">
                          {post.author?.avatar ? (
                            <img
                              src={post.author.avatar}
                              alt=""
                              className="h-7 w-7 shrink-0 rounded-full border border-[#2A241E] object-cover"
                            />
                          ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/15 text-xs font-semibold text-[#D4AF37]">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-[#E5E0D8]">{authorName}</div>
                            <div className="text-[10px] text-[#8C8070]">{timeAgo(post.createdAt)}</div>
                          </div>
                        </div>

                        {post.title && (
                          <h3 className="mb-1 line-clamp-1 font-serif text-xs font-semibold text-[#E5E0D8] sm:text-sm">
                            {post.title}
                          </h3>
                        )}

                        {post.text && (
                          <p className="line-clamp-2 text-xs leading-relaxed text-[#A69B8D]">
                            {post.text}
                          </p>
                        )}

                        {post.media?.length > 0 && (
                          <div className="mt-2.5 max-h-40 overflow-hidden rounded-lg border border-[#2A241E]">
                            <PostMediaGallery media={post.media} />
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-3 border-t border-[#2A241E] pt-2.5 text-[10px] text-[#8C8070]">
                        <span className="inline-flex items-center gap-1">
                          <Heart size={12} className="text-[#D4AF37]/80" />
                          {formatCount(post.likeCount)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle size={12} className="text-[#D4AF37]/80" />
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

      {/* Edit & Delete Modals */}
      <EditCommunityModal
        community={editingCommunity}
        onClose={() => setEditingCommunity(null)}
        onSuccess={handleEditSuccess}
      />

      <ConfirmDeleteModal
        open={Boolean(communityToDelete)}
        title="Delete Community"
        variant="dashboard"
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