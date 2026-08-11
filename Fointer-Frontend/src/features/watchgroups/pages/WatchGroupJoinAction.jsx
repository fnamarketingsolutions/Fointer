import { useState } from "react";
import { Loader2, Check, Clock } from "lucide-react";
import {
  joinWatchGroup,
  requestJoinWatchGroup,
} from "../services/watchGroupService";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../shared/utils/errors";

/**
 * Join / Request / Joined / Pending control for a single watch group.
 */
export default function WatchGroupJoinAction({
  group,
  disabled = false,
  onJoined,
  onRequested,
  className = "",
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const isMember = Boolean(group?.myRole);
  const isPending = group?.myJoinRequestStatus === "pending";

  const handleJoin = async (e) => {
    e?.stopPropagation?.();
    if (!group?.id || busy || disabled) return;
    setBusy(true);
    try {
      await joinWatchGroup(group.id);
      showToast("Joined watch group.");
      onJoined?.(group);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to join watch group."));
    } finally {
      setBusy(false);
    }
  };

  const handleRequest = async (e) => {
    e?.stopPropagation?.();
    if (!group?.id || busy || disabled) return;
    setBusy(true);
    try {
      await requestJoinWatchGroup(group.id);
      showToast("Join request submitted.");
      onRequested?.(group);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to request join."));
    } finally {
      setBusy(false);
    }
  };

  if (isMember) {
    return (
      <span
        className={`inline-flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 ${className}`}
      >
        <Check size={12} />
        Joined
      </span>
    );
  }

  if (isPending) {
    return (
      <span
        className={`inline-flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#2A241E] text-[#A69B8D] border border-[#2A241E] ${className}`}
      >
        <Clock size={12} />
        Pending
      </span>
    );
  }

  if (group?.type === "private") {
    return (
      <button
        type="button"
        disabled={busy || disabled}
        onClick={handleRequest}
        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#D4AF37]/50 text-[#D4AF37] text-[11px] font-bold hover:bg-[#D4AF37]/10 disabled:opacity-50 ${className}`}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : null}
        Request
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={handleJoin}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black text-[11px] font-bold disabled:opacity-50 ${className}`}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : null}
      Join
    </button>
  );
}

/** Aggregate CTA state for a list of community watch groups. */
export function getJoinGroupCtaState(watchGroups = []) {
  const allGroupsJoined =
    watchGroups.length > 0 && watchGroups.every((g) => Boolean(g.myRole));
  const anyPendingOnly =
    !allGroupsJoined &&
    watchGroups.some((g) => g.myJoinRequestStatus === "pending") &&
    watchGroups.every(
      (g) => Boolean(g.myRole) || g.myJoinRequestStatus === "pending"
    );
  const label = allGroupsJoined
    ? "Joined"
    : anyPendingOnly
      ? "Pending"
      : "Join Group";

  return { allGroupsJoined, anyPendingOnly, label };
}
