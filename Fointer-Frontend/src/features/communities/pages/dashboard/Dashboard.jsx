import { lazy, useCallback, useEffect, useState } from "react";
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
  LuUserRound as UserRound,
  LuLifeBuoy as LifeBuoy,
  LuShoppingBag as ShoppingBag,
  LuMessageCircle as MessageCircle,
} from "react-icons/lu";

import AuthOnly from "../../../../guards/AuthOnly";
import PanelShell from "../../../../shared/layouts/PanelShell";
import RouteSuspense from "../../../../shared/components/RouteSuspense";
import { PageLoader } from "../../../../shared/components/ThemeSpinner";
import IncomingDmCallBridge from "../../../messages/components/IncomingDmCallBridge";
import { fetchUnreadTotal } from "../../../messages/services/messageService";
import { getLiveSocket } from "../../../../shared/services/liveSocket";
import {
  EXPLORE_PATH,
  FEED_PATH,
  MARKETPLACE_PATH,
  MESSAGES_PATH,
} from "../../../../shared/constants/paths";
import { scrollAppToTop } from "../../../../shared/utils/scroll";
import DashboardFeed from "./DashboardFeed";
/* Primary sidebar tabs — eager so RR7 startTransition does not keep the old page. */
import JoinedCommunities from "./JoinedCommunities";
import ActivityHistory from "./ActivityHistory";
import Support from "./Support";
import Profile from "../../../profile/pages/Profile";
import LiveEvents from "./LiveEvents";
import WatchGroups from "./WatchGroups";
import UserNotifications from "./UserNotifications";
import MarketplaceBrowse from "../../../marketplace/pages/MarketplaceBrowse";
import MessagesInbox from "../../../messages/pages/MessagesInbox";
/* Nested / heavy screens stay lazy; RouteSuspense shows Loading on entry. */
const ManageCommunities = lazy(() => import("./ManageCommunities"));
const ManagePostPage = lazy(() => import("./ManagePostPage"));
const CommunityFeed = lazy(() => import("./CommunityFeed"));
const DeleteMe = lazy(() => import("../../../profile/pages/DeleteMe"));
const PublicProfile = lazy(() => import("../../../profile/pages/PublicProfile"));
const SearchResultsPage = lazy(() => import("../../../search/pages/SearchResultsPage"));
const LiveRoom = lazy(() => import("./LiveRoom"));
const WatchGroupRoom = lazy(() => import("./WatchGroupRoom"));
const ListingDetail = lazy(
  () => import("../../../marketplace/pages/ListingDetail")
);
const MyListings = lazy(() => import("../../../marketplace/pages/MyListings"));
const SponsorListing = lazy(() => import("../../../marketplace/pages/SponsorListing"));
const PromoteSuccess = lazy(() => import("../../../marketplace/pages/PromoteSuccess"));
const SubscriptionPage = lazy(() =>
  import("../../../subscription/pages/SubscriptionPage")
);
const SubscriptionSuccess = lazy(() =>
  import("../../../subscription/pages/SubscriptionSuccess")
);
const ConversationThread = lazy(
  () => import("../../../messages/pages/ConversationThread")
);

const lazyPage = (element) => <RouteSuspense>{element}</RouteSuspense>;

const VALID_TABS = [
  "postfeed",
  "marketplace",
  "messages",
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
  events: "/live-events",
  watchgroups: "/watch-groups",
  activity: "/my-activity",
  support: "/support",
  profile: "/profile",
};

function PostManagementListRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const compose = params.get("compose") === "1";
  return (
    <Navigate
      to={compose ? `${FEED_PATH}?compose=1` : `${FEED_PATH}?mine=1`}
      replace
    />
  );
}

function PostManagementPostRedirect() {
  const { postId } = useParams();
  return <Navigate to={postId ? `/post/${postId}` : FEED_PATH} replace />;
}

function ManageCommunityListRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.delete("tab");
  const qs = params.toString();
  return (
    <Navigate
      to={qs ? `/communities/manage?${qs}` : "/communities/manage"}
      replace
    />
  );
}

function ManageCommunityDetailRedirect() {
  const { communityId } = useParams();
  const location = useLocation();
  return (
    <Navigate
      to={`/communities/manage/${communityId}${location.search}`}
      replace
    />
  );
}

function ManageCommunityPostRedirect() {
  const { communityId, postId } = useParams();
  const location = useLocation();
  return (
    <Navigate
      to={`/communities/manage/${communityId}/posts/${postId}${location.search}`}
      replace
    />
  );
}

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isGuest = !loading && !user;
  const [messagesUnread, setMessagesUnread] = useState(0);

  const refreshMessagesUnread = useCallback(async () => {
    if (!user) {
      setMessagesUnread(0);
      return;
    }
    try {
      const data = await fetchUnreadTotal();
      setMessagesUnread(Number(data?.unreadTotal) || 0);
    } catch {
      /* keep previous */
    }
  }, [user]);

  useEffect(() => {
    refreshMessagesUnread();
  }, [refreshMessagesUnread, location.pathname]);

  useEffect(() => {
    if (!user) return undefined;
    const socket = getLiveSocket();
    if (!socket) return undefined;
    const onChange = () => refreshMessagesUnread();
    socket.on("dm_new", onChange);
    socket.on("dm_unread_changed", onChange);
    return () => {
      socket.off("dm_new", onChange);
      socket.off("dm_unread_changed", onChange);
    };
  }, [user, refreshMessagesUnread]);

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
    location.pathname.startsWith("/communities/") ||
    location.pathname === "/manage-community" ||
    location.pathname.startsWith("/manage-community/");
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

  const requireLogin = (fromPath) => {
    navigate("/login", {
      flushSync: true,
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

    if (location.pathname === targetPath) {
      scrollAppToTop({ smooth: true });
      return;
    }

    // RR7 wraps navigations in startTransition; flushSync so Suspense shows
    // Loading instead of keeping the previous tab painted for seconds.
    navigate(targetPath, { flushSync: true });
  };

  const navItems = [
    { id: "postfeed", label: "Feed", icon: Newspaper },
    { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
    {
      id: "messages",
      label: "Messages",
      icon: MessageCircle,
      badge:
        messagesUnread > 0
          ? messagesUnread > 99
            ? "99+"
            : messagesUnread
          : null,
    },
    { id: "communities", label: "Communities", icon: Users },
    { id: "events", label: "Live Events", icon: Video },
    { id: "watchgroups", label: "Watch Groups", icon: Radio },
    { id: "activity", label: "My Activity History", icon: History },
    { id: "support", label: "Support", icon: LifeBuoy },
    { id: "profile", label: "Profile", icon: UserRound },
  ]
    .filter(() => !isGuest)
    .map((item) => ({ ...item, isActive: activeTab === item.id }));

  if (loading && !isRootFeed) {
    return <PageLoader minHeight="min-h-screen" size="lg" className="bg-fo-bg" />;
  }

  if (!loading && isGuest && location.pathname === FEED_PATH) {
    return <Navigate to={EXPLORE_PATH} replace />;
  }

  return (
    <PanelShell
      navItems={navItems}
      onSelectNav={handleTabSelect}
      homeTo={user ? FEED_PATH : "/"}
      profileTo="/profile"
      notificationsTo="/notifications"
      logoutTo="/"
      allowGuest
    >
      <IncomingDmCallBridge />
      <Routes>
          <Route path={FEED_PATH} element={<DashboardFeed />} />
          <Route path={EXPLORE_PATH} element={<DashboardFeed />} />
          <Route path="/post/:postSlug" element={<DashboardFeed />} />
          <Route
            path="/communities/manage/:communityId/posts/:postId"
            element={
              <AuthOnly>
                {lazyPage(<ManagePostPage />)}
              </AuthOnly>
            }
          />
          <Route
            path="/communities/manage/:communityId"
            element={
              <AuthOnly>
                {lazyPage(<ManageCommunities />)}
              </AuthOnly>
            }
          />
          <Route
            path="/communities/manage"
            element={
              <AuthOnly>
                {lazyPage(<ManageCommunities />)}
              </AuthOnly>
            }
          />
          <Route
            path="/manage-community/:communityId/posts/:postId"
            element={<ManageCommunityPostRedirect />}
          />
          <Route
            path="/manage-community/:communityId"
            element={<ManageCommunityDetailRedirect />}
          />
          <Route
            path="/manage-community"
            element={<ManageCommunityListRedirect />}
          />
          <Route
            path="/post-management/:postId"
            element={<PostManagementPostRedirect />}
          />
          <Route
            path="/post-management"
            element={<PostManagementListRedirect />}
          />
          <Route
            path="/communities/:communityId/posts/:postSlug"
            element={lazyPage(<CommunityFeed />)}
          />
          <Route
            path="/communities/:communityId"
            element={lazyPage(<CommunityFeed />)}
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
          <Route path="/search" element={lazyPage(<SearchResultsPage />)} />
          <Route path="/users/:username" element={lazyPage(<PublicProfile />)} />
          <Route
            path="/profile"
            element={
              <AuthOnly>
                <Profile />
              </AuthOnly>
            }
          />
          <Route
            path="/subscription"
            element={
              <AuthOnly>
                {lazyPage(<SubscriptionPage />)}
              </AuthOnly>
            }
          />
          <Route
            path="/subscription/success"
            element={
              <AuthOnly>
                {lazyPage(<SubscriptionSuccess />)}
              </AuthOnly>
            }
          />
          <Route
            path="/delete-me"
            element={
              <AuthOnly>
                {lazyPage(<DeleteMe />)}
              </AuthOnly>
            }
          />
          <Route
            path="/live-events/:eventId"
            element={
              <AuthOnly>
                {lazyPage(<LiveRoom />)}
              </AuthOnly>
            }
          />
          <Route path="/live-events" element={<LiveEvents />} />
          <Route
            path="/watch-groups/:groupId"
            element={
              <AuthOnly>
                {lazyPage(<WatchGroupRoom />)}
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
                {lazyPage(<MyListings />)}
              </AuthOnly>
            }
          />
          <Route path="/marketplace/promote/success" element={
              <AuthOnly>
                {lazyPage(<PromoteSuccess />)}
              </AuthOnly>
            }
          />
          <Route path="/marketplace/promote/:listingId" element={
              <AuthOnly>
                {lazyPage(<SponsorListing />)}
              </AuthOnly>
            }
          />
          <Route
            path="/marketplace/:listingId"
            element={
              <AuthOnly>
                {lazyPage(<ListingDetail />)}
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
                {lazyPage(<ConversationThread />)}
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
    </PanelShell>
  );
};

export default Dashboard;
