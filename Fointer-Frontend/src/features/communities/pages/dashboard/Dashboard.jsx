import React, { Suspense, lazy, useEffect } from "react";
import {
  useNavigate,
  useLocation,
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
  LuShoppingBag as ShoppingBag,
  LuMessageCircle as MessageCircle,
} from "react-icons/lu";

import AuthOnly from "../../../../guards/AuthOnly";
import PanelShell from "../../../../shared/layouts/PanelShell";
import {
  EXPLORE_PATH,
  FEED_PATH,
  MARKETPLACE_PATH,
  MESSAGES_PATH,
} from "../../../../shared/constants/paths";
import DashboardFeed from "./DashboardFeed";
const ManageCommunities = lazy(() => import("./ManageCommunities"));
const ManagePostPage = lazy(() => import("./ManagePostPage"));
const DashboardPostPage = lazy(() => import("./DashboardPostPage"));
const PostManagement = lazy(() => import("../../../posts/pages/PostManagement"));
const JoinedCommunities = lazy(() => import("./JoinedCommunities"));
const CommunityFeed = lazy(() => import("./CommunityFeed"));
const ActivityHistory = lazy(() => import("./ActivityHistory"));
const Support = lazy(() => import("./Support"));
const Profile = lazy(() => import("../../../profile/pages/Profile"));
const PublicProfile = lazy(() => import("../../../profile/pages/PublicProfile"));
const SearchResultsPage = lazy(() => import("../../../search/pages/SearchResultsPage"));
const LiveEvents = lazy(() => import("./LiveEvents"));
const LiveRoom = lazy(() => import("./LiveRoom"));
const WatchGroups = lazy(() => import("./WatchGroups"));
const WatchGroupRoom = lazy(() => import("./WatchGroupRoom"));
const UserNotifications = lazy(() => import("./UserNotifications"));
const MarketplaceBrowse = lazy(
  () => import("../../../marketplace/pages/MarketplaceBrowse")
);
const ListingDetail = lazy(
  () => import("../../../marketplace/pages/ListingDetail")
);
const MyListings = lazy(() => import("../../../marketplace/pages/MyListings"));
const MessagesInbox = lazy(
  () => import("../../../messages/pages/MessagesInbox")
);
const ConversationThread = lazy(
  () => import("../../../messages/pages/ConversationThread")
);

const pageFallback = (
  <div className="min-h-[30vh] flex items-center justify-center text-fo-muted text-sm">
    Loading...
  </div>
);

const VALID_TABS = [
  "postfeed",
  "marketplace",
  "messages",
  "manage",
  "posts",
  "communities",
  "events",
  "watchgroups",
  "activity",
  "support",
  "profile",
];

const TAB_PATHS = {
  postfeed: FEED_PATH,
  marketplace: MARKETPLACE_PATH,
  messages: MESSAGES_PATH,
  communities: "/communities",
  manage: "/manage-community",
  posts: "/post-management",
  events: "/live-events",
  watchgroups: "/watch-groups",
  activity: "/my-activity",
  support: "/support",
  profile: "/profile",
};

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isGuest = !loading && !user;

  const isRootFeed =
    location.pathname === FEED_PATH ||
    location.pathname === EXPLORE_PATH ||
    location.pathname.startsWith("/post/");
  const isMarketplace =
    location.pathname === MARKETPLACE_PATH ||
    location.pathname.startsWith("/marketplace/");
  const isMessages =
    location.pathname === MESSAGES_PATH ||
    location.pathname.startsWith("/messages/");
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

  const firstSegment = isRootFeed
    ? "postfeed"
    : isMarketplace
      ? "marketplace"
      : isMessages
        ? "messages"
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
                    : "postfeed";

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
    const targetPath =
      tabId === "postfeed"
        ? isGuest
          ? EXPLORE_PATH
          : FEED_PATH
        : TAB_PATHS[tabId] || (isGuest ? EXPLORE_PATH : FEED_PATH);

    if (isGuest) {
      requireLogin(targetPath);
      return;
    }

    navigate(targetPath);
  };

  const navItems = [
    { id: "postfeed", label: "Feed", icon: Newspaper },
    { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
    { id: "messages", label: "Messages", icon: MessageCircle },
    { id: "communities", label: "Communities", icon: Users },
    { id: "manage", label: "Manage Communities", icon: Folders },
    { id: "posts", label: "Post Management", icon: FileText },
    { id: "events", label: "Live Events", icon: Video },
    { id: "watchgroups", label: "Watch Groups", icon: Radio },
    { id: "activity", label: "My Activity History", icon: History },
    { id: "support", label: "Support", icon: LifeBuoy },
    { id: "profile", label: "Profile", icon: UserRound },
  ]
    .filter((item) => !isGuest)
    .map((item) => ({ ...item, isActive: activeTab === item.id }));

  if (loading && !isRootFeed) {
    return (
      <div className="min-h-screen bg-fo-bg flex items-center justify-center text-fo-muted text-sm">
        Loading…
      </div>
    );
  }

  if (!loading && isGuest && location.pathname === FEED_PATH) {
    return <Navigate to={EXPLORE_PATH} replace />;
  }

  if (!loading && user?.role === "admin") {
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
          <Route path={FEED_PATH} element={<DashboardFeed />} />
          <Route path={EXPLORE_PATH} element={<DashboardFeed />} />
          <Route path="/post/:postSlug" element={<DashboardFeed />} />
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
            path="/communities/:communityId/posts/:postSlug"
            element={<CommunityFeed />}
          />
          <Route
            path="/communities/:communityId"
            element={<CommunityFeed />}
          />
          <Route path="/communities" element={<JoinedCommunities />} />
          <Route
            path="/support"
            element={
              <AuthOnly>
                <Support />
              </AuthOnly>
            }
          />
          <Route
            path="/notifications"
            element={
              <AuthOnly>
                <UserNotifications />
              </AuthOnly>
            }
          />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/users/:username" element={<PublicProfile />} />
          <Route
            path="/profile"
            element={
              <AuthOnly>
                <Profile />
              </AuthOnly>
            }
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
            path="/watch-groups/:groupId"
            element={
              <AuthOnly>
                <WatchGroupRoom />
              </AuthOnly>
            }
          />
          <Route path="/watch-groups" element={<WatchGroups />} />
          <Route path={MARKETPLACE_PATH} element={
              <AuthOnly>
                <MarketplaceBrowse />
              </AuthOnly>
            }
          />
          <Route path="/marketplace/my-listings" element={
              <AuthOnly>
                <MyListings />
              </AuthOnly>
            }
          />
          <Route
            path="/marketplace/:listingId"
            element={
              <AuthOnly>
                <ListingDetail />
              </AuthOnly>
            }
          />
          <Route
            path={MESSAGES_PATH}
            element={
              <AuthOnly>
                <MessagesInbox />
              </AuthOnly>
            }
          />
          <Route
            path="/messages/:conversationId"
            element={
              <AuthOnly>
                <ConversationThread />
              </AuthOnly>
            }
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
            path="*"
            element={
              <Navigate to={isGuest ? EXPLORE_PATH : FEED_PATH} replace />
            }
          />
        </Routes>
      </Suspense>
    </PanelShell>
  );
};

export default Dashboard;
