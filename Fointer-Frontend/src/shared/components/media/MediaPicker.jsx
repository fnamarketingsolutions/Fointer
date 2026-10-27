import { useEffect, useRef, useState } from "react";
import {
  LuX as X,
  LuLoaderCircle as Loader2,
  LuImage as ImageIcon,
  LuVideo as Video,
  LuCamera as Camera,
  LuPencil as Pencil,
} from "react-icons/lu";
import { uploadMedia } from "../../../api/uploads";
import CameraCaptureModal from "./CameraCaptureModal";

const MAX_MEDIA = 8;

/**
 * Multi-file media picker with thumbnail strip and ✕ remove.
 * media items: { url, publicId?, type: 'image'|'video' }
 */
export default function MediaPicker({
  media = [],
  onChange,
  max = MAX_MEDIA,
  accept = "image/*,video/*",
  label = "Images / Videos",
  onError,
  allowCamera = true,
  allowReplace = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState(null);
  const galleryRef = useRef(null);
  const replaceRef = useRef(null);
  const replaceIndexRef = useRef(null);
  const mediaRef = useRef(media);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  const updateMedia = (nextMedia) => {
    mediaRef.current = nextMedia;
    onChange(nextMedia);
  };

  const uploadFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;

    const remaining = Math.max(0, max - mediaRef.current.length);
    if (remaining === 0) {
      onError?.(`You can add up to ${max} media files.`);
      return;
    }

    const toUpload = list.slice(0, remaining);
    setUploading(true);
    onError?.("");
    try {
      const uploaded = [];
      for (const file of toUpload) {
        const data = await uploadMedia(file);
        if (data?.media) uploaded.push(data.media);
      }
      updateMedia([...mediaRef.current, ...uploaded]);
      if (list.length > remaining) {
        onError?.(`Only ${max} media files allowed. Extra files were skipped.`);
      }
    } catch (err) {
      onError?.(err?.response?.data?.message || err?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e) => {
    await uploadFiles(e.target.files);
    e.target.value = "";
  };

  const handleReplaceChange = async (event) => {
    const file = event.target.files?.[0];
    const index = replaceIndexRef.current;
    event.target.value = "";
    if (!file || index == null) {
      replaceIndexRef.current = null;
      setReplacingIndex(null);
      return;
    }

    setUploading(true);
    onError?.("");
    try {
      const data = await uploadMedia(file);
      if (!data?.media) {
        onError?.("Could not replace this image.");
        return;
      }
      const current = mediaRef.current;
      if (!current[index]) return;
      const next = [...current];
      next[index] = data.media;
      updateMedia(next);
    } catch (err) {
      onError?.(err?.response?.data?.message || err?.message || "Upload failed.");
    } finally {
      replaceIndexRef.current = null;
      setReplacingIndex(null);
      setUploading(false);
    }
  };

  const startReplace = (index) => {
    replaceIndexRef.current = index;
    setReplacingIndex(index);
    replaceRef.current?.click();
  };

  const handleCameraCapture = async (file) => {
    await uploadFiles([file]);
  };

  const removeAt = (index) => {
    updateMedia(mediaRef.current.filter((_, i) => i !== index));
  };

  const full = uploading || media.length >= max;
  const showCamera = allowCamera && String(accept).includes("image");

  return (
    <div>
      {label ? (
        <label className="block text-[10px] uppercase tracking-wider text-fo-subtle mb-1">
          {label}
        </label>
      ) : null}

      <div className={`grid gap-2 ${showCamera ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          disabled={full}
          onClick={() => galleryRef.current?.click()}
          className="flex items-center justify-center gap-2 w-full border border-dashed border-fo-border rounded-lg py-4 text-xs text-fo-muted hover:border-fo-accent/40 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <ImageIcon size={14} />
              <Video size={14} />
              Gallery ({media.length}/{max})
            </>
          )}
        </button>

        {showCamera ? (
          <button
            type="button"
            disabled={full}
            onClick={() => setCameraOpen(true)}
            className="flex items-center justify-center gap-2 w-full border border-dashed border-fo-border rounded-lg py-4 text-xs text-fo-muted hover:border-fo-accent/40 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Camera size={14} />
                Take photo
              </>
            )}
          </button>
        ) : null}
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={full}
      />
      {allowReplace ? (
        <input
          ref={replaceRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleReplaceChange}
          disabled={uploading}
        />
      ) : null}

      {media.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {media.map((m, idx) => (
            <div
              key={`${m.url}-${idx}`}
              className="group relative overflow-hidden rounded-lg border border-fo-border"
            >
              {m.type === "video" ? (
                <video
                  src={m.url}
                  className="h-28 w-full object-cover"
                />
              ) : (
                <img
                  src={m.url}
                  alt=""
                  className="h-28 w-full object-cover"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                {allowReplace && m.type !== "video" ? (
                  <button
                    type="button"
                    onClick={() => startReplace(idx)}
                    disabled={uploading}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-black/75 px-2.5 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                    aria-label={`Replace image ${idx + 1}`}
                  >
                    {uploading && replacingIndex === idx ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Pencil size={13} />
                    )}
                    Replace
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  disabled={uploading}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-black/75 px-2.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-60"
                  title="Remove"
                  aria-label={`Remove media ${idx + 1}`}
                >
                  <X size={13} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}
