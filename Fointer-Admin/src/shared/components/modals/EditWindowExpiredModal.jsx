import {
  LuClock as Clock,
  LuX as X
} from "react-icons/lu";

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
      <div className="relative w-full max-w-sm bg-fo-surface border border-fo-border rounded-xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Clock size={16} className="text-fo-accent" />
            </div>
            <h3 className="text-base font-semibold text-fo-text">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-fo-muted hover:text-fo-text rounded-lg"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-fo-muted leading-relaxed">
          {message}
          {windowHint}
        </p>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-fo-accent/15 border border-fo-accent/30 text-fo-accent text-xs font-semibold hover:bg-fo-accent/25 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
