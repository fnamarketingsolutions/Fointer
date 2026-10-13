/** Whether a profile photo URL is safe to put on an image element. */
export const hasProfilePhoto = (src) => {
  const value = String(src || "").trim();
  if (!value || value === "null" || value === "undefined") return false;
  return true;
};

/** A live, unmuted video track is shown unless this participant turned the camera off. */
export const shouldShowRemoteVideo = (peer) => {
  if (!peer || peer.camera === false) return false;
  const tracks = peer.stream?.getVideoTracks?.() || [];
  return tracks.some(
    (track) =>
      track.readyState === "live" &&
      track.enabled !== false &&
      track.muted !== true
  );
};

export const remoteStatusLabel = (peer, status) => {
  if (status === "connecting") return "Connecting video…";
  if (status === "failed") return "Connection failed";
  const hasVideoTrack = (peer?.stream?.getVideoTracks?.() || []).some(
    (track) => track.readyState !== "ended"
  );
  if (peer?.camera === false && (hasVideoTrack || peer?.mode === "video")) return "Camera off";
  if (peer?.mode === "audio") return "Audio";
  return "Camera off";
};

/** video | avatar | connecting | failed */
export const remoteMediaStatus = (peer) => {
  if (!peer) return "avatar";
  if (peer.connectionState === "failed") return "failed";
  if (shouldShowRemoteVideo(peer)) return "video";
  if (peer.mode === "audio" && peer.camera === false) return "avatar";
  if (peer.camera === false) return "avatar";
  return "connecting";
};

/**
 * One tile per roster participant, with the media stream from that socket.
 * Roster identity wins over a signal that only carried a socket id.
 */
export const mergeCallTiles = ({ local = null, roster = [], peers = [] } = {}) => {
  const next = [];
  if (local) next.push(local);
  const seen = new Set();
  const peerById = new Map(peers.map((peer) => [peer.socketId, peer]));

  const push = (socketId, rosterPeer) => {
    if (!socketId || seen.has(socketId)) return;
    if (local && socketId === local.socketId) return;
    seen.add(socketId);
    const peer = peerById.get(socketId);
    const mode = rosterPeer?.mode || peer?.mode || "video";
    const camera =
      typeof rosterPeer?.camera === "boolean"
        ? rosterPeer.camera
        : typeof peer?.camera === "boolean"
          ? peer.camera
          : mode !== "audio";
    next.push({
      socketId,
      name: rosterPeer?.name || peer?.name || rosterPeer?.username || peer?.username || "Member",
      username: rosterPeer?.username || peer?.username || "",
      avatar: rosterPeer?.avatar || peer?.avatar || "",
      mode,
      mic:
        typeof rosterPeer?.mic === "boolean"
          ? rosterPeer.mic
          : peer?.mic !== false,
      camera,
      stream: peer?.stream || null,
      streamVersion: peer?.streamVersion || 0,
      connectionState: peer?.connectionState || "new",
      isLocal: false,
    });
  };

  for (const remote of roster) push(remote?.socketId, remote);
  for (const peer of peers) push(peer?.socketId, null);
  return next;
};
