import { GoogleAuth } from "google-auth-library";

/**
 * Google Play Billing verification adapter.
 * Requires GOOGLE_PLAY_PACKAGE_NAME and either:
 * - GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (stringified JSON), or
 * - GOOGLE_APPLICATION_CREDENTIALS pointing at a service account file.
 *
 * Without credentials, verification returns a clear configuration error
 * and never grants entitlement from client-supplied booleans.
 */

const packageName = () =>
  String(process.env.GOOGLE_PLAY_PACKAGE_NAME || "").trim();

export const googlePlayConfigStatus = () => {
  const hasJson = Boolean(
    String(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || "").trim()
  );
  const hasFile = Boolean(
    String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim()
  );
  return {
    configured: Boolean(packageName() && (hasJson || hasFile)),
    packageName: packageName() || null,
    hasServiceAccount: hasJson || hasFile,
  };
};

const getAuthClient = async () => {
  const jsonRaw = String(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || "").trim();
  let credentials;
  if (jsonRaw) {
    credentials = JSON.parse(jsonRaw);
  }
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  return auth.getClient();
};

/**
 * Verify a subscription purchase token with Google Play Developer API v3.
 * Returns normalized period dates when successful.
 */
export const verifyGooglePlaySubscription = async ({
  productId,
  purchaseToken,
}) => {
  const status = googlePlayConfigStatus();
  if (!status.configured) {
    return {
      ok: false,
      status: 503,
      message:
        "Google Play Billing is not configured. Set GOOGLE_PLAY_PACKAGE_NAME and a service account.",
    };
  }

  const token = String(purchaseToken || "").trim();
  const sku = String(productId || "").trim();
  if (!token || !sku) {
    return {
      ok: false,
      status: 400,
      message: "productId and purchaseToken are required.",
    };
  }

  try {
    const client = await getAuthClient();
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(status.packageName)}/purchases/subscriptions/` +
      `${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`;

    const response = await client.request({ url, method: "GET" });
    const data = response.data || {};

    // paymentState: 1 = received, 2 = free trial, 3 = pending deferred
    const paymentState = Number(data.paymentState);
    const cancelReason = data.cancelReason;
    const expiryTimeMillis = Number(data.expiryTimeMillis || 0);
    const startTimeMillis = Number(data.startTimeMillis || Date.now());
    const expiry = expiryTimeMillis ? new Date(expiryTimeMillis) : null;

    if (!expiry || Number.isNaN(expiry.getTime())) {
      return {
        ok: false,
        status: 400,
        message: "Google Play response missing expiry.",
        data,
      };
    }

    // cancelReason: 0 user, 1 system, 2 replaced, 3 developer
    const acknowledgementState = Number(data.acknowledgementState);
    const active =
      expiry.getTime() > Date.now() &&
      (paymentState === 1 || paymentState === 2 || Number.isNaN(paymentState));

    return {
      ok: true,
      active,
      /** Cancellation alone does not revoke until period end; refunds use separate flows. */
      revoked: false,
      autoRenewing: Boolean(data.autoRenewing),
      periodStart: new Date(startTimeMillis),
      periodEnd: expiry,
      orderId: data.orderId || "",
      acknowledgementState,
      raw: {
        paymentState,
        cancelReason,
        expiryTimeMillis,
        autoRenewing: data.autoRenewing,
      },
    };
  } catch (error) {
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Google Play verification failed.";
    return {
      ok: false,
      status: error?.response?.status || 502,
      message: String(message).slice(0, 500),
    };
  }
};

/**
 * Acknowledge a subscription purchase when required (acknowledgementState === 0).
 */
export const acknowledgeGooglePlaySubscription = async ({
  productId,
  purchaseToken,
}) => {
  const status = googlePlayConfigStatus();
  if (!status.configured) {
    return { ok: false, status: 503, message: "Google Play Billing is not configured." };
  }
  try {
    const client = await getAuthClient();
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(status.packageName)}/purchases/subscriptions/` +
      `${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
    await client.request({ url, method: "POST", data: {} });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      status: error?.response?.status || 502,
      message: error?.message || "Acknowledge failed.",
    };
  }
};

/** Parse RTDN / PubSub style notification for idempotency keys. */
export const summarizeGooglePlayNotification = (body) => {
  const notification =
    body?.subscriptionNotification ||
    body?.oneTimeProductNotification ||
    null;
  if (!notification) {
    return {
      eventType: String(body?.eventType || "unknown"),
      eventId:
        String(body?.message?.messageId || body?.eventId || body?.eventTimeMillis || "") ||
        cryptoRandom(),
      purchaseToken: "",
      productId: "",
    };
  }
  return {
    eventType: `subscription_notification_${notification.notificationType}`,
    eventId: String(
      notification.purchaseToken ||
        body?.eventTimeMillis ||
        body?.message?.messageId ||
        cryptoRandom()
    ),
    purchaseToken: String(notification.purchaseToken || ""),
    productId: String(notification.subscriptionId || notification.sku || ""),
  };
};

const cryptoRandom = () =>
  `gp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
