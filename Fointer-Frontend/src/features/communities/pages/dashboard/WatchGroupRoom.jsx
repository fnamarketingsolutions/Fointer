import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuRadio as Radio,
  LuSend as Send,
  LuTrash2 as Trash2,
  LuUserMinus as UserMinus,
  LuUserPlus as UserPlus,
  LuUsers as Users,
  LuShield as Shield,
  LuX as X
} from "react-icons/lu";
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
import { globalSearch } from "../../../../api/search";
import { getLiveSocket } from "../../../../shared/services/liveSocket";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../../context/AuthContext";
import UserProfileLink from "../../../../shared/components/UserProfileLink";
import ProfileAvatar from "../../../../shared/components/ProfileAvatar";
import useDebouncedValue from "../../../../shared/hooks/useDebouncedValue";

const INVITE_SEARCH_MIN = 2;

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
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteSuggestions, setInviteSuggestions] = useState([]);
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const debouncedInviteQuery = useDebouncedValue(inviteQuery.trim(), 300);

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
        if (g.hasPendingInvite) {
          showToast("Accept the invite from Watch Groups → Invites to join.");
          navigate("/watch-groups?tab=invites");
          return;
        }
        showToast("Join this watch group first.");
        navigate("/watch-groups");
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
      navigate("/watch-groups");
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
        navigate("/watch-groups");
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
      navigate("/watch-groups");
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
    // Require picking a suggestion — don't invite on raw Enter.
    if (inviteSuggestions.length === 1) {
      await inviteUser(inviteSuggestions[0]);
      return;
    }
    if (inviteQuery.trim().length < INVITE_SEARCH_MIN) {
      showToast("Type at least 2 characters and pick a profile.");
      return;
    }
    showToast("Pick a profile from the suggestions to invite.");
  };

  const inviteUser = async (profile) => {
    const username = profile?.username;
    if (!username || inviting) return;
    setInviting(true);
    try {
      const res = await addWatchParticipant(groupId, { username });
      if (res?.participant) {
        setParticipants((prev) => {
          if (prev.some((p) => String(p.id) === String(res.participant.id))) {
            return prev;
          }
          return [...prev, res.participant];
        });
      } else {
        await loadParticipants();
      }
      setInviteQuery("");
      setInviteSuggestions([]);
      showToast("Invite sent. They’ll need to accept before joining.");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  };

  useEffect(() => {
    if (!panelOpen || debouncedInviteQuery.length < INVITE_SEARCH_MIN) {
      setInviteSuggestions([]);
      setInviteSearchLoading(false);
      return undefined;
    }

    let cancelled = false;
    setInviteSearchLoading(true);

    globalSearch({
      q: debouncedInviteQuery,
      types: "profiles",
      limit: 8,
    })
      .then((data) => {
        if (cancelled) return;
        const taken = new Set(
          participants
            .filter((p) => p.status === "active" || p.status === "pending")
            .map((p) => String(p.user?.id || p.user?._id || ""))
            .filter(Boolean)
        );
        const profiles = (data?.results?.profiles || []).filter(
          (profile) => !taken.has(String(profile.id))
        );
        setInviteSuggestions(profiles);
      })
      .catch(() => {
        if (!cancelled) setInviteSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setInviteSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedInviteQuery, panelOpen, participants]);

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
      navigate("/watch-groups");
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
      navigate("/watch-groups");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete group.");
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-fo-muted text-sm gap-2">
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
            onClick={() => navigate("/watch-groups")}
            className="inline-flex items-center gap-1.5 text-xs text-fo-muted hover:text-fo-accent mb-2"
          >
            <ArrowLeft size={14} /> Back to Watch Groups
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-fo-accent/15 text-fo-accent border border-fo-accent/30 px-2 py-0.5 rounded-full capitalize">
              {group.type}
            </span>
            <span className="text-[10px] text-fo-subtle flex items-center gap-1">
              <Users size={11} /> {group.participantCount}/
              {group.maxParticipants}
            </span>
            <span className="text-[10px] text-fo-subtle">
              {onlineCount} online
            </span>
            <span
              className={`text-[10px] ${connected ? "text-emerald-500/80" : "text-amber-500/80"}`}
            >
              {connected ? "Connected" : "Reconnecting…"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-serif font-semibold text-fo-text mt-1 truncate">
            {group.name}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40"
          >
            <Users size={14} /> Members
          </button>
          {!group.canDelete && group.viewerRole !== "owner" ? (
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleLeave}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-fo-border text-fo-muted hover:text-red-400 disabled:opacity-50"
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

      <div className="flex-1 min-h-0 border border-fo-border rounded-2xl bg-fo-surface flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-fo-border flex items-center gap-2 text-xs text-fo-muted">
          <Radio size={14} className="text-fo-accent" />
          Watch Group Chat
          <MessageCircle size={12} className="ml-auto text-fo-subtle" />
          <span>{messages.length}</span>
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          {messages.length === 0 ? (
            <p className="text-center text-xs text-fo-subtle py-10">
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
            disabled={sending}
            maxLength={1000}
            placeholder="Write a message…"
            className="flex-1 bg-fo-bg border border-fo-border rounded-xl px-3 py-2.5 text-sm text-fo-text focus:outline-none focus:border-fo-accent/60 placeholder:text-fo-subtle disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
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

      {panelOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setPanelOpen(false)}
          />
          <aside className="relative w-full max-w-sm bg-fo-surface border-l border-fo-border h-full overflow-y-auto p-4 space-y-4 z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-fo-text flex items-center gap-2">
                <Users size={16} className="text-fo-accent" /> Participants
              </h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="p-1 text-fo-muted hover:text-fo-text"
              >
                <X size={16} />
              </button>
            </div>

            {group.canModerate ? (
              <div className="space-y-2">
                <form onSubmit={handleInvite} className="flex gap-2">
                  <input
                    type="text"
                    value={inviteQuery}
                    onChange={(e) => setInviteQuery(e.target.value)}
                    placeholder="Search name or username…"
                    autoComplete="off"
                    className="flex-1 bg-fo-bg border border-fo-border rounded-lg px-3 py-2 text-xs text-fo-text focus:outline-none focus:border-fo-accent/60 placeholder:text-fo-subtle"
                  />
                  <button
                    type="submit"
                    disabled={
                      inviting ||
                      inviteQuery.trim().length < INVITE_SEARCH_MIN
                    }
                    className="px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold disabled:opacity-50"
                    title="Pick a profile below, or press Enter if only one match"
                  >
                    {inviting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <UserPlus size={14} />
                    )}
                  </button>
                </form>

                {inviteQuery.trim().length > 0 &&
                inviteQuery.trim().length < INVITE_SEARCH_MIN ? (
                  <p className="text-[10px] text-fo-subtle px-0.5">
                    Type at least 2 characters to see matching profiles.
                  </p>
                ) : null}

                {inviteQuery.trim().length >= INVITE_SEARCH_MIN ? (
                  <div className="rounded-xl border border-fo-border bg-fo-bg overflow-hidden max-h-56 overflow-y-auto">
                    {inviteSearchLoading ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-fo-muted">
                        <Loader2 size={12} className="animate-spin text-fo-accent" />
                        Searching profiles…
                      </div>
                    ) : inviteSuggestions.length === 0 ? (
                      <p className="px-3 py-3 text-[11px] text-fo-subtle">
                        No matching profiles found.
                      </p>
                    ) : (
                      inviteSuggestions.map((profile) => {
                        const label =
                          profile.name || profile.username || "User";
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            disabled={inviting}
                            onClick={() => inviteUser(profile)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-fo-surface-hover transition-colors disabled:opacity-50 border-b border-fo-border last:border-b-0"
                          >
                            <ProfileAvatar
                              src={profile.avatar}
                              name={label}
                              className="w-8 h-8 rounded-full object-cover border border-fo-border shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-fo-text truncate">
                                {label}
                              </p>
                              <p className="text-[10px] text-fo-subtle truncate">
                                @{profile.username}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold text-fo-accent shrink-0">
                              Invite
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              {participants.map((p) => {
                const name = p.user?.name || p.user?.username || "Member";
                const isPending = p.status === "pending";
                const canRemove =
                  group.canModerate &&
                  p.role !== "owner" &&
                  !(
                    !isPending &&
                    group.viewerRole === "moderator" &&
                    p.role === "moderator"
                  );
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-fo-border bg-fo-bg"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border border-fo-border text-fo-muted shrink-0">
                      {(name[0] || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <UserProfileLink
                        author={p.user}
                        className="text-xs text-fo-text truncate block hover:text-fo-accent transition-colors"
                        stopPropagation={false}
                      >
                        {name}
                      </UserProfileLink>
                      <p className="text-[10px] text-fo-subtle capitalize flex items-center gap-1">
                        {isPending ? (
                          <span className="text-fo-accent">Invite pending</span>
                        ) : (
                          <>
                            {p.role === "moderator" || p.role === "owner" ? (
                              <Shield size={10} className="text-fo-accent" />
                            ) : null}
                            {p.role}
                          </>
                        )}
                      </p>
                    </div>
                    {!isPending && isOwner && p.role !== "owner" ? (
                      <button
                        type="button"
                        onClick={() => handleRoleToggle(p)}
                        className="text-[10px] text-fo-accent hover:underline shrink-0"
                      >
                        {p.role === "moderator" ? "Demote" : "Make mod"}
                      </button>
                    ) : null}
                    {canRemove ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(p.id)}
                        className="p-1 text-red-400/80 hover:text-red-400 shrink-0"
                        title={isPending ? "Cancel invite" : "Remove participant"}
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
