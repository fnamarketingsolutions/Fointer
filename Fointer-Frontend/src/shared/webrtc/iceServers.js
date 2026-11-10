import api from "../services/http/client";
import {
  iceRefreshDue,
  maybeRotateIce,
  rtcConfigFromIceResponse,
  TurnUnavailableError,
} from "./iceContract.js";

export { TurnUnavailableError, iceRefreshDue, maybeRotateIce };

let cached = null;

const productionBuild = () => {
  try {
    return Boolean(import.meta.env?.PROD);
  } catch {
    return false;
  }
};

export const getIceSession = () => cached;

/** Fetches the backend ICE contract. The returned object is passed to RTCPeerConnection. */
export const getIceConfig = async ({ force = false } = {}) => {
  const refreshAt = Date.parse(cached?.refreshAt || "");
  const cacheValid = cached
    && !iceRefreshDue(cached)
    && Number.isFinite(refreshAt)
    && refreshAt > Date.now();
  if (!force && cacheValid) return cached.rtc;

  try {
    const response = await api.get("/webrtc/ice-servers", {
      timeout: 7000,
      params: force ? { fresh: "1" } : undefined,
    });
    cached = rtcConfigFromIceResponse(response.data, { production: productionBuild() });
    return cached.rtc;
  } catch (error) {
    cached = null;
    if (error instanceof TurnUnavailableError) throw error;
    throw new TurnUnavailableError();
  }
};

export const refreshIceConfigIfDue = async () => {
  if (iceRefreshDue(cached)) return getIceConfig({ force: true });
  return getIceConfig();
};
