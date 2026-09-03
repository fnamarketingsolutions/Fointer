import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuTrash2 as Trash2,
} from "react-icons/lu";
import { deleteConversation, fetchConversations } from "../../../api/messages";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import { timeAgo } from "../../../shared/utils/date";

export default function MessagesInbox() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchConversations();
      setConversations(res?.conversations || []);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (event, conv) => {
    event.stopPropagation();
    const other = conv.otherUser || {};
    const label = other.name || other.username || "this user";
    if (
      !window.confirm(
        `Delete your message history with ${label}? This only removes it from your inbox.`
      )
    ) {
      return;
    }

    setDeletingId(conv.id);
    try {
      await deleteConversation(conv.id);
      setConversations((prev) => prev.filter((row) => row.id !== conv.id));
      showToast("Conversation deleted.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete conversation.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center gap-2">
        <MessageCircle size={20} className="text-fo-accent" />
        <h1 className="text-2xl font-semibold text-fo-text">Messages</h1>
      </div>
      <p className="mt-2 text-sm text-fo-muted">
        Private conversations with other Fointers.
      </p>

      {loading ? (
        <div className="mt-12 flex justify-center text-fo-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="mt-12 text-center text-sm text-fo-muted">
          No conversations yet. Message someone from their profile or contact a
          seller on the Marketplace.
        </div>
      ) : (
        <div className="mt-6 divide-y divide-fo-border border border-fo-border rounded-xl overflow-hidden bg-fo-surface">
          {conversations.map((conv) => {
            const other = conv.otherUser || {};
            return (
              <div
                key={conv.id}
                className="flex items-center gap-2 hover:bg-fo-surface-hover transition-colors"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/messages/${conv.id}`)}
                  className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
                >
                  <ProfileAvatar
                    src={other.avatar}
                    name={other.name}
                    className="w-11 h-11 rounded-full object-cover border border-fo-border shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-fo-text truncate">
                        {other.name || other.username || "User"}
                      </p>
                      {conv.lastMessageAt ? (
                        <span className="text-[10px] text-fo-subtle shrink-0">
                          {timeAgo(conv.lastMessageAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-fo-muted truncate mt-0.5">
                      {conv.listing?.title
                        ? `Re: ${conv.listing.title}`
                        : conv.lastMessageText || "No messages yet"}
                    </p>
                  </div>
                  {conv.unreadCount > 0 ? (
                    <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-fo-accent text-fo-bg text-[10px] font-bold flex items-center justify-center">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={(event) => handleDelete(event, conv)}
                  disabled={deletingId === conv.id}
                  className="shrink-0 mr-3 p-2 rounded-lg text-fo-subtle hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  title="Delete conversation"
                >
                  {deletingId === conv.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
