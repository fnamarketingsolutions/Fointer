import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuAward as Award,
  LuCamera as Camera,
  LuChevronRight as ChevronRight,
  LuEye as Eye,
  LuEyeOff as EyeOff,
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSave as Save,
  LuShield as Shield,
  LuUsers as Users,
  LuX as X,
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
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import ThemeToggle from "../../../shared/components/ThemeToggle";
import {
  communitySegment,
  postSegment,
} from "../../../shared/services/entityLinks";
import { normalizeUsername } from "../../../shared/services/profileLinks";
import { formatCommunityType } from "../../../shared/utils/community";
import { formatLongDate, timeAgo } from "../../../shared/utils/date";
import FollowUserList from "../components/FollowUserList";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "communities", label: "Communities" },
  { id: "posts", label: "My Posts" },
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
];

const EMPTY_FORM = {
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
};

const EMPTY_PASSWORD = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const cardClass =
  "bg-fo-surface border border-fo-border rounded-xl p-3.5 sm:p-4";

const fieldClass =
  "w-full bg-fo-bg border border-fo-border rounded-lg px-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50 focus-visible:ring-2 focus-visible:ring-fo-accent/40";

const labelClass =
  "block text-xs uppercase tracking-wide text-fo-subtle mb-1.5";

const tabBtnClass = (active) =>
  `shrink-0 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
    active
      ? "bg-fo-surface-3 text-fo-accent border border-fo-accent/35"
      : "text-fo-subtle hover:text-fo-text border border-transparent"
  }`;

const listLinkClass =
  "group block bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40";

function formFromProfile(p) {
  return {
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
  };
}

function postPath(post) {
  const postSeg = postSegment(post) || post.id;
  const communitySeg = post.community
    ? communitySegment(post.community) || post.community.id
    : null;
  return communitySeg
    ? `/communities/${communitySeg}/posts/${postSeg}`
    : `/post/${postSeg}`;
}

export default function Profile() {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD);
  const [interestInput, setInterestInput] = useState("");
  const [passwordVisibility, setPasswordVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const avatarInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMyProfile();
      const p = data?.profile;
      setProfile(p || null);
      setForm(formFromProfile(p));
    } catch (err) {
      setProfile(null);
      const message =
        err?.response?.data?.message || "Failed to load profile.";
      setError(message);
      showToast(message);
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
      next.username === normalizeUsername(profile?.username) &&
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
        const cleanedUsername = normalizeUsername(updated.username);
        const nextProfile = { ...updated, username: cleanedUsername };
        setProfile((prev) => (prev ? { ...prev, ...nextProfile } : nextProfile));
        setForm(formFromProfile(nextProfile));
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
      setPasswordForm(EMPTY_PASSWORD);
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
      <div className="w-full max-w-3xl mx-auto space-y-5" aria-busy="true">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-32 rounded-lg bg-fo-surface-hover animate-pulse" />
            <div className="h-4 w-56 rounded bg-fo-surface-hover animate-pulse" />
          </div>
          <div className="h-10 w-10 rounded-lg bg-fo-surface-hover animate-pulse shrink-0" />
        </div>
        <div className={`${cardClass} animate-pulse space-y-3`}>
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-full bg-fo-surface-hover shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-5 w-40 rounded bg-fo-surface-hover" />
              <div className="h-3 w-28 rounded bg-fo-surface-hover" />
              <div className="h-3 w-48 rounded bg-fo-surface-hover" />
            </div>
          </div>
        </div>
        <div className="h-11 rounded-xl bg-fo-surface-hover animate-pulse" />
        <span className="sr-only">Loading profile…</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
            Profile
          </h1>
          <p className="text-sm text-fo-subtle">
            Identity, security, communities, and posts.
          </p>
        </header>
        <div className="border border-dashed border-fo-border rounded-xl py-14 px-4 text-center space-y-3">
          <p className="text-sm text-fo-text font-medium">
            Could not load profile
          </p>
          <p className="text-xs text-fo-subtle">
            {error || "Your profile is unavailable right now."}
          </p>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-fo-border text-xs font-semibold text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handle = normalizeUsername(profile.username);
  const communityCount =
    profile.stats?.communitiesJoined || profile.communities?.length || 0;
  const postCount = profile.stats?.posts || profile.posts?.length || 0;
  const followerCount = profile.stats?.followers ?? 0;
  const followingCount = profile.stats?.following ?? 0;

  const stats = [
    { id: "posts", count: postCount, label: "posts" },
    { id: "communities", count: communityCount, label: "communities" },
    { id: "followers", count: followerCount, label: "followers" },
    { id: "following", count: followingCount, label: "following" },
  ];

  const tabItems = TABS.map((item) => {
    if (item.id === "communities") {
      return {
        ...item,
        shortLabel: "Communities",
        label: `Communities (${communityCount})`,
      };
    }
    if (item.id === "posts") {
      return {
        ...item,
        shortLabel: "Posts",
        label: `My Posts (${postCount})`,
      };
    }
    if (item.id === "followers") {
      return {
        ...item,
        shortLabel: "Followers",
        label: `Followers (${followerCount})`,
      };
    }
    if (item.id === "following") {
      return {
        ...item,
        shortLabel: "Following",
        label: `Following (${followingCount})`,
      };
    }
    return { ...item, shortLabel: item.label };
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
          title="Refresh"
          aria-label="Refresh profile"
          className="inline-flex items-center justify-center min-h-10 min-w-10 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors disabled:opacity-50 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className={cardClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarSaving}
                title="Change photo"
                aria-label="Change profile photo"
                className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 disabled:opacity-70 group"
              >
              <ProfileAvatar
                src={profile.avatar}
                alt={profile.name || "Profile"}
                name={profile.name || profile.username}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border border-fo-border"
              />
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
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-semibold text-fo-text truncate">
                {profile.name || "Member"}
              </h2>
              <p className="text-sm text-fo-muted truncate">@{handle}</p>
              {profile.email ? (
                <p className="text-xs text-fo-subtle break-all">{profile.email}</p>
              ) : null}
            </div>

            {profile.bio ? (
              <p className="text-sm text-fo-muted leading-relaxed line-clamp-3">
                {profile.bio}
              </p>
            ) : null}

            {profile.createdAt ? (
              <p className="text-xs text-fo-subtle">
                Joined {formatLongDate(profile.createdAt)}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fo-muted">
              {stats.map((stat) => (
                <button
                  key={stat.id}
                  type="button"
                  onClick={() => setTab(stat.id)}
                  className="hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
                >
                  <span className="font-semibold text-fo-text tabular-nums">
                    {stat.count}
                  </span>{" "}
                  {stat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto overscroll-x-contain scrollbar-thin [-webkit-overflow-scrolling:touch]"
        role="tablist"
        aria-label="Profile sections"
      >
        {tabItems.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={tabBtnClass(active)}
            >
              <span className="sm:hidden">{item.shortLabel || item.label}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "profile" && (
        <div className="space-y-4">
          <form
            onSubmit={handleSaveProfile}
            className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-name" className={labelClass}>
                  Display name
                </label>
                <input
                  id="profile-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="profile-username" className={labelClass}>
                  Username
                </label>
                <input
                  id="profile-username"
                  value={form.username}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, username: e.target.value }))
                  }
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-email" className={labelClass}>
                Email
              </label>
              <input
                id="profile-email"
                value={profile.email || ""}
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
                <label htmlFor="profile-phone" className={labelClass}>
                  Phone number
                </label>
                <input
                  id="profile-phone"
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
                  <label htmlFor="profile-city" className={labelClass}>
                    City
                  </label>
                  <input
                    id="profile-city"
                    value={form.city}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, city: e.target.value }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="profile-state" className={labelClass}>
                    State
                  </label>
                  <input
                    id="profile-state"
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
                  <label htmlFor="profile-country" className={labelClass}>
                    Country
                  </label>
                  <input
                    id="profile-country"
                    value={form.country}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, country: e.target.value }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="profile-zip" className={labelClass}>
                    Zip code
                  </label>
                  <input
                    id="profile-zip"
                    value={form.zipCode}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, zipCode: e.target.value }))
                    }
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="profile-yob" className={labelClass}>
                  Year of birth
                </label>
                <input
                  id="profile-yob"
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
              <label htmlFor="profile-bio" className={labelClass}>
                Bio
              </label>
              <textarea
                id="profile-bio"
                value={form.bio}
                onChange={(e) =>
                  setForm((p) => ({ ...p, bio: e.target.value }))
                }
                rows={3}
                maxLength={500}
                placeholder="Tell others about yourself…"
                className={`${fieldClass} resize-y`}
              />
              <p className="text-xs text-fo-subtle text-right mt-1">
                {form.bio.length}/500
              </p>
            </div>

            <div>
              <label htmlFor="profile-interest-input" className={labelClass}>
                Interests
              </label>
              {interestList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {interestList.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-fo-border bg-fo-bg text-xs text-fo-muted"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeInterest(tag)}
                        className="hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
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
                  id="profile-interest-input"
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
                  className="inline-flex items-center justify-center min-h-10 px-3 rounded-lg border border-fo-border text-xs text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                >
                  Add
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg bg-fo-accent text-black text-sm font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save profile
            </button>
          </form>

          <section className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Award size={15} className="text-fo-accent" aria-hidden />
              <h3 className="text-sm font-semibold text-fo-text">
                Achievements
              </h3>
            </div>
            {!profile.achievements?.length ? (
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
                    <Award
                      size={14}
                      className="text-fo-accent mt-0.5 shrink-0"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-fo-text">
                        {badge.label}
                      </p>
                      <p className="text-xs text-fo-subtle mt-0.5">
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

      {tab === "security" && (
        <section className="bg-fo-surface border border-fo-border rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-fo-accent" aria-hidden />
            <h3 className="text-sm font-semibold text-fo-text">
              Change password
            </h3>
          </div>

          {!profile.hasPassword ? (
            <p className="text-sm text-fo-subtle">
              This account uses social login. Password changes are not
              available.
            </p>
          ) : (
            <form onSubmit={handlePassword} className="space-y-3 max-w-md">
              {[
                {
                  key: "currentPassword",
                  id: "password-current",
                  label: "Current password",
                  placeholder: "Current password",
                },
                {
                  key: "newPassword",
                  id: "password-new",
                  label: "New password",
                  placeholder: "New password (min 8 characters)",
                },
                {
                  key: "confirmPassword",
                  id: "password-confirm",
                  label: "Confirm new password",
                  placeholder: "Confirm new password",
                },
              ].map(({ key, id, label, placeholder }) => (
                <div key={key}>
                  <label htmlFor={id} className={labelClass}>
                    {label}
                  </label>
                  <div className="relative">
                    <input
                      id={id}
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
                      className="absolute inset-y-0 right-0 px-3 text-fo-muted hover:text-fo-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
                      title={
                        passwordVisibility[key]
                          ? "Hide password"
                          : "Show password"
                      }
                      aria-label={
                        passwordVisibility[key]
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {passwordVisibility[key] ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-fo-accent/40 text-fo-accent text-sm font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
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

      {tab === "communities" && (
        <section className="space-y-2.5" aria-label="Communities">
          {!profile.communities?.length ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No communities joined yet.
            </div>
          ) : (
            profile.communities.map((community) => (
              <Link
                key={community.id}
                to={`/communities/${communitySegment(community) || community.id}`}
                className={`${listLinkClass} flex items-center gap-3`}
              >
                {community.coverImage ? (
                  <img
                    src={community.coverImage}
                    alt=""
                    className="w-11 h-11 rounded-lg object-cover border border-fo-border shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-fo-surface-3 border border-fo-border flex items-center justify-center shrink-0">
                    <Users size={16} className="text-fo-accent/70" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fo-text group-hover:text-fo-accent transition-colors truncate">
                    {community.name}
                  </p>
                  <p className="text-xs text-fo-subtle mt-0.5">
                    {formatCommunityType(community.type)}
                    <span className="mx-1">·</span>
                    <span className="capitalize">
                      {community.membershipRole || "member"}
                    </span>
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="text-fo-subtle shrink-0"
                  aria-hidden
                />
              </Link>
            ))
          )}
        </section>
      )}

      {tab === "posts" && (
        <section className="space-y-2.5" aria-label="Posts">
          {!profile.posts?.length ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No posts yet.
            </div>
          ) : (
            profile.posts.map((post) => (
              <Link
                key={post.id}
                to={postPath(post)}
                className={`${listLinkClass} space-y-1`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-fo-text group-hover:text-fo-accent transition-colors line-clamp-2 min-w-0">
                    {post.title || "Untitled"}
                  </p>
                  <ChevronRight
                    size={16}
                    className="text-fo-subtle shrink-0 mt-0.5"
                    aria-hidden
                  />
                </div>
                <p className="text-xs text-fo-subtle">
                  {post.community?.name || "Public"}
                  {post.createdAt ? ` · ${timeAgo(post.createdAt)}` : ""}
                </p>
              </Link>
            ))
          )}
        </section>
      )}

      {tab === "followers" && handle ? (
        <FollowUserList username={handle} mode="followers" />
      ) : null}

      {tab === "following" && handle ? (
        <FollowUserList username={handle} mode="following" />
      ) : null}
    </div>
  );
}
