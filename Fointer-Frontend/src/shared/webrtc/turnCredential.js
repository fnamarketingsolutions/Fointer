/**
 * Time-limited TURN password (coturn REST / use-auth-secret).
 * The Open Relay secret is published by Metered for client use.
 */
const textEncoder = new TextEncoder();

export const turnUsername = (expiresAtSec, label = "fointer") =>
  `${expiresAtSec}:${label}`;

export const turnPassword = async (username, secret) => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(String(secret)),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(String(username))
  );
  let binary = "";
  const bytes = new Uint8Array(signature);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const OPEN_RELAY_SECRET = "openrelayprojectsecret";
const OPEN_RELAY_HOST = "staticauth.openrelay.metered.ca";

/** STUN plus TURN on 80/443 so a phone on LTE can still send video. */
export const openRelayIceServers = async (nowMs = Date.now()) => {
  const expiresAtSec = Math.floor(nowMs / 1000) + 24 * 60 * 60;
  const username = turnUsername(expiresAtSec);
  const credential = await turnPassword(username, OPEN_RELAY_SECRET);
  const turn = (urls) => ({ urls, username, credential });
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    turn(`turn:${OPEN_RELAY_HOST}:80`),
    turn(`turn:${OPEN_RELAY_HOST}:80?transport=tcp`),
    turn(`turn:${OPEN_RELAY_HOST}:443`),
    turn(`turns:${OPEN_RELAY_HOST}:443?transport=tcp`),
  ];
};
