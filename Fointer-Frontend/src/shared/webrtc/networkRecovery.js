export const recoveryNeededAfterNetworkChange = ({
  connectionState = "",
  iceConnectionState = "",
} = {}) => {
  if (connectionState === "connected") return false;
  if (iceConnectionState === "connected" || iceConnectionState === "completed") return false;
  return connectionState === "disconnected" ||
    connectionState === "failed" ||
    iceConnectionState === "disconnected" ||
    iceConnectionState === "failed";
};

/**
 * Browser network hints. ICE state and media stats remain the recovery signal.
 * Network Information API is optional and is not required for this to work.
 */
export const watchNetworkChanges = (onChange) => {
  if (typeof window === "undefined" || typeof onChange !== "function") return () => {};
  const notify = (source) => onChange({ source });
  const onOnline = () => notify("online");
  const onOffline = () => notify("offline");
  const onWake = () => {
    if (document.visibilityState === "visible") notify("wake");
  };
  const onInfo = () => notify("network-information");
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener?.("visibilitychange", onWake);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  connection?.addEventListener?.("change", onInfo);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener?.("visibilitychange", onWake);
    connection?.removeEventListener?.("change", onInfo);
  };
};
