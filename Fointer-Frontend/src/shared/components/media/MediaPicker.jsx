import React, { useState } from "react";
import {
  LuX as X,
  LuLoaderCircle as Loader2,
  LuImage as ImageIcon,
  LuVideo as Video
} from "react-icons/lu";
import { uploadMedia } from "../../../api/uploads";

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
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = Math.max(0, max - media.length);
    if (remaining === 0) {
      onError?.(`You can add up to ${max} media files.`);
      e.target.value = "";
      return;
    }

    const toUpload = files.slice(0, remaining);
    setUploading(true);
    onError?.("");
    try {
      const uploaded = [];
      for (const file of toUpload) {
        const data = await uploadMedia(file);
        if (data?.media) uploaded.push(data.media);
      }
      onChange([...media, ...uploaded]);
      if (files.length > remaining) {
        onError?.(`Only ${max} media files allowed. Extra files were skipped.`);
      }
    } catch (err) {
      onError?.(err?.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAt = (index) => {
    onChange(media.filter((_, i) => i !== index));
  };

  return (
    <div>
      {label && (
        <label className="block text-[10px] uppercase tracking-wider text-[#8C8070] mb-1">
          {label}
        </label>
      )}
      <label className="flex items-center justify-center gap-2 w-full border border-dashed border-[#2A241E] rounded-lg py-4 text-xs text-[#A69B8D] cursor-pointer hover:border-[#D4AF37]/40">
        {uploading ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Uploading...
          </>
        ) : (
          <>
            <ImageIcon size={14} />
            <Video size={14} />
            Select media ({media.length}/{max})
          </>
        )}
        <input
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading || media.length >= max}
        />
      </label>
      {media.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {media.map((m, idx) => (
            <div key={`${m.url}-${idx}`} className="relative group">
              {m.type === "video" ? (
                <video
                  src={m.url}
                  className="w-full h-24 object-cover rounded-lg border border-[#2A241E]"
                />
              ) : (
                <img
                  src={m.url}
                  alt=""
                  className="w-full h-24 object-cover rounded-lg border border-[#2A241E]"
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
      )}
    </div>
  );
}

export { MAX_MEDIA };
