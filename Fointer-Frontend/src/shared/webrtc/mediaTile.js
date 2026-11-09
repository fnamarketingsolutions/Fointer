import { isTransportConnected, isTransportPending } from "./callLink.js";

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
  if (status === "reconnecting") return "Network issue. Reconnecting…";
  if (status === "one-way") return "Connected, but their audio is not arriving.";
  if (status === "poor-video") return "Video quality is poor. Audio is still connected.";
  if (status === "failed") return "Connection lost. Check your internet.";
  if (status === "connecting") return "Connecting…";
  if (status === "audio") return "Audio";
  const hasVideoTrack = (peer?.stream?.getVideoTracks?.() || []).some(
    (track) => track.readyState !== "ended"
  );
  if (peer?.camera === false && (hasVideoTrack || peer?.mode === "video")) return "Camera off";
  if (
    status === "avatar" &&
    isTransportConnected(peer) &&
    peer?.mediaStats?.audio &&
    peer.mediaStats.audio.receiving === false
  ) {
    return "Waiting for audio…";
  }
  if (peer?.mode === "audio") return "Audio";
  return "Camera off";
};

/** video | audio | avatar | connecting | reconnecting | failed */
export const remoteMediaStatus = (peer) => {
  if (!peer) return "avatar";
  if (peer.networkStatus === "failed") return "failed";
  if (peer.networkStatus === "one-way") return "one-way";
  if (peer.networkStatus === "poor-video") return "poor-video";
  if (peer.networkStatus === "reconnecting") return "reconnecting";
  if (peer.connectionState === "failed" || peer.iceConnectionState === "failed") return "failed";
  if (peer.connectionState === "disconnected" || peer.iceConnectionState === "disconnected") {
    return "reconnecting";
  }
  if (shouldShowRemoteVideo(peer)) return "video";
  if (isTransportPending(peer)) return "connecting";
  const audioReceiving = peer.mediaStats?.audio?.receiving === true;
  const videoReceiving = peer.mediaStats?.video?.receiving === true;
  if (audioReceiving && !videoReceiving && peer.mode !== "audio" && peer.camera !== false) {
    return "audio";
  }
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
      iceConnectionState: peer?.iceConnectionState || "",
      networkStatus: peer?.networkStatus || "",
      mediaStats: peer?.mediaStats || null,
      isLocal: false,
    });
  };

  for (const remote of roster) push(remote?.socketId, remote);
  for (const peer of peers) push(peer?.socketId, null);
  return next;
};
