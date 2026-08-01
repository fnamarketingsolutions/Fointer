import { Loader2, X } from 'lucide-react';

/**
 * Reusable destructive-action confirmation modal.
 * Supports admin, dashboard, and post variants to preserve existing UI behavior.
 */
export default function ConfirmDeleteModal({
  open,
  title,
  children,
  error,
  onConfirm,
  onClose,
  loading = false,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'admin',
  closeOnBackdrop = true,
  disableCloseWhileLoading = true,
  showCloseButton = true,
  confirmDisabled = false,
}) {
  if (!open) return null;

  const canClose = !disableCloseWhileLoading || !loading;

  const handleBackdropClick = () => {
    if (closeOnBackdrop && canClose) onClose();
  };

  if (variant === 'admin') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="relative w-full max-w-[420px] bg-[#120D0B] border border-stone-800/60 rounded-2xl p-6 space-y-5 shadow-2xl text-stone-300">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-medium text-[#F87171]">{title}</h3>
            {showCloseButton && (
              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="text-stone-400 hover:text-stone-200 transition-colors p-1"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="text-sm text-stone-400 leading-relaxed">{children}</div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={loading || confirmDisabled}
              onClick={onConfirm}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#451819] border border-[#7f1d1d]/40 text-[#F87171] hover:bg-[#581c1e] text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {confirmLabel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-stone-800 bg-[#161210] text-stone-300 hover:bg-stone-800/50 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={handleBackdropClick}
        />
        <div className="relative w-full max-w-sm bg-[#120F0D] border border-[#2A241E] rounded-xl p-4 sm:p-5 shadow-2xl z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-red-400">{title}</h2>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-[#A69B8D] hover:text-[#E5E0D8] rounded-lg"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {error && (
            <div className="mb-3 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="text-xs sm:text-sm text-[#A69B8D] mb-4">{children}</div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading || confirmDisabled}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs sm:text-sm font-semibold hover:bg-red-500/30 disabled:opacity-60 transition-colors"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#2A241E] text-xs sm:text-sm text-[#A69B8D] hover:text-[#E5E0D8]"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // post variant (PostDetail, ActivityHistory)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />
      <div className="relative w-full max-w-sm bg-[#14100D] border border-[#2A241E] rounded-xl p-6 space-y-4 shadow-2xl">
        <h3 className="text-base font-semibold text-[#E5E0D8]">{title}</h3>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="text-xs text-[#A69B8D] leading-relaxed">{children}</div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#E5E0D8]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
