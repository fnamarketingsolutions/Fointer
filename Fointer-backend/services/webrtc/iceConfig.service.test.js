import assert from "node:assert/strict";
import test from "node:test";
import { createTimeLimitedTurnServer } from "../../utils/webrtcIceServers.js";
import { createIceConfigService } from "./iceConfig.service.js";

const now = 1_700_000_000_000;

const metered = (expiresAt = null, username = "5e7dbfbe19c6c158515907a6") => ({
  servers: [
    { urls: "turn:global.relay.metered.ca:80", username, credential: "pass" },
    { urls: "turn:global.relay.metered.ca:80?transport=tcp", username, credential: "pass" },
    { urls: "turn:global.relay.metered.ca:443", username, credential: "pass" },
    { urls: "turns:global.relay.metered.ca:443?transport=tcp", username, credential: "pass" },
  ],
  expiresAt,
});

const serviceWith = ({ credentials, env, clock = now }) => {
  let reads = 0;
  const service = createIceConfigService({
    env,
    now: () => clock,
    warn() {},
    fetchCredentials: async () => {
      reads += 1;
      return credentials;
    },
  });
  return { service, reads: () => reads };
};

test("a Metered response without expiry is cached and does not require renegotiation", async () => {
  const { service, reads } = serviceWith({
    credentials: metered(null),
    env: { NODE_ENV: "production", ICE_CONFIG_REFRESH_MS: "300000" },
  });
  const first = await service.getConfig({ userId: "user-1" });
  const second = await service.getConfig({ userId: "user-1" });
  assert.equal(reads(), 1);
  assert.equal(first.expiresAt, null);
  assert.equal(first.credentialUpdate, "next-peer-connection");
  assert.equal(first.restartBefore, null);
  assert.equal(first.relay.available, true);
  assert.equal(first.transportPolicy, "all");
  assert.equal(first.rtc.iceTransportPolicy, "all");
  assert.equal(first.refreshAt, new Date(now + 300000).toISOString());
  assert.equal(first.providerCache, "generated");
  assert.equal(second.providerCache, "hit");
  assert.equal(second.issuedAt, first.issuedAt);
  assert.equal(JSON.stringify(first).includes("pass"), true);
  assert.equal(first.fallback, null);
});

test("a genuine expiry recommends refresh and renegotiation before it lapses", async () => {
  const expiresAt = now + 2 * 60 * 1000;
  const { service } = serviceWith({
    credentials: metered(expiresAt),
    env: { NODE_ENV: "production", ICE_CONFIG_REFRESH_MS: "300000" },
  });
  const body = await service.getConfig({ fresh: true });
  assert.equal(body.expiresAt, new Date(expiresAt).toISOString());
  assert.equal(body.credentialUpdate, "renegotiate");
  assert.equal(body.restartBefore, new Date(expiresAt - 30_000).toISOString());
  assert.equal(body.refreshAt, body.restartBefore);
});

test("fresh bypasses the credential cache", async () => {
  const { service, reads } = serviceWith({
    credentials: metered(null),
    env: { NODE_ENV: "development" },
  });
  await service.getConfig();
  await service.getConfig({ fresh: true });
  assert.equal(reads(), 2);
});

test("production fails closed when no TURN configuration is available", async () => {
  const { service } = serviceWith({
    credentials: null,
    env: { NODE_ENV: "production" },
  });
  await assert.rejects(
    () => service.getConfig(),
    (error) => {
      assert.equal(error.code, "TURN_NOT_CONFIGURED");
      return true;
    }
  );
});

test("development STUN fallback is not a relay configuration", async () => {
  const { service } = serviceWith({
    credentials: null,
    env: { NODE_ENV: "development", ICE_RELAY_ONLY: "1" },
  });
  const body = await service.getConfig({ relayTest: true });
  assert.equal(body.fallback, "development-stun");
  assert.equal(body.relay.available, false);
  assert.equal(body.relay.required, false);
  assert.equal(body.transportPolicy, "all");
  assert.equal(body.rtc.iceTransportPolicy, "all");
  assert.equal(body.expiresAt, null);
  assert.equal(body.credentialUpdate, "next-peer-connection");
  assert.equal(body.iceServers.every((server) => String(server.urls).startsWith("stun:")), true);
});

test("relay-only testing is allowed only with TURN and never in production", async () => {
  const dev = serviceWith({
    credentials: metered(null),
    env: { NODE_ENV: "development" },
  });
  const enabled = await dev.service.getConfig({ relayTest: true });
  assert.equal(enabled.transportPolicy, "relay");
  assert.equal(enabled.rtc.iceTransportPolicy, "relay");

  const production = serviceWith({
    credentials: metered(null),
    env: { NODE_ENV: "production", ICE_RELAY_ONLY: "1" },
  });
  const ignored = await production.service.getConfig({ relayTest: true });
  assert.equal(ignored.transportPolicy, "all");
});

const relayIdentity = (body) => {
  const server = body.rtc.iceServers.find((item) => item.username);
  return {
    username: server?.username || "",
    credential: server?.credential || "",
  };
};

const secretEnv = (extra = {}) => ({
  NODE_ENV: "production",
  TURN_URL: "turn:turn.example.com:3478",
  TURN_SHARED_SECRET: "coturn-secret",
  ICE_CONFIG_REFRESH_MS: "300000",
  ...extra,
});

test("shared-secret TURN credentials are isolated per user", async () => {
  let generated = 0;
  const isolated = createIceConfigService({
    env: secretEnv(),
    now: () => now,
    warn() {},
    fetchCredentials: async () => null,
    createTurn: (options) => {
      generated += 1;
      return createTimeLimitedTurnServer(options);
    },
  });
  const firstA = await isolated.getConfig({ userId: "user-a" });
  const firstB = await isolated.getConfig({ userId: "user-b" });
  const secondA = await isolated.getConfig({ userId: "user-a" });
  const freshA = await isolated.getConfig({ userId: "user-a", fresh: true });
  const a = relayIdentity(firstA);
  const b = relayIdentity(firstB);
  assert.match(a.username, /:user-a$/);
  assert.match(b.username, /:user-b$/);
  assert.notEqual(a.username, b.username);
  assert.notEqual(a.credential, b.credential);
  assert.equal(relayIdentity(secondA).username, a.username);
  assert.match(relayIdentity(freshA).username, /:user-a$/);
  assert.equal(JSON.stringify(firstB).includes(a.username), false);
  assert.equal(JSON.stringify(firstA).includes(b.username), false);
  assert.equal(JSON.stringify(freshA).includes(b.username), false);
  assert.equal(generated, 3);
  assert.equal(firstA.credentialUpdate, "renegotiate");
});

test("concurrent shared-secret requests do not cross users or duplicate a user", async () => {
  const counts = {};
  let releaseA;
  const gateA = new Promise((resolve) => {
    releaseA = resolve;
  });
  const service = createIceConfigService({
    env: secretEnv(),
    now: () => now,
    warn() {},
    fetchCredentials: async () => null,
    createTurn: async (options) => {
      counts[options.userId] = (counts[options.userId] || 0) + 1;
      if (options.userId === "user-a") await gateA;
      return createTimeLimitedTurnServer(options);
    },
  });
  const pendingA1 = service.getConfig({ userId: "user-a" });
  const pendingA2 = service.getConfig({ userId: "user-a" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const userB = await service.getConfig({ userId: "user-b" });
  assert.equal(counts["user-a"], 1);
  assert.equal(counts["user-b"], 1);
  assert.match(relayIdentity(userB).username, /:user-b$/);
  releaseA();
  const [userA1, userA2] = await Promise.all([pendingA1, pendingA2]);
  assert.equal(relayIdentity(userA1).username, relayIdentity(userA2).username);
  assert.match(relayIdentity(userA1).username, /:user-a$/);
  assert.equal(JSON.stringify(userB).includes(relayIdentity(userA1).username), false);
  assert.equal(JSON.stringify(userA1).includes(relayIdentity(userB).username), false);
});

test("shared-secret cache expires and a later Metered response becomes primary", async () => {
  let clock = now;
  let generated = 0;
  let provider = null;
  let providerReads = 0;
  const service = createIceConfigService({
    env: secretEnv({ ICE_CONFIG_REFRESH_MS: "30000" }),
    now: () => clock,
    warn() {},
    fetchCredentials: async () => {
      providerReads += 1;
      return provider;
    },
    createTurn: (options) => {
      generated += 1;
      return createTimeLimitedTurnServer({ ...options, ttlSeconds: 3600 });
    },
  });
  const first = await service.getConfig({ userId: "user-a" });
  const cached = await service.getConfig({ userId: "user-a" });
  assert.equal(relayIdentity(cached).username, relayIdentity(first).username);
  assert.equal(generated, 1);
  assert.equal(providerReads, 1);

  clock = now + 30_000;
  const refreshed = await service.getConfig({ userId: "user-a" });
  assert.notEqual(relayIdentity(refreshed).username, relayIdentity(first).username);
  assert.match(relayIdentity(refreshed).username, /:user-a$/);
  assert.equal(generated, 2);

  clock = now + 60_000;
  provider = metered(null, "metered-user");
  const promoted = await service.getConfig({ userId: "user-a" });
  const other = await service.getConfig({ userId: "user-b" });
  assert.equal(relayIdentity(promoted).username, "metered-user");
  assert.equal(relayIdentity(other).username, "metered-user");
  assert.equal(generated, 2);
  assert.equal(promoted.credentialUpdate, "next-peer-connection");
});

test("shared-secret fallback stays disabled unless it is configured", async () => {
  let generated = 0;
  const service = createIceConfigService({
    env: { NODE_ENV: "production", TURN_URL: "turn:turn.example.com:3478" },
    now: () => now,
    warn() {},
    fetchCredentials: async () => null,
    createTurn: () => {
      generated += 1;
      return null;
    },
  });
  await assert.rejects(
    () => service.getConfig({ userId: "user-a" }),
    (error) => error.code === "TURN_NOT_CONFIGURED"
  );
  assert.equal(generated, 0);
});

test("a cached shared-secret credential is replaced inside the expiry margin", async () => {
  let clock = now;
  let generated = 0;
  const service = createIceConfigService({
    env: secretEnv({ ICE_CONFIG_REFRESH_MS: "3600000" }),
    now: () => clock,
    warn() {},
    fetchCredentials: async () => null,
    createTurn: (options) => {
      generated += 1;
      return createTimeLimitedTurnServer({ ...options, ttlSeconds: 60 });
    },
  });
  const first = await service.getConfig({ userId: "user-a" });
  clock = now + 31_000;
  const second = await service.getConfig({ userId: "user-a" });
  const other = await service.getConfig({ userId: "user-b" });
  assert.notEqual(relayIdentity(first).username, relayIdentity(second).username);
  assert.match(relayIdentity(second).username, /:user-a$/);
  assert.match(relayIdentity(other).username, /:user-b$/);
  assert.equal(generated, 3);
});

test("a long-running call with no provider expiry does not rotate the active connection", async () => {
  const { service } = serviceWith({
    credentials: metered(null),
    env: { NODE_ENV: "development", ICE_CONFIG_REFRESH_MS: "300000" },
  });
  const body = await service.getConfig();
  assert.equal(body.credentialUpdate, "next-peer-connection");
  assert.equal(body.restartBefore, null);
  const later = now + 20 * 60 * 1000;
  assert.equal(Date.parse(body.refreshAt) < later, true);
  assert.equal(body.expiresAt, null);
});
