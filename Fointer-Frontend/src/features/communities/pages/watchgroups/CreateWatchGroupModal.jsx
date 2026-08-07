import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  X,
  Globe,
  Lock,
  ChevronDown,
  Check,
  Users,
} from "lucide-react";
import {
  createWatchGroup,
  fetchWatchGroupCreateContext,
} from "../../services/communityService";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";

const emptyForm = {
  name: "",
  type: "public",
  maxParticipants: 50,
  communityId: "",
};

const TYPE_OPTIONS = [
  {
    value: "public",
    label: "Public",
    description: "Any community member can join freely.",
    icon: Globe,
  },
  {
    value: "private",
    label: "Private",
    description: "Invite-only access within the community.",
    icon: Lock,
  },
];

export default function CreateWatchGroupModal({ open, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [communities, setCommunities] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [communityDropdownOpen, setCommunityDropdownOpen] = useState(false);
  const communityRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        communityRef.current &&
        !communityRef.current.contains(event.target)
      ) {
        setCommunityDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingContext(true);
      try {
        const data = await fetchWatchGroupCreateContext();
        if (cancelled) return;
        const list = data?.communities || [];
        setCommunities(list);
        setForm({
          ...emptyForm,
          maxParticipants: data?.defaults?.maxParticipants ?? 50,
          type: data?.defaults?.type ?? "public",
          communityId: list.length === 1 ? list[0].id : "",
        });
        setCommunityDropdownOpen(false);
      } catch (err) {
        if (!cancelled) {
          showToast(
            getErrorMessage(err, "Failed to load create options.")
          );
        }
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, showToast]);

  if (!open) return null;

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectedCommunity = communities.find((c) => c.id === form.communityId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.communityId) {
      showToast("Please select a community.");
      return;
    }
    if (!form.name.trim()) {
      showToast("Group name is required.");
      return;
    }

    const max = Number(form.maxParticipants);
    if (!Number.isFinite(max) || !Number.isInteger(max) || max < 2) {
      showToast("Max participants must be at least 2.");
      return;
    }

    setSaving(true);
    try {
      await createWatchGroup({
        name: form.name.trim(),
        type: form.type,
        maxParticipants: max,
        communityId: form.communityId,
      });
      showToast("Watch group created.");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create watch group."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#120F0D] border border-[#2A241E] rounded-2xl shadow-2xl text-[#E5E0D8] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#120F0D] [&::-webkit-scrollbar-thumb]:bg-[#2A241E] [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-4 border-b border-[#2A241E] bg-[#120F0D]/95 backdrop-blur">
          <div>
            <h3 className="text-lg sm:text-xl font-serif font-semibold text-[#E5E0D8]">
              Create Watch Group
            </h3>
            <p className="text-[11px] text-[#A69B8D] mt-0.5">
              Start a live commentary room for your community.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="text-[#8C8070] hover:text-[#E5E0D8] p-1"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          <div className="relative" ref={communityRef}>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] mb-2">
              Community
            </label>
            {loadingContext ? (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs text-[#8C8070]">
                <Loader2 size={14} className="animate-spin" />
                Loading communities...
              </div>
            ) : communities.length === 0 ? (
              <div className="px-3.5 py-2.5 rounded-lg bg-[#0E0C0A]/60 border border-[#2A241E] text-xs text-[#8C8070]">
                Join a community first to create a watch group.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCommunityDropdownOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/80"
                >
                  <span className="truncate">
                    {selectedCommunity
                      ? selectedCommunity.name
                      : "Select a community"}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-[#8C8070] transition-transform ${
                      communityDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {communityDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-48 overflow-y-auto bg-[#0E0C0A] border border-[#2A241E] rounded-lg shadow-xl py-1">
                    {communities.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          handleInputChange("communityId", c.id);
                          setCommunityDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm transition-colors flex items-center justify-between ${
                          form.communityId === c.id
                            ? "bg-[#D4AF37]/15 text-[#D4AF37] font-semibold"
                            : "text-[#E5E0D8] hover:bg-[#1a1510]"
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        {form.communityId === c.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="e.g. Q3 Earnings Watch Party"
              maxLength={100}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none focus:border-[#D4AF37]/80"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
              Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TYPE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                const selected = form.type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleInputChange("type", value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selected
                        ? "bg-[#251E17] border-[#D4AF37] text-white"
                        : "bg-[#0E0C0A] border-[#2A241E] text-[#8C8070] hover:border-[#3D332A]"
                    }`}
                  >
                    <Icon
                      size={16}
                      className={`mb-1.5 ${selected ? "text-[#D4AF37]" : ""}`}
                    />
                    <div className="text-xs font-bold text-[#E5E0D8]">
                      {label}
                    </div>
                    <div className="text-[10px] text-[#A69B8D] mt-0.5 leading-tight">
                      {description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
              Max Participants
            </label>
            <div className="relative">
              <Users
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8070]"
              />
              <input
                type="number"
                min={2}
                max={500}
                value={form.maxParticipants}
                onChange={(e) =>
                  handleInputChange("maxParticipants", e.target.value)
                }
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/80"
              />
            </div>
            <p className="text-[10px] text-[#8C8070] mt-1.5">
              Default is 50. Range: 2–500.
            </p>
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
              disabled={saving || loadingContext || communities.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black text-xs sm:text-sm font-bold disabled:opacity-60"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
