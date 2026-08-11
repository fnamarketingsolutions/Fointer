import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Calendar,
  Image as ImageIcon,
  Lock,
  Globe,
  Layers,
  Grid,
  Video,
  Check,
  Clock,
} from "lucide-react";
import {
  inviteToCommunity,
  lookupInviteUser,
  inviteUserToCommunity,
  fetchCommunityMembers,
  assignModerator,
  revokeModerator,
  removeCommunityMember,
  banCommunityMember,
  unbanCommunityMember,
} from "../../../../api/communities";
import { fetchPosts, createPost, togglePostLike } from "../../../../api/posts";
import { fetchWatchGroups } from "../../../watchgroups/services/watchGroupService";
import JoinWatchGroupModal from "../../../watchgroups/pages/JoinWatchGroupModal";
import { getJoinGroupCtaState } from "../../../watchgroups/pages/WatchGroupJoinAction";
import MediaPicker from "../../../../shared/components/media/MediaPicker";
import PostMediaGallery from "../../../../shared/components/media/PostMediaGallery";
import { COMMUNITY_TYPE_LABELS } from "../../../../shared/constants/community";
import { formatLongDate, timeAgo } from "../../../../shared/utils/date";
import { formatCount } from "../../../../shared/utils/format";
import {
  communitySegment,
  postSegment,
} from "../../../../shared/services/entityLinks";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";

const TYPE_META = {
  public: { label: COMMUNITY_TYPE_LABELS.public, icon: Globe },
  private_invite: { label: COMMUNITY_TYPE_LABELS.private_invite, icon: Lock },
  private_request: { label: COMMUNITY_TYPE_LABELS.private_request, icon: Lock },
};

const roleBadgeClass = (role) => {
  if (role === "owner") return "text-[#D4AF37] border-[#D4AF37]/40 bg-[#D4AF37]/10";
  if (role === "moderator") return "text-amber-200 border-amber-500/30 bg-amber-500/10";
  return "text-[#A69B8D] border-[#2A241E] bg-[#0E0C0A]";
};

function Collapsible({ open, collapsedHeight = 0, children }) {
  const innerRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(
    open ? "none" : `${collapsedHeight}px`
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
          e.propertyName === "max-height"
        ) {
          setMaxHeight("none");
        }
      }}
      className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

function RuleItem({ index, rule }) {
  return (
    <li className="flex gap-2">
      <span className="text-[11px] font-semibold text-[#D4AF37] shrink-0 w-4">
        {index + 1}.
      </span>
      <span className="text-xs sm:text-sm text-[#A69B8D] leading-relaxed">
        {rule}
      </span>
    </li>
  );
}

export default function CommunityDetail({
  manageData,
  manageLoading,
  selectedId,
  onBack,
  onEdit,
  onDelete,
  onRefresh,
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [heroPreview, setHeroPreview] = useState(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [subchannelsExpanded, setSubchannelsExpanded] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState("trending");
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLookupUsers, setInviteLookupUsers] = useState([]);
  const [inviteLookupLoading, setInviteLookupLoading] = useState(false);
  const [selectedInviteUser, setSelectedInviteUser] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postForm, setPostForm] = useState({ title: "", text: "", media: [] });
  const [postSaving, setPostSaving] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");
  const [savingMemberId, setSavingMemberId] = useState(null);
  const inviteLookupSeq = useRef(0);
  const memberFilterMounted = useRef(false);
  const [expandedFilter, setExpandedFilter] = useState("all");
  const [watchGroups, setWatchGroups] = useState([]);
  const [watchGroupsLoading, setWatchGroupsLoading] = useState(false);
  const [joinGroupOpen, setJoinGroupOpen] = useState(false);

  const community = manageData?.community;
  const viewerRole = manageData?.viewerRole || "member";
  const isOwner = viewerRole === "owner" || viewerRole === "admin";
  const isModerator = viewerRole === "moderator";
  const canModerate = isOwner || isModerator;
  const isCommunityMember = Boolean(viewerRole);
  const galleryImages = community?.galleryImages || [];
  const heroImage =
    heroPreview || community?.coverImage || galleryImages[0] || "";
  const thumbs = [
    ...new Set(
      [community?.coverImage, ...galleryImages].filter(Boolean)
    ),
  ];
  const meta = TYPE_META[community?.type] || TYPE_META.public;
  const TypeIcon = meta.icon;
  const ownerName =
    community?.owner?.name || community?.owner?.username || "Owner";

  // Channel & Subchannels Normalization
  const channelName =
    typeof community?.channel === "object"
      ? community?.channel?.name
      : community?.channel || "";

  const rawSubchannels = Array.isArray(community?.subchannels)
    ? community.subchannels
    : [];
  
  // Format subchannel items cleanly as display strings
  const subchannelList = rawSubchannels.map((sub) =>
    typeof sub === "object" ? sub.name || sub.title || sub.id : String(sub)
  );
  
  // Split subchannels: initial 2 shown, rest moved to collapsible View More list
  const primarySubchannels = subchannelList.slice(0, 2);
  const extraSubchannels = subchannelList.slice(2);

  const ruleLines = (community?.rules || "")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  const primaryRules = ruleLines.slice(0, 3);
  const extraRules = ruleLines.slice(3);
  const aboutNeedsToggle = (community?.description || "").length > 180;
  const rulesBlobNeedsToggle =
    ruleLines.length <= 1 && (community?.rules || "").length > 180;

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

  const loadWatchGroups = useCallback(async () => {
    if (!selectedId || !isCommunityMember) {
      setWatchGroups([]);
      return;
    }
    setWatchGroupsLoading(true);
    try {
      const data = await fetchWatchGroups({ communityId: selectedId });
      setWatchGroups(data?.watchGroups || []);
    } catch (err) {
      setWatchGroups([]);
      showToast(getErrorMessage(err, "Failed to load watch groups."));
    } finally {
      setWatchGroupsLoading(false);
    }
  }, [selectedId, isCommunityMember, showToast]);

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
    setAboutExpanded(false);
    setRulesExpanded(false);
    setSubchannelsExpanded(false);
    setJoinGroupOpen(false);
    loadPosts();
  }, [selectedId, loadPosts]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    loadWatchGroups();
  }, [loadWatchGroups]);

  useEffect(() => {
    if (!memberFilterMounted.current) {
      memberFilterMounted.current = true;
      return undefined;
    }
  }, [memberStatusFilter]);

  useEffect(() => {
    if (!selectedId || !isOwner) {
      setInviteLookupUsers([]);
      setSelectedInviteUser(null);
      return undefined;
    }

    const query = inviteIdentifier.trim();
    if (!query || query.length < 3) {
      setInviteLookupUsers([]);
      setSelectedInviteUser(null);
      setInviteLookupLoading(false);
      return undefined;
    }

    const seq = ++inviteLookupSeq.current;
    setInviteLookupLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await lookupInviteUser(selectedId, query);
        if (inviteLookupSeq.current !== seq) return;
        const matched = Array.isArray(data?.users) ? data.users : [];
        setInviteLookupUsers(matched);
        setSelectedInviteUser((prev) =>
          prev && matched.some((u) => String(u.id) === String(prev.id))
            ? prev
            : null
        );
      } catch (err) {
        if (inviteLookupSeq.current !== seq) return;
        setInviteLookupUsers([]);
        setSelectedInviteUser(null);
        showToast(
          err?.response?.data?.message || "Failed to look up users."
        );
      } finally {
        if (inviteLookupSeq.current === seq) {
          setInviteLookupLoading(false);
        }
      }
    }, 450);

    return () => {
      clearTimeout(timer);
    };
  }, [inviteIdentifier, selectedId, isOwner, showToast]);

  const refreshAll = async () => {
    await onRefresh?.(selectedId, { silent: true });
    await loadMembers();
    await loadPosts();
  };

  const runMemberAction = async (memberId, action) => {
    if (!selectedId) return;
    setSavingMemberId(memberId);
    try {
      await action();
      await loadMembers();
      await onRefresh?.(selectedId, { silent: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Member action failed.");
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

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!selectedId || !inviteIdentifier.trim()) return;
    if (isOwner && !selectedInviteUser) {
      showToast("Select the user tile below to send an invite.");
      return;
    }
    setInviteBusy(true);
    try {
      if (selectedInviteUser) {
        await inviteUserToCommunity(selectedId, {
          userId: selectedInviteUser.id,
          username: selectedInviteUser.username,
          message: inviteNote.trim(),
        });
      } else {
        await inviteToCommunity(selectedId, {
          identifier: inviteIdentifier.trim(),
          message: inviteNote.trim(),
        });
      }
      setInviteIdentifier("");
      setInviteNote("");
      setInviteLookupUsers([]);
      setSelectedInviteUser(null);
      showToast("Invite sent successfully.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to send invite.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!selectedId || !postForm.title.trim()) {
      showToast("Post title is required.");
      return;
    }
    setPostSaving(true);
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
      showToast(err?.response?.data?.message || "Failed to create post.");
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

  const sortedPosts = [...posts].sort((a, b) => {
    if (feedFilter === "trending") {
      return (b.likeCount || 0) - (a.likeCount || 0);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const openPost = (post) => {
    if (!selectedId || !post?.id) return;
    const segment = communitySegment(community) || selectedId;
    navigate(`/dashboard/manage/${segment}/posts/${postSegment(post)}`);
  };

  const showJoinGroupCta =
    isCommunityMember && !watchGroupsLoading && watchGroups.length > 0;
  const { allGroupsJoined, anyPendingOnly, label: joinCtaLabel } =
    getJoinGroupCtaState(watchGroups);

  const handleJoinCtaClick = () => {
    if (allGroupsJoined) {
      navigate("/dashboard/watchgroups");
      return;
    }
    setJoinGroupOpen(true);
  };

  const handleGroupJoined = (group) => {
    setWatchGroups((list) =>
      list.map((g) =>
        String(g.id) === String(group.id)
          ? {
              ...g,
              myRole: "member",
              myJoinRequestStatus: null,
              participantCount: (g.participantCount || 0) + 1,
            }
          : g
      )
    );
    setJoinGroupOpen(false);
    navigate("/dashboard/watchgroups");
  };

  const handleGroupRequested = (group) => {
    setWatchGroups((list) =>
      list.map((g) =>
        String(g.id) === String(group.id)
          ? { ...g, myJoinRequestStatus: "pending" }
          : g
      )
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full">
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

      {manageLoading || !manageData ? (
        <div className="flex items-center justify-center py-16 text-[#A69B8D] text-xs sm:text-sm gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading community...
        </div>
      ) : (
        <>
          <div className="space-y-4 sm:space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-serif font-semibold text-[#D4AF37] text-2xl sm:text-3xl leading-tight">
                  {community?.name}
                </h1>
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#D4AF37]/90">
                  <TypeIcon size={10} />
                  {meta.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {showJoinGroupCta && (
                  <button
                    type="button"
                    onClick={handleJoinCtaClick}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-opacity hover:opacity-90 ${
                      allGroupsJoined
                        ? "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40"
                        : anyPendingOnly
                          ? "bg-[#2A241E] text-[#A69B8D] border border-[#2A241E]"
                          : "bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black"
                    }`}
                  >
                    {allGroupsJoined ? (
                      <Check size={14} />
                    ) : anyPendingOnly ? (
                      <Clock size={14} />
                    ) : (
                      <Video size={14} />
                    )}
                    {joinCtaLabel}
                  </button>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#D4AF37] text-black text-[10px] font-bold uppercase">
                  <Shield size={10} />
                  Verified
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[40%_1fr] gap-4 lg:gap-5">
              <div className="lg:self-start">
                <div className="relative rounded-xl overflow-hidden border border-[#2A241E]">
                  <div className="relative flex items-center justify-center h-64 sm:h-80 lg:h-[420px] bg-[#0E0C0A]">
                    {heroImage ? (
                      <img
                        src={heroImage}
                        alt=""
                        className="max-w-full max-h-full w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#1C1612] to-[#0E0C0A]" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col divide-y divide-[#2A241E]/60">
                {thumbs.length > 0 && (
                  <div className="py-4 first:pt-0">
                    <h4 className="text-[10px] uppercase tracking-wider text-[#A69B8D] mb-2 flex items-center gap-1">
                      <ImageIcon size={12} />
                      Gallery
                    </h4>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 sm:gap-2">
                      {thumbs.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setHeroPreview(url)}
                          className={`aspect-square rounded-lg overflow-hidden border transition-all ${
                            heroImage === url
                              ? "border-[#D4AF37] ring-1 ring-[#D4AF37]/40"
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
                  </div>
                )}

                <div className="py-4 first:pt-0">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="font-serif text-[#D4AF37] text-base sm:text-lg">
                        {(community?.memberCount ?? 0).toLocaleString()}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-[#8C8070] mt-0.5">
                        Members
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-[#E5E0D8] truncate text-xs sm:text-sm">
                        {ownerName}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-[#8C8070] mt-0.5">
                        Owner
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-[#E5E0D8] text-xs sm:text-sm">
                        {formatLongDate(community?.createdAt)}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-[#8C8070] mt-0.5 flex items-center justify-center gap-1">
                        <Calendar size={10} />
                        Created
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Channel and Dynamic Subchannel List */}
                {(channelName || subchannelList.length > 0) && (
                  <div className="py-4 space-y-3">
                    {channelName && (
                      <div>
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8C8070] mb-1.5 font-bold">
                          <Layers size={12} className="text-[#D4AF37]" />
                          Channel
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold">
                            {channelName}
                          </span>
                        </div>
                      </div>
                    )}

                    {subchannelList.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8C8070] mb-1.5 font-bold">
                          <Grid size={12} className="text-[#D4AF37]" />
                          Subchannels ({subchannelList.length})
                        </div>
                        
                        {/* Always display initial 2 subchannels */}
                        <div className="flex flex-wrap gap-1.5">
                          {primarySubchannels.map((sub, idx) => (
                            <span
                              key={`${idx}-${sub}`}
                              className="px-2 py-0.5 rounded-md bg-[#1C1612] border border-[#2A241E] text-[#E5E0D8] text-[11px] font-medium"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>

                        {/* Collapsible area for remaining subchannels (> 2) */}
                        {extraSubchannels.length > 0 && (
                          <>
                            <Collapsible open={subchannelsExpanded}>
                              <div className="flex flex-wrap gap-1.5 pt-1.5">
                                {extraSubchannels.map((sub, idx) => (
                                  <span
                                    key={`${idx + 2}-${sub}`}
                                    className="px-2 py-0.5 rounded-md bg-[#1C1612] border border-[#2A241E] text-[#E5E0D8] text-[11px] font-medium"
                                  >
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            </Collapsible>
                            <button
                              type="button"
                              onClick={() => setSubchannelsExpanded((v) => !v)}
                              className="mt-2 text-[11px] font-medium text-[#D4AF37] hover:text-[#e0c04a] transition-colors"
                            >
                              {subchannelsExpanded
                                ? "View less"
                                : `View more (${extraSubchannels.length})`}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {community?.description && (
                  <div className="py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Flag size={14} className="text-[#D4AF37]" />
                      <h4 className="text-sm font-semibold text-[#E5E0D8]">
                        About
                      </h4>
                    </div>
                    <Collapsible
                      open={aboutExpanded || !aboutNeedsToggle}
                      collapsedHeight={72}
                    >
                      <p className="text-xs sm:text-sm text-[#A69B8D] leading-relaxed whitespace-pre-wrap">
                        {community.description}
                      </p>
                    </Collapsible>
                    {aboutNeedsToggle && (
                      <button
                        type="button"
                        onClick={() => setAboutExpanded((v) => !v)}
                        className="mt-2 text-[11px] font-medium text-[#D4AF37] hover:text-[#e0c04a]"
                      >
                        {aboutExpanded ? "View less" : "View more"}
                      </button>
                    )}
                  </div>
                )}

                {community?.rules && (
                  <div className="py-4">
                    <h4 className="text-sm font-semibold text-[#E5E0D8] mb-2">
                      Community Rules
                    </h4>
                    {ruleLines.length > 1 ? (
                      <>
                        <ol className="space-y-2">
                          {primaryRules.map((rule, idx) => (
                            <RuleItem
                              key={`${idx}-${rule.slice(0, 24)}`}
                              index={idx}
                              rule={rule}
                            />
                          ))}
                        </ol>
                        {extraRules.length > 0 && (
                          <>
                            <Collapsible open={rulesExpanded}>
                              <ol className="space-y-2 pt-2">
                                {extraRules.map((rule, idx) => (
                                  <RuleItem
                                    key={`${idx + 3}-${rule.slice(0, 24)}`}
                                    index={idx + 3}
                                    rule={rule}
                                  />
                                ))}
                              </ol>
                            </Collapsible>
                            <button
                              type="button"
                              onClick={() => setRulesExpanded((v) => !v)}
                              className="mt-2 text-[11px] font-medium text-[#D4AF37] hover:text-[#e0c04a]"
                            >
                              {rulesExpanded
                                ? "View less"
                                : `View more (${extraRules.length})`}
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <Collapsible
                          open={rulesExpanded || !rulesBlobNeedsToggle}
                          collapsedHeight={72}
                        >
                          <p className="text-xs sm:text-sm text-[#A69B8D] whitespace-pre-wrap leading-relaxed">
                            {community.rules}
                          </p>
                        </Collapsible>
                        {rulesBlobNeedsToggle && (
                          <button
                            type="button"
                            onClick={() => setRulesExpanded((v) => !v)}
                            className="mt-2 text-[11px] font-medium text-[#D4AF37] hover:text-[#e0c04a]"
                          >
                            {rulesExpanded ? "View less" : "View more"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {community?.tags?.length > 0 && (
                  <div className="py-4 last:pb-0">
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
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Intelligence Feed */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
              <h2 className="text-xl sm:text-2xl font-serif font-semibold text-[#D4AF37]">
                Intelligence Feed
              </h2>
              <button
                type="button"
                onClick={() => setShowCreatePost(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold self-start sm:self-auto"
              >
                <Plus size={14} />
                Create Post
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {[
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {sortedPosts.map((post) => {
                  const authorUsername =
                    post.author?.username || post.author?.name || "Member";
                  const initial = authorUsername.charAt(0).toUpperCase();
                  const hasMedia = post.media?.length > 0;
                  return (
                    <article
                      key={post.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openPost(post)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") openPost(post);
                      }}
                      className="bg-[#14100D] border border-[#2A241E] rounded-xl p-3 sm:p-4 cursor-pointer hover:border-[#D4AF37]/40 transition-colors overflow-hidden h-full flex flex-col"
                    >
                      <div className="flex items-start gap-2.5 mb-3">
                        {post.author?.avatar ? (
                          <img
                            src={post.author.avatar}
                            alt=""
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-[#2A241E] shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] text-xs font-semibold shrink-0">
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-medium text-[#E5E0D8] truncate">
                            {authorUsername}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-[#8C8070]">
                            {timeAgo(post.createdAt)}
                          </div>
                        </div>
                      </div>

                      {hasMedia && (
                        <div
                          className="-mx-3 sm:-mx-4 mb-3 h-64 overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PostMediaGallery
                            media={post.media}
                            counterOverlay
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {post.title && (
                          <h3 className="text-xs sm:text-sm font-serif font-semibold text-[#E5E0D8] mb-1.5 line-clamp-2">
                            {post.title}
                          </h3>
                        )}
                        {post.text && (
                          <p className="text-[11px] sm:text-xs text-[#A69B8D] leading-relaxed line-clamp-3">
                            {post.text}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-auto pt-3 border-t border-[#2A241E]/60 text-[11px] text-[#8C8070]">
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
                  onError={showToast}
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

          {/* Members section */}
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

                <div className="flex items-center gap-2 self-start flex-wrap">
                  {["all", "active", "banned"].map((status) => {
                    const isExpanded = expandedFilter === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          if (memberStatusFilter === status && expandedFilter === status) {
                            setExpandedFilter(null);
                          } else {
                            setMemberStatusFilter(status);
                            setExpandedFilter(status);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border capitalize transition-all ${
                          memberStatusFilter === status
                            ? "bg-[#D4AF37] text-black border-[#D4AF37]"
                            : "border-[#2A241E] text-[#A69B8D] hover:border-[#D4AF37]/40"
                        }`}
                      >
                        <span>{status}</span>
                        <ChevronDown
                          size={12}
                          className={`transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : "rotate-0"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                  expandedFilter === memberStatusFilter
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden min-h-0">
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-10 text-[#A69B8D] text-xs gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Loading members...
                    </div>
                  ) : members.length === 0 ? (
                    <div className="border border-dashed border-[#2A241E] rounded-lg py-10 text-center text-[#8C8070] text-xs px-4">
                      {memberStatusFilter === "all"
                        ? "No members found."
                        : `No ${memberStatusFilter} members found.`}
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
                    Search by username or email. Type at least 3 characters,
                    then select a user from the results to invite.
                  </p>
                </div>
              </div>

              <form onSubmit={handleInvite} className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={inviteIdentifier}
                    onChange={(e) => {
                      setInviteIdentifier(e.target.value);
                      setSelectedInviteUser(null);
                    }}
                    placeholder="Username or email"
                    className="flex-1 bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-sm text-[#E5E0D8] placeholder:text-[#8C8070] focus:outline-none focus:border-[#D4AF37]/50"
                  />
                  <button
                    type="submit"
                    disabled={
                      inviteBusy ||
                      !inviteIdentifier.trim() ||
                      (isOwner && !selectedInviteUser)
                    }
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold disabled:opacity-60"
                  >
                    {inviteBusy && <Loader2 size={12} className="animate-spin" />}
                    Send Invite
                  </button>
                </div>

                {isOwner && inviteIdentifier.trim() && (
                  <div className="space-y-1.5">
                    {inviteIdentifier.trim().length < 3 ? (
                      <p className="text-[11px] text-[#8C8070] px-1">
                        Type at least 3 characters to look up a user.
                      </p>
                    ) : inviteLookupLoading ? (
                      <div className="flex items-center gap-2 text-[11px] text-[#A69B8D] px-1 py-1">
                        <Loader2 size={12} className="animate-spin" />
                        Looking up users...
                      </div>
                    ) : inviteLookupUsers.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto space-y-1.5">
                        {inviteLookupUsers.map((user) => {
                          const isSelected =
                            selectedInviteUser &&
                            String(selectedInviteUser.id) === String(user.id);
                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                setSelectedInviteUser(user);
                                setInviteIdentifier(user.username || user.email || "");
                              }}
                              className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                                isSelected
                                  ? "border-[#D4AF37] bg-[#D4AF37]/10"
                                  : "border-[#2A241E] bg-[#0E0C0A] hover:border-[#D4AF37]/40"
                              }`}
                            >
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt=""
                                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#2A241E]"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-[#1C1612] border border-[#2A241E] flex items-center justify-center text-[#D4AF37] text-xs font-semibold shrink-0">
                                  {(user.username || "?").charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#E5E0D8] truncate">
                                  @{user.username}
                                </p>
                                <p className="text-[11px] text-[#A69B8D] truncate">
                                  {user.name ? `${user.name} · ` : ""}
                                  {user.email || ""}
                                </p>
                              </div>
                              {isSelected && (
                                <span className="ml-auto text-[10px] uppercase tracking-wide text-[#D4AF37] shrink-0">
                                  Selected
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-red-400 px-1">
                        No matching user found.
                      </p>
                    )}
                  </div>
                )}

                <textarea
                  value={inviteNote}
                  onChange={(e) => setInviteNote(e.target.value)}
                  placeholder="Optional message…"
                  rows={2}
                  className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-sm text-[#E5E0D8] placeholder:text-[#8C8070] focus:outline-none focus:border-[#D4AF37]/50 resize-y min-h-[64px]"
                />
              </form>
            </section>
          )}
        </>
      )}

      <JoinWatchGroupModal
        open={joinGroupOpen}
        onClose={() => setJoinGroupOpen(false)}
        groups={watchGroups}
        onJoined={handleGroupJoined}
        onRequested={handleGroupRequested}
      />
    </div>
  );
}