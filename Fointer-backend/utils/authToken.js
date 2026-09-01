/**
 * Read a JWT from cookie (web) or Authorization Bearer (native / API clients).
 */

const bearerFromHeader = (value) => {
  const header = String(value || "").trim();
  if (!header) return null;
  if (header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    return token || null;
  }
  return null;
};

export const getRequestToken = (req) => {
  const cookieToken = req.cookies?.token;
  if (cookieToken) return cookieToken;
  return bearerFromHeader(req.headers?.authorization || req.headers?.Authorization);
};

export const getHandshakeToken = (socket) => {
  const cookies = socket?.handshake?.headers?.cookie;
  if (cookies) {
    const parts = String(cookies).split(";");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith("token=")) {
        const raw = trimmed.slice("token=".length);
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      }
    }
  }

  const authToken = socket?.handshake?.auth?.token;
  if (authToken) return String(authToken);

  return bearerFromHeader(
    socket?.handshake?.headers?.authorization ||
      socket?.handshake?.headers?.Authorization
  );
};
