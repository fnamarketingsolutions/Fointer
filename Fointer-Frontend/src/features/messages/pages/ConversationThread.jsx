import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuCheck as Check,
  LuFlag as Flag,
  LuLoaderCircle as Loader2,
  LuPencil as Pencil,
  LuSend as Send,
  LuTrash2 as Trash2,
  LuX as X,
} from "react-icons/lu";
import {
  deleteConversation,
  deleteMessage,
  fetchConversation,
  fetchMessages,
  markConversationRead,
  sendMessage,
  updateMessage,
} from "../../../api/messages";
import { getLiveSocket } from "../../../shared/services/liveSocket";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import UserProfileLink from "../../../shared/components/UserProfileLink";
import ListingReference from "../components/ListingReference";
import { timeAgo } from "../../../shared/utils/date";
import ReportContentModal from "../../../shared/components/modals/ReportContentModal";

export default function ConversationThread() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");
  const [messageBusyId, setMessageBusyId] = useState(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const listRef = useRef(null);

  const myId = String(user?.id || user?._id || "");

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
      const [convRes, msgRes] = await Promise.all([
        fetchConversation(conversationId),
        fetchMessages(conversationId),
      ]);
      setConversation(convRes?.conversation || null);
      setMessages(msgRes?.messages || []);
      await markConversationRead(conversationId);
      scrollToBottom();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load conversation.");
      navigate("/messages", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [conversationId, navigate, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!conversationId || loading) return undefined;

    const socket = getLiveSocket();

    const join = () => {
      socket.emit("join_conversation", { conversationId }, (ack) => {
        if (ack && !ack.success) {
          showToast(ack.message || "Could not join conversation.");
        }
      });
    };

    const onMessageNew = ({ conversationId: cid, message }) => {
      if (String(cid) !== String(conversationId) || !message) return;
      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(message.id))) return prev;
        return [...prev, message];
      });
      if (String(message.author?.id) !== myId) {
        markConversationRead(conversationId).catch(() => {});
      }
      scrollToBottom();
    };

    const onMessageUpdated = ({ conversationId: cid, message }) => {
      if (String(cid) !== String(conversationId) || !message) return;
      setMessages((prev) =>
        prev.map((row) =>
          String(row.id) === String(message.id) ? { ...row, ...message } : row
        )
      );
    };

    const onMessageDeleted = ({ conversationId: cid, message }) => {
      if (String(cid) !== String(conversationId) || !message) return;
      setMessages((prev) =>
        prev.map((row) =>
          String(row.id) === String(message.id) ? { ...row, ...message } : row
        )
      );
    };

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("dm_new", onMessageNew);
    socket.on("dm_updated", onMessageUpdated);
    socket.on("dm_deleted", onMessageDeleted);

    return () => {
      socket.emit("leave_conversation", { conversationId });
      socket.off("connect", join);
      socket.off("dm_new", onMessageNew);
      socket.off("dm_updated", onMessageUpdated);
      socket.off("dm_deleted", onMessageDeleted);
    };
  }, [conversationId, loading, myId, showToast]);

  const handleSend = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;

    setSending(true);
    try {
      const socket = getLiveSocket();
      if (socket.connected) {
        await new Promise((resolve) => {
          socket.emit(
            "send_dm",
            { conversationId, text: value },
            (ack) => {
              if (!ack?.success) {
                showToast(ack?.message || "Failed to send message.");
              }
              resolve();
            }
          );
        });
      } else {
        const res = await sendMessage(conversationId, { text: value });
        if (res?.message) {
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(res.message.id))) {
              return prev;
            }
            return [...prev, res.message];
          });
        }
      }
      setText("");
      scrollToBottom();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    const other = conversation?.otherUser || {};
    const label = other.name || other.username || "this user";
    if (
      !window.confirm(
        `Delete your message history with ${label}? This only removes it from your inbox.`
      )
    ) {
      return;
    }

    setDeletingConversation(true);
    try {
      await deleteConversation(conversationId);
      showToast("Conversation deleted.");
      navigate("/messages", { replace: true });
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete conversation.");
    } finally {
      setDeletingConversation(false);
    }
  };

  const startEdit = (message) => {
    setEditingMessage(message);
    setEditText(message.text || "");
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText("");
  };

  const handleSaveEdit = async () => {
    if (!editingMessage) return;
    const value = editText.trim();
    if (!value) {
      showToast("Message cannot be empty.");
      return;
    }

    setMessageBusyId(editingMessage.id);
    try {
      const res = await updateMessage(conversationId, editingMessage.id, {
        text: value,
      });
      if (res?.message) {
        setMessages((prev) =>
          prev.map((row) =>
            String(row.id) === String(res.message.id) ? res.message : row
          )
        );
      }
      cancelEdit();
      showToast("Message updated.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update message.");
    } finally {
      setMessageBusyId(null);
    }
  };

  const handleDeleteMessage = async (message) => {
    if (!window.confirm("Delete this message for everyone in this chat?")) return;

    setMessageBusyId(message.id);
    try {
      const res = await deleteMessage(conversationId, message.id);
      if (res?.message) {
        setMessages((prev) =>
          prev.map((row) =>
            String(row.id) === String(res.message.id) ? res.message : row
          )
        );
      }
      showToast("Message deleted.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete message.");
    } finally {
      setMessageBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-fo-muted">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (!conversation) return null;

  const other = conversation.otherUser || {};

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 pb-4 border-b border-fo-border shrink-0">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="p-1.5 rounded-lg text-fo-muted hover:text-fo-text hover:bg-fo-surface"
        >
          <ArrowLeft size={18} />
        </button>
        <ProfileAvatar
          src={other.avatar}
          name={other.name}
          className="w-10 h-10 rounded-full object-cover border border-fo-border shrink-0"
        />
        <div className="min-w-0 flex-1">
          <UserProfileLink
            author={other}
            className="text-sm font-semibold text-fo-text hover:text-fo-accent truncate block"
          >
            {other.name || other.username}
          </UserProfileLink>
          <p className="text-[11px] text-fo-subtle truncate">
            @{other.username}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDeleteConversation}
          disabled={deletingConversation}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-red-400 shrink-0 disabled:opacity-50"
          title="Delete conversation"
        >
          {deletingConversation ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={16} />
          )}
        </button>
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-red-400 shrink-0"
          title="Report conversation"
        >
          <Flag size={16} />
        </button>
      </div>

      {conversation.listing ? (
        <div className="py-3 shrink-0">
          <ListingReference
            listing={conversation.listing}
            onClick={() =>
              navigate(
                `/marketplace/${conversation.listing.shortCode || conversation.listing.listingId}`
              )
            }
          />
        </div>
      ) : null}

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto space-y-3 py-4 min-h-0"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-fo-muted py-8">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((message) => {
            const isMine = String(message.author?.id) === myId;
            const isEditing =
              editingMessage && String(editingMessage.id) === String(message.id);
            const isBusy = messageBusyId === message.id;

            return (
              <div
                key={message.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] space-y-2 ${
                    isMine ? "items-end" : "items-start"
                  }`}
                >
                  {message.listing && !message.isDeleted ? (
                    <ListingReference
                      listing={message.listing}
                      onClick={() =>
                        navigate(
                          `/marketplace/${message.listing.shortCode || message.listing.listingId}`
                        )
                      }
                    />
                  ) : null}

                  {isEditing ? (
                    <div className="w-full space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-xl border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-fo-border text-xs text-fo-muted"
                        >
                          <X size={12} /> Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={isBusy || !editText.trim()}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-fo-accent text-fo-bg text-xs disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        message.isDeleted
                          ? "bg-fo-surface border border-fo-border text-fo-subtle italic"
                          : isMine
                            ? "bg-fo-accent text-fo-bg rounded-br-md"
                            : "bg-fo-surface border border-fo-border text-fo-text rounded-bl-md"
                      }`}
                    >
                      {message.isDeleted ? "Message deleted" : message.text}
                    </div>
                  )}

                  <div
                    className={`flex items-center gap-2 px-1 ${
                      isMine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <p className="text-[10px] text-fo-subtle">
                      {timeAgo(message.createdAt)}
                      {message.editedAt ? " · edited" : ""}
                    </p>
                    {isMine && !message.isDeleted && !isEditing ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(message)}
                          disabled={isBusy}
                          className="p-1 rounded text-fo-subtle hover:text-fo-text disabled:opacity-50"
                          title="Edit message"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(message)}
                          disabled={isBusy}
                          className="p-1 rounded text-fo-subtle hover:text-red-400 disabled:opacity-50"
                          title="Delete message"
                        >
                          {isBusy ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="shrink-0 flex items-end gap-2 pt-3 border-t border-fo-border"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="Write a message..."
          className="flex-1 resize-none rounded-xl border border-fo-border bg-fo-bg px-4 py-2.5 text-sm text-fo-text max-h-32"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="shrink-0 p-2.5 rounded-xl bg-fo-accent text-fo-bg disabled:opacity-50"
        >
          {sending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>

      <ReportContentModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="conversation"
        targetId={conversationId}
        targetLabel={`conversation with ${other.name || other.username}`}
      />
    </div>
  );
}
