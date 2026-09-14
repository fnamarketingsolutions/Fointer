import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  LuFileText as FileText,
  LuLoaderCircle as Loader2,
  LuSearch as Search,
  LuUserRound as UserRound,
  LuUsers as Users,
} from "react-icons/lu";
import { globalSearch } from "../../../api/search";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import { useAuth } from "../../../context/AuthContext";
import { communitySegment, postSegment } from "../../../shared/services/entityLinks";
import { userProfilePath } from "../../../shared/services/profileLinks";
import { timeAgo } from "../../../shared/utils/date";

const TABS = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "communities", label: "Communities" },
  { id: "profiles", label: "Profiles" },
];

export default function SearchResultsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = String(searchParams.get("q") || "").trim();
  const activeTab = searchParams.get("type") || "all";

  const [input, setInput] = useState(q);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setInput(q);
  }, [q]);

  useEffect(() => {
    if (q.length < 2) {
      setResults(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    globalSearch({ q, limit: 20 })
      .then((data) => {
        if (cancelled) return;
        setResults(data?.results || {});
      })
      .catch((err) => {
        if (cancelled) return;
        setResults(null);
        setError(err?.response?.data?.message || "Search failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q]);

  const profilePath = (username) => userProfilePath(username, user);

  const posts = results?.posts || [];
  const communities = results?.communities || [];
  const profiles = results?.profiles || [];

  const visible = useMemo(() => {
    if (activeTab === "posts") return { posts, communities: [], profiles: [] };
    if (activeTab === "communities")
      return { posts: [], communities, profiles: [] };
    if (activeTab === "profiles")
      return { posts: [], communities: [], profiles };
    return { posts, communities, profiles };
  }, [activeTab, posts, communities, profiles]);

  const totalCount = posts.length + communities.length + profiles.length;

  const handleSearch = (e) => {
    e.preventDefault();
    const next = input.trim();
    if (next.length < 2) return;
    const params = new URLSearchParams(searchParams);
    params.set("q", next);
    setSearchParams(params, { replace: true });
  };

  const setTab = (type) => {
    const params = new URLSearchParams(searchParams);
    if (type === "all") params.delete("type");
    else params.set("type", type);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
          Search
        </h1>
        <p className="text-sm text-fo-subtle">
          Find posts, communities, and profiles across Fointer.
        </p>
      </header>

      <form onSubmit={handleSearch} className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
        />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search posts, communities, profiles…"
          className="w-full bg-fo-surface border border-fo-border rounded-xl pl-10 pr-4 py-3 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
        />
      </form>

      {q.length >= 2 ? (
        <>
          <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                      : "text-fo-subtle hover:text-fo-text border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
              <Loader2 size={16} className="animate-spin text-fo-accent" />
              Searching for “{q}”…
            </div>
          ) : error ? (
            <p className="text-sm text-red-400 py-8 text-center">{error}</p>
          ) : totalCount === 0 ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No results for “{q}”.
            </div>
          ) : (
            <div className="space-y-6">
              {visible.posts.length ? (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 px-0.5">
                    <FileText size={15} className="text-fo-accent" />
                    <h2 className="text-sm font-semibold text-fo-text">
                      Posts
                    </h2>
                    <span className="text-[11px] text-fo-subtle">
                      ({visible.posts.length})
                    </span>
                  </div>
                  {visible.posts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/post/${postSegment(post) || post.id}`}
                      className="block bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-4 transition-colors"
                    >
                      <p className="text-sm font-medium text-fo-text line-clamp-2">
                        {post.title || "Untitled post"}
                      </p>
                      {post.text ? (
                        <p className="text-xs text-fo-subtle line-clamp-2 mt-1">
                          {post.text}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-fo-subtle mt-2">
                        {post.community?.name || "Public"}
                        {post.author?.name ? ` · ${post.author.name}` : ""}
                        {post.createdAt ? ` · ${timeAgo(post.createdAt)}` : ""}
                      </p>
                    </Link>
                  ))}
                </section>
              ) : null}

              {visible.communities.length ? (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 px-0.5">
                    <Users size={15} className="text-fo-accent" />
                    <h2 className="text-sm font-semibold text-fo-text">
                      Communities
                    </h2>
                    <span className="text-[11px] text-fo-subtle">
                      ({visible.communities.length})
                    </span>
                  </div>
                  {visible.communities.map((community) => (
                    <Link
                      key={community.id}
                      to={`/communities/${communitySegment(community) || community.id}`}
                      className="flex items-center gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-4 transition-colors"
                    >
                      {community.coverImage ? (
                        <img
                          src={community.coverImage}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover border border-fo-border shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[#1A1510] border border-fo-border flex items-center justify-center text-fo-accent font-bold shrink-0">
                          {(community.name || "C").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fo-text truncate">
                          {community.name}
                        </p>
                        {community.tags?.length ? (
                          <p className="text-[11px] text-fo-subtle truncate mt-0.5">
                            {community.tags.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </section>
              ) : null}

              {visible.profiles.length ? (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 px-0.5">
                    <UserRound size={15} className="text-fo-accent" />
                    <h2 className="text-sm font-semibold text-fo-text">
                      Profiles
                    </h2>
                    <span className="text-[11px] text-fo-subtle">
                      ({visible.profiles.length})
                    </span>
                  </div>
                  {visible.profiles.map((profile) => (
                    <Link
                      key={profile.id}
                      to={profilePath(profile.username)}
                      className="flex items-center gap-3 bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-4 transition-colors"
                    >
                      <ProfileAvatar
                        src={profile.avatar}
                        name={profile.name}
                        className="w-10 h-10 rounded-full object-cover border border-fo-border shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fo-text truncate">
                          {profile.name || profile.username}
                        </p>
                        <p className="text-[11px] text-fo-subtle truncate">
                          @{String(profile.username || "").replace(/^@+/, "")}
                        </p>
                        {profile.bio ? (
                          <p className="text-xs text-fo-muted line-clamp-2 mt-1">
                            {profile.bio}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </section>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
          Enter at least 2 characters to search.
        </div>
      )}
    </div>
  );
}
