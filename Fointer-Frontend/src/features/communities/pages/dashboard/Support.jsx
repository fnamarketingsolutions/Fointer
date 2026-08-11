import { useCallback, useEffect, useState } from 'react';
import { Loader2, LifeBuoy, RefreshCw } from 'lucide-react';
import { fetchMySupportTickets } from '../../../../api/channels';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import { getErrorMessage } from '../../../../shared/utils/errors';
import { formatDate } from '../../../../shared/utils/date';

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Created',
  rejected: 'Rejected',
  open: 'Pending',
  in_review: 'Pending',
  resolved: 'Created',
  closed: 'Rejected',
};

const STATUS_STYLES = {
  pending: 'bg-[#D4AF37]/10 border-[#D4AF37]/20 text-[#D4AF37]',
  approved: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/10 border-red-500/20 text-red-400',
  open: 'bg-[#D4AF37]/10 border-[#D4AF37]/20 text-[#D4AF37]',
  in_review: 'bg-[#D4AF37]/10 border-[#D4AF37]/20 text-[#D4AF37]',
  resolved: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  closed: 'bg-red-500/10 border-red-500/20 text-red-400',
};

export default function Support() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMySupportTickets();
      setTickets(data?.tickets || []);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load support tickets.'));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold text-[#E5E0D8]">
            Support
          </h1>
          <p className="text-xs sm:text-sm text-[#A69B8D] mt-1">
            Track your channel and subchannel requests here.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTickets}
          disabled={loading}
          className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 self-start"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#A69B8D] text-sm gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading support requests...
        </div>
      ) : tickets.length === 0 ? (
        <div className="border border-dashed border-[#2A241E] rounded-xl py-12 sm:py-16 text-center text-[#A69B8D] text-xs sm:text-sm px-4 space-y-2">
          <LifeBuoy className="w-8 h-8 mx-auto text-[#D4AF37]/50" />
          <p>You have not submitted any support requests yet.</p>
          <p className="text-[#8C8070]">
            Use Help on Manage Communities to send a message.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tickets.map((ticket) => {
            const statusKey = ticket.status || 'pending';
            const statusLabel = STATUS_LABELS[statusKey] || statusKey;
            const statusStyle =
              STATUS_STYLES[statusKey] ||
              'bg-[#D4AF37]/10 border-[#D4AF37]/20 text-[#D4AF37]';

            return (
              <div
                key={ticket.id}
                className="bg-[#0D0A08] border border-[#221C17] rounded-xl p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-wide ${statusStyle}`}
                  >
                    {statusLabel}
                  </span>
                  {ticket.createdAt ? (
                    <span className="text-[11px] text-[#8C8070]">
                      {formatDate(ticket.createdAt)}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-[#E5E0D8] whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
