import React, { useState } from "react";
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  MessageSquare, 
  Heart, 
  UserPlus, 
  ShieldAlert, 
  Crown, 
  Filter,
  ArrowLeft
} from "lucide-react";

export default function UserNotifications({ user, onBack }) {
  const [filter, setFilter] = useState("all");

  // Default back handler if no prop is provided
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  // Sample notification state
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "mention",
      icon: MessageSquare,
      iconColor: "text-[#D4AF37]",
      title: "Alexander Sterling mentioned you in a post",
      description: '"@' + (user?.username || "user") + ' thoughts on the upcoming rate cuts and liquidity shifts?"',
      time: "10 mins ago",
      isUnread: true,
      community: "Alpha Venture Group",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200"
    },
    {
      id: 2,
      type: "like",
      icon: Heart,
      iconColor: "text-rose-500",
      title: "Elena Rostova liked your comment",
      description: '"Agreed on the macroeconomic rates assessment..."',
      time: "1 hour ago",
      isUnread: true,
      community: "Crypto Strategy Lab",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200"
    },
    {
      id: 3,
      type: "access",
      icon: UserPlus,
      iconColor: "text-emerald-400",
      title: "Join request approved!",
      description: "You have been granted access to Web3 Founders Syndicate.",
      time: "3 hours ago",
      isUnread: false,
      community: "Web3 Founders Syndicate",
      avatar: null
    },
    {
      id: 4,
      type: "system",
      icon: Crown,
      iconColor: "text-[#D4AF37]",
      title: "Elite Status Activated",
      description: "Your account privileges have been elevated to Verified Elite Member.",
      time: "Yesterday",
      isUnread: false,
      community: "System Notice",
      avatar: null
    }
  ]);

  // Mark all as read
  const handleMarkAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isUnread: false }))
    );
  };

  // Clear single notification
  const handleDeleteNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Toggle single read status
  const toggleReadStatus = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isUnread: !n.isUnread } : n))
    );
  };

  // Filtered notifications logic
  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return n.isUnread;
    if (filter === "mentions") return n.type === "mention";
    if (filter === "system") return n.type === "system" || n.type === "access";
    return true;
  });

  const unreadCount = notifications.filter((n) => n.isUnread).length;

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-[#E5E0D8] p-4 md:p-8 font-sans selection:bg-[#D4AF37] selection:text-black">
      <div className="space-y-6 max-w-4xl mx-auto">
        
        {/* Header Section with Back Arrow */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A241E] pb-5">
          <div className="flex items-center gap-4">
            {/* Back Button */}
            <button
              onClick={handleBack}
              title="Go Back"
              className="p-2.5 rounded-xl bg-[#14100D] border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/50 hover:bg-[#1C1612] transition-all group"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-[#E5E0D8]">
                  Notifications
                </h1>
                {unreadCount > 0 && (
                  <span className="bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8C8070] mt-1">
                Stay updated with mentions, community activity, and account status updates.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
                unreadCount > 0
                  ? "border-[#3D3123] text-[#E5E0D8] bg-[#14100D] hover:border-[#D4AF37] hover:text-[#D4AF37]"
                  : "border-[#2A241E] text-[#5c5246] bg-[#0E0C0A] cursor-not-allowed"
              }`}
            >
              <CheckCheck size={14} /> Mark all as read
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-[#2A241E]/60 pb-3 overflow-x-auto">
          <Filter size={14} className="text-[#8C8070] ml-1 mr-2 shrink-0" />
          {[
            { id: "all", label: "All Activity" },
            { id: "unread", label: "Unread" },
            { id: "mentions", label: "Mentions" },
            { id: "system", label: "System & Access" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 ${
                filter === tab.id
                  ? "bg-[#251E17] text-[#D4AF37] border border-[#D4AF37]/40 shadow-sm"
                  : "text-[#8C8070] hover:text-[#E5E0D8] hover:bg-[#1C1612]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((n) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.id}
                  className={`group relative border p-4 sm:p-5 rounded-xl transition-all duration-200 flex items-start justify-between gap-4 ${
                    n.isUnread
                      ? "border-[#D4AF37]/40 bg-[#1A140F] shadow-lg shadow-black/40"
                      : "border-[#2A241E] bg-[#14100D] hover:border-[#3D3123]"
                  }`}
                >
                  {/* Unread Glow Line */}
                  {n.isUnread && (
                    <span className="absolute left-0 top-3 bottom-3 w-1 bg-[#D4AF37] rounded-r-full shadow-[0_0_8px_#D4AF37]"></span>
                  )}

                  <div className="flex items-start gap-4 flex-1 pl-2">
                    {/* Avatar / Icon Badge */}
                    <div className="relative shrink-0">
                      {n.avatar ? (
                        <img
                          src={n.avatar}
                          alt="Avatar"
                          className="w-10 h-10 rounded-full object-cover border border-[#3D3123]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#1C1612] border border-[#3D3123] flex items-center justify-center">
                          <Icon size={18} className={n.iconColor} />
                        </div>
                      )}
                      {n.avatar && (
                        <div className="absolute -bottom-1 -right-1 bg-[#14100D] p-1 rounded-full border border-[#2A241E]">
                          <Icon size={11} className={n.iconColor} />
                        </div>
                      )}
                    </div>

                    {/* Notification Content */}
                    <div className="space-y-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono uppercase text-[#D4AF37] font-semibold">
                          {n.community}
                        </span>
                        <span className="text-[10px] text-[#8C8070]">
                          • {n.time}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-[#E5E0D8] leading-tight">
                        {n.title}
                      </h3>

                      {n.description && (
                        <p className="text-xs text-[#A69B8D] leading-relaxed line-clamp-2">
                          {n.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Action Menu */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleReadStatus(n.id)}
                      title={n.isUnread ? "Mark as Read" : "Mark as Unread"}
                      className="p-1.5 text-[#8C8070] hover:text-[#D4AF37] hover:bg-[#2A241E]/60 rounded-lg transition-colors"
                    >
                      <CheckCheck size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteNotification(n.id)}
                      title="Delete Notification"
                      className="p-1.5 text-[#8C8070] hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            /* Empty State */
            <div className="bg-[#14100D] border border-[#2A241E] rounded-xl p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-[#1C1612] border border-[#2A241E] rounded-full flex items-center justify-center mx-auto text-[#8C8070]">
                <Bell size={20} />
              </div>
              <h3 className="font-serif text-base font-semibold text-[#E5E0D8]">
                No notifications found
              </h3>
              <p className="text-xs text-[#8C8070]">
                You're all caught up! Check back later for new mentions and community updates.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}