  import React, { useCallback, useEffect, useState } from "react";
  import { Link, useNavigate } from "react-router-dom";
  import {
    X,
    Loader2,
    Users,
    Shield,
    Lock,
    Globe,
    UserPlus,
    Calendar,
    Flag,
    Image as ImageIcon,
    Heart,
    MessageCircle,
    Plus,
  } from "lucide-react";
  import {
    fetchBrowsableCommunity,
    fetchBrowsableCommunityMembers,
    requestToJoin,
    joinPublicCommunity,
  } from "../../../api/communities";
  import {
    fetchPosts,
    createPost,
    togglePostLike,
  } from "../../../api/posts";
  import MediaPicker from "../../../shared/components/media/MediaPicker";
  import { useAuth } from "../../../context/AuthContext";
  import { COMMUNITY_TYPE_LABELS } from "../../../shared/constants/community";
  import { formatLongDate, timeAgo } from "../../../shared/utils/date";
  import { formatCount } from "../../../shared/utils/format";

  const TYPE_META = {
    public: { label: COMMUNITY_TYPE_LABELS.public, icon: Globe },
    private_invite: { label: COMMUNITY_TYPE_LABELS.private_invite, icon: Lock },
    private_request: { label: COMMUNITY_TYPE_LABELS.private_request, icon: Lock },
  };

  function MemberAvatar({ user, size = "md" }) {
    const name = user?.name || user?.username || "Member";
    const initial = name.charAt(0).toUpperCase();
    const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";

    if (user?.avatar) {
      return (
        <img
          src={user.avatar}
          alt=""
          className={`${sizeClass} rounded-full object-cover border border-[#2A241E] shrink-0`}
        />
      );
    }

    return (
      <div
        className={`${sizeClass} rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] font-semibold shrink-0`}
      >
        {initial}
      </div>
    );
  }

  export default function CommunityBrowseDetail({
    communityId,
    initialCommunity = null,
    variant = "modal",
    onClose,
    onJoined,
  }) {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const isPage = variant === "page";

    const [community, setCommunity] = useState(initialCommunity);
    const [loading, setLoading] = useState(!initialCommunity);
    const [error, setError] = useState("");
    const [joining, setJoining] = useState(false);
    const [message, setMessage] = useState("");
    const [heroPreview, setHeroPreview] = useState(null);
    const [members, setMembers] = useState([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [posts, setPosts] = useState([]);
    const [postsLoading, setPostsLoading] = useState(false);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [postForm, setPostForm] = useState({ title: "", text: "", media: [] });
    const [postSaving, setPostSaving] = useState(false);
    const [membersExpanded, setMembersExpanded] = useState(false);

    const load = useCallback(async () => {
      if (!communityId) return;
      setLoading(true);
      setError("");
      try {
        const data = await fetchBrowsableCommunity(communityId);
        setCommunity(data?.community || null);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load community.");
        setCommunity(null);
      } finally {
        setLoading(false);
      }
    }, [communityId]);

    const loadMembers = useCallback(async () => {
      if (!communityId) return;
      setMembersLoading(true);
      try {
        const data = await fetchBrowsableCommunityMembers(communityId);
        setMembers(data?.members || []);
      } catch {
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    }, [communityId]);

    const loadPosts = useCallback(async () => {
      if (!communityId) return;
      setPostsLoading(true);
      try {
        const data = await fetchPosts({ communityId });
        setPosts(data?.posts || []);
      } catch {
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    }, [communityId]);

    useEffect(() => {
      setHeroPreview(null);
      if (communityId) {
        load();
      }
    }, [communityId, load]);

    useEffect(() => {
      if (community?.isMember && isAuthenticated) {
        loadMembers();
        loadPosts();
      } else {
        setMembers([]);
        setPosts([]);
      }
    }, [community?.isMember, isAuthenticated, loadMembers, loadPosts]);

    const handleJoin = async () => {
      if (!community) return;
      setJoining(true);
      setError("");
      try {
        if (community.type === "public") {
          await joinPublicCommunity(community.id);
        } else if (community.type === "private_request") {
          await requestToJoin(community.id, { message: message.trim() });
        }
        await load();
        onJoined?.();
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to submit request.");
      } finally {
        setJoining(false);
      }
    };

    const handleCreatePost = async (e) => {
      e.preventDefault();
      if (!communityId || !postForm.title.trim()) {
        setError("Post title is required.");
        return;
      }
      setPostSaving(true);
      setError("");
      try {
        await createPost({
          communityId,
          title: postForm.title.trim(),
          text: postForm.text.trim(),
          media: postForm.media,
        });
        setShowCreatePost(false);
        setPostForm({ title: "", text: "", media: [] });
        await loadPosts();
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to create post.");
      } finally {
        setPostSaving(false);
      }
    };

    const handleToggleLike = async (post, e) => {
      e?.stopPropagation?.();
      const prev = posts;
      setPosts((list) =>
        list.map((p) =>
          p.id === post.id
            ? {
                ...p,
                likedByMe: !p.likedByMe,
                likeCount: p.likedByMe
                  ? Math.max(0, (p.likeCount || 0) - 1)
                  : (p.likeCount || 0) + 1,
              }
            : p
        )
      );
      try {
        const data = await togglePostLike(post.id);
        setPosts((list) =>
          list.map((p) =>
            p.id === post.id
              ? { ...p, likedByMe: data.likedByMe, likeCount: data.likeCount }
              : p
          )
        );
      } catch {
        setPosts(prev);
      }
    };

    const handlePostClick = (postId) => {
      if (!communityId || !postId) return;
      navigate(`/communities/${communityId}/posts/${postId}`);
    };

  const handleCommentClick = (postId, e) => {
    e?.stopPropagation?.();
    handlePostClick(postId);
  };

    const meta = TYPE_META[community?.type] || TYPE_META.public;
    const TypeIcon = meta.icon;
    const ownerName =
      community?.owner?.name || community?.owner?.username || "Owner";
    const galleryImages = community?.galleryImages || [];
    const heroImage =
      heroPreview || community?.coverImage || galleryImages[0] || "";

    const canRequestJoin =
      community?.type === "private_request" &&
      !community?.isMember &&
      !community?.joinRequestPending;

    const canJoinPublic =
      community?.type === "public" &&
      !community?.isMember &&
      !community?.joinRequestPending;

    const sortedPosts = [...posts].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const content = (
      <div className="space-y-4 sm:space-y-5">
        {error && (
          <div className="text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#A69B8D] text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading...
          </div>
        ) : !community ? (
          <div className="py-16 text-center text-[#8C8070] text-sm">
            Community not found.
          </div>
        ) : (
          <>
            <div className="relative rounded-xl overflow-hidden border border-[#2A241E]">
              <div className={`relative ${isPage ? "h-48 sm:h-64" : "h-40 sm:h-52"}`}>
                {heroImage ? (
                  <img
                    src={heroImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1C1612] to-[#0E0C0A]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0E0C0A] via-[#0E0C0A]/50 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#D4AF37] text-black text-[10px] font-bold uppercase">
                      <Shield size={10} />
                      Verified
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#D4AF37]/90 uppercase">
                      <TypeIcon size={10} />
                      {meta.label}
                    </span>
                  </div>
                  <h3
                    className={`font-serif font-semibold text-[#D4AF37] ${
                      isPage ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
                    }`}
                  >
                    {community.name}
                  </h3>
                </div>
              </div>
            </div>

            {galleryImages.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-[#A69B8D] mb-2 flex items-center gap-1">
                  <ImageIcon size={12} />
                  Gallery
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {community.coverImage && (
                    <button
                      type="button"
                      onClick={() => setHeroPreview(community.coverImage)}
                      className={`aspect-square rounded-lg overflow-hidden border ${
                        heroImage === community.coverImage
                          ? "border-[#D4AF37]"
                          : "border-[#2A241E]"
                      }`}
                    >
                      <img
                        src={community.coverImage}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}
                  {galleryImages.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setHeroPreview(url)}
                      className={`aspect-square rounded-lg overflow-hidden border ${
                        heroImage === url
                          ? "border-[#D4AF37]"
                          : "border-[#2A241E]"
                      }`}
                    >
                      <img
                        src={url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
              <div className="bg-[#0E0C0A] border border-[#2A241E] rounded-lg p-3">
                <div className="text-lg font-serif text-[#D4AF37]">
                  {(community.memberCount ?? 0).toLocaleString()}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-[#8C8070] mt-0.5">
                  Members
                </div>
              </div>
              <div className="bg-[#0E0C0A] border border-[#2A241E] rounded-lg p-3">
                <div className="text-sm font-medium text-[#E5E0D8] truncate">
                  {ownerName}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-[#8C8070] mt-0.5">
                  Owner
                </div>
              </div>
              <div className="bg-[#0E0C0A] border border-[#2A241E] rounded-lg p-3 col-span-2 sm:col-span-1">
                <div className="text-sm font-medium text-[#E5E0D8]">
                  {formatLongDate(community.createdAt)}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-[#8C8070] mt-0.5 flex items-center justify-center gap-1">
                  <Calendar size={10} />
                  Created
                </div>
              </div>
            </div>

            {community.description && (
              <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flag size={14} className="text-[#D4AF37]" />
                  <h4 className="text-sm font-semibold text-[#E5E0D8]">About</h4>
                </div>
                <p className="text-xs sm:text-sm text-[#A69B8D] leading-relaxed whitespace-pre-wrap">
                  {community.description}
                </p>
              </section>
            )}

            {community.rules && (
              <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4">
                <h4 className="text-sm font-semibold text-[#E5E0D8] mb-2">
                  Community Rules
                </h4>
                <p className="text-xs sm:text-sm text-[#A69B8D] whitespace-pre-wrap">
                  {community.rules}
                </p>
              </section>
            )}

            {community.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {community.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-[#D4AF37]/10 text-[#D4AF37] text-[11px]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="bg-[#0E0C0A] border border-[#2A241E] rounded-xl p-4">
              {!isAuthenticated ? (
                <div className="text-center space-y-3">
                  <p className="text-xs sm:text-sm text-[#A69B8D]">
                    Sign in to join this community or send a join request to the
                    owner.
                  </p>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e0c04a]"
                  >
                    Sign In to Continue
                  </Link>
                </div>
              ) : community.isMember ? (
                <p className="text-center text-sm text-emerald-400 font-medium">
                  You are a member of this community.
                </p>
              ) : community.joinRequestPending ? (
                <p className="text-center text-sm text-amber-400 font-medium">
                  Your join request is pending owner approval.
                </p>
              ) : canRequestJoin ? (
                <div className="space-y-3">
                  <p className="text-xs text-[#A69B8D]">
                    Send a join request to the owner, or wait for an invite — like
                    a friend request, either side can start.
                  </p>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                    placeholder="Optional message to the owner..."
                    className="w-full px-3 py-2 rounded-lg bg-[#14100D] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60 resize-y"
                  />
                  <button
                    type="button"
                    disabled={joining}
                    onClick={handleJoin}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold disabled:opacity-60 hover:bg-[#e0c04a]"
                  >
                    {joining ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <UserPlus size={14} />
                    )}
                    Request to Join
                  </button>
                </div>
              ) : canJoinPublic ? (
                <button
                  type="button"
                  disabled={joining}
                  onClick={handleJoin}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold disabled:opacity-60 hover:bg-[#e0c04a]"
                >
                  {joining ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Users size={14} />
                  )}
                  Join Community
                </button>
              ) : (
                <p className="text-center text-xs text-[#8C8070]">
                  This community is invite-only. An owner or moderator must send
                  you an invite — accept it from Join Requests & Invites.
                </p>
              )}
            </div>

            {community.isMember && isAuthenticated && (
              <>
                <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Users size={16} className="text-[#D4AF37]" />
                    <h4 className="text-base font-semibold text-[#E5E0D8]">
                      Members
                    </h4>
                    <span className="text-xs text-[#8C8070]">
                      ({members.length})
                    </span>
                  </div>

                  {membersLoading ? (
                    <div className="flex items-center gap-2 text-xs text-[#8C8070] py-4">
                      <Loader2 size={12} className="animate-spin" />
                      Loading members...
                    </div>
                  ) : members.length === 0 ? (
                    <p className="text-xs text-[#8C8070]">No members found.</p>
                  ) : membersExpanded ? (
                    <div className="space-y-3">
                      {members.map((member) => {
                        const user = member.user || {};
                        const displayName =
                          user.name || user.username || "Member";
                        return (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-[#0E0C0A] border border-[#2A241E]"
                          >
                            <MemberAvatar user={user} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-[#E5E0D8]">
                                  {displayName}
                                </span>
                                {user.username && (
                                  <span className="text-[11px] text-[#8C8070]">
                                    @{user.username}
                                  </span>
                                )}
                                {member.role !== "member" && (
                                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37]">
                                    {member.role}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#8C8070] mt-0.5">
                                Joined {formatLongDate(member.createdAt)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setMembersExpanded(false)}
                        className="w-full text-center text-xs text-[#A69B8D] hover:text-[#D4AF37] py-2"
                      >
                        Show less
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center">
                        {members.slice(0, 4).map((member, idx) => (
                          <div
                            key={member.id}
                            className={idx > 0 ? "-ml-2" : ""}
                            style={{ zIndex: 4 - idx }}
                          >
                            <MemberAvatar user={member.user} size="sm" />
                          </div>
                        ))}
                        {members.length > 4 && (
                          <span className="-ml-2 w-8 h-8 rounded-full bg-[#2A241E] border border-[#3D3123] flex items-center justify-center text-[10px] text-[#A69B8D] font-medium shrink-0">
                            +{members.length - 4}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setMembersExpanded(true)}
                        className="text-xs font-medium text-[#D4AF37] hover:text-[#e0c04a] text-left"
                      >
                        View all {members.length} members
                      </button>
                    </div>
                  )}
                </section>

                <section>
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
    <h4 className="text-xl font-serif font-semibold text-[#D4AF37]">
      Community Posts
    </h4>
    <button
      type="button"
      onClick={() => {
        setShowCreatePost(true);
        setError("");
      }}
      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold self-start sm:self-auto hover:bg-[#c3a030] transition-colors"
    >
      <Plus size={14} />
      Create Post
    </button>
  </div>

  {postsLoading ? (
    <div className="flex items-center justify-center py-12 text-[#A69B8D] text-xs gap-2">
      <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
      Loading posts...
    </div>
  ) : sortedPosts.length === 0 ? (
    <div className="border border-dashed border-[#2A241E] rounded-xl py-12 text-center text-[#8C8070] text-xs px-4">
      No posts yet. Be the first to share something.
    </div>
  ) : (
    /* 3-Column Grid Layout */
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
      {sortedPosts.map((post) => {
        const authorName =
          post.author?.name || post.author?.username || "Member";
        const coverImage = post.media?.find((m) => m.type === "image");
        return (
          <div key={post.id} className="flex flex-col h-full">
            <article
              role="button"
              tabIndex={0}
              onClick={() => handlePostClick(post.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePostClick(post.id);
              }}
              className="bg-[#14100D] border border-[#2A241E] rounded-xl overflow-hidden cursor-pointer transition-all flex flex-col justify-between h-full hover:border-[#D4AF37]/40 shadow-lg hover:shadow-2xl"
            >
              <div>
                {/* 1. Author Header ABOVE the Image */}
                <div className="p-3.5 sm:p-4 border-b border-[#2A241E]/40 flex items-center gap-2.5">
                  <MemberAvatar user={post.author} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#E5E0D8] truncate">
                      {authorName}
                    </div>
                    <div className="text-[10px] text-[#8C8070] truncate">
                      {post.author?.username && (
                        <span>@{post.author.username} · </span>
                      )}
                      {timeAgo(post.createdAt)}
                    </div>
                  </div>
                </div>

                {/* 2. Cover Image */}
                {coverImage ? (
                  <div className="w-full h-44 bg-[#0A0806] border-b border-[#2A241E] overflow-hidden">
                    <img
                      src={coverImage.url}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="w-full h-24 bg-[#0A0806]/60 border-b border-[#2A241E]/40 flex items-center justify-center text-[10px] text-[#8C8070] tracking-wider uppercase font-mono">
                    No Media
                  </div>
                )}

                {/* 3. Title & Description BELOW the Image */}
                <div className="p-4 space-y-2">
                  {post.title && (
                    <h3 className="text-sm font-serif font-semibold text-[#E5E0D8] line-clamp-1 leading-snug">
                      {post.title}
                    </h3>
                  )}

                  {post.text && (
                    <p className="text-xs text-[#A69B8D] leading-relaxed line-clamp-2">
                      {post.text}
                    </p>
                  )}
                </div>
              </div>

              {/* 4. Footer Action Controls */}
              <div className="p-4 pt-0">
                <div className="flex items-center gap-4 pt-3 border-t border-[#2A241E]/60 text-[11px] text-[#8C8070]">
                  <button
                    type="button"
                    onClick={(e) => handleToggleLike(post, e)}
                    className={`inline-flex items-center gap-1 transition-colors ${
                      post.likedByMe
                        ? "text-[#D4AF37]"
                        : "hover:text-[#E5E0D8]"
                    }`}
                  >
                    <Heart
                      size={13}
                      className={
                        post.likedByMe
                          ? "fill-current text-[#D4AF37]"
                          : "text-[#D4AF37]/70"
                      }
                    />
                    <span>{formatCount(post.likeCount)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCommentClick(post.id, e)}
                    className="inline-flex items-center gap-1 transition-colors hover:text-[#E5E0D8]"
                  >
                    <MessageCircle
                      size={13}
                      className="text-[#D4AF37]/70"
                    />
                    <span>{formatCount(post.commentCount)}</span>
                  </button>
                </div>
              </div>
            </article>

          </div>
        );
      })}
    </div>
  )}
</section>
              </>
            )}

            {showCreatePost && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <div
                  className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                  onClick={() => setShowCreatePost(false)}
                />
                <form
                  onSubmit={handleCreatePost}
                  className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#14100D] border border-[#2A241E] rounded-t-xl sm:rounded-xl p-5 space-y-4 shadow-2xl"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#E5E0D8]">
                      Create Post
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowCreatePost(false)}
                      className="p-1.5 text-[#A69B8D] hover:text-[#E5E0D8]"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <input
                    value={postForm.title}
                    onChange={(e) =>
                      setPostForm((p) => ({ ...p, title: e.target.value }))
                    }
                    required
                    placeholder="Post title"
                    className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60"
                  />
                  <textarea
                    value={postForm.text}
                    onChange={(e) =>
                      setPostForm((p) => ({ ...p, text: e.target.value }))
                    }
                    rows={4}
                    placeholder="What do you want to share?"
                    className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 resize-y"
                  />
                  <MediaPicker
                    media={postForm.media}
                    onChange={(media) => setPostForm((p) => ({ ...p, media }))}
                    onError={setError}
                  />
                  <button
                    type="submit"
                    disabled={postSaving}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#0E0C0A] text-xs font-bold disabled:opacity-60"
                  >
                    {postSaving && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    Post
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    );

    if (isPage) {
      return content;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        <div className="relative w-full sm:max-w-2xl lg:max-w-3xl bg-[#120F0D] border border-[#2A241E] rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#2A241E] shrink-0">
            <h2 className="text-sm sm:text-base font-semibold text-[#D4AF37] truncate pr-2">
              Community Details
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#A69B8D] hover:text-[#E5E0D8] rounded-lg shrink-0"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-4 sm:p-5">{content}</div>
        </div>
      </div>
    );
  }
