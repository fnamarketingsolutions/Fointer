import React, { useCallback, useEffect, useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  fetchMyJoinRequests,
  fetchMyInvites,
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

export default function JoinRequests() {
  const [requests, setRequests] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqData, inviteData] = await Promise.all([
        fetchMyJoinRequests(),
        fetchMyInvites(),
      ]);
      setRequests(reqData?.requests || []);
      setInvites(inviteData?.invites || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (inviteId) => {
    setActionId(inviteId);
    setError("");
    try {
      await acceptInvite(inviteId);
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
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to decline invite.");
    } finally {
      setActionId(null);
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
            Track your outgoing requests and respond to community invites.
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
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider">
              Invites Received
            </h2>
            {invites.length === 0 ? (
              <div className="border border-dashed border-[#2A241E] rounded-xl py-10 text-center text-[#8C8070] text-xs sm:text-sm px-4">
                No community invites yet.
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {invites.map((invite) => {
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
                        onClick={() =>
                          community.id && setSelectedCommunityId(community.id)
                        }
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
            {requests.length === 0 ? (
              <div className="border border-dashed border-[#2A241E] rounded-xl py-10 text-center text-[#8C8070] text-xs sm:text-sm px-4">
                You have not submitted any join requests yet.
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {requests.map((req) => {
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
                        onClick={() =>
                          community.id && setSelectedCommunityId(community.id)
                        }
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

      {selectedCommunityId && (
        <CommunityBrowseDetail
          communityId={selectedCommunityId}
          onClose={() => setSelectedCommunityId(null)}
          onJoined={load}
        />
      )}
    </div>
  );
}
