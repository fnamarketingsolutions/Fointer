import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  EllipsisVertical,
  Loader2,
  Pencil,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  closeWatchGroup,
  createWatchGroupMessage,
  deleteWatchGroupMessage,
  fetchWatchGroupChatMeta,
  fetchWatchGroupMessages,
  removeWatchGroupMember,
  updateWatchGroupMessage,
} from "../../services/communityService";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import {
  joinWatchGroupRoom,
  leaveWatchGroupRoom,
  getWatchGroupChatSocket,
  watchGroupSocketEvents,
} from "../../services/watchGroupChatSocket";
import { useAuth } from "../../../../context/AuthContext";
import ConfirmDeleteModal from "../../../../shared/components/modals/ConfirmDeleteModal";

const PAGE_LIMIT = 30;
const SCROLL_TOP_THRESHOLD = 80;

export default function WatchGroupChatPage({
  groupId: propGroupId,
  onBack,
  onGroupClosed,
  onMemberRemoved,
}) {
  const params = useParams();
  const groupId = propGroupId || params.groupId;

  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id;

  const [loading, setLoading] = useState(true);
  const [chatMeta, setChatMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [membersMenuOpen, setMembersMenuOpen] = useState(false);

  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [removingMember, setRemovingMember] = useState(null);
  const [removeMemberLoading, setRemoveMemberLoading] = useState(false);

  const [closeGroupOpen, setCloseGroupOpen] = useState(false);
  const [closeGroupLoading, setCloseGroupLoading] = useState(false);

  const messagesWrapRef = useRef(null);
  const actionMenuRef = useRef(null);
  const membersMenuRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);

  const upsertMessage = useCallback((incoming) => {
    if (!incoming?.id) return;
    shouldStickToBottomRef.current = true;
    setMessages((prev) => {
      const idx = prev.findIndex((item) => item.id === incoming.id);
      if (idx === -1) {
        return [...prev, incoming].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
      }
      const next = [...prev];
      next[idx] = incoming;
      return next;
    });
  }, []);

  const loadChat = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    shouldStickToBottomRef.current = true;
    try {
      const [metaData, messageData] = await Promise.all([
        fetchWatchGroupChatMeta(groupId),
        fetchWatchGroupMessages(groupId, { limit: PAGE_LIMIT }),
      ]);
      setChatMeta(metaData?.chatMeta || null);
      setMessages(messageData?.messages || []);
      setHasMore(Boolean(messageData?.pagination?.hasMore));
      setNextCursor(messageData?.pagination?.nextCursor || null);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load chat."));
      setChatMeta(null);
      setMessages([]);
      setHasMore(false);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, showToast]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  useEffect(() => {
    if (!messagesWrapRef.current) return;
    if (!shouldStickToBottomRef.current) return;
    messagesWrapRef.current.scrollTop = messagesWrapRef.current.scrollHeight;
  }, [messages.length]);

  const loadOlderMessages = useCallback(async () => {
    if (!groupId || !hasMore || !nextCursor || loadingOlderRef.current) return;

    const wrap = messagesWrapRef.current;
    if (!wrap) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const previousHeight = wrap.scrollHeight;
    const previousTop = wrap.scrollTop;

    try {
      const messageData = await fetchWatchGroupMessages(groupId, {
        limit: PAGE_LIMIT,
        before: nextCursor,
      });
      const older = messageData?.messages || [];
      shouldStickToBottomRef.current = false;

      setMessages((prev) => {
        const seen = new Set(prev.map((m) => String(m.id)));
        const uniqueOlder = older.filter((m) => !seen.has(String(m.id)));
        return [...uniqueOlder, ...prev];
      });
      setHasMore(Boolean(messageData?.pagination?.hasMore));
      setNextCursor(messageData?.pagination?.nextCursor || null);

      requestAnimationFrame(() => {
        if (!messagesWrapRef.current) return;
        const nextHeight = messagesWrapRef.current.scrollHeight;
        messagesWrapRef.current.scrollTop =
          previousTop + (nextHeight - previousHeight);
      });
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load older messages."));
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [groupId, hasMore, nextCursor, showToast]);

  const handleMessagesScroll = useCallback(() => {
    const wrap = messagesWrapRef.current;
    if (!wrap) return;
    const distanceFromBottom =
      wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 80;
    if (wrap.scrollTop <= SCROLL_TOP_THRESHOLD) {
      loadOlderMessages();
    }
  }, [loadOlderMessages]);

  useEffect(() => {
    const closeMenus = (event) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target)
      ) {
        setOpenActionMenuId(null);
      }
      if (
        membersMenuRef.current &&
        !membersMenuRef.current.contains(event.target)
      ) {
        setMembersMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  useEffect(() => {
    if (!groupId) return undefined;
    const socket = getWatchGroupChatSocket();
    const activeGroupId = String(groupId);

    joinWatchGroupRoom(activeGroupId);

    const onCreated = (payload) => {
      if (String(payload?.groupId) !== activeGroupId) return;
      if (!payload?.message) return;
      upsertMessage(payload.message);
    };
    const onUpdated = (payload) => {
      if (String(payload?.groupId) !== activeGroupId) return;
      if (!payload?.message) return;
      upsertMessage(payload.message);
    };
    const onDeleted = (payload) => {
      if (String(payload?.groupId) !== activeGroupId) return;
      if (!payload?.message) return;
      upsertMessage(payload.message);
    };

    socket.on(watchGroupSocketEvents.messageCreated, onCreated);
    socket.on(watchGroupSocketEvents.messageUpdated, onUpdated);
    socket.on(watchGroupSocketEvents.messageDeleted, onDeleted);

    return () => {
      leaveWatchGroupRoom(activeGroupId);
      socket.off(watchGroupSocketEvents.messageCreated, onCreated);
      socket.off(watchGroupSocketEvents.messageUpdated, onUpdated);
      socket.off(watchGroupSocketEvents.messageDeleted, onDeleted);
    };
  }, [groupId, upsertMessage]);

  const clearComposer = () => {
    setText("");
    setComposerError("");
    setEditingMessageId(null);
  };

  const openEdit = (message) => {
    setEditingMessageId(message.id);
    setText(message.text || "");
    setComposerError("");
    setOpenActionMenuId(null);
  };

  const handleSend = async () => {
    const payload = { text: text.trim() };
    if (!payload.text) {
      setComposerError("Please enter a message.");
      return;
    }

    setSending(true);
    setComposerError("");
    try {
      if (editingMessageId) {
        const response = await updateWatchGroupMessage(
          groupId,
          editingMessageId,
          payload
        );
        upsertMessage(response?.data);
        showToast("Message updated.");
      } else {
        const response = await createWatchGroupMessage(groupId, payload);
        upsertMessage(response?.data);
      }
      clearComposer();
    } catch (err) {
      setComposerError(getErrorMessage(err, "Failed to send message."));
    } finally {
      setSending(false);
    }
  };

  const promptDelete = (messageId) => {
    setOpenActionMenuId(null);
    setDeletingMessageId(messageId);
  };

  const confirmDelete = async () => {
    if (!deletingMessageId) return;
    setDeleteLoading(true);
    try {
      const response = await deleteWatchGroupMessage(groupId, deletingMessageId);
      upsertMessage(response?.data);
      if (editingMessageId === deletingMessageId) {
        clearComposer();
      }
      showToast("Message deleted.");
      setDeletingMessageId(null);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to delete message."));
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmRemoveMember = async () => {
    if (!removingMember?.id) return;
    setRemoveMemberLoading(true);
    try {
      await removeWatchGroupMember(groupId, removingMember.id);
      showToast("Member removed.");
      setChatMeta((prev) => {
        if (!prev) return prev;
        const members = (prev.members || []).filter(
          (m) => String(m.id) !== String(removingMember.id)
        );
        return {
          ...prev,
          members,
          memberCount: members.length,
        };
      });
      setRemovingMember(null);
      setMembersMenuOpen(false);
      onMemberRemoved?.();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to remove member."));
    } finally {
      setRemoveMemberLoading(false);
    }
  };

  const confirmCloseGroup = async () => {
    setCloseGroupLoading(true);
    try {
      await closeWatchGroup(groupId);
      showToast("Watch group deleted.");
      setCloseGroupOpen(false);
      if (onGroupClosed) {
        onGroupClosed();
      } else if (onBack) {
        onBack();
      } else {
        navigate("/dashboard/watchgroups");
      }
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to delete watch group."));
    } finally {
      setCloseGroupLoading(false);
    }
  };

  const editingMessage = useMemo(
    () => messages.find((row) => row.id === editingMessageId) || null,
    [messages, editingMessageId]
  );

  const groupTitle = chatMeta?.group?.name || "Watch Group Chat";
  const administrator = chatMeta?.administrator;
  const adminLabel =
    administrator?.username || administrator?.name || "Administrator";
  const isGroupOwner =
    chatMeta?.myRole === "owner" ||
    (administrator?.id &&
      currentUserId &&
      String(administrator.id) === String(currentUserId));
  const canManageGroup = Boolean(
    chatMeta?.canManageGroup ?? isGroupOwner
  );
  const canModerateCommunity = Boolean(chatMeta?.canModerateCommunity);
  const canSendMessages = Boolean(chatMeta?.myRole);

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/dashboard/watchgroups");
    }
  };

  return (
    <div className="h-full bg-[#0F0C09] border border-[#2A241E] rounded-2xl overflow-hidden flex flex-col min-h-0">
      {/* Top Bar Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-[#2A241E] bg-[#14100D] sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackClick}
            className="p-1.5 rounded-md text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1D1713] transition-colors"
            title="Back to watch groups"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-base font-semibold text-[#E5E0D8] truncate">
              {groupTitle}
            </h1>
            <p className="text-[11px] text-[#8C8070] truncate">
              Group Administrator
              <span className="text-[#D4AF37]/90"> @{adminLabel}</span>
            </p>
            <p className="text-[10px] text-[#5A5046] truncate mt-0.5">
              {chatMeta?.memberCount || 0} members
            </p>
          </div>

          <div className="relative shrink-0" ref={membersMenuRef}>
            <button
              type="button"
              onClick={() => setMembersMenuOpen((v) => !v)}
              className="p-1.5 rounded-md text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1D1713] transition-colors"
              title="Members"
            >
              <Users size={16} />
            </button>
            {membersMenuOpen ? (
              <div className="absolute top-9 right-0 w-64 max-h-72 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-[#14100D] border border-[#2A241E] rounded-xl shadow-xl z-40 p-2 space-y-1">
                <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-[#8C8070]">
                  Members
                </p>
                {(chatMeta?.members || []).map((member) => {
                  const isOwnerMember = member.role === "owner";
                  const isSelf =
                    currentUserId &&
                    String(member.id) === String(currentUserId);
                  const canRemove =
                    canManageGroup &&
                    !isSelf &&
                    (canModerateCommunity || !isOwnerMember);
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1E1813]"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-[#E5E0D8] truncate">
                          @{member.username || "user"}
                          {isOwnerMember ? (
                            <span className="ml-1 text-[10px] text-[#D4AF37]">
                              admin
                            </span>
                          ) : null}
                        </p>
                        {member.name ? (
                          <p className="text-[10px] text-[#8C8070] truncate">
                            {member.name}
                          </p>
                        ) : null}
                      </div>
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRemovingMember(member);
                            setMembersMenuOpen(false);
                          }}
                          className="text-[10px] text-red-300 hover:text-red-200 shrink-0"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {canManageGroup ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCloseGroupOpen(true);
                      setMembersMenuOpen(false);
                    }}
                    className="w-full mt-1 px-2 py-2 text-left text-xs text-red-300 hover:bg-[#1E1813] rounded-lg border-t border-[#2A241E]"
                  >
                    Delete group
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Messages Scroll Region — scrollbar hidden */}
      <div
        ref={messagesWrapRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-2.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#A69B8D] text-xs sm:text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            Loading chat...
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-[#8C8070] text-center py-10">
            No messages yet. Start the conversation.
          </p>
        ) : (
          <>
            {loadingOlder ? (
              <div className="flex items-center justify-center py-2 text-[#8C8070] text-[11px] gap-2">
                <Loader2 size={12} className="animate-spin" />
                Loading older messages...
              </div>
            ) : hasMore ? (
              <p className="text-center text-[10px] text-[#5A5046] py-1">
                Scroll up for older messages
              </p>
            ) : null}
            {messages.map((message) => {
              const authorId = message.author?.id || message.author?._id;
              const isMine =
                authorId && String(authorId) === String(currentUserId);
              const authorName =
                message.author?.name ||
                message.author?.username ||
                "Member";
              const showActions = message.canEdit || message.canDelete;

              return (
                <div
                  key={message.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`relative max-w-[86%] sm:max-w-[75%] rounded-2xl px-3 py-2.5 border ${
                      message.status === "deleted"
                        ? "bg-[#1A1612] border-[#2A241E]"
                        : isMine
                          ? "bg-[#2B2217] border-[#4A391E]"
                          : "bg-[#F8A201] border-[#D68B00]"
                    }`}
                  >
                    {message.status === "deleted" ? (
                      <div>
                        <p
                          className={`text-[11px] font-semibold mb-1 ${
                            isMine ? "text-[#A69B8D]" : "text-[#8C8070]"
                          }`}
                        >
                          {authorName}
                        </p>
                        <p className="text-xs italic text-[#8C8070]">
                          This message was deleted.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          {!isMine ? (
                            <p className="text-[11px] font-bold text-black/80 break-words flex-1 min-w-0">
                              {authorName}
                            </p>
                          ) : (
                            <div className="flex-1" />
                          )}

                          {showActions ? (
                            <div
                              className="relative shrink-0 -mr-1 -mt-1"
                              ref={
                                openActionMenuId === message.id
                                  ? actionMenuRef
                                  : null
                              }
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionMenuId((prev) =>
                                    prev === message.id ? null : message.id
                                  )
                                }
                                className={`p-1 rounded-md hover:bg-black/20 ${
                                  isMine
                                    ? "text-[#A69B8D] hover:text-[#E5E0D8]"
                                    : "text-black/60 hover:text-black"
                                }`}
                                title="Message actions"
                              >
                                <EllipsisVertical size={14} />
                              </button>

                              {openActionMenuId === message.id ? (
                                <div className="absolute top-7 right-0 w-36 bg-[#14100D] border border-[#2A241E] rounded-lg shadow-xl p-1 z-30">
                                  {message.canEdit ? (
                                    <button
                                      type="button"
                                      onClick={() => openEdit(message)}
                                      className="w-full text-left px-2.5 py-2 text-xs text-[#E5E0D8] hover:bg-[#1E1813] rounded-md flex items-center gap-2"
                                    >
                                      <Pencil size={12} />
                                      Edit
                                    </button>
                                  ) : null}
                                  {message.canDelete ? (
                                    <button
                                      type="button"
                                      onClick={() => promptDelete(message.id)}
                                      className="w-full text-left px-2.5 py-2 text-xs text-red-300 hover:bg-[#1E1813] rounded-md flex items-center gap-2"
                                    >
                                      <Trash2 size={12} />
                                      Delete
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {message.text ? (
                          <p
                            className={`text-sm whitespace-pre-wrap break-words ${
                              isMine
                                ? "text-[#E5E0D8]"
                                : "text-black font-medium"
                            }`}
                          >
                            {message.text}
                          </p>
                        ) : null}

                        <p
                          className={`text-[10px] mt-1.5 ${
                            isMine
                              ? "text-[#8C8070]"
                              : "text-black/70 font-medium"
                          }`}
                        >
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {message.editedAt ? " • edited" : ""}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Message Composer Area */}
      <div className="border-t border-[#2A241E] bg-[#14100D] p-3 sm:p-4 space-y-2 shrink-0">
        {!canSendMessages ? (
          <p className="text-xs text-[#8C8070] text-center py-1">
            Join this watch group to send messages. You can still moderate as a
            community moderator.
          </p>
        ) : (
          <>
            {editingMessage ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#3A2E1D] bg-[#1A140F] px-3 py-2">
                <p className="text-xs text-[#D4AF37] truncate">
                  Editing message: {(editingMessage.text || "").slice(0, 80)}
                </p>
                <button
                  type="button"
                  onClick={clearComposer}
                  className="inline-flex items-center gap-1 text-[11px] text-[#A69B8D] hover:text-[#E5E0D8]"
                >
                  <X size={12} />
                  Cancel
                </button>
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={5000}
                placeholder="Type a message"
                className="flex-1 bg-[#0F0C09] border border-[#2A241E] rounded-2xl px-3 py-2.5 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50 resize-none"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black disabled:opacity-60 transition-opacity"
                title={editingMessageId ? "Save message" : "Send message"}
              >
                {sending ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>

            {composerError ? (
              <p className="text-xs text-red-400">{composerError}</p>
            ) : null}
          </>
        )}
      </div>

      <ConfirmDeleteModal
        open={Boolean(deletingMessageId)}
        title="Delete message"
        variant="dashboard"
        confirmLabel="Delete"
        onClose={() => setDeletingMessageId(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      >
        This removes the message for everyone in the group. The author&apos;s
        username will still appear with &ldquo;This message was deleted.&rdquo;
      </ConfirmDeleteModal>

      <ConfirmDeleteModal
        open={Boolean(removingMember)}
        title="Remove member"
        variant="dashboard"
        confirmLabel="Remove"
        onClose={() => setRemovingMember(null)}
        onConfirm={confirmRemoveMember}
        loading={removeMemberLoading}
      >
        Remove @{removingMember?.username || "this member"} from the watch
        group? They will lose access to this chat.
      </ConfirmDeleteModal>

      <ConfirmDeleteModal
        open={closeGroupOpen}
        title="Delete watch group"
        variant="dashboard"
        confirmLabel="Delete group"
        onClose={() => setCloseGroupOpen(false)}
        onConfirm={confirmCloseGroup}
        loading={closeGroupLoading}
      >
        This closes the group for all members. The group will no longer appear
        in active watch groups.
      </ConfirmDeleteModal>
    </div>
  );
}
