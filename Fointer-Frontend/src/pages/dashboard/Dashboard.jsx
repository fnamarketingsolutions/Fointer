import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { 
  Home,
  Rss, 
  Users, 
  Video, 
  Clock, 
  History, 
  LogOut, 
  HelpCircle, 
  Bell, 
  Mail, 
  Crown,
  X,
  FolderPlus,
  Folders,
  Settings,
} from "lucide-react";

import CreateCommunity from "./UserMenus/CreateCommunity";
import ManageCommunities from "./UserMenus/ManageCommunities";
import ComingSoon from "../../components/ComingSoon";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("create");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200";

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    navigate("/login");
  };

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { id: "create", label: "Create Community", icon: FolderPlus },
    { id: "manage", label: "Manage Communities", icon: Folders },
    { id: "feed", label: "Personalized Feed", icon: Rss },
    { id: "communities", label: "Joined Communities", icon: Users },
    { id: "events", label: "Live Events & Watch Groups", icon: Video },
    { id: "requests", label: "My Join Requests", icon: Clock },
    { id: "activity", label: "My Activity History", icon: History },
  ];

  const comingSoonTitles = {
    create: "Create Community",
    manage: "Manage Communities",
    feed: "Personalized Feed",
    communities: "Joined Communities",
    events: "Live Events & Watch Groups",
    requests: "Join Requests",
    activity: "Activity History",
  };

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
            
          {/* Upper Right Profile Badge */}
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex items-center gap-3 pl-3 border-l border-[#2A241E] focus:outline-none hover:opacity-80 transition-opacity"
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
              {/* Go to Home Link (Top of Menu) */}
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
                      <Icon size={16} className={`shrink-0 ${isActive ? "text-[#D4AF37]" : "text-[#8C8070]"}`} />
                      <span className="truncate whitespace-nowrap">{item.label}</span>
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

          {/* Desktop Bottom Actions */}
          <div className="space-y-4 pt-4 border-t border-[#2A241E]">
            <div className="space-y-1 text-xs text-[#8C8070]">
             
              <button 
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors whitespace-nowrap"
              >
                <LogOut size={15} className="shrink-0" /> <span className="truncate">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Slide-In Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex justify-end">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Right Drawer Container */}
            <aside className="relative w-[75%] max-w-[300px] bg-[#14100D] h-full border-l border-[#2A241E] p-4 flex flex-col justify-between z-10 overflow-y-auto shadow-2xl transition-transform duration-300">
              <div className="space-y-5">
                
                {/* Mobile Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#2A241E]">
                  <div className="flex items-center gap-2.5 truncate">
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
                  </div>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 text-[#A69B8D] hover:text-[#E5E0D8] shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Mobile Navigation Links */}
                <nav className="space-y-1">
                  {/* Go to Home Link (Mobile Menu Top) */}
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
                          <Icon size={16} className={`shrink-0 ${isActive ? "text-[#D4AF37]" : "text-[#8C8070]"}`} />
                          <span className="truncate whitespace-nowrap">{item.label}</span>
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

              {/* Mobile Drawer Bottom Actions */}
              <div className="space-y-3 pt-4 border-t border-[#2A241E] mt-auto">
               
                <div className="space-y-1 text-xs text-[#8C8070]">
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:text-[#E5E0D8] hover:bg-[#1C1612] whitespace-nowrap">
                    <Settings size={15} className="shrink-0" /> <span className="truncate">Settings</span>
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:text-[#E5E0D8] hover:bg-[#1C1612] whitespace-nowrap">
                    <HelpCircle size={15} className="shrink-0" /> <span className="truncate">Support</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 whitespace-nowrap"
                  >
                    <LogOut size={15} className="shrink-0" /> <span className="truncate">Logout</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Right Dynamic Workspace View */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-4rem)] w-full">
          {activeTab === "create" && (
            <ComingSoon title="Create Community" />
            // <CreateCommunity onCreated={() => setActiveTab("manage")} />
          )}
          {activeTab === "manage" && <ComingSoon title="Manage Communities" />}
          {/* {activeTab === "manage" && <ManageCommunities />} */}
          {activeTab !== "create" && activeTab !== "manage" && (
            <ComingSoon title={comingSoonTitles[activeTab] || "This feature"} />
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;