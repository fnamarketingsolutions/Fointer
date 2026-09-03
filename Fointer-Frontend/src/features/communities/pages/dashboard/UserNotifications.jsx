import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LuBell as Bell,
  LuCheckCheck as CheckCheck,
  LuTrash2 as Trash2,
  LuFilter as Filter,
  LuArrowLeft as ArrowLeft,
  LuHeart as Heart,
  LuMessageCircle as MessageCircle,
  LuRepeat as Repeat,
  LuUserPlus as UserPlus,
  LuShield as Shield,
  LuBan as Ban,
  LuLifeBuoy as LifeBuoy,
  LuFlag as Flag,
  LuLayers as Layers,
  LuLoaderCircle as Loader2,
} from "react-icons/lu";
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../../../../api/notifications";
import {
  notificationPath,
  notificationTypeLabel,
  isSystemNotification,
  isAdminNotification,
} from "../../../notifications/notificationLinks";
import { useNotifications } from "../../../../context/NotificationContext";
import { timeAgo } from "../../../../shared/utils/date";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { DEFAULT_AVATAR } from "../../../../shared/constants/avatars";
import { getLiveSocket } from "../../../../shared/services/liveSocket";
import { getDashboardPathForRole } from "../../../../shared/lib/roles";

const USER_FILTERS = [
  { id: "all", label: "All Activity" },
  { id: "unread", label: "Unread" },
  { id: "mentions", label: "Mentions" },
  { id: "system", label: "System & Access" },
];

const ADMIN_FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "reports", label: "Reports" },
  { id: "requests", label: "Channel requests" },
];

const typeIcon = (type) => {
  if (type === "like") return { Icon: Heart, className: "text-rose-400" };
  if (type === "comment" || type === "reply" || type === "mention") {
    return { Icon: MessageCircle, className: "text-sky-400" };
  }
  if (type === "reshare") return { Icon: Repeat, className: "text-emerald-400" };
  if (type === "invite" || type === "invite_accepted" || type === "join_request") {
    return { Icon: UserPlus, className: "text-fo-accent" };
  }
  if (type === "moderator_assigned" || type === "moderator_revoked") {
    return { Icon: Shield, className: "text-amber-300" };
  }
  if (type === "member_banned" || type === "member_removed") {
    return { Icon: Ban, className: "text-red-400" };
  }
  if (type === "support_ticket" || type === "channel_request") {
    return {
      Icon: type === "channel_request" ? Layers : LifeBuoy,
      className: "text-fo-accent",
    };
  }
  if (type === "content_report") {
    return { Icon: Flag, className: "text-rose-400" };
  }
  return { Icon: Bell, className: "text-fo-accent" };
};

export default function UserNotifications({ onBack }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { unreadCount, refreshUnread, adjustUnread, setUnread } =
    useNotifications();
  const [filter, setFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = location.pathname.startsWith("/admin");
  const filters = isAdmin ? ADMIN_FILTERS : USER_FILTERS;

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(isAdmin ? "/admin" : getDashboardPathForRole("user"));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications({
        filter,
        page: 1,
        limit: 50,
      });
      setNotifications(data?.notifications || []);
      if (typeof data?.unreadCount === "number") {
        setUnread(data.unreadCount);
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [filter, setUnread, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getLiveSocket();
    const onNew = (payload) => {
      if (!payload?.id) return;
      setNotifications((prev) => {
        if (prev.some((n) => String(n.id) === String(payload.id))) {
          return prev.map((n) =>
            String(n.id) === String(payload.id) ? { ...n, ...payload } : n
          );
        }
        if (isAdmin && !isAdminNotification(payload.type)) return prev;
        if (!isAdmin && isAdminNotification(payload.type)) return prev;
        if (filter === "unread" && !payload.isUnread) return prev;
        if (filter === "mentions" && payload.type !== "mention") return prev;
        if (filter === "system" && !isSystemNotification(payload.type)) {
          return prev;
        }
        if (filter === "reports" && payload.type !== "content_report") {
          return prev;
        }
        if (filter === "requests" && payload.type !== "channel_request") {
          return prev;
        }
        return [payload, ...prev];
      });
    };
    socket.on("notification:new", onNew);
    return () => socket.off("notification:new", onNew);
  }, [filter, isAdmin]);

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isUnread: false }))
      );
      setUnread(0);
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not mark all as read.");
    }
  };

  const toggleReadStatus = async (item) => {
    try {
      if (item.isUnread) {
        await markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isUnread: false } : n))
        );
        adjustUnread(-1);
      } else {
        await markNotificationUnread(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isUnread: true } : n))
        );
        adjustUnread(1);
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not update notification.");
    }
  };

  const handleDeleteNotification = async (item) => {
    try {
      await deleteNotification(item.id);
      setNotifications((prev) => prev.filter((n) => n.id !== item.id));
      if (item.isUnread) adjustUnread(-1);
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not delete notification.");
    }
  };

  const openNotification = async (item) => {
    if (item.isUnread) {
      try {
        await markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isUnread: false } : n))
        );
        adjustUnread(-1);
      } catch {
        refreshUnread();
      }
    }
    navigate(notificationPath(item, { isAdmin }));
  };

  const visible = notifications.filter((n) => {
    if (filter === "unread") return n.isUnread;
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-fo-border pb-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            title="Go Back"
            className="p-2.5 rounded-xl bg-fo-surface border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/50 hover:bg-fo-surface-hover transition-all group"
          >
            <ArrowLeft
              size={18}
              className="group-hover:-translate-x-0.5 transition-transform"
            />
          </button>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="bg-fo-accent/15 text-fo-accent border border-fo-accent/30 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-xs text-fo-subtle mt-1">
              {isAdmin
                ? "New reports and pending channel requests from the platform."
                : "Stay updated with mentions, community activity, and account status updates."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
              unreadCount > 0
                ? "border-fo-border text-fo-text bg-fo-surface hover:border-fo-accent hover:text-fo-accent"
                : "border-fo-border text-fo-subtle bg-fo-bg cursor-not-allowed"
            }`}
          >
            <CheckCheck size={14} /> Mark all as read
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-fo-border/60 pb-3 overflow-x-auto">
        <Filter size={14} className="text-fo-subtle ml-1 mr-2 shrink-0" />
        {filters.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all shrink-0 ${
              filter === tab.id
                ? "bg-fo-surface-3 text-fo-accent border border-fo-accent/40 shadow-sm"
                : "text-fo-subtle hover:text-fo-text hover:bg-fo-surface-hover"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-fo-subtle gap-2 text-sm">
            <Loader2 size={18} className="animate-spin" />
            Loading notifications…
          </div>
        ) : visible.length > 0 ? (
          visible.map((n) => {
            const { Icon, className: iconColor } = typeIcon(n.type);
            return (
              <div
                key={n.id}
                className={`group relative border p-4 sm:p-5 rounded-xl transition-all duration-200 flex items-start justify-between gap-4 ${
                  n.isUnread
                    ? "border-fo-accent/40 bg-fo-accent/10 shadow-md shadow-fo-accent/10"
                    : "border-fo-border bg-fo-surface hover:border-fo-border"
                }`}
              >
                {n.isUnread && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-fo-accent rounded-r-full shadow-[0_0_8px_var(--theme-accent)]" />
                )}

                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className="flex items-start gap-4 flex-1 pl-2 text-left min-w-0"
                >
                  <div className="relative shrink-0">
                    {n.actor?.avatar ? (
                      <img
                        src={n.actor.avatar || DEFAULT_AVATAR}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-fo-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-fo-surface-hover border border-fo-border flex items-center justify-center">
                        <Icon size={18} className={iconColor} />
                      </div>
                    )}
                    {n.actor?.avatar ? (
                      <div className="absolute -bottom-1 -right-1 bg-fo-surface p-1 rounded-full border border-fo-border">
                        <Icon size={11} className={iconColor} />
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-1 pr-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono uppercase text-fo-accent font-semibold">
                        {notificationTypeLabel(n)}
                      </span>
                      <span className="text-[10px] text-fo-subtle">
                        • {timeAgo(n.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-fo-text leading-tight">
                      {n.title}
                    </h3>

                    {n.body ? (
                      <p className="text-xs text-fo-muted leading-relaxed line-clamp-2">
                        {n.body}
                      </p>
                    ) : null}
                  </div>
                </button>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => toggleReadStatus(n)}
                    title={n.isUnread ? "Mark as Read" : "Mark as Unread"}
                    className="p-1.5 text-fo-subtle hover:text-fo-accent hover:bg-fo-surface-hover rounded-lg transition-colors"
                  >
                    <CheckCheck size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNotification(n)}
                    title="Delete Notification"
                    className="p-1.5 text-fo-subtle hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-fo-surface border border-fo-border rounded-xl p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-fo-surface-hover border border-fo-border rounded-full flex items-center justify-center mx-auto text-fo-subtle">
              <Bell size={20} />
            </div>
            <h3 className="text-base font-semibold text-fo-text">
              No notifications found
            </h3>
            <p className="text-xs text-fo-subtle">
              {isAdmin
                ? "New reports and channel requests will show up here."
                : "You're all caught up! Check back later for new mentions and community updates."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
