import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuRadio as Radio,
  LuSend as Send,
  LuTrash2 as Trash2,
  LuUsers as Users,
  LuCircleX as XCircle
} from "react-icons/lu";
import {
  deleteLiveEvent,
  deleteLiveMessage,
  endLiveEvent,
  fetchLiveEvent,
  fetchLiveMessages,
} from "../../../../api/liveEvents";
import { getLiveSocket } from "../../../../shared/services/liveSocket";
import UserProfileLink from "../../../../shared/components/UserProfileLink";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../../context/AuthContext";

const categoryLabel = (event) => {
  if (!event) return "";
  if (event.category === "custom") {
    return event.customCategory || "Custom";
  }
  return event.category
    ? event.category.charAt(0).toUpperCase() + event.category.slice(1)
    : "";
};

export default function LiveRoom() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  const listRef = useRef(null);
  const canModerateRef = useRef(false);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eventRes, messagesRes] = await Promise.all([
        fetchLiveEvent(eventId),
        fetchLiveMessages(eventId),
      ]);
      setEvent(eventRes?.event || null);
      canModerateRef.current = Boolean(eventRes?.event?.canModerate);
      setMessages(messagesRes?.messages || []);
      scrollToBottom();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load live room.");
      navigate("/live-events");
    } finally {
      setLoading(false);
    }
  }, [eventId, navigate, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!eventId || loading) return undefined;

    const socket = getLiveSocket();

    const onConnect = () => {
      setConnected(true);
      socket.emit("join_event", { eventId }, (ack) => {
        if (ack && !ack.success) {
          showToast(ack.message || "Could not join live room.");
        } else if (ack?.canModerate != null) {
          canModerateRef.current = Boolean(ack.canModerate);
          setEvent((prev) =>
            prev ? { ...prev, canModerate: Boolean(ack.canModerate) } : prev
          );
        }
      });
    };

    const onDisconnect = () => setConnected(false);

    const onMessageNew = ({ message }) => {
      if (!message) return;
      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(message.id))) return prev;
        return [
          ...prev,
          {
            ...message,
            canDelete: canModerateRef.current,
          },
        ];
      });
      scrollToBottom();
    };

    const onMessageDeleted = ({ messageId }) => {
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId))
      );
    };

    const onViewerCount = ({ count }) => {
      setViewerCount(typeof count === "number" ? count : 0);
    };

    const onEventEnded = ({ event: ended }) => {
      setEvent((prev) =>
        prev
          ? { ...prev, ...(ended || {}), status: "ended" }
          : ended || prev
      );
      showToast("This live event has ended.");
    };

    const onEventDeleted = () => {
      showToast("This live event was deleted.");
      navigate("/live-events");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("message_new", onMessageNew);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("viewer_count", onViewerCount);
    socket.on("event_ended", onEventEnded);
    socket.on("event_deleted", onEventDeleted);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.emit("leave_event", { eventId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("message_new", onMessageNew);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("viewer_count", onViewerCount);
      socket.off("event_ended", onEventEnded);
      socket.off("event_deleted", onEventDeleted);
    };
  }, [eventId, loading, navigate, showToast]);

  const handleSend = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending || event?.status !== "live") return;

    setSending(true);
    const socket = getLiveSocket();
    socket.emit("send_message", { eventId, text: value }, (ack) => {
      setSending(false);
      if (!ack?.success) {
        showToast(ack?.message || "Failed to send message.");
        return;
      }
      setText("");
      if (ack.message) {
        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(ack.message.id))) {
            return prev;
          }
          return [
            ...prev,
            { ...ack.message, canDelete: canModerateRef.current },
          ];
        });
        scrollToBottom();
      }
    });
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteLiveMessage(eventId, messageId);
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId))
      );
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to remove message.");
    }
  };

  const handleEnd = async () => {
    if (!window.confirm("End this live commentary for everyone?")) return;
    setActionBusy(true);
    try {
      const res = await endLiveEvent(eventId);
      setEvent(res?.event || { ...event, status: "ended" });
      showToast("Live event ended.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to end event.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (
      !window.confirm(
        "Delete this live event and all commentary? This cannot be undone."
      )
    ) {
      return;
    }
    setActionBusy(true);
    try {
      await deleteLiveEvent(eventId);
      showToast("Live event deleted.");
      navigate("/live-events");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete event.");
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-fo-muted text-sm gap-2">
        <Loader2 size={16} className="animate-spin" />
        Joining live room...
      </div>
    );
  }

  if (!event) return null;

  const isLive = event.status === "live";
  const displayName = (msg) =>
    msg.author?.name || msg.author?.username || "Member";
  const isOwn = (msg) =>
    String(msg.author?.id) === String(user?.id || user?._id);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate("/live-events")}
            className="inline-flex items-center gap-1.5 text-xs text-fo-muted hover:text-fo-accent mb-2"
          >
            <ArrowLeft size={14} /> Back to Live Events
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-red-600/90 text-fo-text px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-[#2A241E] text-fo-muted px-2 py-0.5 rounded-full">
                Ended
              </span>
            )}
            <span className="text-[10px] font-mono uppercase text-fo-accent">
              {categoryLabel(event)}
            </span>
            <span className="text-[10px] text-fo-subtle flex items-center gap-1">
              <Users size={11} /> {viewerCount} watching
            </span>
            <span
              className={`text-[10px] ${connected ? "text-emerald-500/80" : "text-amber-500/80"}`}
            >
              {connected ? "Connected" : "Reconnecting…"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-serif font-semibold text-fo-text mt-1 truncate">
            {event.title}
          </h1>
          <p className="text-xs text-fo-subtle mt-0.5 truncate">
            {event.community?.name}
            {event.host?.name || event.host?.username ? (
              <>
                {" · Hosted by "}
                <UserProfileLink
                  author={event.host}
                  className="hover:text-fo-accent transition-colors"
                  stopPropagation={false}
                >
                  {event.host?.name || event.host?.username}
                </UserProfileLink>
              </>
            ) : null}
          </p>
        </div>

        {(event.canEnd || event.canDelete) && (
          <div className="flex items-center gap-2 shrink-0">
            {event.canEnd && isLive && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleEnd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
              >
                <XCircle size={14} /> End
              </button>
            )}
            {event.canDelete && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleDeleteEvent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 border border-fo-border rounded-2xl bg-fo-surface flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-fo-border flex items-center gap-2 text-xs text-fo-muted">
          <Radio size={14} className="text-red-500" />
          Live Commentary
          <MessageCircle size={12} className="ml-auto text-fo-subtle" />
          <span>{messages.length}</span>
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          {messages.length === 0 ? (
            <p className="text-center text-xs text-fo-subtle py-10">
              No messages yet. Be the first to comment.
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`group flex gap-2.5 ${isOwn(msg) ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border ${
                    isOwn(msg)
                      ? "bg-fo-accent/15 border-fo-accent/40 text-fo-accent"
                      : "bg-fo-surface-hover border-fo-border text-fo-muted"
                  }`}
                >
                  {(displayName(msg)[0] || "?").toUpperCase()}
                </div>
                <div
                  className={`min-w-0 max-w-[80%] ${isOwn(msg) ? "text-right" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-0.5 text-[10px] text-fo-subtle">
                    <UserProfileLink
                      author={msg.author}
                      className={`font-medium hover:text-fo-accent transition-colors ${
                        isOwn(msg) ? "text-fo-accent" : "text-fo-muted"
                      }`}
                      stopPropagation={false}
                    >
                      {displayName(msg)}
                    </UserProfileLink>
                    <span>
                      {msg.createdAt
                        ? new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                    {(msg.canDelete || canModerateRef.current) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                        title="Remove message"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div
                    className={`inline-block text-left text-sm px-3 py-2 rounded-xl ${
                      isOwn(msg)
                        ? "bg-fo-accent/15 text-fo-text border border-fo-accent/25"
                        : "bg-fo-surface-hover text-fo-text border border-fo-border"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleSend}
          className="p-3 border-t border-fo-border flex items-center gap-2"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!isLive || sending}
            maxLength={1000}
            placeholder={
              isLive
                ? "Write a live commentary message…"
                : "This event has ended"
            }
            className="flex-1 bg-[#0D0A08] border border-fo-border rounded-xl px-3 py-2.5 text-sm text-fo-text focus:outline-none focus:border-fo-accent/60 placeholder:text-fo-subtle disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isLive || sending || !text.trim()}
            className="shrink-0 w-10 h-10 rounded-xl bg-fo-accent text-black flex items-center justify-center hover:bg-fo-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
