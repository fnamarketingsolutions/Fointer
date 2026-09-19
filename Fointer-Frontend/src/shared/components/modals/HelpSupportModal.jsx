import { useEffect, useState } from 'react';
import {
  LuLoaderCircle as Loader2,
  LuX as X
} from 'react-icons/lu';
import { createSupportTicket } from '../../../api/channels';
import { useToast } from '../feedback/ToastContext';
import { getErrorMessage } from '../../utils/errors';

export default function HelpSupportModal({ open, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setDescription('');
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = description.trim();
    if (!text) {
      showToast('Please enter a description.');
      return;
    }

    setSubmitting(true);
    try {
      await createSupportTicket({ description: text });
      showToast('Support request submitted.');
      setDescription('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to submit support request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={submitting ? undefined : onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-[480px] bg-fo-surface border border-fo-border rounded-2xl p-6 space-y-5 shadow-xl text-fo-text">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-fo-text">
              Help & Support
            </h3>
            <p className="text-[13px] text-fo-subtle mt-0.5">
              Request a channel and subchannel for your community.
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="text-fo-subtle hover:text-fo-text p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
          >
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl border border-fo-border bg-fo-surface-2 px-4 py-3 text-sm text-fo-muted leading-relaxed space-y-2">
          <p>
            Use this form to request a <strong className="text-fo-text font-medium">channel</strong> and{' '}
            <strong className="text-fo-text font-medium">subchannel</strong> for your community.
          </p>
          <p>
            If you need another channel or subchannel, describe what you want below. An admin will
            review your request and provide it for you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-fo-subtle mb-1.5">
              Your request
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe the channel and subchannel you need, or any additional ones you want..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-fo-bg border border-fo-border text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50 resize-y"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="inline-flex items-center gap-2 min-h-9 px-5 py-2.5 rounded-full bg-fo-accent text-black text-[13px] font-semibold hover:bg-fo-accent-hover disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
