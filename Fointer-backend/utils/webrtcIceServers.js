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

const futureMillis = (value, nowMs) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 0 && value < 1e11 ? value * 1000 : value;
    return ms > nowMs ? ms : null;
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return futureMillis(Number(trimmed), nowMs);
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed) && parsed > nowMs) return parsed;
  }
  return null;
};

/** Coturn REST usernames are `<unix seconds>:<label>`. Opaque ids are not expiry. */
const coturnExpiryMs = (username, nowMs) => {
  const head = String(username || "").split(":")[0];
  if (!/^\d{10}$/.test(head)) return null;
  const ms = Number(head) * 1000;
  return ms > nowMs ? ms : null;
};

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
 * That query accepts only the credential-scoped key. The account secret is rejected
 * with HTTP 401 "Invalid API Key" and is used only to list an existing credential.
 */
export const meteredCredentialsUrl = (domain) =>
  new URL("/api/v1/turn/credentials", resolveMeteredProviderOrigin(domain));

/** Removes a BOM, surrounding whitespace, and one or two layers of wrapping quotes. */
export const normalizeMeteredKey = (value) => {
  let key = String(value ?? "");
  if (key.charCodeAt(0) === 0xfeff) key = key.slice(1);
  key = key.trim();
  for (let i = 0; i < 2; i += 1) {
    const quote = key[0];
    if (key.length < 2 || (quote !== '"' && quote !== "'") || key.at(-1) !== quote) break;
    key = key.slice(1, -1).trim();
  }
  return key;
};

const malformedMeteredKey = (key) => /[\s\u0000-\u001f\u007f]/.test(key);

export const turnProviderConfigState = ({ domain, apiKey } = {}) => {
  const rawKey = apiKey == null ? "" : String(apiKey);
  const trimmedKey = rawKey.trim();
  const normalizedKey = normalizeMeteredKey(rawKey);
  return {
    domain: String(domain || "").trim(),
    apiKeyPresent: rawKey.length > 0,
    apiKeyEmptyAfterTrim: rawKey.length > 0 && normalizedKey.length === 0,
    apiKeyHadSurroundingWhitespace: rawKey !== trimmedKey && normalizedKey.length > 0,
  };
};

const providerErrorCategory = (body, secrets) => {
  const error = typeof body?.error === "string" ? body.error.trim() : "";
  const hidden = (Array.isArray(secrets) ? secrets : [secrets]).filter(Boolean);
  if (!error || error.length > 120 || hidden.some((secret) => error.includes(secret))) return "unrecognized";
  if (!/^[A-Za-z0-9 .,'-]{1,120}$/.test(error)) return "unrecognized";
  return error;
};

const providerFailure = (message, diagnostics) => {
  const error = new Error(message);
  error.diagnostics = diagnostics;
  return error;
};

/**
 * Real credential expiry only.
 * Returns null when the provider response has no future expiry and the username
 * is not a coturn timestamp. A missing expiry is not replaced with a guess.
 */
export const providerCredentialExpiry = (body, servers, nowMs = Date.now()) => {
  const explicit = futureMillis(body?.expiresAt ?? body?.expires_at, nowMs);
  if (explicit) return explicit;

  const usernameExpiries = (servers || [])
    .map((server) => coturnExpiryMs(server?.username, nowMs))
    .filter((expiry) => Number.isFinite(expiry));
  return usernameExpiries.length ? Math.min(...usernameExpiries) : null;
};

/**
 * Fetches the provider's own TURN entries. Returns null when Metered is not configured.
 * Throws a static message on failure so the API key and credentials are never logged.
 */
export const fetchMeteredTurnCredentials = async ({
  domain = process.env.METERED_DOMAIN,
  apiKey = process.env.METERED_API_KEY,
  secretKey = process.env.METERED_SECRET_KEY,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
  nowMs = Date.now(),
} = {}) => {
  const configState = turnProviderConfigState({ domain, apiKey });
  const configuredDomain = configState.domain;
  const credentialKey = normalizeMeteredKey(apiKey);
  const accountSecret = normalizeMeteredKey(secretKey);
  if (!configuredDomain || (!credentialKey && !accountSecret)) return null;

  const origin = resolveMeteredProviderOrigin(configuredDomain);
  const hiddenKeys = [credentialKey, accountSecret].filter(Boolean);
  const startedAt = Date.now();
  const failure = (message, extra = {}) => providerFailure(message, {
    domain: configuredDomain,
    apiKeyPresent: configState.apiKeyPresent || accountSecret.length > 0,
    apiKeyEmptyAfterTrim: configState.apiKeyEmptyAfterTrim,
    apiKeyHadSurroundingWhitespace: configState.apiKeyHadSurroundingWhitespace,
    durationMs: Date.now() - startedAt,
    ...extra,
  });

  if (hiddenKeys.some(malformedMeteredKey)) {
    throw failure("Invalid TURN provider key configuration.", { status: 0, category: "malformed-key" });
  }

  const providerGet = async (url) => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      return await fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      const name = error?.name || "";
      if (timedOut || name === "TimeoutError" || name === "AbortError") {
        throw failure("TURN provider request timed out.", { status: 0, category: "timeout" });
      }
      throw failure("TURN provider request failed.", { status: 0, category: "network" });
    } finally {
      clearTimeout(timer);
    }
  };

  const rejected = async (response) => {
    const status = Number(response?.status) || 0;
    let category = "unrecognized";
    try {
      category = providerErrorCategory(await response.json(), hiddenKeys);
    } catch {
      category = "unrecognized";
    }
    return failure(
      status ? `TURN provider responded with ${status}.` : "TURN provider request failed.",
      { status, category }
    );
  };

  const loadCredential = async (key) => {
    const credentialsUrl = new URL("/api/v1/turn/credentials", origin);
    credentialsUrl.searchParams.set("apiKey", key);
    const response = await providerGet(credentialsUrl);
    if (!response?.ok) throw await rejected(response);

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
    if (!turnServers.length) throw new Error("TURN provider returned no usable relay.");
    return {
      servers: turnServers,
      expiresAt: providerCredentialExpiry(body, turnServers, nowMs),
    };
  };

  const resolveExistingCredentialKey = async (secret) => {
    const listUrl = new URL("/api/v2/turn/credentials", origin);
    listUrl.searchParams.set("secretKey", secret);
    const response = await providerGet(listUrl);
    if (!response?.ok) {
      const error = await rejected(response);
      error.diagnostics.authMode = "account-secret";
      throw error;
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw failure("TURN provider returned an invalid response.", {
        status: Number(response?.status) || 0,
        category: "invalid-response",
        authMode: "account-secret",
      });
    }
    const rows = Array.isArray(body?.data) ? body.data : [];
    const usable = [];
    for (const row of rows) {
      if (!row || row.expired === true) continue;
      const resolved = normalizeMeteredKey(row.apiKey);
      if (!resolved || malformedMeteredKey(resolved)) continue;
      const expiry = Number(row.expiryInSeconds);
      usable.push({ resolved, expiry: Number.isFinite(expiry) ? expiry : 0 });
    }
    usable.sort((left, right) => right.expiry - left.expiry);
    if (!usable.length) {
      throw failure("TURN provider has no usable credential.", {
        status: Number(response?.status) || 0,
        category: "no-usable-credential",
        authMode: "account-secret",
      });
    }
    return usable[0].resolved;
  };

  const afterRejectedCredentialKey = async (secret, credentialError) => {
    try {
      const resolved = await resolveExistingCredentialKey(secret);
      if (!resolved || resolved === credentialKey) throw credentialError;
      return await loadCredential(resolved);
    } catch (lookupError) {
      if (lookupError?.diagnostics?.authMode !== "account-secret") throw lookupError;
      throw failure("TURN provider responded with 401.", {
        status: 401,
        category: "Invalid API Key",
        secretLookupStatus: Number(lookupError.diagnostics.status) || 0,
        secretLookupCategory: String(lookupError.diagnostics.category || "unrecognized"),
      });
    }
  };

  if (!credentialKey) {
    const resolved = await resolveExistingCredentialKey(accountSecret);
    return loadCredential(resolved);
  }

  try {
    return await loadCredential(credentialKey);
  } catch (error) {
    const invalidCredentialKey = error?.diagnostics?.status === 401
      && error?.diagnostics?.category === "Invalid API Key";
    if (!invalidCredentialKey) throw error;
    return afterRejectedCredentialKey(accountSecret || credentialKey, error);
  }
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