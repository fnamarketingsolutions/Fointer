import { createHmac } from "node:crypto";

const turnUrls = (value) => {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return values
    .map((url) => String(url || "").trim())
    .filter((url) => /^turns?:/i.test(url));
};

export const normalizeTurnServers = (servers) => {
  if (!Array.isArray(servers)) return [];
  return servers.flatMap((server) => {
    const urls = turnUrls(server?.urls);
    const username = String(server?.username || "");
    const credential = String(server?.credential || "");
    if (!urls.length || !username || !credential) return [];
    return [{
      urls: urls.length === 1 ? urls[0] : urls,
      username,
      credential,
    }];
  });
};

const METERED_HOST_SUFFIXES = ["metered.live", "metered.ca"];
const PROVIDER_FALLBACK_TTL_MS = 5 * 60 * 1000;

/** HTTPS origin for the configured Metered app, or a thrown configuration error. */
export const resolveMeteredProviderOrigin = (domain) => {
  const raw = String(domain || "").trim();
  let url;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    throw new Error("Invalid TURN provider domain configuration.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid TURN provider domain configuration.");
  }
  if (url.pathname && url.pathname !== "/") {
    throw new Error("Invalid TURN provider domain configuration.");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Invalid TURN provider domain configuration.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const allowed = METERED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
  if (!allowed || host.includes("..")) {
    throw new Error("Invalid TURN provider domain configuration.");
  }
  return `https://${host}`;
};

/**
 * Credential endpoint documented by Metered: GET /api/v1/turn/credentials?apiKey=...
 * The query value must be the credential-scoped key from that TURN credential.
 * The account secret key belongs on other Metered APIs and is rejected here.
 */
export const meteredCredentialsUrl = (domain) =>
  new URL("/api/v1/turn/credentials", resolveMeteredProviderOrigin(domain));

export const turnProviderConfigState = ({ domain, apiKey } = {}) => {
  const rawKey = apiKey == null ? "" : String(apiKey);
  const trimmedKey = rawKey.trim();
  return {
    domain: String(domain || "").trim(),
    apiKeyPresent: rawKey.length > 0,
    apiKeyEmptyAfterTrim: rawKey.length > 0 && trimmedKey.length === 0,
    apiKeyHadSurroundingWhitespace: rawKey !== trimmedKey && trimmedKey.length > 0,
  };
};

const providerErrorCategory = (body, apiKey) => {
  const error = typeof body?.error === "string" ? body.error.trim() : "";
  if (!error || error.length > 120 || (apiKey && error.includes(apiKey))) return "unrecognized";
  if (!/^[A-Za-z0-9 .,'-]{1,120}$/.test(error)) return "unrecognized";
  return error;
};

const providerFailure = (message, diagnostics) => {
  const error = new Error(message);
  error.diagnostics = diagnostics;
  return error;
};

export const providerCredentialExpiry = (body, servers, nowMs = Date.now()) => {
  const explicit = Date.parse(body?.expiresAt || body?.expires_at || "");
  if (Number.isFinite(explicit) && explicit > nowMs) return explicit;

  const usernameExpiries = (servers || [])
    .map((server) => Number(String(server.username).split(":", 1)[0]) * 1000)
    .filter((expiry) => Number.isFinite(expiry) && expiry > nowMs);
  return usernameExpiries.length
    ? Math.min(...usernameExpiries)
    : nowMs + PROVIDER_FALLBACK_TTL_MS;
};

/**
 * Fetches the provider's own TURN entries. Returns null when Metered is not configured.
 * Throws a static message on failure so the API key and credentials are never logged.
 */
export const fetchMeteredTurnCredentials = async ({
  domain = process.env.METERED_DOMAIN,
  apiKey = process.env.METERED_API_KEY,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
  nowMs = Date.now(),
} = {}) => {
  const configState = turnProviderConfigState({ domain, apiKey });
  const configuredDomain = configState.domain;
  const key = String(apiKey || "").trim();
  if (!configuredDomain || !key) return null;

  const credentialsUrl = meteredCredentialsUrl(configuredDomain);
  credentialsUrl.searchParams.set("apiKey", key);
  const startedAt = Date.now();
  const failure = (message, extra = {}) => providerFailure(message, {
    domain: configuredDomain,
    apiKeyPresent: configState.apiKeyPresent,
    apiKeyEmptyAfterTrim: configState.apiKeyEmptyAfterTrim,
    apiKeyHadSurroundingWhitespace: configState.apiKeyHadSurroundingWhitespace,
    durationMs: Date.now() - startedAt,
    ...extra,
  });

  let response;
  try {
    response = await fetchImpl(credentialsUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = error?.name || "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw failure("TURN provider request timed out.", { status: 0, category: "timeout" });
    }
    throw failure("TURN provider request failed.", { status: 0, category: "network" });
  }

  if (!response?.ok) {
    const status = Number(response?.status) || 0;
    let category = "unrecognized";
    try {
      category = providerErrorCategory(await response.json(), key);
    } catch {
      category = "unrecognized";
    }
    throw failure(
      status ? `TURN provider responded with ${status}.` : "TURN provider request failed.",
      { status, category }
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("TURN provider returned an invalid response.");
  }
  if (!body || (typeof body !== "object" && !Array.isArray(body))) {
    throw new Error("TURN provider returned an invalid response.");
  }

  const servers = Array.isArray(body) ? body : body.iceServers;
  const turnServers = normalizeTurnServers(servers);
  if (!turnServers.length) {
    throw new Error("TURN provider returned no usable relay.");
  }
  return {
    servers: turnServers,
    expiresAt: providerCredentialExpiry(body, turnServers, nowMs),
  };
};

export const createTimeLimitedTurnServer = ({
  urls,
  sharedSecret,
  userId,
  nowMs = Date.now(),
  ttlSeconds = 60 * 60,
} = {}) => {
  const normalizedUrls = turnUrls(urls);
  const secret = String(sharedSecret || "");
  if (!normalizedUrls.length || !secret) return null;

  const expiresAt = Math.floor(nowMs / 1000) + ttlSeconds;
  const identity = String(userId || "fointer").replace(/[^a-zA-Z0-9._-]/g, "") || "fointer";
  const username = `${expiresAt}:${identity}`;
  const credential = createHmac("sha1", secret).update(username).digest("base64");

  return {
    iceServer: {
      urls: normalizedUrls.length === 1 ? normalizedUrls[0] : normalizedUrls,
      username,
      credential,
    },
    expiresAt: expiresAt * 1000,
  };
};