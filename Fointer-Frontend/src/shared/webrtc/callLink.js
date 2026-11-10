export const MEDIA_CONNECT_FAILURE =
  "The call could not connect. Check your network and try again.";

export const isTransportConnected = (peer = {}) =>
  peer.connectionState === "connected" ||
  peer.iceConnectionState === "connected" ||
  peer.iceConnectionState === "completed";

export const isTransportPending = (peer = {}) => {
  if (isTransportConnected(peer)) return false;
  if (peer.connectionState === "failed" || peer.iceConnectionState === "failed") return false;
  return (
    peer.connectionState === "new" ||
    peer.connectionState === "connecting" ||
    peer.iceConnectionState === "new" ||
    peer.iceConnectionState === "checking"
  );
};

const isFailed = (peer = {}) => {
  if (peer.networkStatus === "reconnecting") return false;
  return (
    peer.networkStatus === "failed" ||
    peer.connectionState === "failed" ||
    peer.iceConnectionState === "failed"
  );
};

const isReconnecting = (peer = {}) =>
  !isFailed(peer) &&
  peer.networkStatus !== "connecting" &&
  (peer.networkStatus === "reconnecting" ||
    peer.connectionState === "disconnected" ||
    peer.iceConnectionState === "disconnected");

/**
 * Session phase is not media connectivity.
 * "connected" requires the peer connection or ICE to be up, not call acceptance.
 */
export const deriveCallLink = ({ phase = "idle", peers = [] } = {}) => {
  if (!phase || phase === "idle") return "ended";
  if (phase === "ringing_out") return "calling";
  if (phase === "ringing_in") return "ringing";

  const remote = peers.filter((peer) => peer && !peer.isLocal);
  if (remote.some(isFailed)) return "failed";
  if (remote.some(isReconnecting)) return "reconnecting";
  if (remote.some(isTransportConnected)) return "connected";
  if (phase === "connecting" || phase === "active") return "connecting";
  return "connecting";
};

export const callLinkLabel = (status) => {
  switch (status) {
    case "calling":
      return "Calling…";
    case "ringing":
      return "Ringing…";
    case "accepted":
    case "connecting":
      return "Connecting…";
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting…";
    case "failed":
      return "Failed";
    default:
      return "";
  }
};

export const callLinkFailureMessage = (status) =>
  status === "failed" ? MEDIA_CONNECT_FAILURE : "";
