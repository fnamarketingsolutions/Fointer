import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LuFileText as FileText,
  LuLoaderCircle as Loader2,
  LuSearch as Search,
  LuUserRound as UserRound,
  LuUsers as Users,
} from "react-icons/lu";
import { globalSearch } from "../../api/search";
import ProfileAvatar from "./ProfileAvatar";
import { useAuth } from "../../context/AuthContext";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { communitySegment, postSegment } from "../services/entityLinks";
import { userProfilePath } from "../services/profileLinks";

const MIN_QUERY = 2;
const PREVIEW_LIMIT = 5;

function ResultSection({ title, icon: Icon, children }) {
  if (!children) return null;
  return (
    <div className="py-2">
      <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fo-subtle">
        <Icon size={12} className="text-fo-accent" />
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function HeaderSearch({ className = "" }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const rootRef = useRef(null);

  const profilePath = (username) => userProfilePath(username, user);

  const postPath = (post) => {
    const seg = postSegment(post) || post.id;
    return `/post/${seg}`;
  };

  const communityPath = (community) => {
    const seg = communitySegment(community) || community.id;
    return `/communities/${seg}`;
  };

  const goToFullSearch = useCallback(
    (value) => {
      const q = String(value || query).trim();
      if (q.length < MIN_QUERY) return;
      setOpen(false);
      navigate(`/search?q=${encodeURIComponent(q)}`);
    },
    [navigate, query]
  );

  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY) {
      setResults(null);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    globalSearch({ q: debouncedQuery, limit: PREVIEW_LIMIT })
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
  }, [debouncedQuery]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const posts = results?.posts || [];
  const communities = results?.communities || [];
  const profiles = results?.profiles || [];
  const hasResults = posts.length + communities.length + profiles.length > 0;
  const showDropdown =
    open && debouncedQuery.length >= MIN_QUERY && (loading || hasResults || error);

  const handleSubmit = (e) => {
    e.preventDefault();
    goToFullSearch(query);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search posts, communities, profiles…"
          className="w-full bg-fo-bg border border-fo-border rounded-lg pl-9 pr-3 py-2 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
          aria-label="Search"
          autoComplete="off"
        />
      </form>

      {showDropdown ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-fo-surface border border-fo-border rounded-xl shadow-2xl overflow-hidden max-h-[min(420px,70vh)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-fo-subtle">
              <Loader2 size={14} className="animate-spin text-fo-accent" />
              Searching…
            </div>
          ) : error ? (
            <p className="px-3 py-4 text-xs text-red-400">{error}</p>
          ) : !hasResults ? (
            <p className="px-3 py-4 text-xs text-fo-subtle">No results found.</p>
          ) : (
            <>
              <ResultSection title="Posts" icon={FileText}>
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    to={postPath(post)}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 hover:bg-fo-surface-hover transition-colors"
                  >
                    <p className="text-xs font-medium text-fo-text line-clamp-1">
                      {post.title || "Untitled post"}
                    </p>
                    <p className="text-[10px] text-fo-subtle line-clamp-1 mt-0.5">
                      {post.community?.name || "Public"}
                      {post.author?.name ? ` · ${post.author.name}` : ""}
                    </p>
                  </Link>
                ))}
              </ResultSection>

              <ResultSection title="Communities" icon={Users}>
                {communities.map((community) => (
                  <Link
                    key={community.id}
                    to={communityPath(community)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-fo-surface-hover transition-colors"
                  >
                    {community.coverImage ? (
                      <img
                        src={community.coverImage}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover border border-fo-border shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[#1A1510] border border-fo-border flex items-center justify-center text-fo-accent text-xs font-bold shrink-0">
                        {(community.name || "C").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-fo-text truncate">
                        {community.name}
                      </p>
                      {community.tags?.length ? (
                        <p className="text-[10px] text-fo-subtle truncate">
                          {community.tags.slice(0, 3).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </ResultSection>

              <ResultSection title="Profiles" icon={UserRound}>
                {profiles.map((profile) => (
                  <Link
                    key={profile.id}
                    to={profilePath(profile.username)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-fo-surface-hover transition-colors"
                  >
                    <ProfileAvatar
                      src={profile.avatar}
                      name={profile.name}
                      className="w-8 h-8 rounded-full object-cover border border-fo-border shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-fo-text truncate">
                        {profile.name || profile.username}
                      </p>
                      <p className="text-[10px] text-fo-subtle truncate">
                        @{String(profile.username || "").replace(/^@+/, "")}
                      </p>
                    </div>
                  </Link>
                ))}
              </ResultSection>
            </>
          )}

          {debouncedQuery.length >= MIN_QUERY && !loading ? (
            <button
              type="button"
              onClick={() => goToFullSearch(debouncedQuery)}
              className="w-full px-3 py-2.5 text-xs font-semibold text-fo-accent border-t border-fo-border hover:bg-fo-surface-hover transition-colors text-left"
            >
              View all results for “{debouncedQuery}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
