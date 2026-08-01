import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  fetchMyJoinRequests,
  fetchMyInvites,
  fetchMyCommunities,
  fetchJoinRequests,
  approveJoinRequest,
  denyJoinRequest,
  acceptInvite,
  declineInvite,
} from "../../../../api/communities";
import CommunityBrowseDetail from "../../components/CommunityBrowseDetail";
import { COMMUNITY_TYPE_LABELS } from "../../../../shared/constants/community";

const TYPE_LABELS = COMMUNITY_TYPE_LABELS;

const STATUS_UI = {
  pending: {
    label: "Pending Approval",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Icon: Clock,
  },
  approved: {
    label: "Accepted",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Icon: CheckCircle2,
  },
  denied: {
    label: "Denied",
    className: "bg-red-500/10 text-red-400 border-red-500/30",
    Icon: XCircle,
  },
  accepted: {
    label: "Accepted",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Icon: CheckCircle2,
  },
  declined: {
    label: "Declined",
    className: "bg-red-500/10 text-red-400 border-red-500/30",
    Icon: XCircle,
  },
};

const FILTERS = ["all", "accepted", "declined", "request"];

const matchesInviteFilter = (status, filter) => {
  if (filter === "all") return true;
  if (filter === "request") return false;
  return status === filter;
};

const matchesRequestFilter = (status, filter) => {
  if (filter === "all") return true;
  if (filter === "request") return false;
  if (filter === "accepted") return status === "approved";
  if (filter === "declined") return status === "denied";
  return false;
};

const matchesIncomingFilter = (status, filter) => {
  if (filter === "all" || filter === "request") return true;
  if (filter === "accepted") return status === "approved";
  if (filter === "declined") return status === "denied";
  return false;
};

const matchesCommunityName = (community, query) => {
  if (!query) return true;
  return String(community?.name || "")
    .toLowerCase()
    .includes(query.toLowerCase());
};

export default function JoinRequests() {
  const [requests, setRequests] = useState([]);
  const [invites, setInvites] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);
  const [actionRequestId, setActionRequestId] = useState(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [selectedInviteId, setSelectedInviteId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqData, inviteData, managedData] = await Promise.all([
        fetchMyJoinRequests(),
        fetchMyInvites(),
        fetchMyCommunities({ manage: true }),
      ]);
      setRequests(reqData?.requests || []);
      setInvites(inviteData?.invites || []);

      const managedCommunities = (managedData?.communities || []).filter(
        (community) => community.type === "private_request"
      );
      const incomingResults = await Promise.all(
        managedCommunities.map(async (community) => {
          try {
            const data = await fetchJoinRequests(community.id, "all");
            return (data?.requests || []).map((request) => ({
              ...request,
              community,
            }));
          } catch {
            return [];
          }
        })
      );
      setIncomingRequests(incomingResults.flat());
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showMemberSections =
    statusFilter === "all" ||
    statusFilter === "accepted" ||
    statusFilter === "declined";

  const filteredInvites = useMemo(() => {
    const q = searchQuery.trim();
    return invites.filter(
      (invite) =>
        matchesInviteFilter(invite.status, statusFilter) &&
        matchesCommunityName(invite.community, q)
    );
  }, [invites, statusFilter, searchQuery]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim();
    return requests.filter(
      (req) =>
        matchesRequestFilter(req.status, statusFilter) &&
        matchesCommunityName(req.community, q)
    );
  }, [requests, statusFilter, searchQuery]);

  const filteredIncoming = useMemo(() => {
    const q = searchQuery.trim();
    return incomingRequests.filter(
      (req) =>
        matchesIncomingFilter(req.status, statusFilter) &&
        matchesCommunityName(req.community, q)
    );
  }, [incomingRequests, statusFilter, searchQuery]);

  const pendingIncomingCount = useMemo(
    () => filteredIncoming.filter((req) => req.status === "pending").length,
    [filteredIncoming]
  );

  const openInviteDetail = (communityId, invite) => {
    if (!communityId) return;
    setSelectedCommunityId(communityId);
    setSelectedInviteId(
      invite?.status === "pending" ? invite.id : null
    );
  };

  const openRequestDetail = (communityId) => {
    if (!communityId) return;
    setSelectedCommunityId(communityId);
    setSelectedInviteId(null);
  };

  const closeDetail = () => {
    setSelectedCommunityId(null);
    setSelectedInviteId(null);
  };

  const handleAccept = async (inviteId) => {
    setActionId(inviteId);
    setError("");
    try {
      await acceptInvite(inviteId);
      closeDetail();
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to accept invite.");
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (inviteId) => {
    setActionId(inviteId);
    setError("");
    try {
      await declineInvite(inviteId);
      closeDetail();
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to decline invite.");
    } finally {
      setActionId(null);
    }
  };

  const handleApproveIncoming = async (communityId, requestId) => {
    if (!communityId || !requestId) return;
    setActionRequestId(requestId);
    setError("");
    try {
      await approveJoinRequest(communityId, requestId);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to approve request.");
    } finally {
      setActionRequestId(null);
    }
  };

  const handleDenyIncoming = async (communityId, requestId) => {
    if (!communityId || !requestId) return;
    setActionRequestId(requestId);
    setError("");
    try {
      await denyJoinRequest(communityId, requestId);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to deny request.");
    } finally {
      setActionRequestId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold text-[#E5E0D8]">
            Join Requests & Invites
          </h1>
          <p className="text-xs sm:text-sm text-[#8C8070] mt-1">
            Track your outgoing requests, respond to invites, and review incoming applications.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded-lg text-[11px] border capitalize transition-colors ${
                  statusFilter === filter
                    ? "bg-[#D4AF37] text-black border-[#D4AF37]"
                    : "border-[#2A241E] text-[#A69B8D] hover:border-[#D4AF37]/40"
                }`}
              >
                {filter}
              </button>
            ))}
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
        </div>
      </div>

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8070] pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by community name..."
          className="w-full bg-[#14100D] border border-[#2A241E] rounded-lg pl-9 pr-3 py-2 text-sm text-[#E5E0D8] placeholder:text-[#8C8070] focus:outline-none focus:border-[#D4AF37]/50"
        />
      </div>

      {error && (
        <div className="text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 sm:px-4 py-2.5">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 sm:py-16 text-[#A69B8D] text-xs sm:text-sm gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          {showMemberSections && (
            <>
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider">
                  Invites Received
                </h2>
                {filteredInvites.length === 0 ? (
                  <div className="border border-dashed border-[#2A241E] rounded-xl py-10 text-center text-[#8C8070] text-xs sm:text-sm px-4">
                    No community invites match this filter.
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {filteredInvites.map((invite) => {
                      const status = STATUS_UI[invite.status] || STATUS_UI.pending;
                      const StatusIcon = status.Icon;
                      const community = invite.community || {};
                      const inviterName =
                        invite.inviter?.name ||
                        invite.inviter?.username ||
                        "Community Owner";
                      const busy = actionId === invite.id;

                      return (
                        <div
                          key={invite.id}
                          className="bg-[#14100D] border border-[#2A241E] p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <button
                            type="button"
                            onClick={() => openInviteDetail(community.id, invite)}
                            className="space-y-1.5 min-w-0 text-left hover:opacity-90 transition-opacity"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-serif font-bold text-base sm:text-lg text-[#E5E0D8] truncate">
                                {community.name || "Community"}
                              </h3>
                              <span className="text-[10px] text-[#8C8070] font-mono px-2 py-0.5 border border-[#2A241E] rounded">
                                {TYPE_LABELS[community.type] || community.type}
                              </span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-[#8C8070]">
                              Invited by: {inviterName}
                            </p>
                            <p className="text-[10px] text-[#8C8070] font-mono">
                              {invite.createdAt
                                ? new Date(invite.createdAt).toLocaleDateString()
                                : "—"}
                            </p>
                          </button>

                          {invite.status === "pending" ? (
                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDecline(invite.id)}
                                className="px-3 py-1.5 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#E5E0D8] disabled:opacity-60"
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleAccept(invite.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold disabled:opacity-60"
                              >
                                {busy && (
                                  <Loader2 size={12} className="animate-spin" />
                                )}
                                Accept
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`border text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0 self-start sm:self-auto ${status.className}`}
                            >
                              <StatusIcon size={14} /> {status.label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider">
                  My Join Requests
                </h2>
                {filteredRequests.length === 0 ? (
                  <div className="border border-dashed border-[#2A241E] rounded-xl py-10 text-center text-[#8C8070] text-xs sm:text-sm px-4">
                    No join requests match this filter.
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {filteredRequests.map((req) => {
                      const status = STATUS_UI[req.status] || STATUS_UI.pending;
                      const StatusIcon = status.Icon;
                      const community = req.community || {};
                      const ownerName =
                        community.owner?.name ||
                        community.owner?.username ||
                        "Community Owner";

                      return (
                        <div
                          key={req.id}
                          className="bg-[#14100D] border border-[#2A241E] p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <button
                            type="button"
                            onClick={() => openRequestDetail(community.id)}
                            className="space-y-1.5 min-w-0 text-left hover:opacity-90 transition-opacity"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-serif font-bold text-base sm:text-lg text-[#E5E0D8] truncate">
                                {community.name || "Community"}
                              </h3>
                              <span className="text-[10px] text-[#8C8070] font-mono px-2 py-0.5 border border-[#2A241E] rounded">
                                {TYPE_LABELS[community.type] || community.type}
                              </span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-[#8C8070]">
                              Owner: {ownerName}
                            </p>
                            {req.message && (
                              <p className="text-xs text-[#A69B8D] line-clamp-2">
                                &ldquo;{req.message}&rdquo;
                              </p>
                            )}
                            <p className="text-[10px] text-[#8C8070] font-mono">
                              Submitted on{" "}
                              {req.createdAt
                                ? new Date(req.createdAt).toLocaleDateString()
                                : "—"}
                            </p>
                          </button>

                          <span
                            className={`border text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0 self-start sm:self-auto ${status.className}`}
                          >
                            <StatusIcon size={14} /> {status.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          <section className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider">
                    Incoming Join Requests
                  </h2>
                  <p className="text-[11px] sm:text-xs text-[#8C8070] mt-1">
                    Review and approve new member applications for communities you manage.
                  </p>
                </div>
                <span className="text-[11px] text-[#D4AF37] shrink-0">
                  {pendingIncomingCount} pending
                </span>
              </div>
              {filteredIncoming.length === 0 ? (
                <div className="border border-dashed border-[#2A241E] rounded-xl py-10 text-center text-[#8C8070] text-xs sm:text-sm px-4">
                  No incoming requests match this filter.
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {filteredIncoming.map((request) => {
                    const name =
                      request.user?.name || request.user?.username || "Member";
                    const initial = name.charAt(0).toUpperCase();
                    const community = request.community || {};
                    const busy = actionRequestId === request.id;
                    const status = STATUS_UI[request.status] || STATUS_UI.pending;
                    const StatusIcon = status.Icon;
                    const isPending = request.status === "pending";
                    return (
                      <div
                        key={`${community.id}-${request.id}`}
                        className="bg-[#14100D] border border-[#2A241E] p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                          <div className="min-w-0 space-y-0.5">
                            <div className="text-sm font-medium text-[#E5E0D8] truncate">
                              {name}
                            </div>
                            <div className="text-[11px] text-[#A69B8D] truncate">
                              {request.user?.email ||
                                request.user?.username ||
                                "Applicant"}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] text-[#8C8070] truncate">
                                {community.name || "Community"}
                              </span>
                              {community.type && (
                                <span className="text-[10px] text-[#8C8070] font-mono px-2 py-0.5 border border-[#2A241E] rounded">
                                  {TYPE_LABELS[community.type] || community.type}
                                </span>
                              )}
                            </div>
                            {request.message && (
                              <p className="text-xs text-[#A69B8D] line-clamp-2 pt-0.5">
                                &ldquo;{request.message}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        {isPending ? (
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleDenyIncoming(community.id, request.id)
                              }
                              className="px-3 py-1.5 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#E5E0D8] disabled:opacity-60"
                            >
                              Deny
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleApproveIncoming(community.id, request.id)
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold disabled:opacity-60"
                            >
                              {busy && (
                                <Loader2 size={12} className="animate-spin" />
                              )}
                              Approve
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`border text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0 self-end sm:self-auto ${status.className}`}
                          >
                            <StatusIcon size={14} /> {status.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
        </>
      )}

      {selectedCommunityId && (
        <CommunityBrowseDetail
          communityId={selectedCommunityId}
          pendingInviteId={selectedInviteId}
          onAcceptInvite={handleAccept}
          onDeclineInvite={handleDecline}
          inviteActionBusy={Boolean(actionId && actionId === selectedInviteId)}
          onClose={closeDetail}
          onJoined={load}
        />
      )}
    </div>
  );
}
