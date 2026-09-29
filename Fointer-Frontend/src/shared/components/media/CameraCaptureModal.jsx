import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuCamera as Camera,
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuX as X,
} from "react-icons/lu";

async function canvasToFile(canvas) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Could not capture photo."))),
      "image/jpeg",
      0.92
    );
  });
  return new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
}

export default function CameraCaptureModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState("environment");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setReady(false);
    setError("");

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        if (!cancelled) {
          setError(
            "Could not open the camera. Allow camera permission and try again."
          );
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open, facingMode]);

  if (!open) return null;

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleClose = () => {
    stopCamera();
    onClose?.();
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !ready || busy) return;
    setBusy(true);
    try {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, width, height);
      const file = await canvasToFile(canvas);
      stopCamera();
      await onCapture?.(file);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Could not capture photo.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4">
      <button
        type="button"
        aria-label="Close camera"
        className="absolute inset-0 bg-black/80"
        onClick={handleClose}
      />
      <div className="relative w-full sm:max-w-md bg-fo-surface border border-fo-border rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-fo-border">
          <div className="flex items-center gap-2 text-sm font-semibold text-fo-text">
            <Camera size={16} className="text-fo-accent" />
            Take photo
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="min-h-8 min-w-8 inline-flex items-center justify-center rounded-lg text-fo-muted hover:text-fo-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative bg-black aspect-[3/4] sm:aspect-video">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-fo-subtle">
              {error}
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full object-cover"
            />
          )}
          {!ready && !error ? (
            <div className="absolute inset-0 flex items-center justify-center text-fo-subtle text-sm gap-2">
              <Loader2 size={16} className="animate-spin" />
              Starting camera…
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() =>
              setFacingMode((mode) =>
                mode === "environment" ? "user" : "environment"
              )
            }
            disabled={Boolean(error) || busy}
            className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-xl border border-fo-border text-fo-muted hover:text-fo-text disabled:opacity-50"
            title="Flip camera"
            aria-label="Flip camera"
          >
            <RefreshCw size={16} />
          </button>

          <button
            type="button"
            onClick={handleCapture}
            disabled={!ready || busy || Boolean(error)}
            className="min-h-14 min-w-14 rounded-full border-4 border-fo-accent bg-fo-accent/20 disabled:opacity-50"
            title="Capture"
            aria-label="Capture photo"
          >
            {busy ? (
              <Loader2 size={18} className="mx-auto animate-spin text-fo-accent" />
            ) : (
              <span className="block mx-auto h-10 w-10 rounded-full bg-fo-accent" />
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="min-h-10 px-3 rounded-xl border border-fo-border text-xs text-fo-muted hover:text-fo-text"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
