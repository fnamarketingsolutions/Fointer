import { useRef, useState } from "react";
import {
  LuX as X,
  LuLoaderCircle as Loader2,
  LuImage as ImageIcon,
  LuVideo as Video,
  LuCamera as Camera,
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
}) {
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const galleryRef = useRef(null);

  const uploadFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;

    const remaining = Math.max(0, max - media.length);
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
      onChange([...media, ...uploaded]);
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

  const handleCameraCapture = async (file) => {
    await uploadFiles([file]);
  };

  const removeAt = (index) => {
    onChange(media.filter((_, i) => i !== index));
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

      {media.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {media.map((m, idx) => (
            <div key={`${m.url}-${idx}`} className="relative group">
              {m.type === "video" ? (
                <video
                  src={m.url}
                  className="w-full h-24 object-cover rounded-lg border border-fo-border"
                />
              ) : (
                <img
                  src={m.url}
                  alt=""
                  className="w-full h-24 object-cover rounded-lg border border-fo-border"
                />
              )}
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/80 text-red-300 hover:text-red-200 border border-red-500/30"
                title="Remove"
              >
                <X size={12} />
              </button>
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
