import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getLiveSocket } from "../../../shared/services/liveSocket";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { useAuth } from "../../../context/AuthContext";

/**
 * Routes incoming 1:1 DM calls to the conversation thread so DirectCall can
 * sync / show the ringing UI (including when the user is elsewhere in the app).
 */
export default function IncomingDmCallBridge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  useEffect(() => {
    if (!user) return undefined;

    const socket = getLiveSocket();
    const onIncoming = (payload) => {
      const id = payload?.conversationId;
      if (!id) return;

      const target = `/messages/${id}`;
      if (location.pathname === target) return;

      const from =
        payload.from?.name || payload.from?.username || "Someone";
      const kind = payload.mode === "video" ? "video" : "audio";
      showToast(`${from} is calling (${kind})`);
      navigate(target);
    };

    socket.on("dm_call_incoming", onIncoming);
    return () => socket.off("dm_call_incoming", onIncoming);
  }, [user, location.pathname, navigate, showToast]);

  return null;
}
