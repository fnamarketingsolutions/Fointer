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