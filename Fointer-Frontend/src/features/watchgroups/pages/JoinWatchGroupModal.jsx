import { Globe, Lock, Users, X } from "lucide-react";
import WatchGroupJoinAction from "./WatchGroupJoinAction";

export default function JoinWatchGroupModal({
  open,
  onClose,
  groups = [],
  onJoined,
  onRequested,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#120F0D] border border-[#2A241E] rounded-2xl shadow-2xl text-[#E5E0D8] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#120F0D] [&::-webkit-scrollbar-thumb]:bg-[#2A241E] [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-4 border-b border-[#2A241E] bg-[#120F0D]/95 backdrop-blur">
          <div>
            <h3 className="text-lg sm:text-xl font-serif font-semibold text-[#E5E0D8]">
              Join Watch Group
            </h3>
            <p className="text-[11px] text-[#A69B8D] mt-0.5">
              Pick a live commentary room for this community.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8C8070] hover:text-[#E5E0D8] p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-3">
          {groups.length === 0 ? (
            <p className="text-xs text-[#8C8070] text-center py-8">
              No watch groups available.
            </p>
          ) : (
            groups.map((group) => {
              const TypeIcon = group.type === "private" ? Lock : Globe;

              return (
                <div
                  key={group.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#2A241E] bg-[#0E0C0A]"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-[#E5E0D8] truncate">
                      {group.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#8C8070]">
                      <span className="inline-flex items-center gap-1">
                        <TypeIcon size={10} className="text-[#D4AF37]" />
                        {group.type}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users size={10} />
                        {group.participantCount ?? 0}/{group.maxParticipants}
                      </span>
                    </div>
                  </div>

                  <WatchGroupJoinAction
                    group={group}
                    onJoined={onJoined}
                    onRequested={onRequested}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
