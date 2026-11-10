/** Client-side guards. The server call id is authoritative. */
export const shouldStartRing = ({ phase, call, retired }) => {
  if (phase !== "idle") return false;
  if (!call || call.status !== "ringing" || call.selfInCall) return false;
  if (!call.callId) return false;
  if (retired?.has?.(String(call.callId))) return false;
  return true;
};

export const shouldApplyEnd = ({ activeCallId, endedCallId, phase }) => {
  if (!phase || phase === "idle") return false;
  if (!activeCallId || !endedCallId) return false;
  return String(activeCallId) === String(endedCallId);
};

export const shouldIgnoreSignal = ({ activeCallId, signalCallId }) => {
  if (!activeCallId || !signalCallId) return false;
  return String(activeCallId) !== String(signalCallId);
};

export const showVideoJoinControl = ({
  isLive = false,
  inCall = false,
  authorized = true,
  callMode,
} = {}) => Boolean(isLive) && !inCall && authorized !== false && callMode !== "audio";

export const showAudioJoinControl = ({
  isLive = false,
  inCall = false,
  authorized = true,
  callMode,
} = {}) => Boolean(isLive) && !inCall && authorized !== false && callMode !== "video";

/** The event's call mode decides which join controls exist. Chat keeps both. */
export const liveCallJoinMode = (callMode, requested) => {
  if (callMode === "audio") return requested === "video" ? null : "audio";
  if (callMode === "video") return requested === "audio" ? null : "video";
  return requested === "video" ? "video" : "audio";
};
