import { useEffect, useRef, useState } from "react";
import { LuMicOff as MicOff } from "react-icons/lu";
import ProfileAvatar from "./ProfileAvatar";
import { hasProfilePhoto, remoteMediaStatus, remoteStatusLabel, shouldShowRemoteVideo } from "../webrtc/mediaTile";

/**
 * Shared WebRTC call tile (DM + live-event calls).
 * size: "md" (DM) | "sm" (live event)
 */
export default function CallTile({
  peer,
  isLocal,
  fallbackLabel = "Caller",
  size = "md",
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [playbackError, setPlaybackError] = useState(false);
  const showVideo = shouldShowRemoteVideo(peer) && !playbackError;
  const status = playbackError ? "avatar" : remoteMediaStatus(peer);

  useEffect(() => {
    setPlaybackError(false);
  }, [peer.stream, peer.streamVersion]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    el.srcObject = peer.stream || null;
    if (peer.stream && showVideo) {
      el.play?.().catch(() => {});
    }
    return () => {
      if (el.srcObject) el.srcObject = null;
    };
  }, [peer.stream, peer.streamVersion, showVideo]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || isLocal) return undefined;
    el.srcObject = peer.stream || null;
    if (peer.stream) {
      el.play?.().catch(() => {});
    }
    return () => {
      if (el.srcObject) el.srcObject = null;
    };
  }, [isLocal, peer.stream, peer.streamVersion]);

  const label = isLocal ? "You" : peer.name || peer.username || fallbackLabel;
  const photo = hasProfilePhoto(peer.avatar) ? peer.avatar : "";
  const minH = size === "sm" ? "min-h-[140px]" : "min-h-[160px]";
  const avatarClass =
    size === "sm"
      ? "w-12 h-12 text-sm"
      : "w-14 h-14 text-base";
  const statusLabel = remoteStatusLabel(peer, status);

  return (
    <div
      className={`relative aspect-video ${minH} rounded-xl overflow-hidden bg-[#0D0A08] border border-fo-border`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onError={() => setPlaybackError(true)}
        className={`absolute inset-0 w-full h-full object-cover ${
          showVideo ? "opacity-100" : "opacity-0"
        }`}
      />
      {!isLocal ? <audio ref={audioRef} autoPlay playsInline /> : null}
      {!showVideo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
          <ProfileAvatar
            src={photo}
            name={label}
            className={`${avatarClass} rounded-full object-cover border border-fo-accent/40`}
          />
          <span className="text-[11px] text-fo-muted text-center">{statusLabel}</span>
        </div>
      ) : null}
      <div className="absolute left-2 bottom-2 right-2 flex items-center gap-1.5">
        <span className="truncate text-[11px] font-medium text-white bg-black/55 px-2 py-0.5 rounded-md">
          {label}
        </span>
        {peer.mic === false ? (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-black/55 text-red-300">
            <MicOff size={11} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
