import crypto from "crypto";

const flutterwaveSecret = () => String(process.env.FLW_SECRET_KEY || "").trim();
const flutterwaveHash = () => String(process.env.FLW_SECRET_HASH || "").trim();

export const isFlutterwaveConfigured = () =>
  Boolean(flutterwaveSecret() && flutterwaveHash());

export const flutterwaveConfigStatus = () => ({
  configured: isFlutterwaveConfigured(),
  hasSecretKey: Boolean(flutterwaveSecret()),
  hasSecretHash: Boolean(flutterwaveHash()),
});

/** Flutterwave sends the configured secret hash in the verif-hash header. */
export const verifyFlutterwaveWebhookSignature = (signatureHeader) => {
  const expected = flutterwaveHash();
  if (!expected) return false;
  const provided = String(signatureHeader || "");
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export const verifyFlutterwaveTransaction = async (transactionId) => {
  const secret = flutterwaveSecret();
  if (!secret) {
    return { ok: false, status: 503, message: "Flutterwave is not configured." };
  }
  const id = String(transactionId || "").trim();
  if (!id) {
    return { ok: false, status: 400, message: "Missing transaction id." };
  }

  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(id)}/verify`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    }
  );
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== "success") {
    return {
      ok: false,
      status: response.status >= 400 && response.status < 600 ? response.status : 502,
      message: data?.message || "Unable to verify this payment.",
      data,
    };
  }
  return { ok: true, data: data.data, raw: data };
};

export const paymentMatchesSubscription = (payment, transaction) =>
  String(payment?.status || "").toLowerCase() === "successful" &&
  String(payment?.currency || "").toUpperCase() ===
    String(transaction.currency || "").toUpperCase() &&
  Math.abs(Number(payment?.amount) - Number(transaction.amount)) < 0.005 &&
  String(payment?.tx_ref || "") === String(transaction.providerReference || "");

export const createFlutterwaveCheckout = async ({
  reference,
  amount,
  currency,
  redirectUrl,
  customer,
  title,
  description,
  meta,
  paymentPlanId = "",
}) => {
  const secret = flutterwaveSecret();
  if (!secret) {
    return { ok: false, status: 503, message: "Flutterwave is not configured." };
  }

  const body = {
    tx_ref: reference,
    amount,
    currency,
    redirect_url: redirectUrl,
    customer: {
      email: customer.email,
      name: customer.name || customer.username || customer.email,
    },
    customizations: {
      title: title || "Fointer Ad-Free Subscription",
      description: description || "Monthly ad-free subscription",
    },
    meta: meta || {},
  };

  if (paymentPlanId) {
    body.payment_plan = paymentPlanId;
  }

  // Log only non-sensitive checkout intent for support diagnosis (no secrets/PII).
  console.info("[flutterwave.checkout.init]", {
    tx_ref: reference,
    amount,
    currency: String(currency || "").toUpperCase(),
    hasPaymentPlan: Boolean(paymentPlanId),
    // Explicitly no payment_options / DCC fields — hosted Standard charge only.
    payment_options: null,
    dccFieldsPresent: false,
  });

  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  const paymentLink = data?.data?.link;
  if (!response.ok || data?.status !== "success" || !paymentLink) {
    console.error("[flutterwave.checkout.init.failed]", {
      tx_ref: reference,
      amount,
      currency: String(currency || "").toUpperCase(),
      httpStatus: response.status,
      message: data?.message || "No checkout link returned",
    });
    return {
      ok: false,
      status: response.status >= 400 && response.status < 500 ? 502 : 502,
      message: data?.message || "Flutterwave could not start checkout.",
      data,
    };
  }
  return { ok: true, checkoutUrl: paymentLink, data };
};

export const addBillingPeriod = (fromDate, days) => {
  const start = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + Math.max(1, Number(days) || 30));
  return end;
};
