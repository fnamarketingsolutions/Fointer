import { Clock, X } from "lucide-react";

/**
 * Informational modal shown when an author tries to edit/delete
 * after the configured time window has expired.
 */
export default function EditWindowExpiredModal({
  open,
  onClose,
  title = "Time's up",
  message = "You can no longer edit or delete this post.",
  editWindowMinutes,
}) {
  if (!open) return null;

  const windowHint =
    editWindowMinutes != null
      ? ` Edits and deletions are only allowed within ${editWindowMinutes} minutes of posting.`
      : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-[#14100D] border border-[#2A241E] rounded-xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Clock size={16} className="text-[#D4AF37]" />
            </div>
            <h3 className="text-base font-semibold text-[#E5E0D8]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#A69B8D] hover:text-[#E5E0D8] rounded-lg"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[#A69B8D] leading-relaxed">
          {message}
          {windowHint}
        </p>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold hover:bg-[#D4AF37]/25 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
