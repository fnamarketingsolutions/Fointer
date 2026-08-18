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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-[480px] bg-[#120F0D] border border-[#2A241E] rounded-2xl p-6 space-y-5 shadow-2xl text-[#E5E0D8]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-serif font-semibold text-[#E5E0D8]">
              Help & Support
            </h3>
            <p className="text-[11px] text-[#A69B8D] mt-0.5">
              Request a channel and subchannel for your community.
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="text-[#8C8070] hover:text-[#E5E0D8] p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl border border-[#2A241E] bg-[#0E0C0A] px-4 py-3 text-xs sm:text-sm text-[#A69B8D] leading-relaxed space-y-2">
          <p>
            Use this form to request a <strong className="text-[#E5E0D8] font-medium">channel</strong> and{' '}
            <strong className="text-[#E5E0D8] font-medium">subchannel</strong> for your community.
          </p>
          <p>
            If you need another channel or subchannel, describe what you want below. An admin will
            review your request and provide it for you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#8C8070] mb-1.5">
              Your request
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe the channel and subchannel you need, or any additional ones you want..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-sm text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none focus:border-[#D4AF37]/80 resize-y"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black text-xs sm:text-sm font-bold disabled:opacity-60"
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
