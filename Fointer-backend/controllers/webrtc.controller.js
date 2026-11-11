import { iceConfigService } from "../services/webrtc/iceConfig.service.js";
import { safeDiagnosticBatchId, sanitizeCallDiagnostic } from "../utils/callDiagnostics.js";
import { logRealtime } from "../utils/realtimeLog.js";

const MAX_DIAGNOSTIC_EVENTS = 20;
const recentDiagnosticBatches = new Set();
const recentDiagnosticOrder = [];

const rememberDiagnosticBatch = (batchId) => {
  if (!batchId) return false;
  if (recentDiagnosticBatches.has(batchId)) return true;
  recentDiagnosticBatches.add(batchId);
  recentDiagnosticOrder.push(batchId);
  if (recentDiagnosticOrder.length > 200) {
    recentDiagnosticBatches.delete(recentDiagnosticOrder.shift());
  }
  return false;
};

const sanitizeDiagnosticList = (events) => {
  const accepted = [];
  for (const item of events) {
    const entry = sanitizeCallDiagnostic(item);
    if (entry) accepted.push(entry);
  }
  return accepted;
};

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
  const body = req.body;
  if (body && typeof body === "object" && Array.isArray(body.events)) {
    const batchId = safeDiagnosticBatchId(body.batchId);
    if (batchId && rememberDiagnosticBatch(batchId)) {
      return res.json({ success: true, duplicate: true, accepted: 0 });
    }
    const events = sanitizeDiagnosticList(body.events.slice(0, MAX_DIAGNOSTIC_EVENTS));
    if (!events.length) {
      return res.status(400).json({ success: false, message: "Diagnostic was empty." });
    }
    const dropped = Number.isInteger(body.dropped) && body.dropped > 0 && body.dropped <= 100_000
      ? body.dropped
      : 0;
    logRealtime("call_diagnostic_batch", {
      batchId,
      count: events.length,
      dropped,
      events,
    });
    return res.json({ success: true, accepted: events.length });
  }

  const entry = sanitizeCallDiagnostic(body);
  if (!entry) {
    return res.status(400).json({ success: false, message: "Diagnostic was empty." });
  }
  logRealtime("call_diagnostic", entry);
  return res.json({ success: true });
};
