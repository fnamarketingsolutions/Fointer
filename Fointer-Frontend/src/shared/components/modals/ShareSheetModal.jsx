import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  LuCopy as Copy,
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuShare2 as Share2,
  LuX as X,
} from "react-icons/lu";
import { useAuth } from "../../../context/AuthContext";
import {
  fetchConversations,
  sendMessage,
} from "../../../api/messages";
import ProfileAvatar from "../ProfileAvatar";
import { useToast } from "../feedback/ToastContext";

export default function ShareSheetModal({
  open,
  onClose,
  title = "Share",
  url = "",
  text = "",
  listingId = null,
  postId = null,
}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [sendingId, setSendingId] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadChats = useCallback(async () => {
    if (!isAuthenticated) {
      setConversations([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchConversations();
      setConversations(
        (data?.conversations || []).filter((row) => !row.isBlocked)
      );
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setCopied(false);
    setSendingId(null);
    loadChats();
    return undefined;
  }, [open, loadChats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((row) => {
      const user = row.otherUser || {};
      return (
        String(user.name || "")
          .toLowerCase()
          .includes(q) ||
        String(user.username || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [conversations, query]);

  if (!open) return null;

  const shareTitle = title || "Fointer";
  const shareText = String(text || "").trim();
  const shareUrl = url || window.location.href;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast("Link copied.");
    } catch {
      showToast("Could not copy link.");
    }
  };

  const handleSystemShare = async () => {
    try {
      if (typeof navigator.share !== "function") {
        await handleCopy();
        return;
      }
      await navigator.share({
        title: shareTitle,
        text: shareText || shareTitle,
        url: shareUrl,
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
      showToast("Could not open share sheet.");
    }
  };

  const handleSendToChat = async (conversation) => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: { from: `${window.location.pathname}${window.location.search}` },
      });
      return;
    }
    if (!conversation?.id || sendingId) return;

    const messagePayload = listingId
      ? { text: "", listingId }
      : postId
        ? { text: "", postId }
        : {
            text:
              shareText || shareTitle
                ? `${shareText || shareTitle}\n${shareUrl}`.trim()
                : shareUrl,
          };

    setSendingId(conversation.id);
    try {
      await sendMessage(conversation.id, messagePayload);
      const name =
        conversation.otherUser?.name ||
        conversation.otherUser?.username ||
        "chat";
      showToast(`Sent to ${name}.`);
      onClose?.();
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not send in chat.");
    } finally {
      setSendingId(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <button
        type="button"
        aria-label="Close share sheet"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-fo-border bg-fo-surface shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-fo-border shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fo-text">Share</p>
            <p className="text-xs text-fo-subtle truncate">{shareTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-8 min-w-8 inline-flex items-center justify-center rounded-lg text-fo-muted hover:text-fo-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 min-h-10 rounded-xl border border-fo-border text-xs font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent"
          >
            <Copy size={14} />
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={handleSystemShare}
            className="inline-flex items-center justify-center gap-2 min-h-10 rounded-xl border border-fo-border text-xs font-medium text-fo-text hover:border-fo-accent/40 hover:text-fo-accent"
          >
            <Share2 size={14} />
            More apps
          </button>
        </div>

        <div className="px-4 pb-2 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle size={14} className="text-fo-accent" />
            <p className="text-xs font-semibold uppercase tracking-wide text-fo-muted">
              Send in Fointer chat
            </p>
          </div>
          {!isAuthenticated ? (
            <button
              type="button"
              onClick={() =>
                navigate("/login", {
                  state: {
                    from: `${window.location.pathname}${window.location.search}`,
                  },
                })
              }
              className="w-full min-h-10 rounded-xl border border-fo-border text-xs text-fo-muted hover:text-fo-accent"
            >
              Log in to share with people you chat with
            </button>
          ) : (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="w-full rounded-xl border border-fo-border bg-fo-bg px-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 min-h-0">
          {!isAuthenticated ? null : loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-fo-subtle">
              <Loader2 size={14} className="animate-spin" />
              Loading chats…
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-fo-subtle">
              {query.trim()
                ? "No matching chats."
                : "No chats yet. Message someone first, then you can share here."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((conversation) => {
                const user = conversation.otherUser || {};
                const busy = String(sendingId) === String(conversation.id);
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      disabled={Boolean(sendingId)}
                      onClick={() => handleSendToChat(conversation)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-fo-surface-hover disabled:opacity-60"
                    >
                      <ProfileAvatar
                        src={user.avatar}
                        name={user.name || user.username}
                        className="w-9 h-9 rounded-full object-cover border border-fo-border shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-fo-text truncate">
                          {user.name || user.username || "User"}
                        </span>
                        {user.username ? (
                          <span className="block text-[11px] text-fo-subtle truncate">
                            @{user.username}
                          </span>
                        ) : null}
                      </span>
                      {busy ? (
                        <Loader2
                          size={14}
                          className="animate-spin text-fo-accent shrink-0"
                        />
                      ) : (
                        <span className="text-[11px] font-semibold text-fo-accent shrink-0">
                          Send
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
