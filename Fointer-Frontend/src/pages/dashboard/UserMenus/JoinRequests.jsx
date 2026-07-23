import React from "react";
import { Clock, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";

export default function JoinRequests() {
  const requests = [
    {
      id: 1,
      community: "Sovereign Wealth & Private Family Offices",
      requestedDate: "July 20, 2026",
      status: "Pending Approval",
      type: "Private Network",
      note: "Requires accreditation verification by board admin."
    },
    {
      id: 2,
      community: "Web3 Founders Syndicate",
      requestedDate: "July 15, 2026",
      status: "Accepted",
      type: "Invite-Only",
      note: "Approved by Admin Marcus."
    }
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-serif font-bold text-[#E5E0D8]">My Join Requests</h2>
        <p className="text-xs text-[#8C8070] mt-1">Status tracker for private community access requests.</p>
      </div>

      <div className="space-y-4">
        {requests.map((req) => (
          <div key={req.id} className="bg-[#14100D] border border-[#2A241E] p-5 rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-base text-[#E5E0D8]">{req.community}</h3>
                <span className="text-[10px] text-[#8C8070] font-mono px-2 py-0.5 border border-[#2A241E] rounded">{req.type}</span>
              </div>
              <p className="text-xs text-[#A69B8D]">{req.note}</p>
              <p className="text-[10px] text-[#8C8070] font-mono">Submitted on {req.requestedDate}</p>
            </div>

            <div>
              {req.status === "Pending Approval" ? (
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0">
                  <Clock size={14} /> Pending Approval
                </span>
              ) : (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0">
                  <CheckCircle2 size={14} /> Accepted
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}