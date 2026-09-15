import { useEffect, useRef } from "react";
import { LuMicOff as MicOff } from "react-icons/lu";

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
  const showVideo =
    peer.mode === "video" &&
    peer.camera !== false &&
    peer.stream &&
    peer.stream.getVideoTracks().some((track) => track.readyState === "live");

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    el.srcObject = peer.stream || null;
    return () => {
      if (el.srcObject) el.srcObject = null;
    };
  }, [peer.stream]);

  const label = isLocal ? "You" : peer.name || peer.username || fallbackLabel;
  const minH = size === "sm" ? "min-h-[140px]" : "min-h-[160px]";
  const avatar =
    size === "sm"
      ? "w-12 h-12 text-sm"
      : "w-14 h-14 text-base";

  return (
    <div
      className={`relative aspect-video ${minH} rounded-xl overflow-hidden bg-[#0D0A08] border border-fo-border`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`absolute inset-0 w-full h-full object-cover ${
          showVideo ? "opacity-100" : "opacity-0"
        }`}
      />
      {!showVideo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div
            className={`${avatar} rounded-full bg-fo-accent/15 border border-fo-accent/40 text-fo-accent flex items-center justify-center font-bold`}
          >
            {(label[0] || "?").toUpperCase()}
          </div>
          <span className="text-[11px] text-fo-muted">
            {peer.mode === "audio" ? "Audio" : "Camera off"}
          </span>
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
