import { useEffect, useState } from "react";
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
  LuTriangleAlert as AlertTriangle,
  LuImage as ImageIcon,
} from "react-icons/lu";
import {
  fetchSystemSettings,
  updateSystemSettings,
} from "../../../../api/dashboard";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { useSiteContact } from "../../../../context/SiteContactContext";

const cardClass =
  "bg-fo-surface border border-fo-border p-5 rounded-xl space-y-3";
const labelClass =
  "text-xs font-semibold text-fo-text flex items-center gap-2";
const inputClass =
  "w-full bg-fo-surface-hover border border-fo-border rounded-lg p-2.5 text-xs text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent disabled:opacity-60";
const hintClass = "text-[11px] text-fo-subtle";
const WATERMARK_POSITIONS = [
  ["bottom-right", "Bottom right"],
  ["bottom-left", "Bottom left"],
  ["top-right", "Top right"],
  ["top-left", "Top left"],
  ["center", "Center"],
];

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
  const [maxWarnings, setMaxWarnings] = useState(3);
  const [autoBanOnMaxWarnings, setAutoBanOnMaxWarnings] = useState(true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkOpacity, setWatermarkOpacity] = useState(60);
  const [watermarkSizePercent, setWatermarkSizePercent] = useState(26);
  const [watermarkPosition, setWatermarkPosition] = useState("bottom-right");
  const [watermarkMarginPercent, setWatermarkMarginPercent] = useState(4);
  const [watermarkImageUrl, setWatermarkImageUrl] = useState("");
  const [watermarkSkipForOwner, setWatermarkSkipForOwner] = useState(false);
  const [watermarkImageData, setWatermarkImageData] = useState("");
  const [watermarkClearImage, setWatermarkClearImage] = useState(false);
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
          if (data.settings.maxWarningsBeforeBan != null) {
            setMaxWarnings(data.settings.maxWarningsBeforeBan);
          }
          if (data.settings.autoBanOnMaxWarnings != null) {
            setAutoBanOnMaxWarnings(Boolean(data.settings.autoBanOnMaxWarnings));
          }
          setWatermarkEnabled(data.settings.watermarkEnabled !== false);
          if (data.settings.watermarkOpacity != null) {
            setWatermarkOpacity(data.settings.watermarkOpacity);
          }
          if (data.settings.watermarkSizePercent != null) {
            setWatermarkSizePercent(data.settings.watermarkSizePercent);
          }
          if (data.settings.watermarkPosition) {
            setWatermarkPosition(data.settings.watermarkPosition);
          }
          if (data.settings.watermarkMarginPercent != null) {
            setWatermarkMarginPercent(data.settings.watermarkMarginPercent);
          }
          setWatermarkImageUrl(data.settings.watermarkImageUrl || "");
          setWatermarkSkipForOwner(Boolean(data.settings.watermarkSkipForOwner));
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
    const warnMax = Number(maxWarnings);
    if (!Number.isFinite(warnMax) || warnMax < 1 || warnMax > 20) {
      showToast("Max warnings before ban must be between 1 and 20.");
      return;
    }
    const opacity = Number(watermarkOpacity);
    const size = Number(watermarkSizePercent);
    const margin = Number(watermarkMarginPercent);
    if (!Number.isFinite(opacity) || opacity < 40 || opacity > 80) {
      showToast("Watermark opacity must be between 40 and 80.");
      return;
    }
    if (!Number.isFinite(size) || size < 12 || size > 40) {
      showToast("Watermark size must be between 12 and 40 percent.");
      return;
    }
    if (!Number.isFinite(margin) || margin < 2 || margin > 12) {
      showToast("Watermark margin must be between 2 and 12 percent.");
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
        maxWarningsBeforeBan: Math.floor(warnMax),
        autoBanOnMaxWarnings: Boolean(autoBanOnMaxWarnings),
        watermarkEnabled: Boolean(watermarkEnabled),
        watermarkOpacity: Math.round(opacity),
        watermarkSizePercent: Math.round(size),
        watermarkPosition,
        watermarkMarginPercent: Math.round(margin),
        watermarkSkipForOwner: Boolean(watermarkSkipForOwner),
        ...(watermarkImageData ? { watermarkImageData } : {}),
        ...(watermarkClearImage ? { watermarkClearImage: true } : {}),
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
      if (next.maxWarningsBeforeBan != null) {
        setMaxWarnings(next.maxWarningsBeforeBan);
      }
      if (next.autoBanOnMaxWarnings != null) {
        setAutoBanOnMaxWarnings(Boolean(next.autoBanOnMaxWarnings));
      }
      setWatermarkEnabled(next.watermarkEnabled !== false);
      if (next.watermarkOpacity != null) setWatermarkOpacity(next.watermarkOpacity);
      if (next.watermarkSizePercent != null) {
        setWatermarkSizePercent(next.watermarkSizePercent);
      }
      if (next.watermarkPosition) setWatermarkPosition(next.watermarkPosition);
      if (next.watermarkMarginPercent != null) {
        setWatermarkMarginPercent(next.watermarkMarginPercent);
      }
      setWatermarkImageUrl(next.watermarkImageUrl || "");
      setWatermarkSkipForOwner(Boolean(next.watermarkSkipForOwner));
      setWatermarkImageData("");
      setWatermarkClearImage(false);
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
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-fo-text">
            Global System Settings
          </h1>
          <p className="text-xs text-fo-subtle mt-1">
            Configure the public contact details, edit window, and other platform controls.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving}
          className="flex items-center gap-2 px-4 py-2 bg-fo-brand text-fo-brand-fg font-bold text-xs rounded-lg hover:bg-fo-brand-hover transition-colors shadow-md disabled:opacity-60"
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
        <div className={cardClass}>
          <label className={labelClass}>
            <Mail className="w-4 h-4 text-fo-accent" /> Main site email
          </label>
          <input
            type="email"
            value={contactEmail}
            disabled={loading || saving}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="e.g. userservices@fointer.net"
            className={inputClass}
          />
          <p className={hintClass}>
            Shown on Contact Us, About, footer, and policy pages. Leave blank until you have the live address.
          </p>
        </div>

        <div className={cardClass}>
          <label className={labelClass}>
            <Phone className="w-4 h-4 text-fo-accent" /> Main site phone
          </label>
          <input
            type="tel"
            value={contactPhone}
            disabled={loading || saving}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="e.g. +1 (555) 010-1234"
            className={inputClass}
          />
          <p className={hintClass}>
            Public support number. Leave blank if the client has not provided one yet.
          </p>
        </div>

        <div className={cardClass}>
          <label className={labelClass}>
            <MapPin className="w-4 h-4 text-fo-accent" /> Main site location
          </label>
          <textarea
            rows={3}
            value={contactAddress}
            disabled={loading || saving}
            onChange={(e) => setContactAddress(e.target.value)}
            placeholder="e.g. 123 Unity Street, Suite 4, Civic Center, NY 10001"
            className={`${inputClass} resize-none`}
          />
          <p className={hintClass}>
            Shown in the public footer and Contact Us. Leave blank until an address is confirmed.
          </p>
        </div>

        <div className={cardClass}>
          <label className={labelClass}>
            <Clock className="w-4 h-4 text-fo-accent" /> Self-Deletion Limit
            (Minutes)
          </label>
          <input
            type="number"
            min={1}
            max={10080}
            value={editLimit}
            disabled={loading || saving}
            onChange={(e) => setEditLimit(e.target.value)}
            className={inputClass}
          />
          <p className={hintClass}>
            Authors can edit their own posts, comments, listings, and direct
            messages only within this window. Deleting their own content stays
            allowed anytime. After the window expires, edits are locked for the
            author.
          </p>
        </div>

        <div className={cardClass}>
          <label className={labelClass}>
            <Users className="w-4 h-4 text-fo-accent" /> Watch Group Max Capacity
          </label>
          <input
            type="number"
            min={2}
            max={200}
            value={watchLimit}
            disabled={loading || saving}
            onChange={(e) => setWatchLimit(e.target.value)}
            className={inputClass}
          />
          <p className={hintClass}>
            Highest number of members a user can set when creating a watch group (2–200).
          </p>
        </div>

        <div className={cardClass}>
          <label className={labelClass}>
            <UploadCloud className="w-4 h-4 text-fo-accent" /> Max Upload Size
            (MB)
          </label>
          <input
            type="number"
            value={s3Limit}
            onChange={(e) => setS3Limit(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className={cardClass}>
          <label className={labelClass}>
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Max warnings
            before ban
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={maxWarnings}
            disabled={loading || saving}
            onChange={(e) => setMaxWarnings(e.target.value)}
            className={inputClass}
          />
          <p className={hintClass}>
            How many platform warnings a user can receive before auto-ban (1–20).
          </p>
          <label className="flex items-center gap-2 pt-2 text-xs text-fo-text cursor-pointer">
            <input
              type="checkbox"
              checked={autoBanOnMaxWarnings}
              disabled={loading || saving}
              onChange={(e) => setAutoBanOnMaxWarnings(e.target.checked)}
              className="rounded border-fo-border text-fo-accent"
            />
            Auto-ban when the warning limit is reached
          </label>
        </div>

        <div className={`${cardClass} md:col-span-2`}>
          <label className={labelClass}>
            <ImageIcon className="w-4 h-4 text-fo-accent" /> Downloaded media watermark
          </label>
          <p className={hintClass}>
            Applied only to the file someone downloads. The original photo or video stored on Fointer stays unchanged. Web, iOS, and Android downloads that use the Fointer download API receive this mark.
          </p>
          <label className="flex items-center gap-2 text-xs text-fo-text cursor-pointer">
            <input
              type="checkbox"
              checked={watermarkEnabled}
              disabled={loading || saving}
              onChange={(e) => setWatermarkEnabled(e.target.checked)}
              className="rounded border-fo-border text-fo-accent"
            />
            Add the Fointer logo to downloaded images and videos
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className={hintClass}>Opacity (40–80)</span>
              <input
                type="number"
                min={40}
                max={80}
                value={watermarkOpacity}
                disabled={loading || saving}
                onChange={(e) => setWatermarkOpacity(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className={hintClass}>Size (% of width)</span>
              <input
                type="number"
                min={12}
                max={40}
                value={watermarkSizePercent}
                disabled={loading || saving}
                onChange={(e) => setWatermarkSizePercent(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className={hintClass}>Edge margin (%)</span>
              <input
                type="number"
                min={2}
                max={12}
                value={watermarkMarginPercent}
                disabled={loading || saving}
                onChange={(e) => setWatermarkMarginPercent(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <label className="space-y-1 block">
            <span className={hintClass}>Position</span>
            <select
              value={watermarkPosition}
              disabled={loading || saving}
              onChange={(e) => setWatermarkPosition(e.target.value)}
              className={inputClass}
            >
              {WATERMARK_POSITIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {watermarkImageData || watermarkImageUrl ? (
              <img
                src={watermarkImageData || watermarkImageUrl}
                alt="Watermark logo"
                className="h-16 w-auto rounded-md bg-[length:12px_12px] bg-[linear-gradient(45deg,#ddd_25%,transparent_25%),linear-gradient(-45deg,#ddd_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ddd_75%),linear-gradient(-45deg,transparent_75%,#ddd_75%)] bg-[position:0_0,0_6px,6px_-6px,-6px_0]"
              />
            ) : (
              <p className={hintClass}>Using the built-in fointer.net logo.</p>
            )}
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-fo-border text-xs text-fo-text cursor-pointer">
              <UploadCloud className="w-3.5 h-3.5" />
              Replace logo
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="hidden"
                disabled={loading || saving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  if (file.size > 500_000) {
                    showToast("Watermark logo must be under 500 KB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    setWatermarkImageData(String(reader.result || ""));
                    setWatermarkClearImage(false);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => {
                setWatermarkImageData("");
                setWatermarkImageUrl("");
                setWatermarkClearImage(true);
              }}
              className="px-3 py-2 rounded-lg border border-fo-border text-xs text-fo-text"
            >
              Use built-in logo
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-fo-text cursor-pointer">
            <input
              type="checkbox"
              checked={watermarkSkipForOwner}
              disabled={loading || saving}
              onChange={(e) => setWatermarkSkipForOwner(e.target.checked)}
              className="rounded border-fo-border text-fo-accent"
            />
            Exception: skip the watermark when the downloader owns that file
          </label>
        </div>

        <div className={cardClass}>
          <label className={labelClass}>
            <ShieldAlert className="w-4 h-4 text-red-400" /> Banned Keywords List
          </label>
          <input
            type="text"
            value={bannedKeywords}
            disabled={loading || saving}
            onChange={(e) => setBannedKeywords(e.target.value)}
            placeholder="e.g. scam, spam link, free tokens"
            className={inputClass}
          />
          <p className={hintClass}>
            Comma-separated words that cannot appear in posts, comments, communities, or chat. Save this list to apply it.
          </p>
        </div>
      </div>
    </div>
  );
}
