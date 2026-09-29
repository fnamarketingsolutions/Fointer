import { useEffect, useMemo, useState } from "react";
import {
  LuLoaderCircle as Loader2,
  LuX as X,
  LuArrowRightLeft as Transfer,
} from "react-icons/lu";
import ProfileAvatar from "../ProfileAvatar";

/**
 * Generic ownership transfer picker.
 * items: [{ id, userId, name, username, avatar, role }]
 */
export default function TransferOwnershipModal({
  open,
  title = "Transfer ownership",
  subtitle = "Choose an active member to become the new owner. You will become a member.",
  items = [],
  loading = false,
  saving = false,
  onClose,
  onConfirm,
}) {
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!open) setSelectedId("");
  }, [open]);

  const candidates = useMemo(
    () => items.filter((item) => item.role !== "owner"),
    [items]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-ownership-title"
      onClick={() => {
        if (!saving) onClose?.();
      }}
    >
      <div
        className="w-full max-w-md bg-fo-surface border border-fo-border rounded-xl shadow-xl max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-4 sm:p-5 border-b border-fo-border">
          <div className="min-w-0 flex-1 space-y-1">
            <h3
              id="transfer-ownership-title"
              className="text-base font-semibold text-fo-text flex items-center gap-2"
            >
              <Transfer size={16} className="text-fo-accent shrink-0" />
              {title}
            </h3>
            <p className="text-xs text-fo-subtle leading-relaxed">{subtitle}</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-lg text-fo-muted hover:text-fo-text disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-fo-subtle">
              <Loader2 size={16} className="animate-spin" />
              Loading members…
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-fo-subtle py-8 text-center leading-relaxed">
              No other active members to transfer to. Invite someone first, or
              delete this instead.
            </p>
          ) : (
            candidates.map((item) => {
              const userId = String(item.userId || item.id);
              const selected = selectedId === userId;
              const label = item.name || item.username || "Member";
              return (
                <label
                  key={userId}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selected
                      ? "border-fo-accent/50 bg-fo-accent/10"
                      : "border-fo-border hover:border-fo-accent/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="transfer-owner"
                    className="sr-only"
                    checked={selected}
                    onChange={() => setSelectedId(userId)}
                  />
                  <ProfileAvatar
                    src={item.avatar}
                    name={label}
                    className="w-10 h-10 rounded-full object-cover border border-fo-border shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fo-text truncate">
                      {label}
                    </span>
                    {item.username ? (
                      <span className="block text-xs text-fo-subtle truncate">
                        @{String(item.username).replace(/^@+/, "")}
                        {item.role ? ` · ${item.role}` : ""}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-end p-4 sm:p-5 border-t border-fo-border">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="min-h-10 px-4 rounded-lg border border-fo-border text-sm text-fo-muted hover:text-fo-text disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !selectedId || candidates.length === 0}
            onClick={() => onConfirm?.(selectedId)}
            className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-fo-accent/40 bg-fo-accent/15 text-fo-accent text-sm font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
