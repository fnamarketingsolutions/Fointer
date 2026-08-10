import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, LifeBuoy, Loader2, RefreshCw, XCircle } from "lucide-react";
import { fetchMySupportTickets } from "../../../../api/channels";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";

const STATUS_META = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "text-[#D4AF37]",
    dot: "bg-[#D4AF37]",
  },
  approved: {
    label: "Created",
    icon: CheckCircle2,
    className: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "text-red-400",
    dot: "bg-red-400",
  },
  open: {
    label: "Pending",
    icon: Clock,
    className: "text-[#D4AF37]",
    dot: "bg-[#D4AF37]",
  },
  in_review: {
    label: "Pending",
    icon: Clock,
    className: "text-[#D4AF37]",
    dot: "bg-[#D4AF37]",
  },
  resolved: {
    label: "Created",
    icon: CheckCircle2,
    className: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  closed: {
    label: "Rejected",
    icon: XCircle,
    className: "text-red-400",
    dot: "bg-red-400",
  },
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Created" },
  { id: "rejected", label: "Rejected" },
];

const normalizeStatus = (status) => {
  const value = String(status || "pending").toLowerCase();
  if (value === "open" || value === "in_review") return "pending";
  if (value === "resolved") return "approved";
  if (value === "closed") return "rejected";
  if (["pending", "approved", "rejected"].includes(value)) return value;
  return "pending";
};

export default function Support() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMySupportTickets();
      setTickets(data?.tickets || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load support tickets."));
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
    tickets.forEach((t) => {
      const key = normalizeStatus(t.status);
      if (base[key] !== undefined) base[key] += 1;
    });
    return base;
  }, [tickets]);

  const visible = useMemo(() => {
    if (filter === "all") return tickets;
    return tickets.filter((t) => normalizeStatus(t.status) === filter);
  }, [tickets, filter]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8]">
            Support
          </h1>
          <p className="text-sm text-[#8C8070]">
            Track your channel and subchannel requests.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTickets}
          disabled={loading}
          className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Filters */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
        {FILTERS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                  : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
              }`}
            >
              {tab.label}
              {!loading ? (
                <span className="ml-1.5 text-[10px] opacity-70">
                  {counts[tab.id] ?? 0}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
          <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
          Loading support requests…
        </div>
      ) : tickets.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center px-4 space-y-2">
          <LifeBuoy className="w-8 h-8 mx-auto text-[#D4AF37]/50" />
          <p className="text-sm text-[#8C8070]">
            You haven’t submitted any support requests yet.
          </p>
          <p className="text-xs text-[#5C5348]">
            Use Help on Manage Communities to send a message.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
          No {FILTERS.find((f) => f.id === filter)?.label.toLowerCase()}{" "}
          requests.
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((ticket) => {
            const statusKey = normalizeStatus(ticket.status);
            const meta = STATUS_META[statusKey] || STATUS_META.pending;
            const StatusIcon = meta.icon;

            return (
              <article
                key={ticket.id}
                className="bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-2.5"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.className}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}
                      aria-hidden
                    />
                    <StatusIcon size={13} />
                    {meta.label}
                  </div>
                  {ticket.createdAt ? (
                    <span className="text-[11px] text-[#8C8070]">
                      {timeAgo(ticket.createdAt)}
                    </span>
                  ) : null}
                </div>

                <p className="text-sm text-[#E5E0D8] whitespace-pre-wrap break-words leading-relaxed">
                  {ticket.description}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
