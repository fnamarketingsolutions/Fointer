import React, { Suspense, lazy, useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useParams,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import {
  LuNewspaper as Newspaper,
  LuUsers as Users,
  LuVideo as Video,
  LuRadio as Radio,
  LuHistory as History,
  LuLogOut as LogOut,
  LuLogIn as LogIn,
  LuCrown as Crown,
  LuX as X,
  LuFolders as Folders,
  LuFileText as FileText,
  LuUserRound as UserRound,
  LuLifeBuoy as LifeBuoy,
  LuUserPlus as UserPlus,
  LuMenu as Menu,
  LuBell as Bell,
} from "react-icons/lu";

import AuthOnly from "../../../../guards/AuthOnly";

const ManageCommunities = lazy(() => import("./ManageCommunities"));
const ManagePostPage = lazy(() => import("./ManagePostPage"));
const DashboardPostPage = lazy(() => import("./DashboardPostPage"));
const DashboardFeed = lazy(() => import("./DashboardFeed"));
const PostManagement = lazy(() => import("../../../posts/pages/PostManagement"));
const JoinedCommunities = lazy(() => import("./JoinedCommunities"));
const CommunityFeed = lazy(() => import("./CommunityFeed"));
const ActivityHistory = lazy(() => import("./ActivityHistory"));
const Support = lazy(() => import("./Support"));
const Profile = lazy(() => import("../../../profile/pages/Profile"));
const LiveEvents = lazy(() => import("./LiveEvents"));
const LiveRoom = lazy(() => import("./LiveRoom"));
const WatchGroups = lazy(() => import("./WatchGroups"));
const WatchGroupRoom = lazy(() => import("./WatchGroupRoom"));
const UserNotifications = lazy(() => import("./UserNotifications"));

const pageFallback = (
  <div className="min-h-[30vh] flex items-center justify-center text-[#A69B8D] text-sm">
    Loading...
  </div>
);

function LegacyCommunitiesRedirect() {
  const { "*": rest } = useParams();
  const location = useLocation();
  const suffix = rest ? `/${rest}` : "";
  return (
    <Navigate
      to={`/communities${suffix}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacyManageRedirect() {
  const { "*": rest } = useParams();
  const location = useLocation();
  const suffix = rest ? `/${rest}` : "";
  return (
    <Navigate
      to={`/manage-community${suffix}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacyPostsRedirect() {
  const { "*": rest } = useParams();
  const location = useLocation();
  const suffix = rest ? `/${rest}` : "";
  return (
    <Navigate
      to={`/post-management${suffix}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacyEventsRedirect() {
  const { "*": rest } = useParams();
  const location = useLocation();
  const suffix = rest ? `/${rest}` : "";
  return (
    <Navigate
      to={`/live-events${suffix}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacyWatchGroupsRedirect() {
  const { "*": rest } = useParams();
  const location = useLocation();
  const suffix = rest ? `/${rest}` : "";
  return (
    <Navigate
      to={`/watch-groups${suffix}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacyActivityRedirect() {
  const { "*": rest } = useParams();
  const location = useLocation();
  const suffix = rest ? `/${rest}` : "";
  return (
    <Navigate
      to={`/my-activity${suffix}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacySupportRedirect() {
  const { "*": rest } = useParams();
  const location = useLocation();
  const suffix = rest ? `/${rest}` : "";
  return (
    <Navigate
      to={`/support${suffix}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacyProfileRedirect() {
  const { "*": rest } = useParams();
  const location = useLocation();
  const suffix = rest ? `/${rest}` : "";
  return (
    <Navigate
      to={`/profile${suffix}${location.search}${location.hash}`}
      replace
    />
  );
}

function LegacyNotificationsRedirect() {
  const { "*": rest } = useParams();
  const location = useLocation();
  const suffix = rest ? `/${rest}` : "";
  return (
    <Navigate
      to={`/notifications${suffix}${location.search}${location.hash}`}
      replace
    />
  );
}

const VALID_TABS = [
  "postfeed",
  "manage",
  "posts",
  "communities",
  "events",
  "watchgroups",
  "activity",
  "support",
  "profile",
];

/** Tabs guests may open without logging in (view-only where noted). */
const GUEST_TABS = new Set(["postfeed", "events", "watchgroups"]);

const Dashboard = () => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isGuest = !loading && !user;

  const defaultAvatar =
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200";

  const isRootFeed =
    location.pathname === "/" || location.pathname.startsWith("/post/");
  const isCommunities =
    location.pathname === "/communities" ||
    location.pathname.startsWith("/communities/");
  const isManage =
    location.pathname === "/manage-community" ||
    location.pathname.startsWith("/manage-community/");
  const isPostManagement =
    location.pathname === "/post-management" ||
    location.pathname.startsWith("/post-management/");
  const isLiveEvents =
    location.pathname === "/live-events" ||
    location.pathname.startsWith("/live-events/");
  const isWatchGroups =
    location.pathname === "/watch-groups" ||
    location.pathname.startsWith("/watch-groups/");
  const isMyActivity =
    location.pathname === "/my-activity" ||
    location.pathname.startsWith("/my-activity/");
  const isSupport =
    location.pathname === "/support" ||
    location.pathname.startsWith("/support/");
  const isProfile =
    location.pathname === "/profile" ||
    location.pathname.startsWith("/profile/");
  const pathAfterDashboard = location.pathname
    .replace(/^\/dashboard\/?/, "")
    .split("/")
    .filter(Boolean);
  const firstSegment = isRootFeed
    ? "postfeed"
    : isCommunities
      ? "communities"
      : isManage
        ? "manage"
        : isPostManagement
          ? "posts"
          : isLiveEvents
            ? "events"
            : isWatchGroups
              ? "watchgroups"
              : isMyActivity
                ? "activity"
                : isSupport
                  ? "support"
                  : isProfile
                    ? "profile"
                    : pathAfterDashboard[0] || "postfeed";
  const activeTab = VALID_TABS.includes(firstSegment)
    ? firstSegment
    : "postfeed";

  useEffect(() => {
    if (user?.role === "admin") {
      navigate("/admin", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    navigate("/");
  };

  const requireLogin = (fromPath) => {
    navigate("/login", {
      state: { from: fromPath || location.pathname },
    });
  };

  const handleTabSelect = (tabId) => {
    if (isGuest && !GUEST_TABS.has(tabId)) {
      const loginFrom =
        tabId === "communities"
          ? "/communities"
          : tabId === "manage"
            ? "/manage-community"
            : tabId === "posts"
              ? "/post-management"
              : tabId === "events"
                ? "/live-events"
                : tabId === "watchgroups"
                  ? "/watch-groups"
                  : tabId === "activity"
                    ? "/my-activity"
                    : tabId === "support"
                      ? "/support"
                      : tabId === "profile"
                        ? "/profile"
                        : `/dashboard/${tabId}`;
      requireLogin(loginFrom);
      setIsMobileMenuOpen(false);
      return;
    }
    if (tabId === "postfeed") {
      navigate("/");
    } else if (tabId === "communities") {
      navigate("/communities");
    } else if (tabId === "manage") {
      navigate("/manage-community");
    } else if (tabId === "posts") {
      navigate("/post-management");
    } else if (tabId === "events") {
      navigate("/live-events");
    } else if (tabId === "watchgroups") {
      navigate("/watch-groups");
    } else if (tabId === "activity") {
      navigate("/my-activity");
    } else if (tabId === "support") {
      navigate("/support");
    } else if (tabId === "profile") {
      navigate("/profile");
    } else {
      navigate(`/dashboard/${tabId}`);
    }
    setIsMobileMenuOpen(false);
  };

  const handleProfileOpen = () => {
    if (isGuest) {
      requireLogin("/profile");
      setIsMobileMenuOpen(false);
      return;
    }
    navigate("/profile");
    setIsMobileMenuOpen(false);
  };

  const handleAvatarClick = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      if (isGuest) requireLogin("/profile");
      else navigate("/profile");
    } else {
      setIsMobileMenuOpen(true);
    }
  };

  const navItems = [
    { id: "postfeed", label: "Feed", icon: Newspaper },
    { id: "communities", label: "Communities", icon: Users },
    { id: "manage", label: "Manage Communities", icon: Folders },
    { id: "posts", label: "Post Management", icon: FileText },
    { id: "events", label: "Live Events", icon: Video },
    { id: "watchgroups", label: "Watch Groups", icon: Radio },
    { id: "activity", label: "My Activity History", icon: History },
    { id: "support", label: "Support", icon: LifeBuoy },
    { id: "profile", label: "Profile", icon: UserRound },
  ];

  const renderNav = (mobile = false) =>
    navItems.map((item) => {
      const Icon = item.icon;
      const isActive = activeTab === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => handleTabSelect(item.id)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            isActive
              ? `bg-[#251E17] text-[#D4AF37] border-l-2 border-[#D4AF37] ${
                  mobile ? "" : "shadow-lg shadow-black/20"
                }`
              : "text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1C1612]"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-1">
            <Icon
              size={16}
              className={`shrink-0 ${isActive ? "text-[#D4AF37]" : "text-[#8C8070]"}`}
            />
            <span className="truncate whitespace-nowrap">{item.label}</span>
          </div>
        </button>
      );
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0C0A] flex items-center justify-center text-[#A69B8D] text-sm">
        Loading…
      </div>
    );
  }

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8] font-sans flex flex-col antialiased selection:bg-[#D4AF37] selection:text-black">
      <header className="h-16 border-b border-[#2A241E] bg-[#14100D]/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0"
          >
            <Crown size={18} />
          </Link>
          <div className="truncate">
            <div className="text-base sm:text-lg font-semibold text-[#D4AF37] truncate">
              {user?.name || user?.username || "Fointer"}
            </div>
            <div className="text-[10px] text-[#A69B8D] tracking-wider uppercase font-mono">
              {user?.role ? `${user.role} Account` : "Browse as guest"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {isGuest ? (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                state={{ from: location.pathname }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2A241E] text-xs font-semibold text-[#E5E0D8] hover:border-[#D4AF37]/40 hover:text-[#D4AF37]"
              >
                <LogIn size={14} /> Log in
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold hover:bg-[#e0c04a]"
              >
                <UserPlus size={14} /> Sign up
              </Link>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37]"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/notifications")}
                className={`p-2 rounded-lg border transition-colors ${
                  location.pathname === "/notifications" ||
                  location.pathname.startsWith("/notifications/")
                    ? "border-[#D4AF37]/40 text-[#D4AF37] bg-[#D4AF37]/10"
                    : "border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40"
                }`}
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell size={16} />
              </button>
              <button
                type="button"
                onClick={handleAvatarClick}
                className="flex items-center gap-3 pl-3 border-l border-[#2A241E] focus:outline-none hover:opacity-80 transition-opacity"
                title="Open menu"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-[#E5E0D8]">
                    {user?.name || user?.username || "User"}
                  </p>
                  <p className="text-[10px] text-[#D4AF37] capitalize font-mono">
                    {user?.role || "Member"}
                  </p>
                </div>
                <img
                  src={user?.avatar || defaultAvatar}
                  alt={user?.name || "Avatar"}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = defaultAvatar;
                  }}
                  className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]/50 shrink-0"
                />
              </button>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37]"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex max-w-[1600px] w-full mx-auto relative">
        <aside className="w-64 border-r border-[#2A241E] bg-[#14100D] p-4 flex-col justify-between shrink-0 hidden md:flex max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="space-y-6">
            <nav className="space-y-1">{renderNav(false)}</nav>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#2A241E] mt-4">
            {isGuest ? (
              <div className="space-y-2">
                <Link
                  to="/signup"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold"
                >
                  <UserPlus size={14} /> Sign up
                </Link>
                <Link
                  to="/login"
                  state={{ from: location.pathname }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#2A241E] text-xs text-[#E5E0D8] hover:text-[#D4AF37]"
                >
                  <LogIn size={14} /> Log in
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors whitespace-nowrap text-xs"
              >
                <LogOut size={15} className="shrink-0" />
                <span className="truncate">Logout</span>
              </button>
            )}
          </div>
        </aside>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex justify-end">
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <aside className="relative w-[70%] max-w-[300px] bg-[#14100D] h-full border-l border-[#2A241E] p-4 flex flex-col justify-between z-10 overflow-y-auto shadow-2xl">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-[#2A241E]">
                  <button
                    type="button"
                    onClick={handleProfileOpen}
                    className="flex items-center gap-2.5 truncate text-left hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={user?.avatar || defaultAvatar}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = defaultAvatar;
                      }}
                      className="w-9 h-9 rounded-full object-cover border border-[#D4AF37]/50 shrink-0"
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold text-[#E5E0D8] truncate">
                        {user?.name || user?.username || "Guest"}
                      </p>
                      <p className="text-[10px] text-[#D4AF37] capitalize font-mono">
                        {user?.role || "Browse"}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 text-[#A69B8D] hover:text-[#E5E0D8] shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                <nav className="space-y-1">{renderNav(true)}</nav>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#2A241E] mt-auto">
                {isGuest ? (
                  <>
                    <Link
                      to="/signup"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold"
                    >
                      Sign up
                    </Link>
                    <Link
                      to="/login"
                      state={{ from: location.pathname }}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#2A241E] text-xs"
                    >
                      Log in
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 whitespace-nowrap text-xs"
                  >
                    <LogOut size={15} className="shrink-0" />
                    <span className="truncate">Logout</span>
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-4rem)] w-full">
          <Suspense fallback={pageFallback}>
            <Routes>
                <Route path="/" element={<DashboardFeed />} />
                <Route path="/post/:postSlug" element={<DashboardFeed />} />
                <Route
                  path="/dashboard"
                  element={<Navigate to="/" replace />}
                />
                <Route
                  path="/dashboard/create"
                  element={
                    <AuthOnly>
                      <Navigate to="/manage-community" replace />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/manage-community/:communityId/posts/:postId"
                  element={
                    <AuthOnly>
                      <ManagePostPage />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/manage-community/:communityId"
                  element={
                    <AuthOnly>
                      <ManageCommunities />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/manage-community"
                  element={
                    <AuthOnly>
                      <ManageCommunities />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/manage/*"
                  element={<LegacyManageRedirect />}
                />
                <Route
                  path="/dashboard/manage"
                  element={<Navigate to="/manage-community" replace />}
                />
                <Route
                  path="/post-management/:postId"
                  element={
                    <AuthOnly>
                      <DashboardPostPage />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/post-management"
                  element={
                    <AuthOnly>
                      <PostManagement />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/posts/*"
                  element={<LegacyPostsRedirect />}
                />
                <Route
                  path="/dashboard/posts"
                  element={<Navigate to="/post-management" replace />}
                />
                <Route
                  path="/dashboard/feed/*"
                  element={
                    <Navigate to="/?mode=personalized" replace />
                  }
                />
                <Route
                  path="/communities/:communityId/posts/:postSlug"
                  element={
                    <AuthOnly>
                      <CommunityFeed />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/communities/:communityId"
                  element={
                    <AuthOnly>
                      <CommunityFeed />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/communities"
                  element={
                    <AuthOnly>
                      <JoinedCommunities />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/communities/*"
                  element={<LegacyCommunitiesRedirect />}
                />
                <Route
                  path="/dashboard/communities"
                  element={<Navigate to="/communities" replace />}
                />
                <Route
                  path="/dashboard/requests"
                  element={<Navigate to="/communities" replace />}
                />
                <Route
                  path="/support"
                  element={
                    <AuthOnly>
                      <Support />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/support/*"
                  element={<LegacySupportRedirect />}
                />
                <Route
                  path="/dashboard/support"
                  element={<Navigate to="/support" replace />}
                />
                <Route
                  path="/notifications"
                  element={
                    <AuthOnly>
                      <UserNotifications />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/notifications/*"
                  element={<LegacyNotificationsRedirect />}
                />
                <Route
                  path="/dashboard/notifications"
                  element={<Navigate to="/notifications" replace />}
                />
                <Route
                  path="/profile"
                  element={
                    <AuthOnly>
                      <Profile />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/profile/*"
                  element={<LegacyProfileRedirect />}
                />
                <Route
                  path="/dashboard/profile"
                  element={<Navigate to="/profile" replace />}
                />
                <Route
                  path="/live-events/:eventId"
                  element={
                    <AuthOnly>
                      <LiveRoom />
                    </AuthOnly>
                  }
                />
                <Route path="/live-events" element={<LiveEvents />} />
                <Route
                  path="/dashboard/events/*"
                  element={<LegacyEventsRedirect />}
                />
                <Route
                  path="/dashboard/events"
                  element={<Navigate to="/live-events" replace />}
                />
                <Route
                  path="/watch-groups/:groupId"
                  element={
                    <AuthOnly>
                      <WatchGroupRoom />
                    </AuthOnly>
                  }
                />
                <Route path="/watch-groups" element={<WatchGroups />} />
                <Route
                  path="/dashboard/watchgroups/*"
                  element={<LegacyWatchGroupsRedirect />}
                />
                <Route
                  path="/dashboard/watchgroups"
                  element={<Navigate to="/watch-groups" replace />}
                />
                <Route
                  path="/my-activity"
                  element={
                    <AuthOnly>
                      <ActivityHistory />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/activity/*"
                  element={<LegacyActivityRedirect />}
                />
                <Route
                  path="/dashboard/activity"
                  element={<Navigate to="/my-activity" replace />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;