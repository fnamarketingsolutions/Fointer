import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuRefreshCw as RefreshCw,
  LuTrash2 as Trash2,
} from "react-icons/lu";
import { deleteConversation, fetchConversations } from "../../../api/messages";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import { timeAgo } from "../../../shared/utils/date";

const cardClass =
  "bg-fo-surface border border-fo-border rounded-xl overflow-hidden";

function InboxSkeleton() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading messages…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${cardClass} p-3.5 sm:p-4 flex items-center gap-3 animate-pulse`}
        >
          <div className="w-11 h-11 rounded-full bg-fo-surface-hover shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 rounded bg-fo-surface-hover" />
            <div className="h-3 w-52 rounded bg-fo-surface-hover" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MessagesInbox() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetchConversations();
      setConversations(res?.conversations || []);
    } catch (err) {
      setConversations([]);
      const message =
        err?.response?.data?.message || "Failed to load messages.";
      setLoadError(message);
      showToast(message);
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
      showToast(
        err?.response?.data?.message || "Failed to delete conversation."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 px-4 py-6 sm:py-8">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <MessageCircle
              size={20}
              className="text-fo-accent shrink-0"
              aria-hidden
            />
            <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
              Messages
            </h1>
          </div>
          <p className="text-sm text-fo-subtle">
            Private conversations with other Fointers.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Refresh"
          aria-label="Refresh messages"
          className="inline-flex items-center justify-center min-h-10 min-w-10 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors disabled:opacity-50 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {loading ? (
        <InboxSkeleton />
      ) : loadError ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 px-4 text-center space-y-3">
          <p className="text-sm text-fo-text font-medium">
            Could not load messages
          </p>
          <p className="text-xs text-fo-subtle">{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-fo-border text-xs font-semibold text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
          >
            Retry
          </button>
        </div>
      ) : conversations.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 px-4 text-center space-y-3">
          <p className="text-sm text-fo-subtle">
            No conversations yet. Message someone from their profile or contact
            a seller on the Marketplace.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/marketplace"
              className="inline-flex items-center min-h-10 px-3 text-sm font-medium text-fo-accent hover:text-fo-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
            >
              Browse marketplace
            </Link>
            <Link
              to="/communities"
              className="inline-flex items-center min-h-10 px-3 text-sm font-medium text-fo-muted hover:text-fo-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 rounded"
            >
              Browse communities
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {conversations.map((conv) => {
            const other = conv.otherUser || {};
            const displayName = other.name || other.username || "User";
            const preview = conv.listing?.title
              ? `Re: ${conv.listing.title}`
              : conv.lastMessageText || "No messages yet";
            const busy = deletingId === conv.id;

            return (
              <article
                key={conv.id}
                className={`${cardClass} flex items-stretch hover:border-fo-accent/35 transition-colors`}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/messages/${conv.id}`)}
                  className="flex-1 flex items-center gap-3 px-3.5 sm:px-4 py-3 text-left min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fo-accent/40"
                  aria-label={`Open conversation with ${displayName}`}
                >
                  <ProfileAvatar
                    src={other.avatar}
                    name={displayName}
                    className="w-11 h-11 rounded-full object-cover border border-fo-border shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-fo-text truncate">
                        {displayName}
                      </p>
                      {conv.lastMessageAt ? (
                        <span className="text-xs text-fo-subtle shrink-0">
                          {timeAgo(conv.lastMessageAt)}
                        </span>
                      ) : null}
                    </div>
                    {other.username ? (
                      <p className="text-xs text-fo-subtle truncate">
                        @{String(other.username).replace(/^@+/, "")}
                      </p>
                    ) : null}
                    <p className="text-xs text-fo-muted truncate">{preview}</p>
                  </div>
                  {conv.unreadCount > 0 ? (
                    <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-fo-accent text-black text-xs font-bold flex items-center justify-center">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={(event) => handleDelete(event, conv)}
                  disabled={busy}
                  className="shrink-0 self-center mr-2 sm:mr-3 min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg text-fo-subtle hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
                  title="Delete conversation"
                  aria-label={`Delete conversation with ${displayName}`}
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
