import crypto from "crypto";

/**
 * App Store Server API / StoreKit verification adapter.
 *
 * Required env for live verification:
 * - APPLE_BUNDLE_ID
 * - APPLE_ISSUER_ID
 * - APPLE_KEY_ID
 * - APPLE_PRIVATE_KEY (PKCS8 PEM, newlines as \n)
 * Optional:
 * - APPLE_APP_STORE_ENVIRONMENT = Sandbox | Production (default Sandbox)
 *
 * Without credentials, endpoints return configuration errors and do not
 * grant entitlement from client-only payloads.
 */

const bundleId = () => String(process.env.APPLE_BUNDLE_ID || "").trim();
const issuerId = () => String(process.env.APPLE_ISSUER_ID || "").trim();
const keyId = () => String(process.env.APPLE_KEY_ID || "").trim();
const privateKey = () =>
  String(process.env.APPLE_PRIVATE_KEY || "")
    .trim()
    .replace(/\\n/g, "\n");

export const appleConfigStatus = () => ({
  configured: Boolean(bundleId() && issuerId() && keyId() && privateKey()),
  bundleId: bundleId() || null,
  environment: String(process.env.APPLE_APP_STORE_ENVIRONMENT || "Sandbox"),
  hasApiKey: Boolean(issuerId() && keyId() && privateKey()),
});

const base64url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const signAppStoreJwt = () => {
  const header = base64url(
    JSON.stringify({ alg: "ES256", kid: keyId(), typ: "JWT" })
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      iss: issuerId(),
      iat: now,
      exp: now + 50 * 60,
      aud: "appstoreconnect-v1",
      bid: bundleId(),
    })
  );
  const data = `${header}.${payload}`;
  const key = privateKey();
  const signature = crypto.sign("sha256", Buffer.from(data), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${data}.${base64url(signature)}`;
};

const apiHost = () => {
  const env = String(process.env.APPLE_APP_STORE_ENVIRONMENT || "Sandbox")
    .trim()
    .toLowerCase();
  return env === "production"
    ? "https://api.storekit.itunes.apple.com"
    : "https://api.storekit-sandbox.itunes.apple.com";
};

const decodeJwsPayload = (jws) => {
  const parts = String(jws || "").split(".");
  if (parts.length < 2) return null;
  const json = Buffer.from(
    parts[1].replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf8");
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/**
 * Look up transaction via App Store Server API.
 * Prefer transactionId from StoreKit 2.
 */
export const verifyAppleTransaction = async ({ transactionId }) => {
  const status = appleConfigStatus();
  if (!status.configured) {
    return {
      ok: false,
      status: 503,
      message:
        "App Store billing is not configured. Set APPLE_BUNDLE_ID, APPLE_ISSUER_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY.",
    };
  }

  const id = String(transactionId || "").trim();
  if (!id) {
    return { ok: false, status: 400, message: "transactionId is required." };
  }

  try {
    const token = signAppStoreJwt();
    const response = await fetch(
      `${apiHost()}/inApps/v1/transactions/${encodeURIComponent(id)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: body?.errorMessage || "Apple transaction lookup failed.",
        data: body,
      };
    }

    const payload = decodeJwsPayload(body?.signedTransactionInfo);
    if (!payload) {
      return {
        ok: false,
        status: 400,
        message: "Apple response missing signed transaction.",
        data: body,
      };
    }

    if (bundleId() && payload.bundleId && payload.bundleId !== bundleId()) {
      return {
        ok: false,
        status: 400,
        message: "Bundle id mismatch.",
        data: payload,
      };
    }

    const periodStart = payload.purchaseDate
      ? new Date(Number(payload.purchaseDate))
      : new Date();
    const periodEnd = payload.expiresDate
      ? new Date(Number(payload.expiresDate))
      : null;

    if (!periodEnd || Number.isNaN(periodEnd.getTime())) {
      return {
        ok: false,
        status: 400,
        message: "Apple transaction is missing subscription expiry.",
        data: payload,
      };
    }

    const revoked = Boolean(payload.revocationDate);
    const active = !revoked && periodEnd.getTime() > Date.now();

    return {
      ok: true,
      active,
      revoked,
      productId: payload.productId || "",
      originalTransactionId: String(payload.originalTransactionId || id),
      transactionId: String(payload.transactionId || id),
      periodStart,
      periodEnd,
      environment: payload.environment || status.environment,
      raw: {
        type: payload.type,
        offerType: payload.offerType,
        revocationDate: payload.revocationDate || null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      message: error?.message || "Apple verification failed.",
    };
  }
};

export const summarizeAppleNotification = (body) => {
  const signedPayload = body?.signedPayload;
  const outer = signedPayload ? decodeJwsPayload(signedPayload) : body;
  const data = outer?.data || {};
  const notificationType = String(
    outer?.notificationType || body?.notificationType || "unknown"
  );
  const subtype = String(outer?.subtype || body?.subtype || "");
  const eventId = String(
    outer?.notificationUUID || body?.notificationUUID || crypto.randomUUID()
  );

  let transactionPayload = null;
  if (data.signedTransactionInfo) {
    transactionPayload = decodeJwsPayload(data.signedTransactionInfo);
  }

  return {
    eventType: subtype ? `${notificationType}:${subtype}` : notificationType,
    eventId,
    transactionId: String(
      transactionPayload?.transactionId ||
        transactionPayload?.originalTransactionId ||
        ""
    ),
    originalTransactionId: String(
      transactionPayload?.originalTransactionId || ""
    ),
    productId: String(transactionPayload?.productId || ""),
    payload: transactionPayload,
  };
};
