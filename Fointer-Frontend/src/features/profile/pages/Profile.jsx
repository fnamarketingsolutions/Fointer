import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  Loader2,
  RefreshCw,
  Shield,
  Award,
  Users,
  FileText,
  Save,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  fetchMyProfile,
  updateMyProfile,
  updateMyPassword,
} from "../../../api/profile";
import { uploadMedia } from "../../../api/uploads";
import { useAuth } from "../../../context/AuthContext";
import { MAX_FILE_SIZE } from "../../../shared/constants/uploads";
import { useToast } from "../../../shared/components/feedback/ToastContext";

export default function Profile() {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    username: "",
    bio: "",
    interests: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [interestInput, setInterestInput] = useState("");
  const [passwordVisibility, setPasswordVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const avatarInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyProfile();
      const p = data?.profile;
      setProfile(p || null);
      setForm({
        name: p?.name || "",
        username: p?.username || "",
        bio: p?.bio || "",
        interests: (p?.interests || []).join(", "),
      });
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const interestList = useMemo(() => {
    return form.interests
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }, [form.interests]);

  const addInterest = () => {
    const value = interestInput.trim();
    if (!value) return;
    if (interestList.includes(value)) {
      setInterestInput("");
      return;
    }
    const next = [...interestList, value].slice(0, 20);
    setForm((p) => ({ ...p, interests: next.join(", ") }));
    setInterestInput("");
  };

  const removeInterest = (tag) => {
    const next = interestList.filter((t) => t !== tag);
    setForm((p) => ({ ...p, interests: next.join(", ") }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    const next = {
      name: form.name.trim(),
      username: form.username.trim().replace(/^@+/, ""),
      bio: form.bio.trim(),
      interests: interestList,
    };
    const prevInterests = profile?.interests || [];
    const unchanged =
      next.name === (profile?.name || "") &&
      next.username === String(profile?.username || "").replace(/^@+/, "") &&
      next.bio === (profile?.bio || "") &&
      next.interests.length === prevInterests.length &&
      next.interests.every((t, i) => t === prevInterests[i]);

    if (unchanged) {
      showToast("Nothing to change.");
      return;
    }

    setSaving(true);
    try {
      const data = await updateMyProfile(next);
      showToast(data?.message || "Profile updated.");

      const updated = data?.user || data?.profile;
      if (updated) {
        const cleanedUsername = String(updated.username || "").replace(/^@+/, "");
        setProfile((prev) => (prev ? { ...prev, ...updated, username: cleanedUsername } : updated));
        setForm({
          name: updated.name ?? form.name,
          username: cleanedUsername,
          bio: updated.bio ?? form.bio,
          interests: Array.isArray(updated.interests)
            ? updated.interests.join(", ")
            : form.interests,
        });
      }

      if (refreshUser) await refreshUser();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    setPasswordSaving(true);
    try {
      const data = await updateMyPassword(passwordForm);
      showToast(data?.message || "Password updated.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showToast("Selected image is too large. Max size is 5 MB.");
      return;
    }

    setAvatarSaving(true);

    try {
      const upload = await uploadMedia(file, "fointer/avatars");
      const avatarUrl = upload?.media?.url;

      if (!avatarUrl) {
        throw new Error("Upload did not return an image URL.");
      }

      const data = await updateMyProfile({ avatar: avatarUrl });
      showToast(data?.message || "Profile photo updated.");

      const updated = data?.user || data?.profile;
      if (updated) {
        setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      }

      if (refreshUser) await refreshUser();
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || "Failed to update profile photo.");
    } finally {
      setAvatarSaving(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#A69B8D] text-sm gap-2">
        <Loader2 size={16} className="animate-spin" />
        Loading profile...
      </div>
    );
  }
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-semibold text-[#E5E0D8]">
            Profile
          </h1>
          <p className="text-xs sm:text-sm text-[#A69B8D] mt-1">
            Your identity, security, communities, posts, and achievements.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Identity */}
      <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-5">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarSaving}
            title="Change photo"
            className="relative shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/60 disabled:opacity-70"
          >
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={profile?.name || "Profile"}
                className="w-16 h-16 rounded-full object-cover border border-[#D4AF37]/40"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] text-2xl font-serif font-semibold">
                {(profile?.name || "U").charAt(0).toUpperCase()}
              </div>
            )}
            {avatarSaving && (
              <span className="absolute inset-0 rounded-full bg-black/55 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-[#D4AF37]" />
              </span>
            )}
          </button>
          <div>
            <h2 className="text-lg font-serif font-semibold text-[#D4AF37]">
              {profile?.name || "Member"}
            </h2>
            <p className="text-xs text-[#A69B8D]">
              {profile?.username} · {profile?.email}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#8C8070] mt-1 font-mono">
              {profile?.role} account
            </p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarSaving}
              className="mt-2 text-[11px] text-[#D4AF37] hover:text-[#E5E0D8] transition-colors disabled:opacity-70"
            >
              {avatarSaving ? "Uploading photo..." : "Change photo"}
            </button>
          </div>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarSelect}
          disabled={avatarSaving}
        />

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8C8070] mb-1">
              Display Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8C8070] mb-1">
              Username
            </label>
            <input
              value={form.username}
              onChange={(e) =>
                setForm((p) => ({ ...p, username: e.target.value }))
              }
              className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8C8070] mb-1">
              Email
            </label>
            <input
              value={profile?.email || ""}
              disabled
              className="w-full bg-[#0E0C0A]/60 border border-[#2A241E] rounded-lg px-3 py-2 text-sm text-[#8C8070] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8C8070] mb-1">
              Bio
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              rows={3}
              maxLength={500}
              placeholder="Tell others about yourself..."
              className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50 resize-y"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#8C8070] mb-1">
              Interests
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {interestList.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D4AF37]/10 text-[#D4AF37] text-[11px]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeInterest(tag)}
                    className="hover:text-red-300"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInterest();
                  }
                }}
                placeholder="Add interest and press Enter"
                className="flex-1 bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50"
              />
              <button
                type="button"
                onClick={addInterest}
                className="px-3 py-2 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#D4AF37]"
              >
                Add
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save Profile
          </button>
        </form>
      </section>

      {/* Security */}
      <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-[#D4AF37]" />
          <h2 className="text-base font-serif font-semibold text-[#E5E0D8]">
            Security
          </h2>
        </div>
        {!profile?.hasPassword ? (
          <p className="text-xs text-[#A69B8D]">
            This account uses social login. Password changes are not available.
          </p>
        ) : (
          <form onSubmit={handlePassword} className="space-y-3 max-w-md">
            <div className="relative">
              <input
                type={passwordVisibility.currentPassword ? "text" : "password"}
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({
                    ...p,
                    currentPassword: e.target.value,
                  }))
                }
                placeholder="Current password"
                required
                className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 pr-11 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("currentPassword")}
                className="absolute inset-y-0 right-0 px-3 text-[#A69B8D] hover:text-[#D4AF37] transition-colors"
                title={passwordVisibility.currentPassword ? "Hide password" : "Show password"}
              >
                {passwordVisibility.currentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <input
                type={passwordVisibility.newPassword ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                }
                placeholder="New password (min 8 characters)"
                required
                minLength={8}
                className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 pr-11 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("newPassword")}
                className="absolute inset-y-0 right-0 px-3 text-[#A69B8D] hover:text-[#D4AF37] transition-colors"
                title={passwordVisibility.newPassword ? "Hide password" : "Show password"}
              >
                {passwordVisibility.newPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <input
                type={passwordVisibility.confirmPassword ? "text" : "password"}
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({
                    ...p,
                    confirmPassword: e.target.value,
                  }))
                }
                placeholder="Confirm new password"
                required
                minLength={8}
                className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2 pr-11 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("confirmPassword")}
                className="absolute inset-y-0 right-0 px-3 text-[#A69B8D] hover:text-[#D4AF37] transition-colors"
                title={passwordVisibility.confirmPassword ? "Hide password" : "Show password"}
              >
                {passwordVisibility.confirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={passwordSaving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-semibold disabled:opacity-60"
            >
              {passwordSaving && <Loader2 size={14} className="animate-spin" />}
              Update Password
            </button>
          </form>
        )}
      </section>

      {/* Achievements */}
      <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award size={16} className="text-[#D4AF37]" />
          <h2 className="text-base font-serif font-semibold text-[#E5E0D8]">
            Achievements
          </h2>
        </div>
        {!profile?.achievements?.length ? (
          <p className="text-xs text-[#8C8070]">
            Join communities and post to unlock badges.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.achievements.map((badge) => (
              <div
                key={badge.id}
                className="px-3 py-2 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10"
                title={badge.description}
              >
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#D4AF37]">
                  {badge.label}
                </div>
                <div className="text-[10px] text-[#A69B8D] mt-0.5">
                  {badge.description}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Communities */}
      <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-[#D4AF37]" />
          <h2 className="text-base font-serif font-semibold text-[#E5E0D8]">
            Communities{" "}
            <span className="text-[#A69B8D] font-sans text-sm">
              ({profile?.stats?.communitiesJoined || 0})
            </span>
          </h2>
        </div>
        {!profile?.communities?.length ? (
          <p className="text-xs text-[#8C8070]">No communities joined yet.</p>
        ) : (
          <div className="space-y-2">
            {profile.communities.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#0E0C0A] border border-[#2A241E]"
              >
                <div className="min-w-0">
                  <div className="text-sm text-[#E5E0D8] truncate">{c.name}</div>
                  <div className="text-[10px] text-[#8C8070] uppercase">
                    {c.membershipRole}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Posts */}
      <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} className="text-[#D4AF37]" />
          <h2 className="text-base font-serif font-semibold text-[#E5E0D8]">
            Posts{" "}
            <span className="text-[#A69B8D] font-sans text-sm">
              ({profile?.stats?.posts || 0})
            </span>
          </h2>
        </div>
        {!profile?.posts?.length ? (
          <p className="text-xs text-[#8C8070]">No posts yet.</p>
        ) : (
          <div className="space-y-2">
            {profile.posts.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-lg bg-[#0E0C0A] border border-[#2A241E]"
              >
                <div className="text-sm font-medium text-[#E5E0D8] truncate">
                  {p.title}
                </div>
                <div className="text-[10px] text-[#8C8070] mt-0.5">
                  {p.community?.name || "Community"}
                  {p.createdAt
                    ? ` · ${new Date(p.createdAt).toLocaleDateString()}`
                    : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
