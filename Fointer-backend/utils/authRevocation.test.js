import assert from "node:assert/strict";
import test from "node:test";
import {
  disconnectRevokedSockets,
  isAuthUserRevoked,
  restoreAuthUser,
  revokeAuthUser,
} from "./authRevocation.js";

test("a banned user is revoked immediately and an unban clears it", () => {
  revokeAuthUser("user-1");
  assert.equal(isAuthUserRevoked("user-1"), true);
  assert.equal(isAuthUserRevoked("user-2"), false);
  restoreAuthUser("user-1");
  assert.equal(isAuthUserRevoked("user-1"), false);
});

test("an empty id is ignored", () => {
  revokeAuthUser("");
  assert.equal(isAuthUserRevoked(""), false);
});

test("revocation disconnects that user's open sockets", () => {
  const rooms = [];
  const io = {
    in(name) {
      return {
        disconnectSockets(close) {
          rooms.push({ name, close });
        },
      };
    },
  };
  disconnectRevokedSockets(io, "user-1");
  disconnectRevokedSockets(null, "user-1");
  assert.deepEqual(rooms, [{ name: "user:user-1", close: true }]);
});
