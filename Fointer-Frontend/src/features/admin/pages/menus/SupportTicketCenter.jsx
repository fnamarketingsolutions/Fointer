import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuCircleCheck as CheckCircle2,
  LuClock3 as Clock3,
  LuLifeBuoy as LifeBuoy,
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuCircleX as XCircle
} from "react-icons/lu";
import {
  fetchAdminChannels,
  fetchAdminSupportTickets,
  updateAdminSupportTicketStatus,
} from "../../../../api/dashboard";
import ApproveChannelRequestModal from "../../../../shared/components/modals/ApproveChannelRequestModal";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const STATUS_META = {
  pending: {
    label: "Pending",
    className: "text-fo-accent",
    icon: Clock3,
  },
  approved: {
    label: "Approved",
    className: "text-emerald-400",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "text-red-400",
    icon: XCircle,
  },
};

const getRequesterName = (ticket) =>
  ticket?.user?.username || ticket?.user?.name || "Unknown user";

function ActionBtn({ onClick, disabled, tone = "ghost", children }) {
  const tones = {
    ghost:
      "border border-fo-border text-fo-muted hover:text-fo-text hover:border-fo-accent/30",
    success:
      "border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
    danger:
      "border border-red-500/30 text-red-400 hover:bg-red-500/10",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export default function SupportTicketCenter() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [approvingTicket, setApprovingTicket] = useState(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketData, channelData] = await Promise.all([
        fetchAdminSupportTickets(),
        fetchAdminChannels(),
      ]);
      setTickets(ticketData?.tickets || []);
      setChannels(channelData?.channels || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load support requests."));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const counts = useMemo(() => {
    const base = { all: tickets.length, pending: 0, approved: 0, rejected: 0 };
    tickets.forEach((ticket) => {
      if (base[ticket.status] !== undefined) {
        base[ticket.status] += 1;
      }
    });
    return base;
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (filter !== "all" && ticket.status !== filter) return false;
      if (!q) return true;
      const name = getRequesterName(ticket).toLowerCase();
      const email = String(ticket?.user?.email || "").toLowerCase();
      const description = String(ticket?.description || "").toLowerCase();
      return (
        name.includes(q) || email.includes(q) || description.includes(q)
      );
    });
  }, [filter, tickets, search]);

  const handleStatusUpdate = async (ticketId, payload) => {
    setUpdatingId(ticketId);
    try {
      await updateAdminSupportTicketStatus(ticketId, payload);
      const status = payload?.status || payload;
      showToast(
        status === "approved"
          ? "Channel created and request approved."
          : `Request marked as ${status}.`
      );
      setApprovingTicket(null);
      await loadTickets();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update support request."));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApproveSubmit = async ({ channelId, channelName, subchannelName }) => {
    if (!approvingTicket) return;
    await handleStatusUpdate(approvingTicket.id, {
      status: "approved",
      channelId,
      channelName,
      subchannelName,
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
            Support
          </h1>
          <p className="text-sm text-fo-subtle">
            Create the requested channel and subchannel, then approve. Reject if it should not be added.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTickets}
          disabled={loading}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
        {STATUS_FILTERS.map((item) => {
          const active = filter === item.id;
          const count = item.id === "all" ? counts.all : counts[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                  : "text-fo-subtle hover:text-fo-text border border-transparent"
              }`}
            >
              {item.label}
              <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by user or request text…"
          className="w-full bg-fo-surface border border-fo-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
          <Loader2 size={16} className="animate-spin text-fo-accent" />
          Loading support requests…
        </div>
      ) : tickets.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4 space-y-2">
          <LifeBuoy className="w-8 h-8 mx-auto text-fo-accent/40" />
          <p>No support requests yet.</p>
        </div>
      ) : visibleTickets.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
          No requests match this filter.
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleTickets.map((ticket) => {
            const meta = STATUS_META[ticket.status] || STATUS_META.pending;
            const StatusIcon = meta.icon;
            const isUpdating = updatingId === ticket.id;
            const requester = getRequesterName(ticket);

            return (
              <article
                key={ticket.id}
                className="bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-[11px] text-fo-subtle flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${meta.className}`}
                      >
                        <StatusIcon size={12} />
                        {meta.label}
                      </span>
                      <span>·</span>
                      <span className="text-fo-muted">
                        {requester.replace(/^@+/, "")}
                      </span>
                      {ticket.createdAt ? (
                        <>
                          <span>·</span>
                          <span>{timeAgo(ticket.createdAt)}</span>
                        </>
                      ) : null}
                    </div>
                    {ticket.user?.email ? (
                      <p className="text-[11px] text-fo-subtle truncate">
                        {ticket.user.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                <p className="text-sm text-fo-text whitespace-pre-wrap break-words leading-relaxed">
                  {ticket.description}
                </p>

                {ticket.fulfilled?.channel ? (
                  <p className="text-[11px] text-fo-muted">
                    Created:{" "}
                    <span className="text-fo-accent">
                      {ticket.fulfilled.channel}
                      {ticket.fulfilled.subchannel
                        ? ` / ${ticket.fulfilled.subchannel}`
                        : ""}
                    </span>
                  </p>
                ) : null}

                {ticket.status === "pending" ? (
                  <div className="flex flex-wrap gap-1.5">
                    <ActionBtn
                      tone="success"
                      disabled={isUpdating}
                      onClick={() => setApprovingTicket(ticket)}
                    >
                      <CheckCircle2 size={12} />
                      Approve
                    </ActionBtn>
                    <ActionBtn
                      tone="danger"
                      disabled={isUpdating}
                      onClick={() =>
                        handleStatusUpdate(ticket.id, { status: "rejected" })
                      }
                    >
                      {isUpdating ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <XCircle size={12} />
                      )}
                      Reject
                    </ActionBtn>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <ApproveChannelRequestModal
        open={Boolean(approvingTicket)}
        ticket={approvingTicket}
        channels={channels}
        loading={updatingId === approvingTicket?.id}
        onClose={() => {
          if (updatingId) return;
          setApprovingTicket(null);
        }}
        onSubmit={handleApproveSubmit}
      />
    </div>
  );
}
