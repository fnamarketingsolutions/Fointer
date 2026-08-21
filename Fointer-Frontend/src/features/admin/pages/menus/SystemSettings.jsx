import React, { useEffect, useState } from "react";
import {
  LuSave as Save,
  LuClock as Clock,
  LuUsers as Users,
  LuCloudUpload as UploadCloud,
  LuShieldAlert as ShieldAlert,
  LuLoaderCircle as Loader2,
  LuMail as Mail,
  LuMapPin as MapPin,
  LuPhone as Phone,
} from "react-icons/lu";
import {
  fetchSystemSettings,
  updateSystemSettings,
} from "../../services/adminService";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { useSiteContact } from "../../../../context/SiteContactContext";

export default function SystemSettings() {
  const { showToast } = useToast();
  const { refresh: refreshPublicContact } = useSiteContact();
  const [editLimit, setEditLimit] = useState(60);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [watchLimit, setWatchLimit] = useState(50);
  const [s3Limit, setS3Limit] = useState(25);
  const [bannedKeywords, setBannedKeywords] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchSystemSettings();
        if (!cancelled && data?.settings) {
          if (data.settings.postEditWindowMinutes != null) {
            setEditLimit(data.settings.postEditWindowMinutes);
          }
          if (data.settings.watchGroupMaxCapacity != null) {
            setWatchLimit(data.settings.watchGroupMaxCapacity);
          }
          setContactEmail(data.settings.contactEmail || "");
          setContactPhone(data.settings.contactPhone || "");
          setContactAddress(data.settings.contactAddress || "");
          setBannedKeywords(
            Array.isArray(data.settings.bannedKeywords)
              ? data.settings.bannedKeywords.join(", ")
              : data.settings.bannedKeywords || ""
          );
        }
      } catch (err) {
        if (!cancelled) {
          showToast(
            err?.response?.data?.message || "Failed to load system settings."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const handleSave = async () => {
    const minutes = Number(editLimit);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 10080) {
      showToast("Self-deletion limit must be between 1 and 10080 minutes.");
      return;
    }
    const watchMax = Number(watchLimit);
    if (!Number.isFinite(watchMax) || watchMax < 2 || watchMax > 200) {
      showToast("Watch group max capacity must be between 2 and 200.");
      return;
    }

    setSaving(true);
    try {
      const data = await updateSystemSettings({
        postEditWindowMinutes: Math.floor(minutes),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        contactAddress: contactAddress.trim(),
        bannedKeywords,
        watchGroupMaxCapacity: Math.floor(watchMax),
      });
      const next = data?.settings || {};
      setEditLimit(next.postEditWindowMinutes ?? Math.floor(minutes));
      setContactEmail(next.contactEmail ?? contactEmail.trim());
      setContactPhone(next.contactPhone ?? contactPhone.trim());
      setContactAddress(next.contactAddress ?? contactAddress.trim());
      if (Array.isArray(next.bannedKeywords)) {
        setBannedKeywords(next.bannedKeywords.join(", "));
      }
      if (next.watchGroupMaxCapacity != null) {
        setWatchLimit(next.watchGroupMaxCapacity);
      }
      await refreshPublicContact();
      showToast("Settings saved.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-amber-50">
            Global System Settings
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Configure the public contact details, edit window, and other platform controls.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold text-xs rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all shadow-md disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-500" /> Main site email
          </label>
          <input
            type="email"
            value={contactEmail}
            disabled={loading || saving}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="e.g. userservices@fointer.net"
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60 disabled:opacity-60"
          />
          <p className="text-[11px] text-stone-500">
            Shown on Contact Us, About, footer, and policy pages. Leave blank until you have the live address.
          </p>
        </div>

        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <Phone className="w-4 h-4 text-amber-500" /> Main site phone
          </label>
          <input
            type="tel"
            value={contactPhone}
            disabled={loading || saving}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="e.g. +1 (555) 010-1234"
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60 disabled:opacity-60"
          />
          <p className="text-[11px] text-stone-500">
            Public support number. Leave blank if the client has not provided one yet.
          </p>
        </div>

        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-500" /> Main site location
          </label>
          <textarea
            rows={3}
            value={contactAddress}
            disabled={loading || saving}
            onChange={(e) => setContactAddress(e.target.value)}
            placeholder="e.g. 123 Unity Street, Suite 4, Civic Center, NY 10001"
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60 disabled:opacity-60 resize-none"
          />
          <p className="text-[11px] text-stone-500">
            Shown in the public footer and Contact Us. Leave blank until an address is confirmed.
          </p>
        </div>

        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Self-Deletion Limit
            (Minutes)
          </label>
          <input
            type="number"
            min={1}
            max={10080}
            value={editLimit}
            disabled={loading || saving}
            onChange={(e) => setEditLimit(e.target.value)}
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60 disabled:opacity-60"
          />
          <p className="text-[11px] text-stone-500">
            Authors can edit or delete their own posts and comments only within
            this window. After it expires, content is locked for the author.
          </p>
        </div>

        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" /> Watch Group Max Capacity
          </label>
          <input
            type="number"
            min={2}
            max={200}
            value={watchLimit}
            disabled={loading || saving}
            onChange={(e) => setWatchLimit(e.target.value)}
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60 disabled:opacity-60"
          />
          <p className="text-[11px] text-stone-500">
            Highest number of members a user can set when creating a watch group (2–200).
          </p>
        </div>

        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-amber-500" /> Max Upload Size
            (MB)
          </label>
          <input
            type="number"
            value={s3Limit}
            onChange={(e) => setS3Limit(e.target.value)}
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        <div className="bg-[#141210] border border-stone-800/60 p-5 rounded-xl space-y-3">
          <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" /> Banned Keywords List
          </label>
          <input
            type="text"
            value={bannedKeywords}
            disabled={loading || saving}
            onChange={(e) => setBannedKeywords(e.target.value)}
            placeholder="e.g. scam, spam link, free tokens"
            className="w-full bg-[#0c0a09] border border-stone-800/80 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none focus:border-amber-500/60 disabled:opacity-60"
          />
          <p className="text-[11px] text-stone-500">
            Comma-separated words that cannot appear in posts, comments, communities, or chat. Save this list to apply it.
          </p>
        </div>
      </div>
    </div>
  );
}
