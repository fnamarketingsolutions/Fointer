import { useEffect, useRef } from "react";
import { useToast } from "../feedback/ToastContext";
import { downloadWatermarkedMedia } from "../../utils/downloadMedia";

const isFointerFile = (url) => {
  try {
    const host = new URL(url, window.location.href).hostname.toLowerCase();
    return (
      host.endsWith(".amazonaws.com") ||
      host === "res.cloudinary.com" ||
      host.endsWith(".cloudinary.com")
    );
  } catch {
    return false;
  }
};

export default function WatermarkDownloadGuard() {
  const { showToast } = useToast();
  const busyRef = useRef(false);

  useEffect(() => {
    const onContextMenu = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const media = target.closest("img, video");
      if (!media) return;
      const url = media.dataset.mediaUrl || media.currentSrc || media.src;
      if (!media.dataset.mediaUrl) {
        const box = media.getBoundingClientRect();
        if (box.width < 96 || box.height < 72) return;
      }
      if (!url || url.startsWith("blob:") || url.startsWith("data:")) return;
      if (!isFointerFile(url)) return;
      event.preventDefault();
      if (busyRef.current) return;
      busyRef.current = true;
      const kind = media.tagName === "VIDEO" ? "video" : "image";
      downloadWatermarkedMedia(url, kind)
        .catch((error) => {
          showToast(error?.message || "Could not download this file.");
        })
        .finally(() => {
          busyRef.current = false;
        });
    };

    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [showToast]);

  return null;
}
