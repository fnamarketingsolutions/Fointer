import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, XCircle, Clock3, LifeBuoy } from 'lucide-react';
import {
  fetchAdminSupportTickets,
  updateAdminSupportTicketStatus,
} from '../../services/adminService';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import { getErrorMessage } from '../../../../shared/utils/errors';
import { formatDate } from '../../../../shared/utils/date';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const STATUS_META = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    icon: Clock3,
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-500/10 border-red-500/30 text-red-400',
    icon: XCircle,
  },
};

const getRequesterName = (ticket) =>
  ticket?.user?.username || ticket?.user?.name || 'Unknown user';

export default function SupportTicketCenter() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSupportTickets();
      setTickets(data?.tickets || []);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load support requests.'));
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
    if (filter === 'all') return tickets;
    return tickets.filter((ticket) => ticket.status === filter);
  }, [filter, tickets]);

  const handleStatusUpdate = async (ticketId, status) => {
    setUpdatingId(ticketId);
    try {
      await updateAdminSupportTicketStatus(ticketId, status);
      showToast(`Request marked as ${status}.`);
      await loadTickets();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update support request.'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">
            Help & Support
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Review channel and subchannel requests from members.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTickets}
          disabled={loading}
          className="p-2 rounded-lg border border-stone-800/60 text-stone-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors disabled:opacity-50 self-start"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-[#141210] border-stone-800/60 text-stone-400 hover:text-stone-200'
              }`}
            >
              {item.label} ({item.id === 'all' ? counts.all : counts[item.id]})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-stone-400 text-sm gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading support requests...
        </div>
      ) : visibleTickets.length === 0 ? (
        <div className="border border-dashed border-stone-800/60 rounded-xl py-16 text-center text-stone-500 text-sm px-4 space-y-2">
          <LifeBuoy className="w-8 h-8 mx-auto text-amber-500/40" />
          <p>No support requests found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleTickets.map((ticket) => {
            const meta = STATUS_META[ticket.status] || STATUS_META.pending;
            const StatusIcon = meta.icon;
            const isUpdating = updatingId === ticket.id;

            return (
              <article
                key={ticket.id}
                className="bg-[#141210] border border-stone-800/60 rounded-xl p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-100 truncate">
                      {getRequesterName(ticket)}
                    </p>
                    {ticket.createdAt ? (
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {formatDate(ticket.createdAt)}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-wide shrink-0 ${meta.className}`}
                  >
                    <StatusIcon size={12} />
                    {meta.label}
                  </span>
                </div>

                <p className="text-sm text-stone-300 whitespace-pre-wrap leading-relaxed flex-1">
                  {ticket.description}
                </p>

                {ticket.status === 'pending' ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleStatusUpdate(ticket.id, 'approved')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/15 disabled:opacity-60"
                    >
                      {isUpdating ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleStatusUpdate(ticket.id, 'rejected')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/15 disabled:opacity-60"
                    >
                      {isUpdating ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <XCircle size={12} />
                      )}
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
