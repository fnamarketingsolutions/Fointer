// src/components/admin/SupportTicketCenter.jsx
import React from 'react';
import { LifeBuoy, Clock } from 'lucide-react';

const mockTickets = [
  { id: 'TK-102', subject: 'Dispute over community ownership transfer', requester: 'user_john', status: 'Open' },
  { id: 'TK-101', subject: 'Reported inappropriate post deletion by mod', requester: 'user_clara', status: 'In Review' },
];

export default function SupportTicketCenter() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">Support & Dispute Center</h1>
        <p className="text-xs text-stone-400 mt-1">Resolve dispute escalation tickets between members and administrators.</p>
      </div>

      <div className="space-y-4">
        {mockTickets.map((ticket) => (
          <div key={ticket.id} className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{ticket.id}</span>
                <h3 className="font-serif font-semibold text-amber-100 text-sm">{ticket.subject}</h3>
              </div>
              <p className="text-[11px] text-stone-500">Submitted by {ticket.requester}</p>
            </div>

            <button className="px-4 py-2 bg-[#0c0a09] hover:bg-[#1a1714] text-xs font-semibold text-amber-400 border border-amber-500/30 rounded-lg transition-colors">
              Inspect Ticket
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}