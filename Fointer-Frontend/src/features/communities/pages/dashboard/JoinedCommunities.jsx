import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuArrowRight as ArrowRight,
  LuCircleCheck as CheckCircle2,
  LuClock as Clock,
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuUsers as Users,
  LuCircleX as XCircle
} from "react-icons/lu";
import {
  acceptInvite,
  approveJoinRequest,
  declineInvite,
  denyJoinRequest,
  fetchDiscoverCommunities,
  fetchIncomingJoinRequests,
  fetchJoinedCommunities,
  fetchMyInvites,
  fetchMyJoinRequests,
  joinPublicCommunity,
  requestToJoin,
} from "../../../../api/communities";
import { COMMUNITY_TYPE_LABELS } from "../../../../shared/constants/community";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { communitySegment } from "../../../../shared/services/entityLinks";
import { timeAgo } from "../../../../shared/utils/date";

const TYPE_LABELS = COMMUNITY_TYPE_LABELS;

const TABS = [
  { id: "discover", label: "Discover" },
  { id: "joined", label: "Joined" },
  { id: "invites", label: "Invites" },
  { id: "requests", label: "Requests" },
  { id: "incoming", label: "Incoming" },
];

const STATUS_UI = {
  pending: { label: "Pending", className: "text-[#D4AF37]", Icon: Clock },
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
        className="w-12 h-12 rounded-lg object-cover border border-[#2A241E] shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-lg bg-[#1A1510] border border-[#2A241E] flex items-center justify-center shrink-0">
      <span className="text-sm font-semibold text-[#D4AF37]/60">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function CommunityBadge({ community }) {
  const name = community?.name || "Community";
  return (
    <span
      title={name}
      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md overflow-hidden bg-[#1C1712] border-2 border-[#14100D] flex items-center justify-center"
    >
      {community?.coverImage ? (
        <img
          src={community.coverImage}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[9px] font-bold text-[#D4AF37]/70">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
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
      "border border-[#2A241E] text-[#A69B8D] hover:text-[#E5E0D8] hover:border-[#D4AF37]/30",
    primary: "bg-[#D4AF37] text-black font-semibold",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs disabled:opacity-60 transition-colors ${tones[tone]}`}
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

export default function JoinedCommunities() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tab, setTab] = useState("discover");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [discover, setDiscover] = useState([]);
  const [joined, setJoined] = useState([]);
  const [invites, setInvites] = useState([]);
  const [requests, setRequests] = useState([]);
  const [incoming, setIncoming] = useState([]);

  const [actionId, setActionId] = useState(null);
  const [actionRequestId, setActionRequestId] = useState(null);
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
      const [discoverRes, joinedRes, inviteData, reqData, incomingData] =
        await Promise.all([
          fetchDiscoverCommunities(),
          fetchJoinedCommunities(),
          fetchMyInvites(),
          fetchMyJoinRequests(),
          fetchIncomingJoinRequests("all"),
        ]);

      setDiscover(discoverRes?.communities || []);
      setJoined(joinedRes?.communities || []);
      setInvites(inviteData?.invites || []);
      setRequests(reqData?.requests || []);
      setIncoming(incomingData?.requests || []);
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Failed to load communities."
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const q = search.trim();

  const filteredDiscover = useMemo(
    () => discover.filter((c) => matchesName(c, q)),
    [discover, q]
  );

  const filteredJoined = useMemo(
    () => joined.filter((c) => matchesName(c, q)),
    [joined, q]
  );

  const filteredInvites = useMemo(
    () => invites.filter((invite) => matchesName(invite.community, q)),
    [invites, q]
  );

  const filteredRequests = useMemo(
    () => requests.filter((req) => matchesName(req.community, q)),
    [requests, q]
  );

  const filteredIncoming = useMemo(
    () => incoming.filter((req) => matchesName(req.community, q)),
    [incoming, q]
  );

  const pendingInviteCount = useMemo(
    () => invites.filter((i) => i.status === "pending").length,
    [invites]
  );

  const pendingRequestCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  );

  const pendingIncomingCount = useMemo(
    () => incoming.filter((r) => r.status === "pending").length,
    [incoming]
  );

  const tabCounts = {
    discover: discover.length,
    joined: joined.length,
    invites: pendingInviteCount,
    requests: pendingRequestCount,
    incoming: pendingIncomingCount,
  };

  const handleJoinDiscover = async (e, community) => {
    e.stopPropagation();
    if (!community?.id || joiningId) return;
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

  const handleApproveIncoming = async (communityId, requestId) => {
    if (!communityId || !requestId) return;
    setActionRequestId(requestId);
    try {
      await approveJoinRequest(communityId, requestId);
      await load();
      showToast("Request approved.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to approve request.");
    } finally {
      setActionRequestId(null);
    }
  };

  const handleDenyIncoming = async (communityId, requestId) => {
    if (!communityId || !requestId) return;
    setActionRequestId(requestId);
    try {
      await denyJoinRequest(communityId, requestId);
      await load();
      showToast("Request denied.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to deny request.");
    } finally {
      setActionRequestId(null);
    }
  };

  const searchPlaceholder =
    tab === "incoming"
      ? "Search by community name…"
      : "Search by community name…";

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8]">
            Communities
          </h1>
          <p className="text-sm text-[#8C8070]">
            Discover communities to join, plus your invites and requests.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count = tabCounts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                  : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
              }`}
            >
              {t.label}
              {!loading && count > 0 ? (
                <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8070] pointer-events-none"
        />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#14100D] border border-[#2A241E] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#E5E0D8] placeholder:text-[#5C5348] focus:outline-none focus:border-[#D4AF37]/50"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
          <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
          Loading…
        </div>
      ) : (
        <>
          {/* Discover */}
          {tab === "discover" &&
            (discover.length === 0 ? (
              <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center px-4 space-y-3">
                <p className="text-sm text-[#8C8070]">
                  No more communities to discover right now. You’ve joined
                  everything available, or none have been created yet.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("joined")}
                  className="inline-flex items-center gap-2 text-sm text-[#D4AF37] hover:text-[#e0c04a] font-medium"
                >
                  View joined <ArrowRight size={14} />
                </button>
              </div>
            ) : filteredDiscover.length === 0 ? (
              <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
                No communities match your search.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredDiscover.map((c) => {
                  const busy = joiningId === c.id;
                  const pending = Boolean(c.joinRequestPending);
                  let actionLabel = "View";
                  if (c.type === "public") actionLabel = "Join";
                  else if (c.type === "private_request")
                    actionLabel = pending ? "Pending" : "Request";

                  return (
                    <article
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openCommunity(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openCommunity(c);
                        }
                      }}
                      className="group flex items-center gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors cursor-pointer"
                    >
                      <CommunityThumb community={c} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-semibold text-[#E5E0D8] group-hover:text-[#D4AF37] transition-colors truncate">
                            {c.name || "Community"}
                          </h2>
                          <span className="text-[10px] text-[#8C8070]">
                            {TYPE_LABELS[c.type] || c.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8C8070] line-clamp-1">
                          {c.description ||
                            (typeof c.memberCount === "number"
                              ? `${c.memberCount} members`
                              : "Open community")}
                        </p>
                      </div>
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
                    </article>
                  );
                })}
              </div>
            ))}

          {/* Joined */}
          {tab === "joined" &&
            (joined.length === 0 ? (
              <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center px-4 space-y-3">
                <p className="text-sm text-[#8C8070]">
                  You haven’t joined any communities yet.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("discover")}
                  className="inline-flex items-center gap-2 text-sm text-[#D4AF37] hover:text-[#e0c04a] font-medium"
                >
                  Discover communities <ArrowRight size={14} />
                </button>
              </div>
            ) : filteredJoined.length === 0 ? (
              <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
                No communities match your search.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredJoined.map((c) => (
                  <article
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openCommunity(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openCommunity(c);
                      }
                    }}
                    className="group flex items-center gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors cursor-pointer"
                  >
                    <CommunityThumb community={c} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold text-[#E5E0D8] group-hover:text-[#D4AF37] transition-colors truncate">
                          {c.name || "Community"}
                        </h2>
                        <span className="text-[10px] text-[#8C8070]">
                          {TYPE_LABELS[c.type] || c.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8C8070] flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 capitalize">
                          <Users size={11} />
                          {c.membershipRole || "member"}
                        </span>
                        {typeof c.memberCount === "number" ? (
                          <>
                            <span>·</span>
                            <span>{c.memberCount} members</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-[#5C5348] group-hover:text-[#D4AF37] shrink-0 transition-colors"
                    />
                  </article>
                ))}
              </div>
            ))}

          {/* Invites */}
          {tab === "invites" &&
            (filteredInvites.length === 0 ? (
              <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
                {invites.length === 0
                  ? "No invites yet."
                  : "No invites match your search."}
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
                      className="flex gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
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
                            <h3 className="text-sm font-semibold text-[#E5E0D8] truncate">
                              {community.name || "Community"}
                            </h3>
                            <span className="text-[10px] text-[#8C8070]">
                              {TYPE_LABELS[community.type] || community.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8C8070]">
                            Invited by {inviterName}
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
              <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
                {requests.length === 0
                  ? "You haven’t sent any join requests."
                  : "No requests match your search."}
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
                      className="flex gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => openCommunity(community)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        <CommunityThumb community={community} />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-[#E5E0D8] truncate">
                              {community.name || "Community"}
                            </h3>
                            <span className="text-[10px] text-[#8C8070]">
                              {TYPE_LABELS[community.type] || community.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8C8070]">
                            Owner {ownerName}
                            {req.createdAt
                              ? ` · ${timeAgo(req.createdAt)}`
                              : ""}
                          </p>
                          {req.message ? (
                            <p className="text-xs text-[#A69B8D] line-clamp-2">
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

          {/* Incoming */}
          {tab === "incoming" &&
            (filteredIncoming.length === 0 ? (
              <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4">
                {incoming.length === 0
                  ? "No incoming applications for communities you manage."
                  : "No applications match your search."}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredIncoming.map((request) => {
                  const name =
                    request.user?.name || request.user?.username || "Member";
                  const initial = name.charAt(0).toUpperCase();
                  const community = request.community || {};
                  const busy = actionRequestId === request.id;
                  const isPending = request.status === "pending";

                  return (
                    <article
                      key={`${community.id}-${request.id}`}
                      className="flex gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          {request.user?.avatar ? (
                            <img
                              src={request.user.avatar}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover border border-[#2A241E]"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#1A1510] border border-[#2A241E] flex items-center justify-center text-[#D4AF37] text-sm font-semibold">
                              {initial}
                            </div>
                          )}
                          <CommunityBadge community={community} />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-[#E5E0D8] truncate">
                            {name}
                          </p>
                          <p className="text-[11px] text-[#8C8070] truncate">
                            {community.name || "Community"}
                            {community.type
                              ? ` · ${TYPE_LABELS[community.type] || community.type}`
                              : ""}
                            {request.createdAt
                              ? ` · ${timeAgo(request.createdAt)}`
                              : ""}
                          </p>
                          {request.message ? (
                            <p className="text-xs text-[#A69B8D] line-clamp-2">
                              “{request.message}”
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {isPending ? (
                        <div className="flex items-center gap-1.5 shrink-0 self-center">
                          <ActionBtn
                            disabled={busy}
                            onClick={() =>
                              handleDenyIncoming(community.id, request.id)
                            }
                          >
                            Deny
                          </ActionBtn>
                          <ActionBtn
                            tone="primary"
                            disabled={busy}
                            onClick={() =>
                              handleApproveIncoming(community.id, request.id)
                            }
                          >
                            {busy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : null}
                            Approve
                          </ActionBtn>
                        </div>
                      ) : (
                        <div className="self-center">
                          <StatusText status={request.status} />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ))}
        </>
      )}
    </div>
  );
}