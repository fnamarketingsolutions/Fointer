import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
import {
  communitySegment,
  postSegment,
} from "../../../shared/services/entityLinks";
import { timeAgo } from "../../../shared/utils/date";
import FollowUserList from "../components/FollowUserList";
import ThemeToggle from "../../../shared/components/ThemeToggle";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "communities", label: "Communities" },
  { id: "posts", label: "My Posts" },
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
];

const fieldClass =
  "w-full bg-fo-bg border border-fo-border rounded-lg px-3 py-2.5 text-sm text-fo-text focus:outline-none focus:border-fo-accent/50 placeholder:text-fo-subtle";

const labelClass =
  "block text-[11px] uppercase tracking-wide text-fo-subtle mb-1.5";

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
    city: "",
    state: "",
    country: "",
    zipCode: "",
    phone: "",
    yearOfBirth: "",
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
        city: p?.city || "",
        state: p?.state || "",
        country: p?.country || "",
        zipCode: p?.zipCode || "",
        phone: p?.phone || "",
        yearOfBirth:
          p?.yearOfBirth !== null && p?.yearOfBirth !== undefined
            ? String(p.yearOfBirth)
            : "",
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
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim(),
      zipCode: form.zipCode.trim(),
      phone: form.phone.trim(),
      yearOfBirth: form.yearOfBirth.trim(),
    };
    const prevInterests = profile?.interests || [];
    const unchanged =
      next.name === (profile?.name || "") &&
      next.username === String(profile?.username || "").replace(/^@+/, "") &&
      next.bio === (profile?.bio || "") &&
      next.city === (profile?.city || "") &&
      next.state === (profile?.state || "") &&
      next.country === (profile?.country || "") &&
      next.zipCode === (profile?.zipCode || "") &&
      next.phone === (profile?.phone || "") &&
      next.yearOfBirth ===
        (profile?.yearOfBirth !== null && profile?.yearOfBirth !== undefined
          ? String(profile.yearOfBirth)
          : "") &&
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
          city: updated.city ?? form.city,
          state: updated.state ?? form.state,
          country: updated.country ?? form.country,
          zipCode: updated.zipCode ?? form.zipCode,
          phone: updated.phone ?? form.phone,
          yearOfBirth:
            updated.yearOfBirth !== null && updated.yearOfBirth !== undefined
              ? String(updated.yearOfBirth)
              : "",
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

      const data = await updateMyProfile({ avatar: upload.media });
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
      <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
        <Loader2 size={16} className="animate-spin text-fo-accent" />
        Loading profile…
      </div>
    );
  }

  const communityCount = profile?.stats?.communitiesJoined || 0;
  const postCount = profile?.stats?.posts || 0;
  const followerCount = profile?.stats?.followers ?? 0;
  const followingCount = profile?.stats?.following ?? 0;

  const tabItems = TABS.map((item) => {
    if (item.id === "followers") {
      return { ...item, label: `Followers (${followerCount})` };
    }
    if (item.id === "following") {
      return { ...item, label: `Following (${followingCount})` };
    }
    return item;
  });

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
            Profile
          </h1>
          <p className="text-sm text-fo-subtle">
            Identity, security, communities, and posts.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Identity strip */}
      <div className="flex items-center gap-4 bg-fo-surface border border-fo-border rounded-xl p-3.5 sm:p-4">
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
              className="w-16 h-16 rounded-full object-cover border border-fo-border"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#1A1510] border border-fo-border flex items-center justify-center text-fo-accent text-xl font-semibold">
              {(profile?.name || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            {avatarSaving ? (
              <Loader2 size={16} className="animate-spin text-fo-accent" />
            ) : (
              <Camera size={16} className="text-fo-text" />
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
          <h2 className="text-base sm:text-lg font-semibold text-fo-text truncate">
            {profile?.name || "Member"}
          </h2>
          <p className="text-xs text-fo-subtle truncate">
            @{String(profile?.username || "").replace(/^@+/, "")}
            {profile?.email ? ` · ${profile.email}` : ""}
          </p>
          <p className="text-xs text-fo-subtle mt-2">
            {postCount} posts · {communityCount} communities
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
        {tabItems.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                  : "text-fo-subtle hover:text-fo-text border border-transparent"
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
            className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-4"
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

            <div className="pt-1 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fo-muted">
                Appearance
              </h3>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-fo-border bg-fo-bg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-fo-text">Theme</p>
                  <p className="text-xs text-fo-subtle mt-0.5">
                    Switch between dark and light mode.
                  </p>
                </div>
                <ThemeToggle showLabel />
              </div>
            </div>

            <div className="pt-1 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fo-muted">
                Contact & location
              </h3>

              <div>
                <label className={labelClass}>Phone number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+1 (555) 123-4567"
                  className={fieldClass}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>City</label>
                  <input
                    value={form.city}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, city: e.target.value }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <input
                    value={form.state}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, state: e.target.value }))
                    }
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Country</label>
                  <input
                    value={form.country}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, country: e.target.value }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Zip code</label>
                  <input
                    value={form.zipCode}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, zipCode: e.target.value }))
                    }
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Year of birth</label>
                <input
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  value={form.yearOfBirth}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, yearOfBirth: e.target.value }))
                  }
                  placeholder="e.g. 1990"
                  className={fieldClass}
                />
              </div>
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
              <p className="text-[10px] text-fo-subtle text-right mt-1">
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
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-fo-border bg-fo-bg text-[11px] text-fo-muted"
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
                  className="px-3 py-2 rounded-lg border border-fo-border text-xs text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 shrink-0"
                >
                  Add
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-fo-accent text-black text-sm font-semibold disabled:opacity-60"
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
          <section className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Award size={15} className="text-fo-accent" />
              <h3 className="text-sm font-semibold text-fo-text">
                Achievements
              </h3>
            </div>
            {!profile?.achievements?.length ? (
              <p className="text-xs text-fo-subtle">
                Join communities and post to unlock badges.
              </p>
            ) : (
              <div className="space-y-2">
                {profile.achievements.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-fo-border bg-fo-bg"
                    title={badge.description}
                  >
                    <Award size={14} className="text-fo-accent mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-fo-text">
                        {badge.label}
                      </p>
                      <p className="text-[11px] text-fo-subtle mt-0.5">
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
        <section className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-fo-accent" />
            <h3 className="text-sm font-semibold text-fo-text">
              Change password
            </h3>
          </div>

          {!profile?.hasPassword ? (
            <p className="text-sm text-fo-subtle">
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
                    className="absolute inset-y-0 right-0 px-3 text-fo-muted hover:text-fo-accent transition-colors"
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-fo-accent/40 text-fo-accent text-sm font-semibold disabled:opacity-60"
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
            <Users size={15} className="text-fo-accent" />
            <h3 className="text-sm font-semibold text-fo-text">
              Communities
            </h3>
            <span className="text-[11px] text-fo-subtle">({communityCount})</span>
          </div>

          {!profile?.communities?.length ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No communities joined yet.
            </div>
          ) : (
            profile.communities.map((c) => {
              const to = `/communities/${communitySegment(c) || c.id}`;
              return (
                <Link
                  key={c.id}
                  to={to}
                  className="group flex items-center justify-between gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fo-text group-hover:text-fo-accent transition-colors truncate">
                      {c.name}
                    </p>
                    <p className="text-[11px] text-fo-subtle capitalize mt-0.5">
                      {c.membershipRole || "member"}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </section>
      )}

      {/* Posts */}
      {tab === "posts" && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2 px-0.5">
            <FileText size={15} className="text-fo-accent" />
            <h3 className="text-sm font-semibold text-fo-text">Posts</h3>
            <span className="text-[11px] text-fo-subtle">({postCount})</span>
          </div>

          {!profile?.posts?.length ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No posts yet.
            </div>
          ) : (
            profile.posts.map((p) => {
              const postSeg = postSegment(p) || p.id;
              const communitySeg = p.community
                ? communitySegment(p.community) || p.community.id
                : null;
              const to = communitySeg
                ? `/communities/${communitySeg}/posts/${postSeg}`
                : `/post/${postSeg}`;
              return (
                <Link
                  key={p.id}
                  to={to}
                  className="group block bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-1"
                >
                  <p className="text-sm font-medium text-fo-text group-hover:text-fo-accent transition-colors line-clamp-2">
                    {p.title || "Untitled"}
                  </p>
                  <p className="text-[11px] text-fo-subtle">
                    {p.community?.name || "Community"}
                    {p.createdAt ? ` · ${timeAgo(p.createdAt)}` : ""}
                  </p>
                </Link>
              );
            })
          )}
        </section>
      )}

      {tab === "followers" && profile?.username ? (
        <FollowUserList username={profile.username} mode="followers" />
      ) : null}

      {tab === "following" && profile?.username ? (
        <FollowUserList username={profile.username} mode="following" />
      ) : null}
    </div>
  );
}
