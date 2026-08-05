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
  Home,
  Rss,
  Newspaper,
  Users,
  Video,
  Clock,
  History,
  LogOut,
  Crown,
  X,
  Folders,
  FileText,
  UserRound,
  LifeBuoy,
} from "lucide-react";

import ManageCommunities from "./ManageCommunities";
import ManagePostPage from "./ManagePostPage";
import DashboardPostPage from "./DashboardPostPage";
import DashboardFeed from "./DashboardFeed";
import PostManagement from "../../../posts/pages/PostManagement";
import JoinedCommunities from "./JoinedCommunities";
import JoinRequests from "./JoinRequests";
import ActivityHistory from "./ActivityHistory";
import Support from "./Support";
import ComingSoon from "../../../../shared/components/feedback/ComingSoon";
import Profile from "../../../profile/pages/Profile";

const VALID_TABS = [
  "postfeed",
  "manage",
  "posts",
  "feed",
  "communities",
  "events",
  "requests",
  "activity",
  "support",
  "profile",
];

const comingSoonTitles = {
  manage: "Manage Communities",
  posts: "Post Management",
  feed: "Personalized Feed",
  communities: "Joined Communities",
  events: "Live Events & Watch Groups",
  requests: "Join Requests",
  activity: "Activity History",
  support: "Support",
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const defaultAvatar =
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200";

  const pathAfterDashboard = location.pathname
    .replace(/^\/dashboard\/?/, "")
    .split("/")
    .filter(Boolean);
  const activeTab = VALID_TABS.includes(pathAfterDashboard[0])
    ? pathAfterDashboard[0]
    : "manage";

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
    navigate("/login");
  };

  const handleTabSelect = (tabId) => {
    navigate(`/dashboard/${tabId}`);
    setIsMobileMenuOpen(false);
  };

  const handleProfileOpen = () => {
    navigate("/dashboard/profile");
    setIsMobileMenuOpen(false);
  };

  const handleAvatarClick = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      navigate("/dashboard/profile");
    } else {
      setIsMobileMenuOpen(true);
    }
  };

  const navItems = [
    { id: "postfeed", label: "Feed", icon: Newspaper },
    { id: "manage", label: "Manage Communities", icon: Folders },
    { id: "posts", label: "Post Management", icon: FileText },
    { id: "feed", label: "Personalized Feed", icon: Rss },
    { id: "communities", label: "Joined Communities", icon: Users },
    { id: "events", label: "Live Events & Watch Groups", icon: Video },
    { id: "requests", label: "My Join Requests", icon: Clock },
    { id: "activity", label: "My Activity History", icon: History },
    { id: "support", label: "Support", icon: LifeBuoy },
    { id: "profile", label: "Profile", icon: UserRound },
  ];

  const renderComingSoon = (tab) => (
    <ComingSoon title={comingSoonTitles[tab] || "This feature"} />
  );

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8] font-sans flex flex-col antialiased selection:bg-[#D4AF37] selection:text-black">
      {/* Top Header */}
      <header className="h-16 border-b border-[#2A241E] bg-[#14100D]/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
            <Crown size={18} />
          </div>
          <div className="truncate">
            <div className="text-base sm:text-lg font-semibold text-[#D4AF37] truncate">
              {user?.name || user?.username || "Elite User"}
            </div>
            <div className="text-[10px] text-[#A69B8D] tracking-wider uppercase font-mono">
              {user?.role ? `${user.role} Account` : "Active Member"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={handleAvatarClick}
            className="flex items-center gap-3 pl-3 border-l border-[#2A241E] focus:outline-none hover:opacity-80 transition-opacity"
            title="Open menu"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-[#E5E0D8]">
                {user?.name || user?.username || "Guest User"}
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
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto relative">
        {/* Desktop Left Sidebar */}
        <aside className="w-64 border-r border-[#2A241E] bg-[#14100D] p-4 flex-col justify-between shrink-0 hidden md:flex">
          <div className="space-y-6">
            <nav className="space-y-1">
              <Link
                to="/"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-[#A69B8D] hover:text-[#D4AF37] hover:bg-[#1C1612] transition-all duration-200 border-b border-[#2A241E]/60 mb-2 whitespace-nowrap"
              >
                <Home size={16} className="text-[#8C8070] shrink-0" />
                <span className="truncate">Go to Home</span>
              </Link>

              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-[#251E17] text-[#D4AF37] border-l-2 border-[#D4AF37] shadow-lg shadow-black/20"
                        : "text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1C1612]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-1">
                      <Icon
                        size={16}
                        className={`shrink-0 ${isActive ? "text-[#D4AF37]" : "text-[#8C8070]"}`}
                      />
                      <span className="truncate whitespace-nowrap">
                        {item.label}
                      </span>
                    </div>

                    {item.badge && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded animate-pulse">
                        {item.badge}
                      </span>
                    )}
                    {item.count && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-[#D4AF37]/20 text-[#D4AF37] rounded-full">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#2A241E]">
            <div className="space-y-1 text-xs text-[#8C8070]">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors whitespace-nowrap"
              >
                <LogOut size={15} className="shrink-0" />{" "}
                <span className="truncate">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Slide-In Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex justify-end">
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <aside className="relative w-[70%] max-w-[300px] bg-[#14100D] h-full border-l border-[#2A241E] p-4 flex flex-col justify-between z-10 overflow-y-auto shadow-2xl transition-transform duration-300">
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-[#2A241E]">
                  <button
                    type="button"
                    onClick={handleProfileOpen}
                    className="flex items-center gap-2.5 truncate text-left hover:opacity-80 transition-opacity"
                    title="Open profile"
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
                        {user?.name || user?.username || "Guest User"}
                      </p>
                      <p className="text-[10px] text-[#D4AF37] capitalize font-mono">
                        {user?.role || "Member"}
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

                <nav className="space-y-1">
                  <Link
                    to="/"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-[#A69B8D] hover:text-[#D4AF37] hover:bg-[#1C1612] transition-all border-b border-[#2A241E]/60 mb-2 whitespace-nowrap"
                  >
                    <Home size={16} className="text-[#8C8070] shrink-0" />
                    <span className="truncate">Go to Home</span>
                  </Link>

                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabSelect(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? "bg-[#251E17] text-[#D4AF37] border-l-2 border-[#D4AF37]"
                            : "text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1C1612]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-1">
                          <Icon
                            size={16}
                            className={`shrink-0 ${isActive ? "text-[#D4AF37]" : "text-[#8C8070]"}`}
                          />
                          <span className="truncate whitespace-nowrap">
                            {item.label}
                          </span>
                        </div>
                        {item.badge && (
                          <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded">
                            {item.badge}
                          </span>
                        )}
                        {item.count && (
                          <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-[#D4AF37]/20 text-[#D4AF37] rounded-full">
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#2A241E] mt-auto">
                <div className="space-y-1 text-xs text-[#8C8070]">
                  
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 whitespace-nowrap"
                  >
                    <LogOut size={15} className="shrink-0" />{" "}
                    <span className="truncate">Logout</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Right Dynamic Workspace View */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-4rem)] w-full">
          <Routes>
            <Route index element={<Navigate to="manage" replace />} />
            <Route path="create" element={<Navigate to="/dashboard/manage" replace />} />
            <Route path="manage" element={<ManageCommunities />} />
            <Route
              path="manage/:communityId/posts/:postId"
              element={<ManagePostPage />}
            />
            <Route
              path="manage/:communityId"
              element={<ManageCommunities />}
            />
            <Route path="posts/:postId" element={<DashboardPostPage />} />
            <Route path="posts" element={<PostManagement />} />
            <Route path="postfeed/:postSlug?" element={<DashboardFeed />} />
            <Route path="communities" element={<JoinedCommunities />} />
            <Route path="requests" element={<JoinRequests />} />
            <Route path="support" element={<Support />} />
            <Route path="profile" element={<Profile />} />
            <Route path="feed" element={renderComingSoon("feed")} />
            <Route path="events" element={renderComingSoon("events")} />
            <Route path="activity" element={<ActivityHistory />} />
            <Route path="*" element={<Navigate to="manage" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
