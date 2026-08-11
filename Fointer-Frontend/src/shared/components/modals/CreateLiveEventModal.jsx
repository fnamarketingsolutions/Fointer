import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  X,
  Globe,
  Lock,
  ChevronDown,
  Check,
  Radio,
} from "lucide-react";
import {
  createLiveEvent,
  fetchLiveEventCreateContext,
} from '../../../features/liveevents/services/liveEventService';
import { useToast } from '../feedback/ToastContext';
import { getErrorMessage } from '../../utils/errors';

const emptyForm = {
  title: "",
  category: "custom",
  access: "community_restricted",
  communityId: "",
};

const CATEGORY_OPTIONS = [
  { value: "sports", label: "Sports" },
  { value: "entertainment", label: "Entertainment" },
  { value: "news", label: "News" },
  { value: "custom", label: "Custom" },
];

const ACCESS_OPTIONS = [
  {
    value: "public",
    label: "Public",
    description: "Any logged-in user can join.",
    icon: Globe,
  },
  {
    value: "community_restricted",
    label: "Community-Restricted",
    description: "Only members of the selected community can join.",
    icon: Lock,
  },
];

export default function CreateLiveEventModal({ open, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [communities, setCommunities] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [communityDropdownOpen, setCommunityDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const communityRef = useRef(null);
  const categoryRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        communityRef.current &&
        !communityRef.current.contains(event.target)
      ) {
        setCommunityDropdownOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const load = async () => {
      setLoadingContext(true);
      try {
        const data = await fetchLiveEventCreateContext();
        if (cancelled) return;
        setCommunities(data?.communities || []);
        setForm({
          ...emptyForm,
          category: data?.defaults?.category || "custom",
          access: data?.defaults?.access || "community_restricted",
        });
      } catch (err) {
        if (!cancelled) {
          showToast(
            getErrorMessage(err, "Failed to load live event options.")
          );
        }
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, showToast]);

  if (!open) return null;

  const handleInputChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectedCommunity = communities.find((c) => c.id === form.communityId);
  const selectedCategory = CATEGORY_OPTIONS.find(
    (c) => c.value === form.category
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast("Event title is required.");
      return;
    }
    if (!form.communityId) {
      showToast("Please select a community.");
      return;
    }

    setSaving(true);
    try {
      await createLiveEvent({
        title: form.title.trim(),
        category: form.category,
        access: form.access,
        communityId: form.communityId,
      });
      showToast("Live event started.");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to start live event."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#120F0D] border border-[#2A241E] rounded-2xl shadow-2xl text-[#E5E0D8] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#120F0D] [&::-webkit-scrollbar-thumb]:bg-[#2A241E] [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-4 border-b border-[#2A241E] bg-[#120F0D]/95 backdrop-blur">
          <div>
            <h3 className="text-lg sm:text-xl font-serif font-semibold text-[#E5E0D8] flex items-center gap-2">
              <Radio size={18} className="text-[#D4AF37]" />
              Start Live Commentary
            </h3>
            <p className="text-[11px] text-[#A69B8D] mt-0.5">
              Owners and moderators can start a live event in a community.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-[#8C8070] hover:text-[#E5E0D8] p-1"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {loadingContext ? (
            <div className="flex items-center justify-center py-10 text-[#A69B8D] text-xs gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
                  Event Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="e.g. Championship Final Live"
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none focus:border-[#D4AF37]/80"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] mb-2">
                  Community
                </label>
                <div className="relative" ref={communityRef}>
                  <button
                    type="button"
                    onClick={() =>
                      setCommunityDropdownOpen((openState) => !openState)
                    }
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-left hover:border-[#D4AF37]/50"
                  >
                    <span
                      className={
                        selectedCommunity ? "text-[#E5E0D8]" : "text-[#8C8070]"
                      }
                    >
                      {selectedCommunity?.name || "Select a community"}
                    </span>
                    <ChevronDown size={14} className="text-[#8C8070]" />
                  </button>
                  {communityDropdownOpen && (
                    <div className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[#2A241E] bg-[#14100D] shadow-xl">
                      {communities.length === 0 ? (
                        <p className="px-3 py-3 text-[11px] text-[#8C8070]">
                          No communities you own or moderate.
                        </p>
                      ) : (
                        communities.map((community) => (
                          <button
                            key={community.id}
                            type="button"
                            onClick={() => {
                              handleInputChange("communityId", community.id);
                              setCommunityDropdownOpen(false);
                            }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-[#1A140F]"
                          >
                            <span className="text-[#E5E0D8]">
                              {community.name}
                            </span>
                            {form.communityId === community.id && (
                              <Check size={14} className="text-[#D4AF37]" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] mb-2">
                  Category
                </label>
                <div className="relative" ref={categoryRef}>
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryDropdownOpen((openState) => !openState)
                    }
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-left hover:border-[#D4AF37]/50"
                  >
                    <span className="text-[#E5E0D8]">
                      {selectedCategory?.label || "Custom"}
                    </span>
                    <ChevronDown size={14} className="text-[#8C8070]" />
                  </button>
                  {categoryDropdownOpen && (
                    <div className="absolute z-30 mt-1 w-full rounded-lg border border-[#2A241E] bg-[#14100D] shadow-xl">
                      {CATEGORY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            handleInputChange("category", option.value);
                            setCategoryDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-[#1A140F]"
                        >
                          <span className="text-[#E5E0D8]">{option.label}</span>
                          {form.category === option.value && (
                            <Check size={14} className="text-[#D4AF37]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
                  Access
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ACCESS_OPTIONS.map(
                    ({ value, label, description, icon: Icon }) => {
                      const selected = form.access === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleInputChange("access", value)}
                          className={`text-left p-3 rounded-xl border transition-all ${
                            selected
                              ? "border-[#D4AF37] bg-[#D4AF37]/10"
                              : "border-[#2A241E] hover:border-[#D4AF37]/40"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon
                              size={14}
                              className={
                                selected ? "text-[#D4AF37]" : "text-[#8C8070]"
                              }
                            />
                            <span className="text-xs font-semibold text-[#E5E0D8]">
                              {label}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#8C8070] leading-relaxed">
                            {description}
                          </p>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2A241E]">
                <button
                  type="button"
                  disabled={saving}
                  onClick={onClose}
                  className="text-xs text-[#A69B8D] hover:text-[#E5E0D8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !communities.length}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black text-xs font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Radio size={14} />
                  )}
                  Start
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
