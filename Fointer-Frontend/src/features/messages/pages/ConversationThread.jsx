import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuBan as Ban,
  LuCheck as Check,
  LuEllipsisVertical as MoreVertical,
  LuFlag as Flag,
  LuImage as ImageIcon,
  LuLoaderCircle as Loader2,
  LuPencil as Pencil,
  LuPhone as Phone,
  LuSend as Send,
  LuTrash2 as Trash2,
  LuVideo as Video,
  LuX as X,
} from "react-icons/lu";
import {
  blockUser,
  deleteConversation,
  deleteMessage,
  fetchConversation,
  fetchMessages,
  markConversationRead,
  sendMessage,
  unblockUser,
  updateMessage,
} from "../../../api/messages";
import { getLiveSocket } from "../../../shared/services/liveSocket";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import UserProfileLink from "../../../shared/components/UserProfileLink";
import ListingReference from "../components/ListingReference";
import DirectCall from "../components/DirectCall";
import { timeAgo } from "../../../shared/utils/date";
import ReportContentModal from "../../../shared/components/modals/ReportContentModal";
import MediaPicker from "../../../shared/components/media/MediaPicker";

const DM_MEDIA_MAX = 4;

const headerIconBtn =
  "min-h-9 min-w-9 sm:min-h-10 sm:min-w-10 items-center justify-center rounded-lg border border-fo-border text-fo-muted shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40";

function MessageMedia({ media = [], accent = false }) {
  if (!media?.length) return null;
  return (
    <div
      className={`grid gap-1.5 ${
        media.length === 1 ? "grid-cols-1" : "grid-cols-2"
      }`}
    >
      {media.map((item, index) => (
        <div
          key={`${item.url}-${index}`}
          className={`overflow-hidden rounded-xl border ${
            accent ? "border-black/10 bg-black/5" : "border-fo-border bg-fo-bg"
          }`}
        >
          {item.type === "video" ? (
            <video
              src={item.url}
              controls
              className="w-full max-h-64 object-contain bg-black"
            />
          ) : (
            <img
              src={item.url}
              alt=""
              className="w-full max-h-64 object-contain"
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ConversationThread() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [media, setMedia] = useState([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");
  const [messageBusyId, setMessageBusyId] = useState(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const listRef = useRef(null);
  const directCallRef = useRef(null);
  const headerMenuRef = useRef(null);

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
    if (!headerMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!headerMenuRef.current?.contains(event.target)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [headerMenuOpen]);

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

  const canSend = Boolean(text.trim() || media.length);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!canSend || sending || conversation?.isBlocked) return;

    const value = text.trim();
    const payloadMedia = media;
    setSending(true);
    try {
      const socket = getLiveSocket();
      if (socket.connected) {
        await new Promise((resolve) => {
          socket.emit(
            "send_dm",
            {
              conversationId,
              text: value,
              media: payloadMedia,
            },
            (ack) => {
              if (!ack?.success) {
                showToast(ack?.message || "Failed to send message.");
              } else if (ack?.message) {
                setMessages((prev) => {
                  if (
                    prev.some((m) => String(m.id) === String(ack.message.id))
                  ) {
                    return prev;
                  }
                  return [...prev, ack.message];
                });
              }
              resolve();
            }
          );
        });
      } else {
        const res = await sendMessage(conversationId, {
          text: value,
          media: payloadMedia,
        });
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
      setMedia([]);
      setShowMediaPicker(false);
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
      showToast(
        err?.response?.data?.message || "Failed to delete conversation."
      );
    } finally {
      setDeletingConversation(false);
    }
  };

  const handleToggleBlock = async () => {
    const other = conversation?.otherUser || {};
    const username = other.username;
    if (!username) return;

    if (!conversation.blockedByMe) {
      if (
        !window.confirm(
          `Block @${username}? They will not be able to message you, and you will not be able to message them until you unblock.`
        )
      ) {
        return;
      }
    }

    setBlockBusy(true);
    try {
      if (conversation.blockedByMe) {
        await unblockUser(username);
        setConversation((prev) =>
          prev
            ? { ...prev, isBlocked: false, blockedByMe: false }
            : prev
        );
        showToast("User unblocked.");
      } else {
        await blockUser({ username, userId: other.id });
        setConversation((prev) =>
          prev ? { ...prev, isBlocked: true, blockedByMe: true } : prev
        );
        showToast("User blocked.");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not update block.");
    } finally {
      setBlockBusy(false);
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
    if (!value && !(editingMessage.media || []).length) {
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
    if (!window.confirm("Delete this message for everyone in this chat?")) {
      return;
    }

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
  const messagingLocked = Boolean(conversation.isBlocked);

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-6 flex flex-col h-[calc(100dvh-7.5rem)] sm:h-[calc(100vh-8rem)] min-h-0">
      <div className="flex items-center gap-2 sm:gap-3 pb-3 sm:pb-4 border-b border-fo-border shrink-0 min-w-0">
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="min-h-9 min-w-9 sm:min-h-10 sm:min-w-10 inline-flex items-center justify-center rounded-lg text-fo-muted hover:text-fo-text hover:bg-fo-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 shrink-0"
          aria-label="Back to messages"
        >
          <ArrowLeft size={18} />
        </button>
        <ProfileAvatar
          src={other.avatar}
          name={other.name || other.username}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-fo-border shrink-0"
        />
        <div className="min-w-0 flex-1">
          <UserProfileLink
            author={other}
            className="text-sm font-semibold text-fo-text hover:text-fo-accent truncate block"
          >
            {other.name || other.username}
          </UserProfileLink>
          <p className="text-xs text-fo-subtle truncate">@{other.username}</p>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => directCallRef.current?.start("audio")}
            disabled={messagingLocked}
            className={`inline-flex ${headerIconBtn} hover:text-fo-accent`}
            title="Audio call"
            aria-label="Start audio call"
          >
            <Phone size={16} />
          </button>
          <button
            type="button"
            onClick={() => directCallRef.current?.start("video")}
            disabled={messagingLocked}
            className={`inline-flex ${headerIconBtn} hover:text-fo-accent`}
            title="Video call"
            aria-label="Start video call"
          >
            <Video size={16} />
          </button>

          {/* Desktop only — on mobile these live in the ⋯ menu */}
          <button
            type="button"
            onClick={handleToggleBlock}
            disabled={blockBusy || (messagingLocked && !conversation.blockedByMe)}
            className={`hidden sm:inline-flex ${headerIconBtn} hover:text-red-400`}
            title={conversation.blockedByMe ? "Unblock user" : "Block user"}
            aria-label={conversation.blockedByMe ? "Unblock user" : "Block user"}
          >
            {blockBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Ban size={16} />
            )}
          </button>
          <button
            type="button"
            onClick={handleDeleteConversation}
            disabled={deletingConversation}
            className={`hidden sm:inline-flex ${headerIconBtn} hover:text-red-400`}
            title="Delete conversation"
            aria-label="Delete conversation"
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
            className={`hidden sm:inline-flex ${headerIconBtn} hover:text-red-400`}
            title="Report conversation"
            aria-label="Report conversation"
          >
            <Flag size={16} />
          </button>

          {/* Mobile: overflow menu for block / delete / report */}
          <div className="relative sm:hidden" ref={headerMenuRef}>
            <button
              type="button"
              onClick={() => setHeaderMenuOpen((v) => !v)}
              className={`inline-flex ${headerIconBtn} hover:text-fo-text`}
              title="More actions"
              aria-label="More actions"
              aria-expanded={headerMenuOpen}
            >
              <MoreVertical size={16} />
            </button>
            {headerMenuOpen ? (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl border border-fo-border bg-fo-surface shadow-lg py-1 overflow-hidden">
                <button
                  type="button"
                  disabled={
                    blockBusy || (messagingLocked && !conversation.blockedByMe)
                  }
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    handleToggleBlock();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-fo-text hover:bg-fo-surface-hover disabled:opacity-50"
                >
                  <Ban size={14} className="text-fo-muted" />
                  {conversation.blockedByMe ? "Unblock user" : "Block user"}
                </button>
                <button
                  type="button"
                  disabled={deletingConversation}
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    handleDeleteConversation();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-fo-text hover:bg-fo-surface-hover disabled:opacity-50"
                >
                  <Trash2 size={14} className="text-fo-muted" />
                  Delete chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-fo-text hover:bg-fo-surface-hover"
                >
                  <Flag size={14} className="text-fo-muted" />
                  Report
                </button>
              </div>
            ) : null}
          </div>
        </div>
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

      {messagingLocked ? (
        <div className="mt-3 shrink-0 rounded-xl border border-fo-border bg-fo-surface px-3.5 py-3 text-xs text-fo-subtle">
          {conversation.blockedByMe
            ? "You blocked this user. Unblock them to send messages again."
            : "Messaging is unavailable with this user."}
        </div>
      ) : null}

      <DirectCall
        ref={directCallRef}
        conversationId={String(conversation.id)}
        otherUser={other}
        disabled={messagingLocked}
      />

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
              editingMessage &&
              String(editingMessage.id) === String(message.id);
            const isBusy = messageBusyId === message.id;
            const mediaItems = message.media || [];

            return (
              <div
                key={message.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(85%,22rem)] sm:max-w-[85%] space-y-2 ${
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
                      {mediaItems.length ? (
                        <MessageMedia media={mediaItems} accent={isMine} />
                      ) : null}
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-xl border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text focus:outline-none focus:border-fo-accent/50"
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
                          disabled={
                            isBusy ||
                            (!editText.trim() && !mediaItems.length)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-fo-accent text-black text-xs disabled:opacity-50"
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
                      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed space-y-2 ${
                        message.isDeleted
                          ? "bg-fo-surface border border-fo-border text-fo-subtle italic"
                          : isMine
                            ? "bg-fo-accent text-black rounded-br-md"
                            : "bg-fo-surface border border-fo-border text-fo-text rounded-bl-md"
                      }`}
                    >
                      {message.isDeleted ? (
                        "Message deleted"
                      ) : (
                        <>
                          {mediaItems.length ? (
                            <MessageMedia media={mediaItems} accent={isMine} />
                          ) : null}
                          {message.text ? (
                            <p className="whitespace-pre-wrap">{message.text}</p>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}

                  <div
                    className={`flex items-center gap-2 px-1 ${
                      isMine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <p className="text-xs text-fo-subtle">
                      {timeAgo(message.createdAt)}
                      {message.editedAt ? " · edited" : ""}
                    </p>
                    {isMine && !message.isDeleted && !isEditing ? (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => startEdit(message)}
                          disabled={isBusy}
                          className="min-h-8 min-w-8 inline-flex items-center justify-center rounded text-fo-subtle hover:text-fo-text disabled:opacity-50"
                          title="Edit message"
                          aria-label="Edit message"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(message)}
                          disabled={isBusy}
                          className="min-h-8 min-w-8 inline-flex items-center justify-center rounded text-fo-subtle hover:text-red-400 disabled:opacity-50"
                          title="Delete message"
                          aria-label="Delete message"
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

      {messagingLocked ? null : (
        <form
          onSubmit={handleSend}
          className="shrink-0 space-y-2 pt-3 border-t border-fo-border"
        >
          {showMediaPicker || media.length > 0 ? (
            <MediaPicker
              media={media}
              onChange={setMedia}
              max={DM_MEDIA_MAX}
              label=""
              onError={(msg) => msg && showToast(msg)}
            />
          ) : null}
          <div className="flex items-end gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setShowMediaPicker((v) => !v)}
              className={`shrink-0 min-h-10 min-w-10 inline-flex items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40 ${
                showMediaPicker || media.length
                  ? "border-fo-accent/40 text-fo-accent bg-fo-accent/10"
                  : "border-fo-border text-fo-muted hover:text-fo-accent"
              }`}
              title="Add photo or video"
              aria-label="Add photo or video"
            >
              <ImageIcon size={18} />
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              placeholder="Write a message..."
              className="min-w-0 flex-1 resize-none rounded-xl border border-fo-border bg-fo-bg px-3 sm:px-4 py-2.5 text-sm text-fo-text max-h-32 focus:outline-none focus:border-fo-accent/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={sending || !canSend}
              className="shrink-0 min-h-10 min-w-10 inline-flex items-center justify-center rounded-xl bg-fo-accent text-black disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fo-accent/40"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </form>
      )}

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
