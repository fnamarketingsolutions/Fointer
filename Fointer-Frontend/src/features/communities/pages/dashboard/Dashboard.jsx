import React, { Suspense, lazy, useEffect } from "react";
import {
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
  LuFolders as Folders,
  LuFileText as FileText,
  LuUserRound as UserRound,
  LuLifeBuoy as LifeBuoy,
} from "react-icons/lu";

import AuthOnly from "../../../../guards/AuthOnly";
import PanelShell from "../../../../shared/layouts/PanelShell";
import { EXPLORE_PATH } from "../../../../shared/constants/paths";

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
const GUEST_TABS = new Set(["postfeed", "communities", "events", "watchgroups"]);

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isGuest = !loading && !user;

  const isRootFeed =
    location.pathname === "/" ||
    location.pathname === EXPLORE_PATH ||
    location.pathname.startsWith("/post/");
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
      return;
    }
    if (tabId === "postfeed") {
      navigate(isGuest ? EXPLORE_PATH : "/");
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
  ].map((item) => ({ ...item, isActive: activeTab === item.id }));

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
    <PanelShell
      navItems={navItems}
      onSelectNav={handleTabSelect}
      homeTo="/"
      profileTo="/profile"
      notificationsTo="/notifications"
      logoutTo="/"
      allowGuest
    >
          <Suspense fallback={pageFallback}>
            <Routes>
                <Route path="/" element={<DashboardFeed />} />
                <Route path={EXPLORE_PATH} element={<DashboardFeed />} />
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
                  element={<CommunityFeed />}
                />
                <Route
                  path="/communities/:communityId"
                  element={<CommunityFeed />}
                />
                <Route path="/communities" element={<JoinedCommunities />} />
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
    </PanelShell>
  );
};

export default Dashboard;