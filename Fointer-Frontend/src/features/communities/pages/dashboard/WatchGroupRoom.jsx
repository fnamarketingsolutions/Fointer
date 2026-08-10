import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Radio,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  Shield,
  X,
} from "lucide-react";
import {
  addWatchParticipant,
  deleteWatchGroup,
  deleteWatchMessage,
  fetchWatchGroup,
  fetchWatchMessages,
  fetchWatchParticipants,
  leaveWatchGroup,
  removeWatchParticipant,
  setWatchParticipantRole,
} from "../../../../api/watchGroups";
import { getLiveSocket } from "../../../../shared/services/liveSocket";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../../context/AuthContext";

export default function WatchGroupRoom() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [text, setText] = useState("");
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);

  const listRef = useRef(null);
  const canModerateRef = useRef(false);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  const loadParticipants = useCallback(async () => {
    try {
      const res = await fetchWatchParticipants(groupId);
      setParticipants(res?.participants || []);
    } catch {
      // ignore for non-members mid-load
    }
  }, [groupId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const groupRes = await fetchWatchGroup(groupId);
      const g = groupRes?.group;
      if (!g) throw new Error("missing");

      if (!g.isMember && user?.role !== "admin") {
        showToast("Join this watch group first.");
        navigate("/dashboard/watchgroups");
        return;
      }

      setGroup(g);
      canModerateRef.current = Boolean(g.canModerate);

      const [messagesRes] = await Promise.all([
        fetchWatchMessages(groupId),
        loadParticipants(),
      ]);
      setMessages(messagesRes?.messages || []);
      scrollToBottom();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load watch group.");
      navigate("/dashboard/watchgroups");
    } finally {
      setLoading(false);
    }
  }, [groupId, loadParticipants, navigate, showToast, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!groupId || loading) return undefined;

    const socket = getLiveSocket();

    const onConnect = () => {
      setConnected(true);
      socket.emit("join_watch_group", { groupId }, (ack) => {
        if (ack && !ack.success) {
          showToast(ack.message || "Could not join chat.");
        } else if (ack?.canModerate != null) {
          canModerateRef.current = Boolean(ack.canModerate);
          setGroup((prev) =>
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
          { ...message, canDelete: canModerateRef.current },
        ];
      });
      scrollToBottom();
    };

    const onMessageDeleted = ({ messageId }) => {
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId))
      );
    };

    const onOnline = ({ count }) => {
      setOnlineCount(typeof count === "number" ? count : 0);
    };

    const onRemoved = ({ userId }) => {
      if (String(userId) === String(user?.id || user?._id)) {
        showToast("You were removed from this watch group.");
        navigate("/dashboard/watchgroups");
        return;
      }
      loadParticipants();
      setGroup((prev) =>
        prev
          ? {
              ...prev,
              participantCount: Math.max(0, (prev.participantCount || 1) - 1),
            }
          : prev
      );
    };

    const onJoined = ({ participantCount }) => {
      if (typeof participantCount === "number") {
        setGroup((prev) =>
          prev ? { ...prev, participantCount } : prev
        );
      }
      loadParticipants();
    };

    const onDeleted = () => {
      showToast("This watch group was deleted.");
      navigate("/dashboard/watchgroups");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("watch_message_new", onMessageNew);
    socket.on("watch_message_deleted", onMessageDeleted);
    socket.on("watch_online_count", onOnline);
    socket.on("watch_participant_removed", onRemoved);
    socket.on("watch_participant_joined", onJoined);
    socket.on("watch_participant_left", onJoined);
    socket.on("watch_group_deleted", onDeleted);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.emit("leave_watch_group", { groupId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("watch_message_new", onMessageNew);
      socket.off("watch_message_deleted", onMessageDeleted);
      socket.off("watch_online_count", onOnline);
      socket.off("watch_participant_removed", onRemoved);
      socket.off("watch_participant_joined", onJoined);
      socket.off("watch_participant_left", onJoined);
      socket.off("watch_group_deleted", onDeleted);
    };
  }, [groupId, loading, loadParticipants, navigate, showToast, user]);

  const handleSend = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;

    setSending(true);
    const socket = getLiveSocket();
    socket.emit("send_watch_message", { groupId, text: value }, (ack) => {
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
      await deleteWatchMessage(groupId, messageId);
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(messageId))
      );
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to remove message.");
    }
  };

  const handleRemoveParticipant = async (memberId) => {
    if (!window.confirm("Remove this participant from the group?")) return;
    try {
      await removeWatchParticipant(groupId, memberId);
      setParticipants((prev) =>
        prev.filter((p) => String(p.id) !== String(memberId))
      );
      setGroup((prev) =>
        prev
          ? {
              ...prev,
              participantCount: Math.max(0, (prev.participantCount || 1) - 1),
            }
          : prev
      );
      showToast("Participant removed.");
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Failed to remove participant."
      );
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    setInviting(true);
    try {
      const res = await addWatchParticipant(groupId, {
        username: inviteUsername.trim(),
      });
      if (res?.participant) {
        setParticipants((prev) => [...prev, res.participant]);
      } else {
        await loadParticipants();
      }
      setInviteUsername("");
      showToast("Participant added.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to add participant.");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleToggle = async (member) => {
    const next = member.role === "moderator" ? "member" : "moderator";
    try {
      const res = await setWatchParticipantRole(groupId, member.id, next);
      setParticipants((prev) =>
        prev.map((p) =>
          String(p.id) === String(member.id) ? res.participant || { ...p, role: next } : p
        )
      );
      showToast(res?.message || `Role updated to ${next}.`);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update role.");
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Leave this watch group?")) return;
    setActionBusy(true);
    try {
      await leaveWatchGroup(groupId);
      navigate("/dashboard/watchgroups");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to leave group.");
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Delete this watch group and all chat messages? This cannot be undone."
      )
    ) {
      return;
    }
    setActionBusy(true);
    try {
      await deleteWatchGroup(groupId);
      showToast("Watch group deleted.");
      navigate("/dashboard/watchgroups");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete group.");
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#A69B8D] text-sm gap-2">
        <Loader2 size={16} className="animate-spin" />
        Opening watch group...
      </div>
    );
  }

  if (!group) return null;

  const displayName = (msg) =>
    msg.author?.name || msg.author?.username || "Member";
  const isOwn = (msg) =>
    String(msg.author?.id) === String(user?.id || user?._id);
  const isOwner =
    group.viewerRole === "owner" || group.canDelete || user?.role === "admin";

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate("/dashboard/watchgroups")}
            className="inline-flex items-center gap-1.5 text-xs text-[#A69B8D] hover:text-[#D4AF37] mb-2"
          >
            <ArrowLeft size={14} /> Back to Watch Groups
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-0.5 rounded-full capitalize">
              {group.type}
            </span>
            <span className="text-[10px] text-[#8C8070] flex items-center gap-1">
              <Users size={11} /> {group.participantCount}/
              {group.maxParticipants}
            </span>
            <span className="text-[10px] text-[#8C8070]">
              {onlineCount} online
            </span>
            <span
              className={`text-[10px] ${connected ? "text-emerald-500/80" : "text-amber-500/80"}`}
            >
              {connected ? "Connected" : "Reconnecting…"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-serif font-semibold text-[#E5E0D8] mt-1 truncate">
            {group.name}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40"
          >
            <Users size={14} /> Members
          </button>
          {!group.canDelete && group.viewerRole !== "owner" ? (
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleLeave}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[#2A241E] text-[#A69B8D] hover:text-red-400 disabled:opacity-50"
            >
              Leave
            </button>
          ) : null}
          {group.canDelete ? (
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 border border-[#2A241E] rounded-2xl bg-[#14100D] flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#2A241E] flex items-center gap-2 text-xs text-[#A69B8D]">
          <Radio size={14} className="text-[#D4AF37]" />
          Watch Group Chat
          <MessageCircle size={12} className="ml-auto text-[#8C8070]" />
          <span>{messages.length}</span>
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          {messages.length === 0 ? (
            <p className="text-center text-xs text-[#8C8070] py-10">
              No messages yet. Start the conversation.
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
                      ? "bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]"
                      : "bg-[#1C1612] border-[#2A241E] text-[#A69B8D]"
                  }`}
                >
                  {(displayName(msg)[0] || "?").toUpperCase()}
                </div>
                <div
                  className={`min-w-0 max-w-[80%] ${isOwn(msg) ? "text-right" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-0.5 text-[10px] text-[#8C8070]">
                    <span
                      className={`font-medium ${isOwn(msg) ? "text-[#D4AF37]" : "text-[#A69B8D]"}`}
                    >
                      {displayName(msg)}
                    </span>
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
                        ? "bg-[#D4AF37]/15 text-[#E5E0D8] border border-[#D4AF37]/25"
                        : "bg-[#1C1612] text-[#E5E0D8] border border-[#2A241E]"
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
          className="p-3 border-t border-[#2A241E] flex items-center gap-2"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
            maxLength={1000}
            placeholder="Write a message…"
            className="flex-1 bg-[#0D0A08] border border-[#2A241E] rounded-xl px-3 py-2.5 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 placeholder:text-[#8C8070] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="shrink-0 w-10 h-10 rounded-xl bg-[#D4AF37] text-black flex items-center justify-center hover:bg-[#e0c04a] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
      </div>

      {panelOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setPanelOpen(false)}
          />
          <aside className="relative w-full max-w-sm bg-[#14100D] border-l border-[#2A241E] h-full overflow-y-auto p-4 space-y-4 z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#E5E0D8] flex items-center gap-2">
                <Users size={16} className="text-[#D4AF37]" /> Participants
              </h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="p-1 text-[#A69B8D] hover:text-[#E5E0D8]"
              >
                <X size={16} />
              </button>
            </div>

            {group.canModerate ? (
              <form onSubmit={handleInvite} className="flex gap-2">
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="Invite by username"
                  className="flex-1 bg-[#0D0A08] border border-[#2A241E] rounded-lg px-3 py-2 text-xs text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60 placeholder:text-[#8C8070]"
                />
                <button
                  type="submit"
                  disabled={inviting || !inviteUsername.trim()}
                  className="px-3 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-semibold disabled:opacity-50"
                >
                  {inviting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <UserPlus size={14} />
                  )}
                </button>
              </form>
            ) : null}

            <div className="space-y-2">
              {participants.map((p) => {
                const name = p.user?.name || p.user?.username || "Member";
                const canRemove =
                  group.canModerate &&
                  p.role !== "owner" &&
                  !(
                    group.viewerRole === "moderator" && p.role === "moderator"
                  );
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-[#2A241E] bg-[#0D0A08]"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border border-[#2A241E] text-[#A69B8D] shrink-0">
                      {(name[0] || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[#E5E0D8] truncate">{name}</p>
                      <p className="text-[10px] text-[#8C8070] capitalize flex items-center gap-1">
                        {p.role === "moderator" || p.role === "owner" ? (
                          <Shield size={10} className="text-[#D4AF37]" />
                        ) : null}
                        {p.role}
                      </p>
                    </div>
                    {isOwner && p.role !== "owner" ? (
                      <button
                        type="button"
                        onClick={() => handleRoleToggle(p)}
                        className="text-[10px] text-[#D4AF37] hover:underline shrink-0"
                      >
                        {p.role === "moderator" ? "Demote" : "Make mod"}
                      </button>
                    ) : null}
                    {canRemove ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(p.id)}
                        className="p-1 text-red-400/80 hover:text-red-400 shrink-0"
                        title="Remove participant"
                      >
                        <UserMinus size={14} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
