import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  selectIceConfig,
  STUN_SERVERS,
  TURN_UNAVAILABLE_MESSAGE,
  DEV_ICE_RELAY_STORAGE_KEY,
  devRelayRequested,
  validateIceConfig,
  withTestRelayPolicy,
} from "./iceConfigPolicy.js";

const productionTurn = {
  iceServers: [
    ...STUN_SERVERS,
    {
      urls: [
        "turn:global.relay.metered.ca:80",
        "turn:global.relay.metered.ca:80?transport=tcp",
        "turns:global.relay.metered.ca:443?transport=tcp",
      ],
      username: "user",
      credential: "pass",
    },
  ],
  bundlePolicy: "max-bundle",
};

const demoRelay = {
  iceServers: [
    ...STUN_SERVERS,
    {
      urls: "turn:staticauth.openrelay.metered.ca:80",
      username: "user",
      credential: "pass",
    },
  ],
  bundlePolicy: "max-bundle",
};

const stunOnly = { iceServers: [...STUN_SERVERS], bundlePolicy: "max-bundle" };

test("production accepts backend TURN and rejects a missing relay", () => {
  const selected = selectIceConfig({
    production: true,
    remoteConfig: productionTurn,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  assert.equal(selected.source, "backend");
  assert.equal(selected.config, productionTurn);

  const missing = selectIceConfig({ production: true, remoteConfig: null });
  assert.equal(missing.code, "TURN_UNAVAILABLE");
  assert.equal(missing.error, TURN_UNAVAILABLE_MESSAGE);
  assert.equal(missing.config, undefined);
});

test("the public demo relay cannot be selected in production", () => {
  const selected = selectIceConfig({ production: true, remoteConfig: demoRelay });
  assert.equal(selected.code, "TURN_UNAVAILABLE");
  assert.equal(JSON.stringify(selected).includes("openrelay.metered.ca"), false);
});

test("STUN-only connectivity fails production validation", () => {
  const verdict = validateIceConfig(stunOnly, { production: true });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.turnCount, 0);
  const selected = selectIceConfig({ production: true, remoteConfig: stunOnly });
  assert.equal(selected.code, "TURN_UNAVAILABLE");
});

test("development can still place a local STUN call when TURN is down", () => {
  const selected = selectIceConfig({ production: false, remoteConfig: null });
  assert.equal(selected.source, "development-stun");
  assert.equal(selected.config.iceServers.length, 2);
  assert.equal(validateIceConfig(selected.config, { production: false }).ok, true);
});

test("production selection does not force a relay-only transport", () => {
  const selected = selectIceConfig({
    production: true,
    remoteConfig: productionTurn,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  assert.equal(selected.config.iceTransportPolicy, undefined);
  assert.equal(withTestRelayPolicy(selected.config, false).iceTransportPolicy, undefined);
});

test("relay-only mode stays off in production and accepts only an explicit development switch", () => {
  assert.equal(devRelayRequested({ dev: false, prod: true, windowFlag: true, stored: "1" }), false);
  assert.equal(devRelayRequested({ dev: true, prod: true, windowFlag: true, stored: "1" }), false);
  assert.equal(devRelayRequested({ dev: true, prod: false, windowFlag: "true", stored: "" }), false);
  assert.equal(devRelayRequested({ dev: true, prod: false, windowFlag: true, stored: "" }), true);
  assert.equal(devRelayRequested({ dev: true, prod: false, stored: "1" }), true);
  assert.equal(DEV_ICE_RELAY_STORAGE_KEY, "fointer:dev-ice-relay");
});

test("the relay-only transport is added only when a test explicitly enables it", () => {
  const selected = withTestRelayPolicy(productionTurn, true);
  assert.equal(selected.iceTransportPolicy, "relay");
  assert.equal(productionTurn.iceTransportPolicy, undefined);
  assert.equal(JSON.stringify(selected).includes("openrelay"), false);
});

test("the call ICE loader does not embed the demo relay or permanent TURN credentials", () => {
  const source = readFileSync(new URL("./iceServers.js", import.meta.url), "utf8");
  assert.equal(source.includes("openrelay"), false);
  assert.equal(source.includes("openRelayIceServers"), false);
  assert.equal(source.includes("VITE_TURN_"), false);
});
