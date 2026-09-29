import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LuArrowRight as ArrowRight,
  LuCircleCheck as CheckCircle2,
  LuClock as Clock,
  LuHash as Hash,
  LuLoaderCircle as Loader2,
  LuSearch as Search,
  LuPlus as Plus,
  LuUsers as Users,
  LuCircleX as XCircle,
} from "react-icons/lu";
import CommunityCard from "../../components/CommunityCard";
import CommunitiesRail, {
  CommunitiesCategoryFilters,
} from "../../components/CommunitiesRail";
import { fetchChannels } from "../../../../api/channels";
import { FeedFilterToggle } from "./FeedRail";
import {
  acceptInvite,
  declineInvite,
  fetchBrowsableCommunities,
  fetchDiscoverCommunities,
  fetchJoinedCommunities,
  fetchMyInvites,
  fetchMyJoinRequests,
  joinPublicCommunity,
  requestToJoin,
} from "../../../../api/communities";
import { COMMUNITY_TYPE_LABELS } from "../../../../shared/constants/community";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import UserProfileLink from "../../../../shared/components/UserProfileLink";
import { communitySegment } from "../../../../shared/services/entityLinks";
import { timeAgo } from "../../../../shared/utils/date";
import { useAuth } from "../../../../context/AuthContext";

const TYPE_LABELS = COMMUNITY_TYPE_LABELS;

const TABS = [
  { id: "discover", label: "Discover" },
  { id: "joined", label: "Joined" },
  { id: "invites", label: "Invites" },
  { id: "requests", label: "Requests" },
];

const tabBtnClass = (active) =>
  `relative px-2.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded-lg ${
    active ? "text-fo-accent" : "text-fo-subtle hover:text-fo-text"
  }`;

const STATUS_UI = {
  pending: { label: "Pending", className: "text-fo-accent", Icon: Clock },
  approved: {
    label: "Accepted",
    className: "text-emerald-400",
    Icon: CheckCircle2,
  },
  denied: { label: "Denied", className: "text-red-400", Icon: XCircle },
  accepted: {
    label: "Accepted",
    className: "text-emerald-400",
    Icon: CheckCircle2,
  },
  declined: { label: "Declined", className: "text-red-400", Icon: XCircle },
};

function CommunityThumb({ community }) {
  const name = community?.name || "Community";
  if (community?.coverImage) {
    return (
      <img
        src={community.coverImage}
        alt={name}
        className="w-10 h-10 rounded-lg object-cover border border-fo-border shrink-0"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-fo-surface-3 border border-fo-border flex items-center justify-center shrink-0">
      <span className="text-sm font-semibold text-fo-accent/60">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function StatusText({ status }) {
  const meta = STATUS_UI[status] || STATUS_UI.pending;
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium shrink-0 ${meta.className}`}
    >
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

function ActionBtn({ onClick, disabled, tone = "ghost", children }) {
  const tones = {
    ghost:
      "border border-fo-border text-fo-muted hover:text-fo-text hover:border-fo-accent/40",
    primary: "bg-fo-accent text-black font-semibold hover:bg-fo-accent-hover",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      className={`inline-flex items-center gap-1.5 min-h-8 px-3 py-1.5 rounded-full text-xs disabled:opacity-60 transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

const matchesName = (community, query) => {
  if (!query) return true;
  return String(community?.name || "")
    .toLowerCase()
    .includes(query.toLowerCase());
};

const categoryNameOf = (community) => {
  const channel = community?.channel;
  if (!channel) return "";
  if (typeof channel === "string") return channel.trim();
  return String(channel.name || "").trim();
};

const matchesCommunity = (community, query, category) => {
  if (!matchesName(community, query)) return false;
  if (!category) return true;
  return categoryNameOf(community).toLowerCase() === category.toLowerCase();
};

const FILTERS_PANEL_ID = "communities-filters-panel";

export default function JoinedCommunities() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = useState(
    TABS.some((item) => item.id === tabFromUrl) ? tabFromUrl : "discover"
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [discover, setDiscover] = useState([]);
  const [joined, setJoined] = useState([]);
  const [invites, setInvites] = useState([]);
  const [requests, setRequests] = useState([]);

  const [actionId, setActionId] = useState(null);
  const [joiningId, setJoiningId] = useState(null);

  const openCommunity = (community, { inviteId } = {}) => {
    const segment = communitySegment(community) || community?.id;
    if (!segment) return;
    const path = `/communities/${segment}`;
    navigate(inviteId ? `${path}?invite=${inviteId}` : path);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!isAuthenticated) {
        const browseRes = await fetchBrowsableCommunities({
          page: 1,
          limit: 48,
          sortBy: "members",
        });
        setDiscover(browseRes?.communities || []);
        setJoined([]);
        setInvites([]);
        setRequests([]);
        return;
      }

      const [discoverRes, joinedRes, inviteData, reqData] =
        await Promise.all([
          fetchDiscoverCommunities(),
          fetchJoinedCommunities(),
          fetchMyInvites(),
          fetchMyJoinRequests(),
        ]);

      setDiscover(discoverRes?.communities || []);
      setJoined(joinedRes?.communities || []);
      setInvites(inviteData?.invites || []);
      setRequests(reqData?.requests || []);
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Failed to load communities."
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChannelsLoading(true);
      try {
        const data = await fetchChannels();
        if (!cancelled) setChannels(data?.channels || data?.data || []);
      } catch {
        if (!cancelled) setChannels([]);
      } finally {
        if (!cancelled) setChannelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tabFromUrl === "manage") {
      navigate("/communities/manage", { replace: true });
      return;
    }
    if (!isAuthenticated) {
      setTab("discover");
      return;
    }
    const next = TABS.some((item) => item.id === tabFromUrl)
      ? tabFromUrl
      : "discover";
    setTab(next);
  }, [tabFromUrl, isAuthenticated, navigate]);

  const q = search.trim();
  const category = String(searchParams.get("category") || "").trim();

  const filteredDiscover = useMemo(
    () => discover.filter((c) => matchesCommunity(c, q, category)),
    [discover, q, category]
  );

  const filteredJoined = useMemo(
    () => joined.filter((c) => matchesCommunity(c, q, category)),
    [joined, q, category]
  );

  const filteredInvites = useMemo(
    () =>
      invites.filter((invite) =>
        matchesCommunity(invite.community, q, category)
      ),
    [invites, q, category]
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter((req) => matchesCommunity(req.community, q, category)),
    [requests, q, category]
  );

  const pendingInviteCount = useMemo(
    () => invites.filter((i) => i.status === "pending").length,
    [invites]
  );

  const pendingRequestCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  );

  const tabCounts = {
    discover: discover.length,
    joined: joined.length,
    invites: pendingInviteCount,
    requests: pendingRequestCount,
  };

  const setActiveTab = (id) => {
    setTab(id);
    const next = new URLSearchParams(searchParams);
    if (id === "discover") next.delete("tab");
    else next.set("tab", id);
    next.delete("create");
    setSearchParams(next, { replace: true });
  };

  const setCategory = (name) => {
    const next = new URLSearchParams(searchParams);
    const value = String(name || "").trim();
    if (value) next.set("category", value);
    else next.delete("category");
    setSearchParams(next, { replace: true });
    setFiltersOpen(false);
  };

  const emptyFilterCopy = (noun, noneCopy) => {
    if (q && category) return `No ${noun} match your search in this category.`;
    if (q) return `No ${noun} match your search.`;
    if (category) return `No ${noun} in this category.`;
    return noneCopy;
  };

  const railItems = isAuthenticated
    ? TABS.map((item) => ({
        ...item,
        count: tabCounts[item.id] || 0,
      }))
    : [];

  const handleJoinDiscover = async (e, community) => {
    e.stopPropagation();
    if (!community?.id || joiningId) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/communities/${communitySegment(community) || community.id}` } });
      return;
    }
    setJoiningId(community.id);
    try {
      if (community.type === "public") {
        await joinPublicCommunity(community.id);
        showToast("Joined community.");
        await load();
        openCommunity(community);
      } else if (community.type === "private_request") {
        await requestToJoin(community.id, {});
        showToast("Join request sent.");
        await load();
      } else {
        openCommunity(community);
      }
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Could not join this community."
      );
    } finally {
      setJoiningId(null);
    }
  };

  const handleAccept = async (inviteId) => {
    setActionId(inviteId);
    try {
      await acceptInvite(inviteId);
      await load();
      showToast("Invite accepted.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to accept invite.");
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (inviteId) => {
    setActionId(inviteId);
    try {
      await declineInvite(inviteId);
      await load();
      showToast("Invite declined.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to decline invite.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="text-fo-text w-full max-w-[1180px] mx-auto pb-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fo-accent inline-flex items-center gap-1.5">
                <Users size={14} aria-hidden /> Communities
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-fo-text leading-tight">
                Find your people
              </h1>
              <p className="mt-1 text-sm text-fo-subtle leading-snug max-w-xl">
                {isAuthenticated
                  ? "Discover communities to join, plus your invites and requests."
                  : "Browse public communities. Log in to join and participate."}
              </p>
              {category ? (
                <button
                  type="button"
                  onClick={() => setCategory("")}
                  className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg text-xs bg-fo-accent/15 text-fo-accent hover:bg-fo-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                >
                  <Hash size={11} aria-hidden />
                  {category}
                  <span className="opacity-70" aria-hidden>
                    ×
                  </span>
                  <span className="sr-only">Clear category filter</span>
                </button>
              ) : null}
            </div>
            {isAuthenticated ? (
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate("/communities/manage")}
                  className="inline-flex items-center min-h-9 px-3.5 rounded-full border border-fo-border text-[13px] font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent transition-colors shrink-0"
                >
                  Manage
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/communities/manage?create=1")}
                  className="inline-flex items-center gap-1.5 min-h-9 px-3.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold hover:bg-fo-accent-hover transition-colors shrink-0"
                >
                  <Plus size={16} aria-hidden /> Create
                </button>
              </div>
            ) : null}
          </div>

          {isAuthenticated ? (
            <div
              className="flex flex-wrap items-center gap-1 border-b border-fo-border pb-1"
              role="group"
              aria-label="Community views"
            >
              {TABS.map((t) => {
                const active = tab === t.id;
                const count = tabCounts[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    aria-pressed={active}
                    className={tabBtnClass(active)}
                  >
                    {t.label}
                    {!loading && count > 0 ? ` (${count})` : ""}
                    {active ? (
                      <span className="absolute left-3 right-3 -bottom-1 h-0.5 rounded-full bg-fo-accent" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
              />
              <input
                type="search"
                placeholder="Search communities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-fo-border bg-fo-surface pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
              />
            </div>
            <FeedFilterToggle
              open={filtersOpen}
              active={Boolean(category)}
              onClick={() => setFiltersOpen((open) => !open)}
              controlsId={FILTERS_PANEL_ID}
            />
          </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
          <Loader2 size={16} className="animate-spin text-fo-accent" />
          Loading…
        </div>
      ) : (
        <>
          {/* Discover */}
          {tab === "discover" &&
            (discover.length === 0 ? (
              <div className="border border-dashed border-fo-border rounded-xl py-14 text-center px-4 space-y-3">
                <p className="text-sm text-fo-subtle">
                  {isAuthenticated
                    ? "No more communities to discover right now. You’ve joined everything available, or none have been created yet."
                    : "No public communities to browse yet."}
                </p>
                {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("joined")}
                  className="inline-flex items-center gap-2 text-sm text-fo-accent hover:text-fo-accent-hover font-medium"
                >
                  View joined <ArrowRight size={14} />
                </button>
                ) : null}
              </div>
            ) : filteredDiscover.length === 0 ? (
              <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
                {emptyFilterCopy("communities", "No communities match your search.")}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredDiscover.map((c) => {
                  const busy = joiningId === c.id;
                  const pending = Boolean(c.joinRequestPending);
                  let actionLabel = "View";
                  if (c.type === "public") actionLabel = "Join";
                  else if (c.type === "private_request")
                    actionLabel = pending ? "Pending" : "Request";

                  return (
                    <CommunityCard
                      key={c.id}
                      community={c}
                      onClick={openCommunity}
                      action={
                        <ActionBtn
                          tone={
                            c.type === "public" ||
                            (c.type === "private_request" && !pending)
                              ? "primary"
                              : "ghost"
                          }
                          disabled={busy || pending}
                          onClick={(e) => handleJoinDiscover(e, c)}
                        >
                          {busy ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : null}
                          {actionLabel}
                        </ActionBtn>
                      }
                    />
                  );
                })}
              </div>
            ))}

          {/* Joined */}
          {tab === "joined" &&
            (joined.length === 0 ? (
              <div className="border border-dashed border-fo-border rounded-xl py-14 text-center px-4 space-y-3">
                <p className="text-sm text-fo-subtle">
                  You haven’t joined any communities yet.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("discover")}
                  className="inline-flex items-center gap-2 text-sm text-fo-accent hover:text-fo-accent-hover font-medium"
                >
                  Discover communities <ArrowRight size={14} />
                </button>
              </div>
            ) : filteredJoined.length === 0 ? (
              <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
                {emptyFilterCopy(
                  "communities",
                  "No communities match your search."
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredJoined.map((c) => (
                  <CommunityCard
                    key={c.id}
                    community={c}
                    onClick={openCommunity}
                    badge={c.membershipRole || "member"}
                  />
                ))}
              </div>
            ))}

          {/* Invites */}
          {tab === "invites" &&
            (filteredInvites.length === 0 ? (
              <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
                {invites.length === 0
                  ? "No invites yet."
                  : emptyFilterCopy("invites", "No invites match your search.")}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredInvites.map((invite) => {
                  const community = invite.community || {};
                  const inviterName =
                    invite.inviter?.name ||
                    invite.inviter?.username ||
                    "Community Owner";
                  const busy = actionId === invite.id;

                  return (
                    <article
                      key={invite.id}
                      className="flex gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          openCommunity(community, {
                            inviteId:
                              invite?.status === "pending" ? invite.id : null,
                          })
                        }
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        <CommunityThumb community={community} />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-fo-text truncate">
                              {community.name || "Community"}
                            </h3>
                            <span className="text-[10px] text-fo-subtle">
                              {TYPE_LABELS[community.type] || community.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-fo-subtle">
                            Invited by{" "}
                            <UserProfileLink
                              author={invite.inviter}
                              className="hover:text-fo-accent transition-colors"
                            >
                              {inviterName}
                            </UserProfileLink>
                            {invite.createdAt
                              ? ` · ${timeAgo(invite.createdAt)}`
                              : ""}
                          </p>
                        </div>
                      </button>

                      {invite.status === "pending" ? (
                        <div className="flex items-center gap-1.5 shrink-0 self-center">
                          <ActionBtn
                            disabled={busy}
                            onClick={() => handleDecline(invite.id)}
                          >
                            Decline
                          </ActionBtn>
                          <ActionBtn
                            tone="primary"
                            disabled={busy}
                            onClick={() => handleAccept(invite.id)}
                          >
                            {busy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : null}
                            Accept
                          </ActionBtn>
                        </div>
                      ) : (
                        <div className="self-center">
                          <StatusText status={invite.status} />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ))}

          {/* My requests */}
          {tab === "requests" &&
            (filteredRequests.length === 0 ? (
              <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
                {requests.length === 0
                  ? "You haven’t sent any join requests."
                  : emptyFilterCopy(
                      "requests",
                      "No requests match your search."
                    )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredRequests.map((req) => {
                  const community = req.community || {};
                  const ownerName =
                    community.owner?.name ||
                    community.owner?.username ||
                    "Community Owner";

                  return (
                    <article
                      key={req.id}
                      className="flex gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => openCommunity(community)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        <CommunityThumb community={community} />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-fo-text truncate">
                              {community.name || "Community"}
                            </h3>
                            <span className="text-[10px] text-fo-subtle">
                              {TYPE_LABELS[community.type] || community.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-fo-subtle">
                            Owner{" "}
                            <UserProfileLink
                              author={community.owner}
                              className="hover:text-fo-accent transition-colors"
                            >
                              {ownerName}
                            </UserProfileLink>
                            {req.createdAt
                              ? ` · ${timeAgo(req.createdAt)}`
                              : ""}
                          </p>
                          {req.message ? (
                            <p className="text-xs text-fo-muted line-clamp-2">
                              “{req.message}”
                            </p>
                          ) : null}
                        </div>
                      </button>
                      <div className="self-center">
                        <StatusText status={req.status} />
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
        </>
      )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-5">
          <CommunitiesRail
            items={railItems}
            selectedId={tab}
            onSelect={setActiveTab}
            isGuest={!isAuthenticated}
            showCategories
            channels={channels}
            channelsLoading={channelsLoading}
            selectedCategory={category}
            onSelectCategory={setCategory}
          />
        </div>
      </div>

      <div className="lg:hidden mt-4">
        <CommunitiesRail
          items={railItems}
          selectedId={tab}
          onSelect={setActiveTab}
          isGuest={!isAuthenticated}
        />
      </div>

      <CommunitiesCategoryFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        channels={channels}
        channelsLoading={channelsLoading}
        selectedChannel={category}
        onSelectChannel={setCategory}
      />
    </div>
  );
}
