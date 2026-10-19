import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { openRelayIceServers, turnPassword, turnUsername } from "./turnCredential.js";

test("TURN password matches coturn's HMAC-SHA1 username credential", async () => {
  const username = turnUsername(1_900_000_000, "fointer");
  const secret = "openrelayprojectsecret";
  const expected = createHmac("sha1", secret).update(username).digest("base64");
  assert.equal(await turnPassword(username, secret), expected);
});

test("relay config includes TLS on 443 for mobile networks", async () => {
  const servers = await openRelayIceServers(1_700_000_000_000);
  const urls = servers.map((server) => server.urls);
  assert.ok(urls.includes("turns:staticauth.openrelay.metered.ca:443?transport=tcp"));
  assert.ok(servers.some((server) => server.username && server.credential));
});
