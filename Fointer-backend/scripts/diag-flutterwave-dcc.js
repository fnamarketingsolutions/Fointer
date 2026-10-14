/**
 * Diagnostic only: probes Flutterwave account currencies and a USD payment-link init.
 * Never prints secrets, card data, or customer PII beyond a fixed diag email.
 */
import "../config/loadEnv.js";

const secret = String(process.env.FLW_SECRET_KEY || "").trim();
const frontendUrl = String(process.env.FRONTEND_URL || "http://localhost:5173")
  .trim()
  .replace(/\/+$/, "");

const sanitize = (data) => {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.slice(0, 5).map(sanitize);
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (/email|phone|name|account|token|key|hash|secret|card|pan|cvv|link/i.test(key)) {
      if (key === "link" && typeof value === "string") {
        try {
          out.linkHost = new URL(value).host;
          out.hasLink = true;
        } catch {
          out.hasLink = Boolean(value);
        }
      } else {
        out[key] = value == null ? value : "[redacted]";
      }
    } else if (typeof value === "object") {
      out[key] = sanitize(value);
    } else {
      out[key] = value;
    }
  }
  return out;
};

const flwGet = async (path) => {
  const response = await fetch(`https://api.flutterwave.com/v3${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await response.json().catch(() => null);
  return {
    httpStatus: response.status,
    status: body?.status,
    message: body?.message,
    data: sanitize(body?.data),
  };
};

const flwPost = async (path, payload) => {
  const response = await fetch(`https://api.flutterwave.com/v3${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  return {
    httpStatus: response.status,
    status: body?.status,
    message: body?.message,
    data: sanitize(body?.data),
  };
};

if (!secret) {
  console.log(JSON.stringify({ error: "FLW_SECRET_KEY missing" }));
  process.exit(1);
}

console.log(
  JSON.stringify({
    phase: "env",
    keyLooksLikeTest: /TEST/i.test(secret),
    keyFamily: secret.startsWith("FLWSECK") ? "FLWSECK*" : "other",
    frontendUrl,
  })
);

console.log(JSON.stringify({ phase: "balances", ...(await flwGet("/balances")) }));
console.log(
  JSON.stringify({
    phase: "rates_ngn_to_usd",
    ...(await flwGet(
      "/transfers/rates?amount=5&destination_currency=USD&source_currency=NGN"
    )),
  })
);
console.log(
  JSON.stringify({
    phase: "rates_usd_to_ngn",
    ...(await flwGet(
      "/transfers/rates?amount=5&destination_currency=NGN&source_currency=USD"
    )),
  })
);

const requestPayload = {
  tx_ref: `FO-DIAG-${Date.now()}`,
  amount: 4.99,
  currency: "USD",
  redirect_url: `${frontendUrl}/subscription/success`,
  customer: { email: "diag@example.com", name: "Diag User" },
  customizations: {
    title: "Fointer DCC diagnostic",
    description: "Do not complete payment",
  },
  meta: { type: "diagnostic", do_not_fulfill: true },
};

const init = await flwPost("/payments", requestPayload);
console.log(
  JSON.stringify({
    phase: "payment_init_usd",
    request: {
      amount: requestPayload.amount,
      currency: requestPayload.currency,
      tx_ref_prefix: "FO-DIAG-",
      payment_plan: null,
      payment_options: null,
      redirect_path: "/subscription/success",
    },
    response: init,
  })
);

const ngnInit = await flwPost("/payments", {
  ...requestPayload,
  tx_ref: `FO-DIAG-NGN-${Date.now()}`,
  amount: 1000,
  currency: "NGN",
});
console.log(
  JSON.stringify({
    phase: "payment_init_ngn_compare",
    request: { amount: 1000, currency: "NGN", tx_ref_prefix: "FO-DIAG-NGN-" },
    response: ngnInit,
  })
);

const failedRes = await fetch(
  "https://api.flutterwave.com/v3/transactions?from=2026-01-01&to=2026-12-31&currency=USD&status=failed",
  { headers: { Authorization: `Bearer ${secret}` } }
);
const failedBody = await failedRes.json().catch(() => null);
const rows = Array.isArray(failedBody?.data) ? failedBody.data : [];
console.log(
  JSON.stringify({
    phase: "failed_usd_transactions",
    httpStatus: failedRes.status,
    status: failedBody?.status,
    message: failedBody?.message,
    count: rows.length,
    samples: rows.slice(0, 5).map((row) => ({
      id: row.id,
      status: row.status,
      currency: row.currency,
      amount: row.amount,
      charged_amount: row.charged_amount,
      app_fee: row.app_fee,
      processor_response: row.processor_response,
      cardType: row.card?.type || null,
      cardCountry: row.card?.country || null,
    })),
  })
);
