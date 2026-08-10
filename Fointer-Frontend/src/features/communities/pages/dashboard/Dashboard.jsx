import React, { useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "../../../../context/AuthContext";
import {
  Newspaper,
  Users,
  Video,
  Radio,
  History,
  LogOut,
  LogIn,
  Crown,
  X,
  Folders,
  FileText,
  UserRound,
  LifeBuoy,
  UserPlus,
  Menu,
} from "lucide-react";

import ManageCommunities from "./ManageCommunities";
import ManagePostPage from "./ManagePostPage";
import DashboardPostPage from "./DashboardPostPage";
import DashboardFeed from "./DashboardFeed";
import PostManagement from "../../../posts/pages/PostManagement";
import JoinedCommunities from "./JoinedCommunities";
import CommunityFeed from "./CommunityFeed";
import ActivityHistory from "./ActivityHistory";
import Support from "./Support";
import Profile from "../../../profile/pages/Profile";
import LiveEvents from "./LiveEvents";
import LiveRoom from "./LiveRoom";
import WatchGroups from "./WatchGroups";
import WatchGroupRoom from "./WatchGroupRoom";
import AuthOnly from "../../../../guards/AuthOnly";
import AboutHero from "../../../public/pages/about/AboutHero";
import ContactHero from "../../../public/pages/contact/ContactHero";
import HowToUse from "../../../public/pages/policies/HowToUse";
import NetworkUseCase from "../../../public/pages/policies/NetworkUseCase";
import PrivacyPolicy from "../../../public/pages/policies/PrivacyPolicy";
import TermsAndConditions from "../../../public/pages/policies/TermsAndConditions";
import UserAgreement from "../../../public/pages/policies/UserAgreement";
import ContentPolicy from "../../../public/pages/policies/ContentPolicy";
import CookiePolicy from "../../../public/pages/policies/CookiePolicy";
import CodeOfConduct from "../../../public/pages/policies/CodeofConduct";
import { SITE_SEGMENTS } from "../../../../shared/constants/siteLinks";
import SiteLinksFooter from "../../../../shared/components/SiteLinksFooter";

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

  const pathAfterDashboard = location.pathname
    .replace(/^\/dashboard\/?/, "")
    .split("/")
    .filter(Boolean);
  const isRootFeed =
    location.pathname === "/" || location.pathname.startsWith("/post/");
  const firstSegment = isRootFeed
    ? "postfeed"
    : pathAfterDashboard[0] || "postfeed";
  const isStaticPage = SITE_SEGMENTS.has(firstSegment);
  const activeTab = VALID_TABS.includes(firstSegment)
    ? firstSegment
    : isStaticPage
      ? null
      : "postfeed";

  const isFeedRoute = isRootFeed || firstSegment === "postfeed";

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
      requireLogin(`/dashboard/${tabId}`);
      setIsMobileMenuOpen(false);
      return;
    }
    if (tabId === "postfeed") {
      navigate("/");
    } else {
      navigate(`/dashboard/${tabId}`);
    }
    setIsMobileMenuOpen(false);
  };

  const handleProfileOpen = () => {
    if (isGuest) {
      requireLogin("/dashboard/profile");
      setIsMobileMenuOpen(false);
      return;
    }
    navigate("/dashboard/profile");
    setIsMobileMenuOpen(false);
  };

  const handleAvatarClick = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      if (isGuest) requireLogin("/dashboard/profile");
      else navigate("/dashboard/profile");
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
          <div
            className={
              isFeedRoute ? "" : "lg:flex lg:gap-5 lg:items-start"
            }
          >
            <div className="min-w-0 flex-1">
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
                      <Navigate to="/dashboard/manage" replace />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/manage"
                  element={
                    <AuthOnly>
                      <ManageCommunities />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/manage/:communityId/posts/:postId"
                  element={
                    <AuthOnly>
                      <ManagePostPage />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/manage/:communityId"
                  element={
                    <AuthOnly>
                      <ManageCommunities />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/posts/:postId"
                  element={
                    <AuthOnly>
                      <DashboardPostPage />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/posts"
                  element={
                    <AuthOnly>
                      <PostManagement />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/feed/*"
                  element={
                    <Navigate to="/?mode=personalized" replace />
                  }
                />
                <Route
                  path="/dashboard/communities/:communityId/posts/:postSlug"
                  element={
                    <AuthOnly>
                      <CommunityFeed />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/communities/:communityId"
                  element={
                    <AuthOnly>
                      <CommunityFeed />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/communities"
                  element={
                    <AuthOnly>
                      <JoinedCommunities />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/requests"
                  element={<Navigate to="/dashboard/communities" replace />}
                />
                <Route
                  path="/dashboard/support"
                  element={
                    <AuthOnly>
                      <Support />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/profile"
                  element={
                    <AuthOnly>
                      <Profile />
                    </AuthOnly>
                  }
                />
                <Route
                  path="/dashboard/events/:eventId"
                  element={
                    <AuthOnly>
                      <LiveRoom />
                    </AuthOnly>
                  }
                />
                <Route path="/dashboard/events" element={<LiveEvents />} />
                <Route
                  path="/dashboard/watchgroups/:groupId"
                  element={
                    <AuthOnly>
                      <WatchGroupRoom />
                    </AuthOnly>
                  }
                />
                <Route path="/dashboard/watchgroups" element={<WatchGroups />} />
                <Route
                  path="/dashboard/activity"
                  element={
                    <AuthOnly>
                      <ActivityHistory />
                    </AuthOnly>
                  }
                />
                <Route path="/dashboard/about" element={<AboutHero />} />
                <Route path="/dashboard/contact-us" element={<ContactHero />} />
                <Route path="/dashboard/how-to-use" element={<HowToUse />} />
                <Route
                  path="/dashboard/code-of-conduct"
                  element={<CodeOfConduct />}
                />
                <Route
                  path="/dashboard/network-use-cases"
                  element={<NetworkUseCase />}
                />
                <Route
                  path="/dashboard/privacy-policy"
                  element={<PrivacyPolicy />}
                />
                <Route
                  path="/dashboard/terms-and-conditions"
                  element={<TermsAndConditions />}
                />
                <Route
                  path="/dashboard/user-agreement"
                  element={<UserAgreement />}
                />
                <Route
                  path="/dashboard/content-policy"
                  element={<ContentPolicy />}
                />
                <Route
                  path="/dashboard/cookie-policy"
                  element={<CookiePolicy />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>

            {!isFeedRoute ? (
              <aside className="hidden lg:block w-72 shrink-0 lg:sticky lg:top-4">
                <SiteLinksFooter activeSegment={firstSegment} />
              </aside>
            ) : null}
          </div>

          {!isFeedRoute ? (
            <div className="lg:hidden mt-8 pt-4 border-t border-[#2A241E]">
              <SiteLinksFooter activeSegment={firstSegment} />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
