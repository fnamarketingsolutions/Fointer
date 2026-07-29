import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  Loader2,
  Heart,
  MessageCircle,
  Flag,
  Shield,
  RefreshCw,
  UserPlus,
  Plus,
  X,
  Ban,
  ChevronDown,
} from "lucide-react";
import {
  approveJoinRequest,
  denyJoinRequest,
  inviteToCommunity,
  fetchCommunityMembers,
  assignModerator,
  revokeModerator,
  removeCommunityMember,
  banCommunityMember,
  unbanCommunityMember,
} from "../../../../api/communities";
import { fetchPosts, createPost, togglePostLike } from "../../../../api/posts";
import MediaPicker from "../../../../shared/components/media/MediaPicker";
import PostDetail from "../../../posts/pages/PostDetail";
import { formatCommunityType } from "../../../../shared/utils/community";
import { timeAgo } from "../../../../shared/utils/date";
import { formatCount } from "../../../../shared/utils/format";

const formatType = formatCommunityType;

const roleBadgeClass = (role) => {
  if (role === "owner") return "text-[#D4AF37] border-[#D4AF37]/40 bg-[#D4AF37]/10";
  if (role === "moderator") return "text-amber-200 border-amber-500/30 bg-amber-500/10";
  return "text-[#A69B8D] border-[#2A241E] bg-[#0E0C0A]";
};

export default function CommunityDetail({
  manageData,
  manageLoading,
  selectedId,
  error,
  setError,
  onBack,
  onEdit,
  onDelete,
  onRefresh,
}) {
  const [actionRequestId, setActionRequestId] = useState(null);
  const [heroPreview, setHeroPreview] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState("trending");
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postForm, setPostForm] = useState({ title: "", text: "", media: [] });
  const [postSaving, setPostSaving] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberStatusFilter, setMemberStatusFilter] = useState("active");
  const [savingMemberId, setSavingMemberId] = useState(null);

  const community = manageData?.community;
  const metrics = manageData?.metrics || {};
  const pendingRequests = manageData?.pendingRequests || [];
  const viewerRole = manageData?.viewerRole || "member";
  const isOwner = viewerRole === "owner" || viewerRole === "admin";
  const isModerator = viewerRole === "moderator";
  const canModerate = isOwner || isModerator;
  const galleryImages = community?.galleryImages || [];
  const [isExpanded, setIsExpanded] = useState(true);
  const heroImage =
    heroPreview || community?.coverImage || galleryImages[0] || "";

  const loadMembers = useCallback(async () => {
    if (!selectedId) return;
    setMembersLoading(true);
    try {
      const data = await fetchCommunityMembers(selectedId, memberStatusFilter);
      setMembers(data?.members || []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [selectedId, memberStatusFilter]);

  const loadPosts = useCallback(async () => {
    if (!selectedId) return;
    setPostsLoading(true);
    try {
      const data = await fetchPosts({ communityId: selectedId });
      setPosts(data?.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    setHeroPreview(null);
    loadPosts();
  }, [selectedId, loadPosts]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const refreshAll = async () => {
    await onRefresh?.(selectedId);
    await loadMembers();
    await loadPosts();
  };

  const runMemberAction = async (memberId, action) => {
    if (!selectedId) return;
    setSavingMemberId(memberId);
    setError("");
    try {
      await action();
      await loadMembers();
      await onRefresh?.(selectedId);
    } catch (err) {
      setError(err?.response?.data?.message || "Member action failed.");
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleAssignModerator = (member) =>
    runMemberAction(member.id, () =>
      assignModerator(selectedId, { userId: member.user?.id })
    );

  const handleRevokeModerator = (member) =>
    runMemberAction(member.id, () =>
      revokeModerator(selectedId, member.user?.id)
    );

  const handleRemoveMember = (member) =>
    runMemberAction(member.id, () =>
      removeCommunityMember(selectedId, member.id, { removeEntirely: true })
    );

  const handleBanMember = (member) =>
    runMemberAction(member.id, () => banCommunityMember(selectedId, member.id));

  const handleUnbanMember = (member) =>
    runMemberAction(member.id, () =>
      unbanCommunityMember(selectedId, member.id)
    );

  const canActOnMember = (member) => {
    if (member.role === "owner") return false;
    if (isOwner) return true;
    if (isModerator && member.role === "member") return true;
    return false;
  };

  const handleApprove = async (requestId) => {
    if (!selectedId) return;
    setActionRequestId(requestId);
    setError("");
    try {
      await approveJoinRequest(selectedId, requestId);
      await onRefresh(selectedId);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to approve request.");
    } finally {
      setActionRequestId(null);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!selectedId || !inviteIdentifier.trim()) return;
    setInviteBusy(true);
    setError("");
    setInviteMessage("");
    try {
      await inviteToCommunity(selectedId, {
        identifier: inviteIdentifier.trim(),
      });
      setInviteIdentifier("");
      setInviteMessage("Invite sent successfully.");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send invite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!selectedId || !postForm.title.trim()) {
      setError("Post title is required.");
      return;
    }
    setPostSaving(true);
    setError("");
    try {
      await createPost({
        communityId: selectedId,
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

  const handleDeny = async (requestId) => {
    if (!selectedId) return;
    setActionRequestId(requestId);
    setError("");
    try {
      await denyJoinRequest(selectedId, requestId);
      await onRefresh(selectedId);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to deny request.");
    } finally {
      setActionRequestId(null);
    }
  };

  const sortedPosts = [...posts].sort((a, b) => {
    if (feedFilter === "trending") {
      return (b.likeCount || 0) - (a.likeCount || 0);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const statItems = [
    {
      value: `${metrics.engagementRate ?? 0}%`,
      label: "Engagement",
    },
    {
      value: formatCount(metrics.activeThreads ?? 0),
      label: "Active Threads",
    },
    {
      value: metrics.tierLabel || "Elite",
      label: "Access Tier",
    },
  ];

  if (selectedPostId) {
    return (
      <PostDetail
        postId={selectedPostId}
        onBack={() => {
          setSelectedPostId(null);
          loadPosts();
        }}
        onDeleted={() => {
          setSelectedPostId(null);
          loadPosts();
        }}
      />
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full">
      {/* Back + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-[#A69B8D] hover:text-[#D4AF37] transition-colors self-start"
        >
          <ArrowLeft size={14} />
          Back to communities
        </button>

        {community && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => refreshAll()}
              className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(community)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40"
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(community)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3">
          {error}
        </div>
      )}

      {manageLoading || !manageData ? (
        <div className="flex items-center justify-center py-16 text-[#A69B8D] text-xs sm:text-sm gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading community...
        </div>
      ) : (
        <>
          {/* Hero */}
          <section className="relative rounded-xl overflow-hidden border border-[#2A241E]">
            <div className="relative h-44 sm:h-64 md:h-80">
              {heroImage ? (
                <img
                  src={heroImage}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#1C1612] to-[#0E0C0A]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E0C0A] via-[#0E0C0A]/60 to-transparent" />

              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#D4AF37] text-black text-[10px] font-bold uppercase tracking-wide">
                    <Shield size={10} />
                    Verified Community
                  </span>
                  <span className="text-[10px] sm:text-xs text-[#D4AF37]/80 uppercase tracking-wider">
                    {formatType(community?.type)}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-semibold text-[#D4AF37] leading-tight">
                  {community?.name}
                </h1>

                {community?.description && (
                  <p className="text-xs sm:text-sm text-[#E5E0D8]/80 mt-1.5 max-w-2xl line-clamp-2 sm:line-clamp-none">
                    {community.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] sm:text-xs text-[#A69B8D] font-mono">
                  <span className="flex items-center gap-1">
                    <Users size={12} className="text-[#D4AF37]" />
                    {(community?.memberCount ?? 0).toLocaleString()} members
                  </span>
                  {community?.owner && (
                    <span>
                      Owner:{" "}
                      {community.owner.name ||
                        community.owner.username ||
                        "—"}
                    </span>
                  )}
                  {community?.createdAt && (
                    <span>
                      Since{" "}
                      {new Date(community.createdAt).toLocaleDateString()}
                    </span>
                  )}
                  {community?.tags?.[0] && (
                    <span className="text-[#D4AF37]/70">
                      #{community.tags[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Gallery */}
          {galleryImages.length > 0 && (
            <section>
              <h2 className="text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-2">
                Gallery
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                {community?.coverImage && (
                  <button
                    type="button"
                    onClick={() => setHeroPreview(community.coverImage)}
                    className={`relative aspect-[4/3] rounded-lg overflow-hidden border transition-all ${
                      heroImage === community.coverImage
                        ? "border-[#D4AF37] ring-1 ring-[#D4AF37]/50"
                        : "border-[#2A241E] hover:border-[#D4AF37]/40"
                    }`}
                  >
                    <img
                      src={community.coverImage}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded text-[8px] bg-black/70 text-[#D4AF37]">
                      Cover
                    </span>
                  </button>
                )}
                {galleryImages.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setHeroPreview(url)}
                    className={`relative aspect-[4/3] rounded-lg overflow-hidden border transition-all ${
                      heroImage === url
                        ? "border-[#D4AF37] ring-1 ring-[#D4AF37]/50"
                        : "border-[#2A241E] hover:border-[#D4AF37]/40"
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
            </section>
          )}

          {/* Mission + stats */}
          <section className="bg-[#14100D]/90 border border-[#2A241E] rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Flag size={16} className="text-[#D4AF37]" />
              <h2 className="text-base sm:text-lg font-serif font-semibold text-[#E5E0D8]">
                Our Mission
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#A69B8D] leading-relaxed whitespace-pre-wrap">
              {community?.description ||
                "No mission statement has been added yet."}
            </p>

            <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-5 sm:mt-6 pt-5 border-t border-[#2A241E]">
              {statItems.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-lg sm:text-2xl font-serif font-semibold text-[#D4AF37]">
                    {stat.value}
                  </div>
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#8C8070] mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Intelligence Feed */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
              <h2 className="text-xl sm:text-2xl font-serif font-semibold text-[#D4AF37]">
                Intelligence Feed
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreatePost(true);
                  setError("");
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold self-start sm:self-auto"
              >
                <Plus size={14} />
                Create Post
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { id: "trending", label: "Trending" },
                { id: "latest", label: "Latest" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setFeedFilter(filter.id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-colors ${
                    feedFilter === filter.id
                      ? "bg-[#D4AF37] text-black"
                      : "bg-[#1C1612] text-[#A69B8D] border border-[#2A241E] hover:text-[#E5E0D8]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {postsLoading ? (
              <div className="flex items-center justify-center py-10 text-[#A69B8D] text-xs gap-2">
                <Loader2 size={14} className="animate-spin" />
                Loading posts...
              </div>
            ) : sortedPosts.length === 0 ? (
              <div className="border border-dashed border-[#2A241E] rounded-xl py-10 text-center text-[#8C8070] text-xs px-4">
                No posts in this community yet. Be the first to post.
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {sortedPosts.map((post) => {
                  const authorName =
                    post.author?.name || post.author?.username || "Member";
                  const initial = authorName.charAt(0).toUpperCase();
                  return (
                    <article
                      key={post.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPostId(post.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSelectedPostId(post.id);
                      }}
                      className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5 cursor-pointer hover:border-[#D4AF37]/40 transition-colors"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {post.author?.avatar ? (
                          <img
                            src={post.author.avatar}
                            alt=""
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-[#2A241E] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] text-sm font-semibold shrink-0">
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[#E5E0D8]">
                            {authorName}
                          </div>
                          <div className="text-[11px] text-[#8C8070]">
                            {timeAgo(post.createdAt)}
                            {community?.tags?.[0]
                              ? ` in #${community.tags[0]}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      {post.title && (
                        <h3 className="text-sm sm:text-base font-serif font-semibold text-[#E5E0D8] mb-1.5">
                          {post.title}
                        </h3>
                      )}
                      {post.text && (
                        <p className="text-xs sm:text-sm text-[#A69B8D] leading-relaxed line-clamp-3">
                          {post.text}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#2A241E]/60 text-[11px] text-[#8C8070]">
                        <button
                          type="button"
                          onClick={(e) => handleToggleLike(post, e)}
                          className={`inline-flex items-center gap-1 ${
                            post.likedByMe ? "text-[#D4AF37]" : ""
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
                          {formatCount(post.likeCount)}
                        </button>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle
                            size={13}
                            className="text-[#D4AF37]/70"
                          />
                          {formatCount(post.commentCount)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

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

         {/* Members */}
  {canModerate && (
    <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
            <Users size={16} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-[#E5E0D8]">
              Members
            </h2>
            <p className="text-[11px] sm:text-xs text-[#A69B8D] mt-0.5">
              {isOwner
                ? "Assign or remove moderators, remove members, or ban users."
                : "Remove or ban regular members. Moderator roles are owner-only."}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start">
          {/* All Toggle Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border border-[#2A241E] text-[#E5E0D8] bg-[#0E0C0A] hover:border-[#D4AF37]/40 transition-colors"
          >
            <span>All</span>
            <ChevronDown
              size={12}
              className={`transition-transform duration-300 ${
                isExpanded ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>

          {/* Status Filters */}
          {["active", "banned"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setMemberStatusFilter(status);
                setIsExpanded(true); // Automatically expand when switching filters
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] border capitalize transition-colors ${
                memberStatusFilter === status
                  ? "bg-[#D4AF37] text-black border-[#D4AF37]"
                  : "border-[#2A241E] text-[#A69B8D] hover:border-[#D4AF37]/40"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Smooth Collapsible Section */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {membersLoading ? (
          <div className="flex items-center justify-center py-10 text-[#A69B8D] text-xs gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div className="border border-dashed border-[#2A241E] rounded-lg py-10 text-center text-[#8C8070] text-xs px-4">
            No {memberStatusFilter} members found.
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {members.map((member) => {
              const name =
                member.user?.name || member.user?.username || "Member";
              const busy = savingMemberId === member.id;
              const banned = member.status === "banned";
              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 rounded-lg border border-[#2A241E] bg-[#0E0C0A] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-[#E5E0D8]">
                        {name}
                      </p>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded border text-[10px] uppercase tracking-wide ${roleBadgeClass(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-[#A69B8D] mt-0.5">
                      @{member.user?.username || "user"}
                      {banned ? " · banned" : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {banned ? (
                      canActOnMember({ ...member, role: "member" }) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleUnbanMember(member)}
                          className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] text-[#D4AF37] disabled:opacity-60"
                        >
                          {busy ? "Saving..." : "Unban"}
                        </button>
                      )
                    ) : (
                      <>
                        {isOwner && member.role === "member" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleAssignModerator(member)}
                            className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] text-[#D4AF37] disabled:opacity-60"
                          >
                            {busy ? "Saving..." : "Assign Moderator"}
                          </button>
                        )}
                        {isOwner && member.role === "moderator" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRevokeModerator(member)}
                            className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200 disabled:opacity-60"
                          >
                            {busy ? "Saving..." : "Remove Moderator"}
                          </button>
                        )}
                        {canActOnMember(member) && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRemoveMember(member)}
                              className="rounded-lg border border-[#2A241E] px-3 py-1.5 text-[11px] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 disabled:opacity-60"
                            >
                              {busy ? "Saving..." : "Remove"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleBanMember(member)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-400 disabled:opacity-60"
                            >
                              <Ban size={12} />
                              {busy ? "Saving..." : "Ban"}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  )}

          {/* Invite Members */}
          {["private_request", "private_invite"].includes(community?.type) && (
            <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-[#E5E0D8]">
                    Invite Members
                  </h2>
                  <p className="text-[11px] sm:text-xs text-[#A69B8D] mt-0.5">
                    Send an invite by username or email. They can accept or
                    decline from Join Requests.
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleInvite}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  value={inviteIdentifier}
                  onChange={(e) => setInviteIdentifier(e.target.value)}
                  placeholder="Username or email"
                  className="flex-1 bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-sm text-[#E5E0D8] placeholder:text-[#8C8070] focus:outline-none focus:border-[#D4AF37]/50"
                />
                <button
                  type="submit"
                  disabled={inviteBusy || !inviteIdentifier.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold disabled:opacity-60"
                >
                  {inviteBusy && <Loader2 size={12} className="animate-spin" />}
                  Send Invite
                </button>
              </form>
              {inviteMessage && (
                <p className="text-xs text-emerald-400 mt-2">{inviteMessage}</p>
              )}
            </section>
          )}

          {/* Pending Join Requests */}
          <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[#E5E0D8]">
                  Pending Requests
                </h2>
                <p className="text-[11px] sm:text-xs text-[#A69B8D] mt-0.5">
                  Review and approve new member applications.
                </p>
              </div>
              <span className="text-[11px] text-[#D4AF37] shrink-0">
                {pendingRequests.length} pending
              </span>
            </div>

            {community?.type !== "private_request" ? (
              <div className="border border-dashed border-[#2A241E] rounded-lg py-10 text-center text-[#8C8070] text-xs px-4">
                Join requests only apply to Private-Request communities. Use
                invites above for invite-only circles.
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="border border-dashed border-[#2A241E] rounded-lg py-10 text-center text-[#8C8070] text-xs px-4">
                No pending requests right now.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => {
                  const name =
                    request.user?.name || request.user?.username || "Member";
                  const initial = name.charAt(0).toUpperCase();
                  const busy = actionRequestId === request.id;
                  return (
                    <div
                      key={request.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#0E0C0A] border border-[#2A241E]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {request.user?.avatar ? (
                          <img
                            src={request.user.avatar}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border border-[#2A241E] shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] text-sm font-semibold shrink-0">
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#E5E0D8] truncate">
                            {name}
                          </div>
                          <div className="text-[11px] text-[#A69B8D] truncate">
                            {request.user?.email ||
                              request.user?.username ||
                              "Applicant"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeny(request.id)}
                          className="px-3 py-1.5 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#E5E0D8] disabled:opacity-60"
                        >
                          Deny
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleApprove(request.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold disabled:opacity-60"
                        >
                          {busy && (
                            <Loader2 size={12} className="animate-spin" />
                          )}
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Rules + tags */}
          {(community?.rules || community?.tags?.length > 0) && (
            <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5 space-y-3">
              <h2 className="text-base font-semibold text-[#E5E0D8]">
                Community Rules
              </h2>
              {community.rules && (
                <p className="text-xs sm:text-sm text-[#E5E0D8] whitespace-pre-wrap">
                  {community.rules}
                </p>
              )}
              {community.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
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
            </section>
          )}
        </>
      )}
    </div>
  );
}
