import { iceConfigService } from "../services/webrtc/iceConfig.service.js";
import { sanitizeCallDiagnostic } from "../utils/callDiagnostics.js";
import { logRealtime } from "../utils/realtimeLog.js";

export const getIceServers = async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const body = await iceConfigService.getConfig({
      userId: String(req.user?._id || req.user?.id || ""),
      relayTest: String(req.query.relayTest || "") === "1",
      fresh: String(req.query.fresh || "") === "1",
    });
    return res.json(body);
  } catch (error) {
    if (error?.code === "TURN_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        code: "TURN_NOT_CONFIGURED",
        message: "Call relay is temporarily unavailable.",
      });
    }
    throw error;
  }
};

export const postCallDiagnostic = (req, res) => {
  const entry = sanitizeCallDiagnostic(req.body);
  if (!entry) {
    return res.status(400).json({ success: false, message: "Diagnostic was empty." });
  }
  logRealtime("call_diagnostic", entry);
  return res.json({ success: true });
};
