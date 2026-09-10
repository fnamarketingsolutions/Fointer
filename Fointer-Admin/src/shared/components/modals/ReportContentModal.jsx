import React, { useEffect, useState } from "react";
import {
  LuArrowLeft as ArrowLeft,
  LuCircleCheck as CheckCircle2,
  LuFlag as Flag,
  LuLoaderCircle as Loader2,
  LuX as X
} from "react-icons/lu";
import { createReport, fetchReportReasons } from "../../../api/reports";
import { useToast } from "../feedback/ToastContext";

const FALLBACK_REASONS = [
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harassment / bullying" },
  { id: "sexual_content", label: "Sexual / explicit content" },
  { id: "hate_speech", label: "Hate speech" },
  { id: "violence", label: "Violence / threats" },
  { id: "misinformation", label: "Misinformation" },
  { id: "other", label: "Other" },
];

/**
 * Modal for reporting a post or comment.
 * Two-step flow: pick reason → optional details + submit.
 */
export default function ReportContentModal({
  open,
  onClose,
  targetType = "post",
  targetId,
  targetLabel = "this content",
}) {
  const { showToast } = useToast();
  const [reasons, setReasons] = useState(FALLBACK_REASONS);
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setReason("");
    setDetails("");
    setDone(false);
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchReportReasons();
        if (!cancelled && data?.reasons?.length) {
          setReasons(data.reasons);
        }
      } catch {
        // keep fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const selectedReason = reasons.find((r) => r.id === reason);
  const noun =
    targetType === "comment"
      ? "comment"
      : targetType === "listing"
        ? "listing"
        : targetType === "conversation"
          ? "conversation"
          : "post";

  const handleClose = () => {
    if (submitting) return;
    onClose?.();
  };

  const handlePickReason = (id) => {
    setReason(id);
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      showToast("Please select a reason.");
      return;
    }
    if (!targetId) {
      showToast("Nothing to report.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createReport({
        targetType,
        targetId,
        reason,
        details: details.trim(),
      });
      setDone(true);
      showToast(res?.message || "Report submitted. Thank you.");
      setTimeout(() => onClose?.(), 1200);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-[var(--theme-overlay)] backdrop-blur-[2px]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        className="relative w-full sm:max-w-md bg-fo-surface border border-fo-border border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-fo-border shrink-0">
          {step === 2 && !done ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(1)}
              className="p-1.5 -ml-1 rounded-lg text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center shrink-0">
              <Flag size={15} className="text-red-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2
              id="report-dialog-title"
              className="text-sm sm:text-base font-semibold text-fo-text"
            >
              {done ? "Report sent" : `Report ${noun}`}
            </h2>
            {!done ? (
              <p className="text-[11px] text-fo-subtle truncate mt-0.5">
                {step === 1
                  ? `Help keep Fointer safe — ${targetLabel}`
                  : selectedReason?.label || "Add details"}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={handleClose}
            className="p-1.5 rounded-lg text-fo-muted hover:text-fo-text hover:bg-fo-surface-hover"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-4">
          {done ? (
            <div className="flex flex-col items-center text-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <p className="text-sm text-fo-text font-medium">
                Thanks for reporting
              </p>
              <p className="text-xs text-fo-subtle max-w-[260px]">
                Our team will review this {noun}. You can keep browsing.
              </p>
            </div>
          ) : step === 1 ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-fo-subtle mb-3">
                Why are you reporting this?
              </p>
              <ul className="divide-y divide-fo-border rounded-xl border border-fo-border overflow-hidden">
                {reasons.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => handlePickReason(r.id)}
                      className="w-full flex items-center gap-3 px-3.5 py-3 text-left text-sm text-fo-text hover:bg-fo-surface-hover transition-colors"
                    >
                      <span
                        className={`w-4 h-4 rounded-full border shrink-0 ${
                          reason === r.id
                            ? "border-fo-accent bg-fo-accent"
                            : "border-fo-subtle"
                        }`}
                        aria-hidden
                      />
                      <span className="flex-1">{r.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <form id="report-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl border border-fo-border bg-fo-surface-hover px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-wide text-fo-subtle">
                  Reason
                </p>
                <p className="text-sm text-fo-text mt-0.5">
                  {selectedReason?.label}
                </p>
              </div>

              <div>
                <label
                  htmlFor="report-details"
                  className="block text-[11px] uppercase tracking-wide text-fo-subtle mb-1.5"
                >
                  Additional details{" "}
                  <span className="normal-case tracking-normal text-fo-subtle">
                    (optional)
                  </span>
                </label>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  autoFocus
                  placeholder="Anything else we should know?"
                  className="w-full bg-fo-surface-hover border border-fo-border rounded-xl px-3.5 py-2.5 text-sm text-fo-text focus:outline-none focus:border-fo-accent/50 placeholder:text-fo-subtle resize-none"
                />
                <p className="text-[10px] text-fo-subtle text-right mt-1">
                  {details.length}/1000
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer — step 2 only */}
        {!done && step === 2 ? (
          <div className="shrink-0 px-4 sm:px-5 pb-4 sm:pb-5 pt-2 border-t border-fo-border flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(1)}
              className="flex-1 py-2.5 rounded-xl border border-fo-border text-sm text-fo-muted hover:text-fo-text hover:border-fo-accent/30"
            >
              Change reason
            </button>
            <button
              type="submit"
              form="report-form"
              disabled={submitting || !reason}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-semibold hover:bg-red-500/30 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Flag size={14} />
              )}
              Submit
            </button>
          </div>
        ) : null}

        {/* Mobile safe-area spacer when no footer */}
        {(done || step === 1) && (
          <div className="h-3 sm:h-4 shrink-0" />
        )}
      </div>
    </div>
  );
}
