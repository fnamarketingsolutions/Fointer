import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuPencil as Pencil,
  LuTrash2 as Trash2,
  LuUsers as Users,
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuUserPlus as UserPlus,
  LuPlus as Plus,
  LuBan as Ban,
  LuLock as Lock,
  LuGlobe as Globe,
  LuLayers as Layers,
  LuLayoutGrid as Grid
} from "react-icons/lu";
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
  fetchJoinRequests,
  approveJoinRequest,
  denyJoinRequest,
} from "../../../../api/communities";
import { fetchPosts, createPost, togglePostLike, togglePostReshare } from "../../../../api/posts";
import CreatePostForm from "../../../../shared/components/forms/CreatePostForm";
import { COMMUNITY_TYPE_LABELS } from "../../../../shared/constants/community";
import { formatLongDate, timeAgo } from "../../../../shared/utils/date";
import { formatCount } from "../../../../shared/utils/format";
import PostActions from "../../../../shared/components/PostActions";
import UserProfileLink from "../../../../shared/components/UserProfileLink";
import {
  communitySegment,
  postSegment,
} from "../../../../shared/services/entityLinks";
import { useToast } from "../../../../shared/components/feedback/ToastContext";

const TYPE_META = {
  public: { label: COMMUNITY_TYPE_LABELS.public, icon: Globe },
  private_invite: { label: COMMUNITY_TYPE_LABELS.private_invite, icon: Lock },
  private_request: { label: COMMUNITY_TYPE_LABELS.private_request, icon: Lock },
};

const FEED_SORT = [
  { id: "latest", label: "New" },
  { id: "trending", label: "Top" },
];

const MEMBER_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "banned", label: "Banned" },
];

const roleBadgeClass = (role) => {
  if (role === "owner")
    return "text-fo-accent border-fo-accent/40 bg-fo-accent/10";
  if (role === "moderator")
    return "text-amber-200 border-amber-500/30 bg-amber-500/10";
  return "text-fo-muted border-fo-border bg-fo-bg";
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
      <span className="text-[11px] font-semibold text-fo-accent shrink-0 w-4">
        {index + 1}.
      </span>
      <span className="text-xs text-fo-muted leading-relaxed">{rule}</span>
    </li>
  );
}

function FeedPostRow({ post, onOpen, onLike, onReshare, onComment }) {
  const authorName = post?.author?.name || post?.author?.username || "Anonymous";
  const coverImage = post?.media?.find((m) => m.type === "image");

  return (
    <article
      onClick={() => onOpen(post)}
      className="group flex gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl overflow-hidden cursor-pointer transition-colors p-3 sm:p-4"
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-fo-subtle flex-wrap">
          <UserProfileLink
            author={post?.author}
            className="font-semibold text-fo-muted hover:text-fo-accent transition-colors"
          >
            {authorName}
          </UserProfileLink>
          <span>·</span>
          <span>{timeAgo(post?.createdAt)}</span>
        </div>
        <h2 className="text-sm sm:text-base font-semibold text-fo-text leading-snug group-hover:text-fo-accent transition-colors line-clamp-2">
          {post?.title || "Untitled"}
        </h2>
        {post?.text ? (
          <p className="text-xs sm:text-sm text-fo-muted line-clamp-2 leading-relaxed">
            {post.text}
          </p>
        ) : null}
        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
          <PostActions
            post={post}
            compact
            onLike={onLike}
            onReshare={onReshare}
            onComment={onComment}
          />
        </div>
      </div>
      {coverImage ? (
        <div className="hidden sm:block w-24 h-20 shrink-0 rounded-lg overflow-hidden bg-fo-surface-2 border border-fo-border">
          <img
            src={coverImage.url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ) : null}
    </article>
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
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [heroPreview, setHeroPreview] = useState(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [subchannelsExpanded, setSubchannelsExpanded] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState("latest");
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
  const sectionFromUrl = searchParams.get("section");
  const [section, setSection] = useState(
    ["posts", "overview", "incoming", "members", "invite"].includes(sectionFromUrl)
      ? sectionFromUrl
      : "posts"
  );
  const [joinRequests, setJoinRequests] = useState([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [actionRequestId, setActionRequestId] = useState(null);

  const community = manageData?.community;
  const viewerRole = manageData?.viewerRole || "member";
  const isOwner = viewerRole === "owner" || viewerRole === "admin";
  const isModerator = viewerRole === "moderator";
  const canModerate = isOwner || isModerator;
  const canInvite = ["private_request", "private_invite"].includes(
    community?.type
  );
  const canShowIncoming =
    canModerate && community?.type === "private_request";
  const galleryImages = community?.galleryImages || [];
  const heroImage =
    heroPreview || community?.coverImage || galleryImages[0] || "";
  const thumbs = [
    ...new Set([community?.coverImage, ...galleryImages].filter(Boolean)),
  ];
  const meta = TYPE_META[community?.type] || TYPE_META.public;
  const TypeIcon = meta.icon;
  const ownerName =
    community?.owner?.name || community?.owner?.username || "Owner";

  const channelName =
    typeof community?.channel === "object"
      ? community?.channel?.name
      : community?.channel || "";

  const rawSubchannels = Array.isArray(community?.subchannels)
    ? community.subchannels
    : [];
  const subchannelList = rawSubchannels.map((sub) =>
    typeof sub === "object" ? sub.name || sub.title || sub.id : String(sub)
  );
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

  const sectionTabs = useMemo(() => {
    const tabs = [
      { id: "posts", label: "Posts" },
      { id: "overview", label: "About" },
    ];
    if (canModerate) tabs.push({ id: "members", label: "Members" });
    if (canShowIncoming) {
      const pendingCount = joinRequests.filter((r) => r.status === "pending")
        .length;
      tabs.push({
        id: "incoming",
        label: pendingCount ? `Incoming (${pendingCount})` : "Incoming",
      });
    }
    if (canInvite) tabs.push({ id: "invite", label: "Invite" });
    return tabs;
  }, [canModerate, canShowIncoming, canInvite, joinRequests]);

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

  const loadJoinRequests = useCallback(async () => {
    if (!selectedId || !canShowIncoming) {
      setJoinRequests([]);
      return;
    }
    setJoinRequestsLoading(true);
    try {
      const data = await fetchJoinRequests(selectedId, "pending");
      setJoinRequests(data?.requests || []);
    } catch {
      setJoinRequests([]);
    } finally {
      setJoinRequestsLoading(false);
    }
  }, [selectedId, canShowIncoming]);

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
    setSection("posts");
    loadPosts();
  }, [selectedId, loadPosts]);

  useEffect(() => {
    loadJoinRequests();
  }, [loadJoinRequests]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

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

  const handleApproveIncoming = async (requestId) => {
    if (!selectedId || !requestId) return;
    setActionRequestId(requestId);
    try {
      await approveJoinRequest(selectedId, requestId);
      setJoinRequests((prev) =>
        prev.filter((r) => String(r.id) !== String(requestId))
      );
      showToast("Join request approved.");
      loadMembers();
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to approve request.");
    } finally {
      setActionRequestId(null);
    }
  };

  const handleDenyIncoming = async (requestId) => {
    if (!selectedId || !requestId) return;
    setActionRequestId(requestId);
    try {
      await denyJoinRequest(selectedId, requestId);
      setJoinRequests((prev) =>
        prev.filter((r) => String(r.id) !== String(requestId))
      );
      showToast("Join request denied.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to deny request.");
    } finally {
      setActionRequestId(null);
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
      setSection("posts");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to create post.");
    } finally {
      setPostSaving(false);
    }
  };

  const patchPost = (postId, patch) => {
    setPosts((list) =>
      list.map((p) => (p.id === postId ? { ...p, ...patch } : p))
    );
  };

  const handleToggleLike = async (post) => {
    const prev = posts;
    patchPost(post.id, {
      likedByMe: !post.likedByMe,
      likeCount: post.likedByMe
        ? Math.max(0, (post.likeCount || 0) - 1)
        : (post.likeCount || 0) + 1,
    });
    try {
      const data = await togglePostLike(post.id);
      patchPost(post.id, {
        likedByMe: data.likedByMe,
        likeCount: data.likeCount,
      });
    } catch (err) {
      setPosts(prev);
      showToast(err?.response?.data?.message || "Failed to like post.");
    }
  };

  const handleToggleReshare = async (post) => {
    const prev = posts;
    patchPost(post.id, {
      resharedByMe: !post.resharedByMe,
      reshareCount: post.resharedByMe
        ? Math.max(0, (post.reshareCount || 0) - 1)
        : (post.reshareCount || 0) + 1,
    });
    try {
      const data = await togglePostReshare(post.id);
      patchPost(post.id, {
        resharedByMe: data.resharedByMe,
        reshareCount: data.reshareCount,
      });
    } catch (err) {
      setPosts(prev);
      showToast(err?.response?.data?.message || "Failed to repost.");
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
    navigate(`/manage-community/${segment}/posts/${postSegment(post)}`);
  };

  const aboutSidebar = community ? (
    <aside className="space-y-4">
      <div className="bg-fo-surface border border-fo-border rounded-xl overflow-hidden">
        {heroImage ? (
          <div className="h-28 bg-fo-surface-2">
            <img
              src={heroImage}
              alt=""
              className="w-full h-full object-cover opacity-90"
            />
          </div>
        ) : (
          <div className="h-16 bg-gradient-to-br from-[#1C1612] to-[#0A0806]" />
        )}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-fo-text">
              {community.name}
            </h3>
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-fo-subtle">
              <TypeIcon size={11} className="text-fo-accent" />
              {meta.label}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-fo-subtle pt-1 border-t border-fo-border">
            <span className="inline-flex items-center gap-1">
              <Users size={11} className="text-fo-accent" />
              {formatCount(community.memberCount || 0)} members
            </span>
            <span>·</span>
            <span>{ownerName}</span>
          </div>
          {community.createdAt ? (
            <p className="text-[11px] text-fo-subtle">
              Created {formatLongDate(community.createdAt)}
            </p>
          ) : null}
        </div>
      </div>

      {thumbs.length > 1 ? (
        <div className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-fo-text">Gallery</h4>
          <div className="grid grid-cols-4 gap-1.5">
            {thumbs.slice(0, 8).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setHeroPreview(src)}
                className={`aspect-square rounded-lg overflow-hidden border transition-all ${
                  heroImage === src
                    ? "border-fo-accent"
                    : "border-fo-border hover:border-fo-accent/40"
                }`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {(channelName || subchannelList.length > 0) && (
        <div className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-3">
          {channelName ? (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-fo-subtle mb-1.5 flex items-center gap-1">
                <Layers size={11} className="text-fo-accent" /> Channel
              </p>
              <span className="inline-flex px-2.5 py-1 rounded-md bg-fo-accent/15 border border-fo-accent/30 text-fo-accent text-xs font-semibold">
                {channelName}
              </span>
            </div>
          ) : null}
          {subchannelList.length > 0 ? (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-fo-subtle mb-1.5 flex items-center gap-1">
                <Grid size={11} className="text-fo-accent" /> Subchannels
              </p>
              <div className="flex flex-wrap gap-1.5">
                {primarySubchannels.map((name) => (
                  <span
                    key={name}
                    className="px-2 py-0.5 rounded-md bg-fo-surface-hover border border-fo-border text-fo-text text-[11px]"
                  >
                    {name}
                  </span>
                ))}
              </div>
              {extraSubchannels.length > 0 ? (
                <>
                  <Collapsible open={subchannelsExpanded}>
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {extraSubchannels.map((name) => (
                        <span
                          key={name}
                          className="px-2 py-0.5 rounded-md bg-fo-surface-hover border border-fo-border text-fo-text text-[11px]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </Collapsible>
                  <button
                    type="button"
                    onClick={() => setSubchannelsExpanded((v) => !v)}
                    className="mt-1 text-[11px] font-medium text-fo-accent hover:text-fo-accent-hover"
                  >
                    {subchannelsExpanded ? "Show less" : "View more"}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {community.description ? (
        <div className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-fo-text">About</h4>
          <Collapsible open={aboutExpanded || !aboutNeedsToggle} collapsedHeight={72}>
            <p className="text-xs text-fo-muted leading-relaxed whitespace-pre-wrap">
              {community.description}
            </p>
          </Collapsible>
          {aboutNeedsToggle ? (
            <button
              type="button"
              onClick={() => setAboutExpanded((v) => !v)}
              className="text-[11px] font-medium text-fo-accent hover:text-fo-accent-hover"
            >
              {aboutExpanded ? "Show less" : "Read more"}
            </button>
          ) : null}
        </div>
      ) : null}

      {ruleLines.length > 0 || community.rules ? (
        <div className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-fo-text">Rules</h4>
          {ruleLines.length > 1 ? (
            <>
              <ol className="space-y-2">
                {primaryRules.map((rule, i) => (
                  <RuleItem key={i} index={i} rule={rule} />
                ))}
              </ol>
              {extraRules.length > 0 ? (
                <>
                  <Collapsible open={rulesExpanded}>
                    <ol className="space-y-2 pt-2">
                      {extraRules.map((rule, i) => (
                        <RuleItem
                          key={i + primaryRules.length}
                          index={i + primaryRules.length}
                          rule={rule}
                        />
                      ))}
                    </ol>
                  </Collapsible>
                  <button
                    type="button"
                    onClick={() => setRulesExpanded((v) => !v)}
                    className="text-[11px] font-medium text-fo-accent hover:text-fo-accent-hover"
                  >
                    {rulesExpanded ? "Show less" : "View more"}
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Collapsible
                open={rulesExpanded || !rulesBlobNeedsToggle}
                collapsedHeight={72}
              >
                <p className="text-xs text-fo-muted whitespace-pre-wrap leading-relaxed">
                  {community.rules}
                </p>
              </Collapsible>
              {rulesBlobNeedsToggle ? (
                <button
                  type="button"
                  onClick={() => setRulesExpanded((v) => !v)}
                  className="text-[11px] font-medium text-fo-accent hover:text-fo-accent-hover"
                >
                  {rulesExpanded ? "Show less" : "Read more"}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {Array.isArray(community.tags) && community.tags.length > 0 ? (
        <div className="bg-fo-surface border border-fo-border rounded-xl p-4">
          <div className="flex flex-wrap gap-1.5">
            {community.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md bg-fo-accent/10 text-fo-accent text-[11px]"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  ) : null;

  if (showCreatePost && community) {
    return (
      <div className="text-fo-text w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 pb-10">
        <CreatePostForm
          title={postForm.title}
          text={postForm.text}
          media={postForm.media}
          onTitleChange={(title) => setPostForm((p) => ({ ...p, title }))}
          onTextChange={(text) => setPostForm((p) => ({ ...p, text }))}
          onMediaChange={(media) => setPostForm((p) => ({ ...p, media }))}
          onSubmit={handleCreatePost}
          onCancel={() => {
            if (postSaving) return;
            setShowCreatePost(false);
            setPostForm({ title: "", text: "", media: [] });
          }}
          saving={postSaving}
          communityLabel={community.name}
          onError={showToast}
        />
      </div>
    );
  }

  return (
    <div className="text-fo-text w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 pb-10 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-fo-muted hover:text-fo-accent transition-colors self-start"
        >
          <ArrowLeft size={14} />
          Back to communities
        </button>

        {community ? (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={refreshAll}
              className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={() => onEdit?.(community)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fo-border text-xs text-fo-muted hover:text-fo-accent hover:border-fo-accent/40"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(community)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {manageLoading && !community ? (
        <div className="flex items-center justify-center py-16 text-fo-muted text-sm gap-2">
          <Loader2 size={16} className="animate-spin text-fo-accent" />
          Loading community…
        </div>
      ) : community ? (
        <>
          <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-fo-text leading-tight truncate">
                {community.name}
              </h1>
              <p className="text-sm text-fo-subtle flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <TypeIcon size={12} className="text-fo-accent" />
                  {meta.label}
                </span>
                <span>·</span>
                <span>{formatCount(community.memberCount || 0)} members</span>
                <span>·</span>
                <span className="capitalize">{viewerRole}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreatePost(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold hover:bg-fo-accent-hover shrink-0"
            >
              <Plus size={14} /> Create post
            </button>
          </header>

          <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
            {sectionTabs.map((tab) => {
              const active = section === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSection(tab.id)}
                  className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                      : "text-fo-subtle hover:text-fo-text border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <div className="min-w-0 space-y-4">
              {section === "posts" ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-fo-border pb-3">
                    {FEED_SORT.map((opt) => {
                      const active = feedFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFeedFilter(opt.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            active
                              ? "bg-fo-accent/15 text-fo-accent"
                              : "text-fo-subtle hover:text-fo-text hover:bg-fo-surface-hover"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {postsLoading ? (
                    <div className="flex items-center justify-center py-14 text-fo-muted text-sm gap-2">
                      <Loader2
                        size={16}
                        className="animate-spin text-fo-accent"
                      />
                      Loading posts…
                    </div>
                  ) : sortedPosts.length === 0 ? (
                    <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4 space-y-3">
                      <p>No posts in this community yet.</p>
                      <button
                        type="button"
                        onClick={() => setShowCreatePost(true)}
                        className="inline-flex items-center gap-2 text-fo-accent hover:text-fo-accent-hover font-medium"
                      >
                        <Plus size={14} /> Create the first post
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sortedPosts.map((post) => (
                        <FeedPostRow
                          key={post.id}
                          post={post}
                          onOpen={openPost}
                          onLike={() => handleToggleLike(post)}
                          onReshare={() => handleToggleReshare(post)}
                          onComment={() => openPost(post)}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : null}

              {section === "overview" ? (
                <div className="space-y-4">{aboutSidebar}</div>
              ) : null}

              {section === "incoming" && canShowIncoming ? (
                <>
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-fo-text">
                      Incoming requests
                    </h2>
                    <p className="text-xs text-fo-subtle">
                      People asking to join this private community.
                    </p>
                  </div>

                  {joinRequestsLoading ? (
                    <div className="flex items-center justify-center py-14 text-fo-muted text-sm gap-2">
                      <Loader2
                        size={16}
                        className="animate-spin text-fo-accent"
                      />
                      Loading requests…
                    </div>
                  ) : joinRequests.length === 0 ? (
                    <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4">
                      No pending join requests.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {joinRequests.map((request) => {
                        const name =
                          request.user?.name ||
                          request.user?.username ||
                          "Member";
                        const initial = name.charAt(0).toUpperCase();
                        const busy = actionRequestId === request.id;
                        return (
                          <article
                            key={request.id}
                            className="flex flex-col gap-3 bg-fo-surface border border-fo-border rounded-xl p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {request.user?.avatar ? (
                                <img
                                  src={request.user.avatar}
                                  alt=""
                                  className="w-10 h-10 rounded-full object-cover border border-fo-border shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-[#1A1510] border border-fo-border flex items-center justify-center text-fo-accent text-sm font-semibold shrink-0">
                                  {initial}
                                </div>
                              )}
                              <div className="min-w-0">
                                <UserProfileLink
                                  author={request.user}
                                  className="text-sm font-semibold text-fo-text truncate block hover:text-fo-accent transition-colors"
                                >
                                  {name}
                                </UserProfileLink>
                                <UserProfileLink
                                  author={request.user}
                                  className="text-[11px] text-fo-subtle truncate block hover:text-fo-accent transition-colors"
                                >
                                  @{request.user?.username || "user"}
                                  {request.createdAt
                                    ? ` · ${timeAgo(request.createdAt)}`
                                    : ""}
                                </UserProfileLink>
                                {request.message ? (
                                  <p className="text-xs text-fo-muted mt-1 line-clamp-2">
                                    “{request.message}”
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDenyIncoming(request.id)}
                                className="rounded-lg border border-fo-border px-3 py-1.5 text-[11px] text-fo-muted hover:text-red-400 hover:border-red-500/30 disabled:opacity-60"
                              >
                                Deny
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleApproveIncoming(request.id)
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-fo-accent/30 bg-fo-accent/10 px-3 py-1.5 text-[11px] text-fo-accent disabled:opacity-60"
                              >
                                {busy ? (
                                  <Loader2
                                    size={12}
                                    className="animate-spin"
                                  />
                                ) : null}
                                Approve
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : null}

              {section === "members" && canModerate ? (
                <>
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-fo-text">
                      Members
                    </h2>
                    <p className="text-xs text-fo-subtle">
                      {isOwner
                        ? "Assign or remove moderators, remove members, or ban users."
                        : "Remove or ban regular members. Moderator roles are owner-only."}
                    </p>
                  </div>

                  <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
                    {MEMBER_FILTERS.map((item) => {
                      const active = memberStatusFilter === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setMemberStatusFilter(item.id)}
                          className={`flex-1 min-w-[4rem] py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                            active
                              ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                              : "text-fo-subtle hover:text-fo-text border border-transparent"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {membersLoading ? (
                    <div className="flex items-center justify-center py-14 text-fo-muted text-sm gap-2">
                      <Loader2
                        size={16}
                        className="animate-spin text-fo-accent"
                      />
                      Loading members…
                    </div>
                  ) : members.length === 0 ? (
                    <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4">
                      {memberStatusFilter === "all"
                        ? "No members found."
                        : `No ${memberStatusFilter} members found.`}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {members.map((member) => {
                        const name =
                          member.user?.name ||
                          member.user?.username ||
                          "Member";
                        const busy = savingMemberId === member.id;
                        const banned = member.status === "banned";
                        return (
                          <article
                            key={member.id}
                            className="flex flex-col gap-3 bg-fo-surface border border-fo-border rounded-xl p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <UserProfileLink
                                  author={member.user}
                                  className="truncate text-sm font-semibold text-fo-text hover:text-fo-accent transition-colors"
                                >
                                  {name}
                                </UserProfileLink>
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded border text-[10px] uppercase tracking-wide ${roleBadgeClass(
                                    member.role
                                  )}`}
                                >
                                  {member.role}
                                </span>
                              </div>
                              <UserProfileLink
                                author={member.user}
                                className="truncate text-[11px] text-fo-subtle mt-0.5 block hover:text-fo-accent transition-colors"
                              >
                                @{member.user?.username || "user"}
                                {banned ? " · banned" : ""}
                              </UserProfileLink>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                              {banned ? (
                                canActOnMember({
                                  ...member,
                                  role: "member",
                                }) && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleUnbanMember(member)}
                                    className="rounded-lg border border-fo-accent/30 bg-fo-accent/10 px-3 py-1.5 text-[11px] text-fo-accent disabled:opacity-60"
                                  >
                                    {busy ? "Saving…" : "Unban"}
                                  </button>
                                )
                              ) : (
                                <>
                                  {isOwner && member.role === "member" ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        handleAssignModerator(member)
                                      }
                                      className="rounded-lg border border-fo-accent/30 bg-fo-accent/10 px-3 py-1.5 text-[11px] text-fo-accent disabled:opacity-60"
                                    >
                                      {busy ? "Saving…" : "Assign mod"}
                                    </button>
                                  ) : null}
                                  {isOwner && member.role === "moderator" ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        handleRevokeModerator(member)
                                      }
                                      className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200 disabled:opacity-60"
                                    >
                                      {busy ? "Saving…" : "Remove mod"}
                                    </button>
                                  ) : null}
                                  {canActOnMember(member) ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          handleRemoveMember(member)
                                        }
                                        className="rounded-lg border border-fo-border px-3 py-1.5 text-[11px] text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 disabled:opacity-60"
                                      >
                                        {busy ? "Saving…" : "Remove"}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => handleBanMember(member)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-400 disabled:opacity-60"
                                      >
                                        <Ban size={12} />
                                        {busy ? "Saving…" : "Ban"}
                                      </button>
                                    </>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : null}

              {section === "invite" && canInvite ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-fo-text inline-flex items-center gap-2">
                      <UserPlus size={16} className="text-fo-accent" />
                      Invite members
                    </h2>
                    <p className="text-xs text-fo-subtle">
                      Search by username or email. Type at least 3 characters,
                      then select a user to invite.
                    </p>
                  </div>

                  <form onSubmit={handleInvite} className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={inviteIdentifier}
                        onChange={(e) => {
                          setInviteIdentifier(e.target.value);
                          setSelectedInviteUser(null);
                        }}
                        placeholder="Username or email"
                        className="flex-1 bg-fo-surface border border-fo-border rounded-xl px-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
                      />
                      <button
                        type="submit"
                        disabled={
                          inviteBusy ||
                          !inviteIdentifier.trim() ||
                          (isOwner && !selectedInviteUser)
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-fo-accent text-black text-xs font-semibold disabled:opacity-60"
                      >
                        {inviteBusy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : null}
                        Send invite
                      </button>
                    </div>

                    {isOwner && inviteIdentifier.trim() ? (
                      <div className="space-y-1.5">
                        {inviteIdentifier.trim().length < 3 ? (
                          <p className="text-[11px] text-fo-subtle px-1">
                            Type at least 3 characters to look up a user.
                          </p>
                        ) : inviteLookupLoading ? (
                          <div className="flex items-center gap-2 text-[11px] text-fo-muted px-1 py-1">
                            <Loader2 size={12} className="animate-spin" />
                            Looking up users…
                          </div>
                        ) : inviteLookupUsers.length > 0 ? (
                          <div className="max-h-48 overflow-y-auto space-y-1.5">
                            {inviteLookupUsers.map((user) => {
                              const isSelected =
                                selectedInviteUser &&
                                String(selectedInviteUser.id) ===
                                  String(user.id);
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedInviteUser(user);
                                    setInviteIdentifier(
                                      user.username || user.email || ""
                                    );
                                  }}
                                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                                    isSelected
                                      ? "border-fo-accent bg-fo-accent/10"
                                      : "border-fo-border bg-fo-surface hover:border-fo-accent/40"
                                  }`}
                                >
                                  {user.avatar ? (
                                    <img
                                      src={user.avatar}
                                      alt=""
                                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-fo-border"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-fo-surface-hover border border-fo-border flex items-center justify-center text-fo-accent text-xs font-semibold shrink-0">
                                      {(user.username || "?")
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-fo-text truncate">
                                      @{user.username}
                                    </p>
                                    <p className="text-[11px] text-fo-muted truncate">
                                      {user.name ? `${user.name} · ` : ""}
                                      {user.email || ""}
                                    </p>
                                  </div>
                                  {isSelected ? (
                                    <span className="ml-auto text-[10px] uppercase tracking-wide text-fo-accent shrink-0">
                                      Selected
                                    </span>
                                  ) : null}
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
                    ) : null}

                    <textarea
                      value={inviteNote}
                      onChange={(e) => setInviteNote(e.target.value)}
                      placeholder="Optional message…"
                      rows={2}
                      className="w-full bg-fo-surface border border-fo-border rounded-xl px-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50 resize-y min-h-[64px]"
                    />
                  </form>
                </div>
              ) : null}
            </div>

            <div className="hidden lg:block lg:sticky lg:top-4">
              {section !== "overview" ? aboutSidebar : null}
            </div>
          </div>

          <div className="lg:hidden mt-2">
            {section === "posts" ||
            section === "members" ||
            section === "invite" ||
            section === "incoming"
              ? aboutSidebar
              : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
