import React from "react";
import {
  LuX as X,
  LuLoader as Loader2
} from "react-icons/lu";
import MediaPicker from "../../../shared/components/media/MediaPicker";

export default function PostEditModal({
  open,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
  showToast,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={onSubmit}
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#14100D] border border-[#2A241E] rounded-t-xl sm:rounded-xl p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#2A241E]">
          <h2 className="text-lg font-semibold text-[#E5E0D8]">
            Edit Post
          </h2>
          <button type="button" onClick={onClose}>
            <X size={18} className="text-[#A69B8D] hover:text-[#E5E0D8]" />
          </button>
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] uppercase tracking-wider text-[#8C8070]">
            Title
          </label>
          <input
            value={form.title}
            onChange={(e) =>
              setForm((p) => ({ ...p, title: e.target.value }))
            }
            required
            className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] uppercase tracking-wider text-[#8C8070]">
            Description
          </label>
          <textarea
            value={form.text}
            onChange={(e) =>
              setForm((p) => ({ ...p, text: e.target.value }))
            }
            rows={4}
            className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 resize-y"
          />
        </div>
        <div>
          <MediaPicker
            media={form.media}
            onChange={(media) => setForm((p) => ({ ...p, media }))}
            onError={showToast}
            label="Media"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-[#0E0C0A] text-xs font-bold disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Changes
        </button>
      </form>
    </div>
  );
}
