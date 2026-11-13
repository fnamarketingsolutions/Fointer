import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  createTimeLimitedTurnServer,
  fetchCloudflareTurnCredentials,
  fetchConfiguredTurnCredentials,
  fetchMeteredTurnCredentials,
  normalizeTurnServers,
  resolveCloudflareTurnTtl,
  resolveMeteredProviderOrigin,
} from "./webrtcIceServers.js";

test("TURN REST credentials are user-scoped and expire at the configured time", () => {
  const nowMs = 1_700_000_000_000;
  const result = createTimeLimitedTurnServer({
    urls: "turn:turn.example.com:3478,turns:turn.example.com:443?transport=tcp",
    sharedSecret: "test-secret",
    userId: "user-123",
    nowMs,
    ttlSeconds: 1800,
  });
  const expectedUsername = `${Math.floor(nowMs / 1000) + 1800}:user-123`;
  const expectedCredential = createHmac("sha1", "test-secret")
    .update(expectedUsername)
    .digest("base64");

  assert.deepEqual(result.iceServer.urls, [
    "turn:turn.example.com:3478",
    "turns:turn.example.com:443?transport=tcp",
  ]);
  assert.equal(result.iceServer.username, expectedUsername);
  assert.equal(result.iceServer.credential, expectedCredential);
  assert.equal(result.expiresAt, (Math.floor(nowMs / 1000) + 1800) * 1000);
});

test("TURN provider responses discard STUN-only and incomplete entries", () => {
  assert.deepEqual(
    normalizeTurnServers([
      { urls: "stun:stun.example.com:3478" },
      { urls: "turn:turn.example.com:3478", username: "u" },
      {
        urls: ["stun:stun.example.com:3478", "turns:turn.example.com:443"],
        username: "u",
        credential: "p",
      },
    ]),
    [{
      urls: "turns:turn.example.com:443",
      username: "u",
      credential: "p",
    }]
  );
});

test("the configured Metered app host is accepted and other hosts are rejected", () => {
  assert.equal(resolveMeteredProviderOrigin("fointer.metered.live"), "https://fointer.metered.live");
  assert.equal(
    resolveMeteredProviderOrigin("https://fointer.metered.live"),
    "https://fointer.metered.live"
  );
  assert.equal(resolveMeteredProviderOrigin("app.metered.ca"), "https://app.metered.ca");
  for (const domain of [
    "http://fointer.metered.live",
    "https://evil.example",
    "https://fointer.metered.live.evil.example",
    "https://user:pass@fointer.metered.live",
    "https://fointer.metered.live/other",
  ]) {
    assert.throws(
      () => resolveMeteredProviderOrigin(domain),
      /Invalid TURN provider domain configuration/
    );
  }
});

const meteredIceResponse = () => [
  { urls: "stun:stun.relay.metered.ca:80" },
  { urls: "turn:global.relay.metered.ca:80", username: "user", credential: "pass" },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "user",
    credential: "pass",
  },
  { urls: "turn:global.relay.metered.ca:443", username: "user", credential: "pass" },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "user",
    credential: "pass",
  },
];

test("Metered credentials keep every UDP, TCP, and TLS relay the provider returned", async () => {
  const apiKey = "metered-test-key";
  let requested = null;
  const result = await fetchMeteredTurnCredentials({
    domain: "fointer.metered.live",
    apiKey,
    nowMs: 1_700_000_000_000,
    fetchImpl: async (url) => {
      requested = new URL(url);
      return { ok: true, status: 200, json: async () => meteredIceResponse() };
    },
  });

  assert.equal(requested.origin, "https://fointer.metered.live");
  assert.equal(requested.pathname, "/api/v1/turn/credentials");
  assert.equal(requested.searchParams.get("apiKey"), apiKey);
  assert.deepEqual(
    result.servers.map((server) => server.urls),
    [
      "turn:global.relay.metered.ca:80",
      "turn:global.relay.metered.ca:80?transport=tcp",
      "turn:global.relay.metered.ca:443",
      "turns:global.relay.metered.ca:443?transport=tcp",
    ]
  );
  assert.equal(JSON.stringify(result).includes("stun:"), false);
  assert.equal(result.expiresAt, null);
});

test("Metered credentials without an expiry are not given a fabricated deadline", async () => {
  const nowMs = 1_700_000_000_000;
  const result = await fetchMeteredTurnCredentials({
    domain: "fointer.metered.live",
    apiKey: "metered-test-key",
    nowMs,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "5e7dbfbe19c6c158515907a6",
          credential: "pass",
        },
      ],
    }),
  });
  assert.equal(result.expiresAt, null);
});

test("an explicit provider expiry is kept when it is still in the future", async () => {
  const nowMs = 1_700_000_000_000;
  const expiresAt = new Date(nowMs + 60 * 60 * 1000).toISOString();
  const result = await fetchMeteredTurnCredentials({
    domain: "fointer.metered.live",
    apiKey: "metered-test-key",
    nowMs,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        expiresAt,
        iceServers: [
          { urls: "turn:turn.example.com:3478", username: "opaque", credential: "pass" },
        ],
      }),
    }),
  });
  assert.equal(result.expiresAt, nowMs + 60 * 60 * 1000);
});

test("a coturn username expiry is read from the unix-second prefix", async () => {
  const nowMs = 1_700_000_000_000;
  const expirySeconds = Math.floor(nowMs / 1000) + 1800;
  const result = await fetchMeteredTurnCredentials({
    domain: "fointer.metered.live",
    apiKey: "metered-test-key",
    nowMs,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          urls: "turn:turn.example.com:3478",
          username: `${expirySeconds}:fointer`,
          credential: "pass",
        },
      ],
    }),
  });
  assert.equal(result.expiresAt, expirySeconds * 1000);
});

test("an invalid Metered response is rejected without using the response body as the error", async () => {
  const apiKey = "metered-test-key";
  await assert.rejects(
    () =>
      fetchMeteredTurnCredentials({
        domain: "fointer.metered.live",
        apiKey,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ iceServers: [{ urls: "stun:stun.example.com:3478" }] }),
        }),
      }),
    (error) => {
      assert.equal(error.message, "TURN provider returned no usable relay.");
      assert.equal(error.message.includes(apiKey), false);
      return true;
    }
  );

  await assert.rejects(
    () =>
      fetchMeteredTurnCredentials({
        domain: "fointer.metered.live",
        apiKey,
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          json: async () => ({ error: "Invalid API Key", apiKey }),
        }),
      }),
    (error) => {
      assert.equal(error.message, "TURN provider responded with 401.");
      assert.equal(error.diagnostics.status, 401);
      assert.equal(error.diagnostics.category, "Invalid API Key");
      assert.equal(error.diagnostics.apiKeyPresent, true);
      assert.equal(error.diagnostics.apiKeyEmptyAfterTrim, false);
      assert.equal(JSON.stringify(error.diagnostics).includes(apiKey), false);
      return true;
    }
  );
});

test("a missing or blank API key does not call the provider", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => meteredIceResponse() };
  };
  assert.equal(await fetchMeteredTurnCredentials({ domain: "fointer.metered.live", apiKey: "", fetchImpl }), null);
  assert.equal(
    await fetchMeteredTurnCredentials({ domain: "fointer.metered.live", apiKey: "   ", fetchImpl }),
    null
  );
  assert.equal(
    await fetchMeteredTurnCredentials({ domain: "", apiKey: "metered-test-key", fetchImpl }),
    null
  );
  assert.equal(calls, 0);
});

test("surrounding whitespace is removed before the API key is sent", async () => {
  let requested = null;
  await fetchMeteredTurnCredentials({
    domain: " fointer.metered.live ",
    apiKey: "  metered-test-key\n",
    fetchImpl: async (url, options) => {
      requested = { url: new URL(url), method: options.method };
      return { ok: true, status: 200, json: async () => meteredIceResponse() };
    },
  });
  assert.equal(requested.method, "GET");
  assert.equal(requested.url.origin, "https://fointer.metered.live");
  assert.deepEqual([...requested.url.searchParams.keys()], ["apiKey"]);
  assert.equal(requested.url.searchParams.get("apiKey"), "metered-test-key");
  assert.equal(requested.url.search.includes("%25"), false);
});

test("HTTP 403 is reported without copying the provider body into the message", async () => {
  const apiKey = "metered-test-key";
  await assert.rejects(
    () =>
      fetchMeteredTurnCredentials({
        domain: "fointer.metered.live",
        apiKey,
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          json: async () => ({ error: "Forbidden", apiKey }),
        }),
      }),
    (error) => {
      assert.equal(error.message, "TURN provider responded with 403.");
      assert.equal(error.diagnostics.status, 403);
      assert.equal(error.diagnostics.category, "Forbidden");
      assert.equal(JSON.stringify(error.diagnostics).includes(apiKey), false);
      return true;
    }
  );
});

test("an incorrect TURN hostname is rejected before a request is sent", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      fetchMeteredTurnCredentials({
        domain: "https://fointer.metered.live.evil.example",
        apiKey: "metered-test-key",
        fetchImpl: async () => {
          calls += 1;
          return { ok: true, status: 200, json: async () => meteredIceResponse() };
        },
      }),
    /Invalid TURN provider domain configuration/
  );
  assert.equal(calls, 0);
});

test("a Metered timeout fails closed and does not expose the API key", async () => {
  const apiKey = "metered-test-key";
  let pending = true;
  await assert.rejects(
    () =>
      fetchMeteredTurnCredentials({
        domain: "fointer.metered.live",
        apiKey,
        secretKey: "",
        timeoutMs: 20,
        fetchImpl: (_url, { signal }) =>
          new Promise((resolve, reject) => {
            const lateSuccess = setTimeout(() => {
              resolve({ ok: true, status: 200, json: async () => meteredIceResponse() });
            }, 1000);
            const onAbort = () => {
              clearTimeout(lateSuccess);
              pending = false;
              const error = new Error(`aborted ${apiKey}`);
              error.name = "AbortError";
              reject(error);
            };
            if (signal?.aborted) onAbort();
            else signal?.addEventListener("abort", onAbort, { once: true });
          }),
      }),
    (error) => {
      assert.equal(error.message, "TURN provider request timed out.");
      assert.equal(error.message.includes(apiKey), false);
      assert.equal(JSON.stringify(error.diagnostics).includes(apiKey), false);
      assert.equal(error.diagnostics.category, "timeout");
      assert.equal(error.servers, undefined);
      return true;
    }
  );
  assert.equal(pending, false);
});

test("wrapping quotes and a BOM are removed before the credential key is sent", async () => {
  let requested = null;
  await fetchMeteredTurnCredentials({
    domain: "fointer.metered.live",
    apiKey: '\uFEFF"metered-test-key"',
    secretKey: "",
    fetchImpl: async (url) => {
      requested = new URL(url);
      return { ok: true, status: 200, json: async () => meteredIceResponse() };
    },
  });
  assert.equal(requested.searchParams.get("apiKey"), "metered-test-key");
});

test("a malformed provider key is rejected before a request is sent", async () => {
  const apiKey = "metered test key";
  let calls = 0;
  await assert.rejects(
    () =>
      fetchMeteredTurnCredentials({
        domain: "fointer.metered.live",
        apiKey,
        secretKey: "",
        fetchImpl: async () => {
          calls += 1;
          return { ok: true, status: 200, json: async () => meteredIceResponse() };
        },
      }),
    (error) => {
      assert.equal(error.message, "Invalid TURN provider key configuration.");
      assert.equal(error.message.includes(apiKey), false);
      return true;
    }
  );
  assert.equal(calls, 0);
});

test("an account secret rejected as a credential key resolves an existing credential", async () => {
  const accountSecret = "account-secret-value";
  const credentialKey = "credential-api-key";
  const calls = [];
  const result = await fetchMeteredTurnCredentials({
    domain: "fointer.metered.live",
    apiKey: accountSecret,
    secretKey: "",
    nowMs: 1_700_000_000_000,
    fetchImpl: async (url, options) => {
      const parsed = new URL(url);
      calls.push({ method: options.method, pathname: parsed.pathname, params: [...parsed.searchParams.keys()] });
      if (parsed.pathname === "/api/v1/turn/credentials" && parsed.searchParams.get("apiKey") === accountSecret) {
        return { ok: false, status: 401, json: async () => ({ error: "Invalid API Key", apiKey: accountSecret }) };
      }
      if (parsed.pathname === "/api/v2/turn/credentials" && parsed.searchParams.get("secretKey") === accountSecret) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { username: "expired-user", password: "expired-pass", apiKey: "expired-key", expired: true },
              { username: "live-user", password: "live-pass", apiKey: credentialKey, expired: false, expiryInSeconds: 3600 },
            ],
          }),
        };
      }
      if (parsed.pathname === "/api/v1/turn/credentials" && parsed.searchParams.get("apiKey") === credentialKey) {
        return { ok: true, status: 200, json: async () => meteredIceResponse() };
      }
      return { ok: false, status: 500, json: async () => ({ error: "unexpected" }) };
    },
  });

  assert.deepEqual(calls, [
    { method: "GET", pathname: "/api/v1/turn/credentials", params: ["apiKey"] },
    { method: "GET", pathname: "/api/v2/turn/credentials", params: ["secretKey"] },
    { method: "GET", pathname: "/api/v1/turn/credentials", params: ["apiKey"] },
  ]);
  assert.equal(result.servers.some((server) => String(server.urls).startsWith("turn:")), true);
  assert.equal(JSON.stringify(result).includes(accountSecret), false);
  assert.equal(JSON.stringify(result).includes("live-pass"), false);
  assert.equal(result.expiresAt, null);
});

test("a rejected account secret fails closed and does not expose either key", async () => {
  const accountSecret = "account-secret-value";
  const credentialKey = "credential-api-key";
  let posts = 0;
  await assert.rejects(
    () =>
      fetchMeteredTurnCredentials({
        domain: "fointer.metered.live",
        apiKey: credentialKey,
        secretKey: accountSecret,
        fetchImpl: async (url, options) => {
          if (options.method === "POST") posts += 1;
          const parsed = new URL(url);
          const status = parsed.searchParams.has("secretKey") ? 400 : 401;
          return {
            ok: false,
            status,
            json: async () => ({ error: status === 401 ? "Invalid API Key" : "not subscribed", secret: accountSecret }),
          };
        },
      }),
    (error) => {
      assert.equal(error.message, "TURN provider responded with 401.");
      assert.equal(error.diagnostics.category, "Invalid API Key");
      assert.equal(error.diagnostics.secretLookupStatus, 400);
      assert.equal(error.diagnostics.secretLookupCategory, "not subscribed");
      const serialized = JSON.stringify(error.diagnostics) + error.message;
      assert.equal(serialized.includes(accountSecret), false);
      assert.equal(serialized.includes(credentialKey), false);
      assert.equal(error.servers, undefined);
      return true;
    }
  );
  assert.equal(posts, 0);
});

const CLOUDFLARE_KEY_ID = "abc123def456";
const CLOUDFLARE_TOKEN = "cf-test-token";
const CLOUDFLARE_USER = "cf-turn-username";
const CLOUDFLARE_PASS = "cf-turn-credential";
const cloudflareNow = 1_700_000_000_000;

const cloudflareTurnUrls = [
  "turn:turn.cloudflare.com:3478?transport=udp",
  "turn:turn.cloudflare.com:443?transport=udp",
  "turn:turn.cloudflare.com:53?transport=udp",
  "turn:turn.cloudflare.com:3478?transport=tcp",
  "turn:turn.cloudflare.com:80?transport=tcp",
  "turns:turn.cloudflare.com:5349?transport=tcp",
  "turns:turn.cloudflare.com:443?transport=tcp",
];

const cloudflareIceBody = (extra = {}) => ({
  iceServers: [
    { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
    {
      urls: cloudflareTurnUrls,
      username: CLOUDFLARE_USER,
      credential: CLOUDFLARE_PASS,
    },
  ],
  ...extra,
});

const cloudflareSuccess = (body = cloudflareIceBody()) => ({
  ok: true,
  status: 201,
  json: async () => body,
});

test("Cloudflare credential generation keeps every UDP, TCP, and TLS URL", async () => {
  let requested = null;
  const result = await fetchCloudflareTurnCredentials({
    keyId: ` ${CLOUDFLARE_KEY_ID} `,
    apiToken: `\uFEFF"${CLOUDFLARE_TOKEN}"`,
    ttlSeconds: "86400",
    nowMs: cloudflareNow,
    fetchImpl: async (url, options) => {
      requested = { href: String(url), ...options };
      return cloudflareSuccess();
    },
  });

  assert.equal(resolveCloudflareTurnTtl(""), 86400);
  assert.equal(resolveCloudflareTurnTtl("3600"), 3600);
  assert.equal(resolveCloudflareTurnTtl("59"), null);
  assert.equal(resolveCloudflareTurnTtl("172801"), null);
  assert.equal(
    requested.href,
    `https://rtc.live.cloudflare.com/v1/turn/keys/${CLOUDFLARE_KEY_ID}/credentials/generate-ice-servers`
  );
  assert.equal(requested.method, "POST");
  assert.equal(requested.redirect, "error");
  assert.equal(requested.headers.Authorization, `Bearer ${CLOUDFLARE_TOKEN}`);
  assert.equal(requested.headers["Content-Type"], "application/json");
  assert.equal(requested.body, JSON.stringify({ ttl: 86400 }));
  assert.equal(requested.href.includes(CLOUDFLARE_TOKEN), false);
  assert.equal(requested.body.includes(CLOUDFLARE_TOKEN), false);
  assert.equal(result.servers.length, 1);
  assert.deepEqual(result.servers[0].urls, cloudflareTurnUrls);
  assert.equal(result.servers[0].username, CLOUDFLARE_USER);
  assert.equal(result.servers[0].credential, CLOUDFLARE_PASS);
  assert.equal(result.expiresAt, cloudflareNow + 86400 * 1000);
  assert.equal(JSON.stringify(result).includes("stun:"), false);
  assert.equal(JSON.stringify(result).includes(CLOUDFLARE_TOKEN), false);
});

test("Cloudflare expiry follows the configured TTL and ignores a longer echo", async () => {
  const shorter = await fetchCloudflareTurnCredentials({
    keyId: CLOUDFLARE_KEY_ID,
    apiToken: CLOUDFLARE_TOKEN,
    ttlSeconds: 86400,
    nowMs: cloudflareNow,
    fetchImpl: async (_url, options) => {
      assert.equal(options.body, JSON.stringify({ ttl: 86400 }));
      return cloudflareSuccess(cloudflareIceBody({ ttl: 3600 }));
    },
  });
  assert.equal(shorter.expiresAt, cloudflareNow + 3600 * 1000);

  const capped = await fetchCloudflareTurnCredentials({
    keyId: CLOUDFLARE_KEY_ID,
    apiToken: CLOUDFLARE_TOKEN,
    ttlSeconds: "3600",
    nowMs: cloudflareNow,
    fetchImpl: async (_url, options) => {
      assert.equal(options.body, JSON.stringify({ ttl: 3600 }));
      return cloudflareSuccess(cloudflareIceBody({ ttl: 172800 }));
    },
  });
  assert.equal(capped.expiresAt, cloudflareNow + 3600 * 1000);

  const unchanged = await fetchCloudflareTurnCredentials({
    keyId: CLOUDFLARE_KEY_ID,
    apiToken: CLOUDFLARE_TOKEN,
    ttlSeconds: 86400,
    nowMs: cloudflareNow,
    fetchImpl: async () => cloudflareSuccess(cloudflareIceBody({ ttl: 0 })),
  });
  assert.equal(unchanged.expiresAt, cloudflareNow + 86400 * 1000);
});

test("an invalid Cloudflare response is rejected without copying the body", async () => {
  const cases = [
    { iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }] },
    { iceServers: [{ urls: cloudflareTurnUrls, username: CLOUDFLARE_USER }] },
    { iceServers: { urls: cloudflareTurnUrls, username: CLOUDFLARE_USER, credential: CLOUDFLARE_PASS } },
    null,
  ];
  for (const body of cases) {
    let calls = 0;
    await assert.rejects(
      () => fetchCloudflareTurnCredentials({
        keyId: CLOUDFLARE_KEY_ID,
        apiToken: CLOUDFLARE_TOKEN,
        ttlSeconds: 86400,
        fetchImpl: async () => {
          calls += 1;
          return { ok: true, status: 201, json: async () => body };
        },
      }),
      (error) => {
        assert.equal(calls, 1);
        assert.match(error.message, /invalid response|no usable relay/);
        const serialized = `${error.message} ${JSON.stringify(error.diagnostics)}`;
        assert.equal(serialized.includes(CLOUDFLARE_TOKEN), false);
        assert.equal(serialized.includes(CLOUDFLARE_USER), false);
        assert.equal(serialized.includes(CLOUDFLARE_PASS), false);
        assert.equal(error.servers, undefined);
        return true;
      }
    );
  }
});

test("Cloudflare API errors stay sanitized and auth failures are not retried", async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchCloudflareTurnCredentials({
      keyId: CLOUDFLARE_KEY_ID,
      apiToken: CLOUDFLARE_TOKEN,
      ttlSeconds: 86400,
      retryDelayMs: 0,
      fetchImpl: async () => {
        calls += 1;
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: `denied ${CLOUDFLARE_TOKEN} ${CLOUDFLARE_USER} ${CLOUDFLARE_PASS} at 203.0.113.10`,
            sdp: "v=0",
            candidate: "candidate:1 1 UDP 203.0.113.10",
          }),
        };
      },
    }),
    (error) => {
      assert.equal(error.message, "TURN provider responded with 401.");
      assert.equal(error.diagnostics.provider, "cloudflare");
      assert.equal(error.diagnostics.status, 401);
      assert.equal(error.diagnostics.category, "unrecognized");
      assert.equal(error.diagnostics.keyIdPresent, true);
      assert.equal(error.diagnostics.apiKeyPresent, true);
      const serialized = `${error.message} ${JSON.stringify(error.diagnostics)}`;
      for (const secret of [CLOUDFLARE_TOKEN, CLOUDFLARE_KEY_ID, CLOUDFLARE_USER, CLOUDFLARE_PASS, "203.0.113.10", "v=0", "candidate:"]) {
        assert.equal(serialized.includes(secret), false, secret);
      }
      return true;
    }
  );
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(
    () => fetchCloudflareTurnCredentials({
      keyId: CLOUDFLARE_KEY_ID,
      apiToken: CLOUDFLARE_TOKEN,
      ttlSeconds: 86400,
      retryDelayMs: 0,
      maxAttempts: 2,
      fetchImpl: async () => {
        calls += 1;
        return { ok: false, status: 500, json: async () => ({ error: "unavailable" }) };
      },
    }),
    (error) => {
      assert.equal(error.message, "TURN provider responded with 500.");
      assert.equal(error.diagnostics.category, "unavailable");
      assert.equal(error.diagnostics.attempts, 2);
      return true;
    }
  );
  assert.equal(calls, 2);
});

test("a transient Cloudflare failure can succeed on the bounded retry", async () => {
  let calls = 0;
  const result = await fetchCloudflareTurnCredentials({
    keyId: CLOUDFLARE_KEY_ID,
    apiToken: CLOUDFLARE_TOKEN,
    ttlSeconds: 86400,
    nowMs: cloudflareNow,
    retryDelayMs: 0,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 503, json: async () => ({ error: "unavailable" }) };
      return cloudflareSuccess();
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.servers[0].credential, CLOUDFLARE_PASS);
  assert.equal(result.expiresAt, cloudflareNow + 86400 * 1000);
});

test("a Cloudflare timeout aborts every attempt and does not expose the token", async () => {
  let calls = 0;
  let active = 0;
  await assert.rejects(
    () => fetchCloudflareTurnCredentials({
      keyId: CLOUDFLARE_KEY_ID,
      apiToken: CLOUDFLARE_TOKEN,
      ttlSeconds: 86400,
      timeoutMs: 20,
      maxAttempts: 2,
      retryDelayMs: 0,
      fetchImpl: (_url, { signal }) => {
        calls += 1;
        active += 1;
        return new Promise((resolve, reject) => {
          const lateSuccess = setTimeout(() => {
            active -= 1;
            resolve(cloudflareSuccess());
          }, 1000);
          const onAbort = () => {
            clearTimeout(lateSuccess);
            active -= 1;
            const error = new Error(`aborted ${CLOUDFLARE_TOKEN}`);
            error.name = "AbortError";
            reject(error);
          };
          if (signal?.aborted) onAbort();
          else signal?.addEventListener("abort", onAbort, { once: true });
        });
      },
    }),
    (error) => {
      assert.equal(error.message, "TURN provider request timed out.");
      assert.equal(error.diagnostics.category, "timeout");
      assert.equal(error.diagnostics.attempts, 2);
      const serialized = `${error.message} ${JSON.stringify(error.diagnostics)}`;
      assert.equal(serialized.includes(CLOUDFLARE_TOKEN), false);
      assert.equal(error.servers, undefined);
      return true;
    }
  );
  assert.equal(calls, 2);
  assert.equal(active, 0);
});

test("incomplete or malformed Cloudflare configuration does not call the provider", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return cloudflareSuccess();
  };
  assert.equal(
    await fetchCloudflareTurnCredentials({ keyId: "", apiToken: "", fetchImpl }),
    null
  );
  await assert.rejects(
    () => fetchCloudflareTurnCredentials({
      keyId: CLOUDFLARE_KEY_ID,
      apiToken: "",
      fetchImpl,
    }),
    (error) => error.diagnostics.category === "malformed-key"
  );
  await assert.rejects(
    () => fetchCloudflareTurnCredentials({
      keyId: "../admin",
      apiToken: CLOUDFLARE_TOKEN,
      fetchImpl,
    }),
    (error) => {
      assert.equal(error.message, "Invalid TURN provider key configuration.");
      assert.equal(error.message.includes(CLOUDFLARE_TOKEN), false);
      return true;
    }
  );
  await assert.rejects(
    () => fetchCloudflareTurnCredentials({
      keyId: CLOUDFLARE_KEY_ID,
      apiToken: CLOUDFLARE_TOKEN,
      ttlSeconds: "10",
      fetchImpl,
    }),
    (error) => error.diagnostics.category === "invalid-ttl"
  );
  assert.equal(calls, 0);
});

test("selecting Cloudflare does not call Metered, and Metered remains the rollback", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ href: String(url), method: options.method });
    if (String(url).includes("cloudflare")) return cloudflareSuccess();
    return { ok: true, status: 200, json: async () => meteredIceResponse() };
  };
  const sharedEnv = {
    CLOUDFLARE_TURN_KEY_ID: CLOUDFLARE_KEY_ID,
    CLOUDFLARE_TURN_API_TOKEN: CLOUDFLARE_TOKEN,
    CLOUDFLARE_TURN_TTL: "86400",
    METERED_DOMAIN: "fointer.metered.live",
    METERED_API_KEY: "metered-test-key",
  };

  const cloudflare = await fetchConfiguredTurnCredentials({
    env: { ...sharedEnv, WEBRTC_TURN_PROVIDER: "cloudflare" },
    fetchImpl,
    nowMs: cloudflareNow,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].href, /\/credentials\/generate-ice-servers$/);
  assert.equal(cloudflare.expiresAt, cloudflareNow + 86400 * 1000);

  calls.length = 0;
  const metered = await fetchConfiguredTurnCredentials({
    env: { ...sharedEnv, WEBRTC_TURN_PROVIDER: "metered" },
    fetchImpl,
    nowMs: cloudflareNow,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.match(calls[0].href, /^https:\/\/fointer\.metered\.live\/api\/v1\/turn\/credentials\?/);
  assert.equal(metered.expiresAt, null);

  calls.length = 0;
  await fetchConfiguredTurnCredentials({
    env: sharedEnv,
    fetchImpl,
    nowMs: cloudflareNow,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");

  let invalidCalls = 0;
  await assert.rejects(
    () => fetchConfiguredTurnCredentials({
      env: { ...sharedEnv, WEBRTC_TURN_PROVIDER: "cloudflare-metered" },
      fetchImpl: async () => {
        invalidCalls += 1;
        return cloudflareSuccess();
      },
    }),
    (error) => error.diagnostics.category === "invalid-provider"
  );
  assert.equal(invalidCalls, 0);
});