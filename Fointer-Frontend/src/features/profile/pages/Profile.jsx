import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuAward as Award,
  LuCamera as Camera,
  LuEye as Eye,
  LuEyeOff as EyeOff,
  LuFileText as FileText,
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSave as Save,
  LuShield as Shield,
  LuUsers as Users,
  LuX as X
} from "react-icons/lu";
import {
  fetchMyProfile,
  updateMyPassword,
  updateMyProfile,
} from "../../../api/profile";
import { uploadMedia } from "../../../api/uploads";
import { useAuth } from "../../../context/AuthContext";
import { MAX_FILE_SIZE } from "../../../shared/constants/uploads";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { timeAgo } from "../../../shared/utils/date";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "communities", label: "Communities" },
  { id: "posts", label: "My Posts" },
];

const fieldClass =
  "w-full bg-[#0E0C0A] border border-[#2A241E] rounded-lg px-3 py-2.5 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50 placeholder:text-[#5C5348]";

const labelClass =
  "block text-[11px] uppercase tracking-wide text-[#8C8070] mb-1.5";

export default function Profile() {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState("profile");
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

  const interestList = useMemo(
    () =>
      form.interests
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [form.interests]
  );

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
        const cleanedUsername = String(updated.username || "").replace(
          /^@+/,
          ""
        );
        setProfile((prev) =>
          prev ? { ...prev, ...updated, username: cleanedUsername } : updated
        );
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
      if (!avatarUrl) throw new Error("Upload did not return an image URL.");

      const data = await updateMyProfile({ avatar: avatarUrl });
      showToast(data?.message || "Profile photo updated.");

      const updated = data?.user || data?.profile;
      if (updated) {
        setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      }
      if (refreshUser) await refreshUser();
    } catch (err) {
      showToast(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update profile photo."
      );
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
      <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
        <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
        Loading profile…
      </div>
    );
  }

  const communityCount = profile?.stats?.communitiesJoined || 0;
  const postCount = profile?.stats?.posts || 0;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8]">
            Profile
          </h1>
          <p className="text-sm text-[#8C8070]">
            Identity, security, communities, and posts.
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
      </header>

      {/* Identity strip */}
      <div className="flex items-center gap-4 bg-[#14100D] border border-[#2A241E] rounded-xl p-3.5 sm:p-4">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarSaving}
          title="Change photo"
          className="relative shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 disabled:opacity-70 group"
        >
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={profile?.name || "Profile"}
              className="w-16 h-16 rounded-full object-cover border border-[#2A241E]"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#1A1510] border border-[#2A241E] flex items-center justify-center text-[#D4AF37] text-xl font-semibold">
              {(profile?.name || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            {avatarSaving ? (
              <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
            ) : (
              <Camera size={16} className="text-[#E5E0D8]" />
            )}
          </span>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarSelect}
          disabled={avatarSaving}
        />

        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-semibold text-[#E5E0D8] truncate">
            {profile?.name || "Member"}
          </h2>
          <p className="text-xs text-[#8C8070] truncate">
            @{String(profile?.username || "").replace(/^@+/, "")}
            {profile?.email ? ` · ${profile.email}` : ""}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#8C8070]">
            <span className="capitalize">{profile?.role || "user"}</span>
            <span>·</span>
            <span>{communityCount} communities</span>
            <span>·</span>
            <span>{postCount} posts</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                  : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Profile tab */}
      {tab === "profile" && (
        <div className="space-y-4">
          <form
            onSubmit={handleSaveProfile}
            className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5 space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Display name</label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Username</label>
                <input
                  value={form.username}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, username: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input
                value={profile?.email || ""}
                disabled
                className={`${fieldClass} opacity-60 cursor-not-allowed`}
              />
            </div>

            <div>
              <label className={labelClass}>Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) =>
                  setForm((p) => ({ ...p, bio: e.target.value }))
                }
                rows={3}
                maxLength={500}
                placeholder="Tell others about yourself…"
                className={`${fieldClass} resize-y`}
              />
              <p className="text-[10px] text-[#5C5348] text-right mt-1">
                {form.bio.length}/500
              </p>
            </div>

            <div>
              <label className={labelClass}>Interests</label>
              {interestList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {interestList.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#2A241E] bg-[#0E0C0A] text-[11px] text-[#A69B8D]"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeInterest(tag)}
                        className="hover:text-red-400"
                        aria-label={`Remove ${tag}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
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
                  className={fieldClass}
                />
                <button
                  type="button"
                  onClick={addInterest}
                  className="px-3 py-2 rounded-lg border border-[#2A241E] text-xs text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 shrink-0"
                >
                  Add
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save profile
            </button>
          </form>

          {/* Achievements */}
          <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Award size={15} className="text-[#D4AF37]" />
              <h3 className="text-sm font-semibold text-[#E5E0D8]">
                Achievements
              </h3>
            </div>
            {!profile?.achievements?.length ? (
              <p className="text-xs text-[#8C8070]">
                Join communities and post to unlock badges.
              </p>
            ) : (
              <div className="space-y-2">
                {profile.achievements.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-[#2A241E] bg-[#0E0C0A]"
                    title={badge.description}
                  >
                    <Award size={14} className="text-[#D4AF37] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#E5E0D8]">
                        {badge.label}
                      </p>
                      <p className="text-[11px] text-[#8C8070] mt-0.5">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Security */}
      {tab === "security" && (
        <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-[#D4AF37]" />
            <h3 className="text-sm font-semibold text-[#E5E0D8]">
              Change password
            </h3>
          </div>

          {!profile?.hasPassword ? (
            <p className="text-sm text-[#8C8070]">
              This account uses social login. Password changes are not
              available.
            </p>
          ) : (
            <form onSubmit={handlePassword} className="space-y-3 max-w-md">
              {[
                {
                  key: "currentPassword",
                  placeholder: "Current password",
                },
                {
                  key: "newPassword",
                  placeholder: "New password (min 8 characters)",
                },
                {
                  key: "confirmPassword",
                  placeholder: "Confirm new password",
                },
              ].map(({ key, placeholder }) => (
                <div key={key} className="relative">
                  <input
                    type={passwordVisibility[key] ? "text" : "password"}
                    value={passwordForm[key]}
                    onChange={(e) =>
                      setPasswordForm((p) => ({
                        ...p,
                        [key]: e.target.value,
                      }))
                    }
                    placeholder={placeholder}
                    required
                    minLength={key === "currentPassword" ? undefined : 8}
                    className={`${fieldClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility(key)}
                    className="absolute inset-y-0 right-0 px-3 text-[#A69B8D] hover:text-[#D4AF37] transition-colors"
                    title={
                      passwordVisibility[key] ? "Hide password" : "Show password"
                    }
                  >
                    {passwordVisibility[key] ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              ))}
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#D4AF37]/40 text-[#D4AF37] text-sm font-semibold disabled:opacity-60"
              >
                {passwordSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Update password
              </button>
            </form>
          )}
        </section>
      )}

      {/* Communities */}
      {tab === "communities" && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2 px-0.5">
            <Users size={15} className="text-[#D4AF37]" />
            <h3 className="text-sm font-semibold text-[#E5E0D8]">
              Communities
            </h3>
            <span className="text-[11px] text-[#8C8070]">({communityCount})</span>
          </div>

          {!profile?.communities?.length ? (
            <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
              No communities joined yet.
            </div>
          ) : (
            profile.communities.map((c) => (
              <article
                key={c.id}
                className="flex items-center justify-between gap-3 bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#E5E0D8] truncate">
                    {c.name}
                  </p>
                  <p className="text-[11px] text-[#8C8070] capitalize mt-0.5">
                    {c.membershipRole || "member"}
                  </p>
                </div>
              </article>
            ))
          )}
        </section>
      )}

      {/* Posts */}
      {tab === "posts" && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2 px-0.5">
            <FileText size={15} className="text-[#D4AF37]" />
            <h3 className="text-sm font-semibold text-[#E5E0D8]">Posts</h3>
            <span className="text-[11px] text-[#8C8070]">({postCount})</span>
          </div>

          {!profile?.posts?.length ? (
            <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
              No posts yet.
            </div>
          ) : (
            profile.posts.map((p) => (
              <article
                key={p.id}
                className="bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-1"
              >
                <p className="text-sm font-medium text-[#E5E0D8] line-clamp-2">
                  {p.title || "Untitled"}
                </p>
                <p className="text-[11px] text-[#8C8070]">
                  {p.community?.name || "Community"}
                  {p.createdAt ? ` · ${timeAgo(p.createdAt)}` : ""}
                </p>
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}
