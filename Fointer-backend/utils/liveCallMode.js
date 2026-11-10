/** The stored event mode is authoritative. Chat may join either way. */
export const resolveLiveJoinMode = (callMode, requested) => {
  const eventMode = callMode === "audio" || callMode === "video" ? callMode : "chat";
  const asked = requested === "video" ? "video" : "audio";
  if (eventMode === "audio") return { ok: true, mode: "audio", camera: false };
  if (eventMode === "video") {
    if (asked !== "video") {
      return { ok: false, message: "This live event is a video call." };
    }
    return { ok: true, mode: "video", camera: true };
  }
  return { ok: true, mode: asked, camera: asked === "video" };
};

/** Audio rooms cannot be switched to camera by a later presence update. */
export const clampLivePresence = (callMode, payload = {}) => {
  if (callMode !== "audio") return payload;
  return { ...payload, mode: "audio", camera: false };
};
