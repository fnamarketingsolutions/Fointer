import React, { useState, useRef } from "react";
import {
  Loader2,
  Upload,
  Globe,
  Lock,
  ShieldCheck,
  Lightbulb,
  Eye,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { createCommunity } from "../../../api/communities";

const emptyForm = {
  name: "",
  description: "",
  rules: "",
  tags: [],
  coverImage: "",
  type: "private_request",
};

const TYPE_OPTIONS = [
  {
    value: "public",
    label: "Public",
    description: "Visible to all members. Open enrollment.",
    icon: Globe,
  },
  {
    value: "private_invite",
    label: "Private-Invite",
    description: "Hidden from search. Only visible to invited guests.",
    icon: ShieldCheck,
  },
  {
    value: "private_request",
    label: "Private-Request",
    description: "Discoverable but requires application for entry.",
    icon: Lock,
  },
];

const typeLabel = (type) => {
  if (type === "private_invite") return "Private-Invite";
  if (type === "private_request") return "Private-Request";
  return "Public";
};

export default function CreateCommunity({ onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  // Ref for local file input trigger
  const fileInputRef = useRef(null);

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Converts local file to Data URL for instant preview and submit
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size should be under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange("coverImage", reader.result);
        setError("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDiscard = () => {
    setForm(emptyForm);
    setTagInput("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addTag = (raw) => {
    const value = raw.trim().toLowerCase();
    if (!value) return;
    setForm((prev) => {
      if (prev.tags.includes(value) || prev.tags.length >= 12) return prev;
      return { ...prev, tags: [...prev.tags, value] };
    });
    setTagInput("");
  };

  const removeTag = (tag) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput.replace(/,/g, ""));
    } else if (e.key === "Backspace" && !tagInput && form.tags.length) {
      removeTag(form.tags[form.tags.length - 1]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Community name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const pendingTag = tagInput.trim();
      const tags = pendingTag
        ? [...new Set([...form.tags, pendingTag.toLowerCase()])]
        : form.tags;

      await createCommunity({
        name: form.name.trim(),
        description: form.description.trim(),
        rules: form.rules.trim(),
        tags,
        coverImage: form.coverImage,
        type: form.type,
      });

      setForm(emptyForm);
      setTagInput("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (onCreated) onCreated();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create community.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-[#E5E0D8]">
      <div>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-wide">
          Establish Your <span className="text-[#D4AF37]">Legacy</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#A69B8D] mt-1 font-light">
          Define the parameters of your exclusive circle within the Fointer.
        </p>
      </div>

      {error && (
        <div className="text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-8 bg-[#14100D] border border-[#2A241E] rounded-2xl p-5 sm:p-7 space-y-7 shadow-2xl"
        >
          {/* Cover Image Section with Local Storage Upload */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
              Cover Image
            </label>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Interactive Image Container / Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-full h-44 sm:h-52 rounded-xl bg-[#0E0C0A] border border-dashed border-[#2A241E] hover:border-[#D4AF37]/50 overflow-hidden flex items-center justify-center cursor-pointer transition-all group"
            >
              {form.coverImage ? (
                <>
                  <img
                    src={form.coverImage}
                    alt="Community cover"
                    className="w-full h-full object-cover"
                  />
                  {/* Remove / Replace Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                    <span className="text-xs text-white bg-black/60 px-3 py-1.5 rounded-md border border-white/20 flex items-center gap-1.5">
                      <Upload size={14} /> Change Image
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInputChange("coverImage", "");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-xs text-red-400 bg-black/60 p-1.5 rounded-md border border-red-500/30 hover:bg-red-500/20"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#8C8070] p-4 text-center">
                  <div className="p-3 rounded-full bg-[#14100D] border border-[#2A241E] text-[#D4AF37] group-hover:scale-110 transition-transform">
                    <Upload size={22} />
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-[#E5E0D8]">
                    Click to upload image from local storage
                  </div>
                  <span className="text-[10px] text-[#8C8070]">
                    PNG, JPG, WEBP up to 5MB (1200x400px recommended)
                  </span>
                </div>
              )}
            </div>

            {/* Alternative Direct URL Input */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#8C8070] uppercase shrink-0">or URL:</span>
              <input
                type="text"
                value={form.coverImage.startsWith("data:") ? "" : form.coverImage}
                onChange={(e) => handleInputChange("coverImage", e.target.value)}
                placeholder="Paste external image URL..."
                className="w-full px-3 py-1.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60"
              />
            </div>
          </div>

          <hr className="border-[#2A241E]/60" />

          <div>
            <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
              Community Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="e.g. Sovereign Wealth Circle"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none focus:border-[#D4AF37]/80 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
              placeholder="Define the purpose of your community..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none focus:border-[#D4AF37]/80 transition-colors resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
              Rules
            </label>
            <textarea
              value={form.rules}
              onChange={(e) => handleInputChange("rules", e.target.value)}
              rows={3}
              placeholder="House rules and expectations for members..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none focus:border-[#D4AF37]/80 transition-colors resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
              Tags / Topics
            </label>
            <div className="w-full min-h-[42px] px-2.5 py-2 rounded-lg bg-[#0E0C0A] border border-[#2A241E] flex flex-wrap items-center gap-1.5 focus-within:border-[#D4AF37]/80">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D4AF37]/15 text-[#D4AF37] text-[11px]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-white"
                    aria-label={`Remove ${tag}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => addTag(tagInput)}
                placeholder={form.tags.length ? "" : "finance, startups, networking"}
                className="flex-1 min-w-[140px] bg-transparent text-xs sm:text-sm text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none px-1 py-0.5"
              />
            </div>
            <p className="text-[10px] text-[#8C8070] mt-1">
              Press Enter or comma to add a tag (max 12).
            </p>
          </div>

          <hr className="border-[#2A241E]/60" />

          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
              Community Type
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TYPE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                const selected = form.type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleInputChange("type", value)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selected
                        ? "bg-[#251E17] border-[#D4AF37] text-white"
                        : "bg-[#0E0C0A] border-[#2A241E] text-[#8C8070] hover:border-[#3D332A]"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={`mb-2 ${selected ? "text-[#D4AF37]" : ""}`}
                    />
                    <div className="text-xs font-bold text-[#E5E0D8]">{label}</div>
                    <div className="text-[10px] text-[#A69B8D] mt-0.5 leading-tight">
                      {description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-[#2A241E]">
            <button
              type="button"
              onClick={handleDiscard}
              className="text-xs text-[#A69B8D] hover:text-[#E5E0D8] transition-colors"
            >
              Discard Draft
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black text-xs sm:text-sm font-bold disabled:opacity-60 hover:opacity-90 transition-all shadow-lg shadow-[#D4AF37]/10"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Create Community
            </button>
          </div>
        </form>

        {/* Sidebar Panel */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-[#14100D] border border-[#D4AF37]/30 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-[#D4AF37] font-semibold text-xs sm:text-sm">
              <Lightbulb size={16} />
              <span>Creation Tips</span>
            </div>

            <ul className="space-y-3 text-[11px] sm:text-xs text-[#A69B8D] leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-[#D4AF37] font-mono font-bold">01.</span>
                <span>A compelling name increases discovery by 40% in the Elite directory.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#D4AF37] font-mono font-bold">02.</span>
                <span>Private-request communities tend to have higher engagement per member.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#D4AF37] font-mono font-bold">03.</span>
                <span>Clear rules and focused tags help the right members find you.</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#14100D] border border-[#2A241E] rounded-2xl p-4 sm:p-5 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
              CURRENT TIER: ELITE
            </span>
            <div className="w-full bg-[#0E0C0A] h-2 rounded-full overflow-hidden border border-[#2A241E]">
              <div className="bg-gradient-to-r from-[#D4AF37] to-[#E5C158] h-full w-2/3 rounded-full" />
            </div>
            <p className="text-[11px] text-[#8C8070]">
              You have <span className="text-[#E5E0D8]">2 of 3</span> community slots remaining.{" "}
              <a href="#upgrade" className="text-[#D4AF37] underline hover:text-[#E5C158]">
                Upgrade to VIP
              </a>{" "}
              for unlimited circles.
            </p>
          </div>

          {/* Live Preview Mode Box */}
          <div className="bg-[#14100D] border border-[#2A241E] rounded-2xl overflow-hidden shadow-xl">
            <div className="relative h-36 bg-[#0E0C0A] border-b border-[#2A241E]">
              {form.coverImage ? (
                <img
                  src={form.coverImage}
                  alt="Preview cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#251E17] to-[#0E0C0A]" />
              )}

              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-semibold text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1.5">
                <Eye size={12} /> Preview Mode
              </div>

              <div className="absolute bottom-3 left-4 right-4">
                <h4 className="text-base font-serif font-bold text-white drop-shadow-md truncate">
                  {form.name || "Community Name"}
                </h4>
                <p className="text-[10px] text-gray-300 drop-shadow">
                  0 Members • {typeLabel(form.type)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}