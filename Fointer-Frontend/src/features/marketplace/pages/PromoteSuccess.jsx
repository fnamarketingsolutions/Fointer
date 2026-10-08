import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  LuCalendarDays as CalendarDays,
  LuCheck as Check,
  LuClock3 as Clock,
  LuLoaderCircle as Loader2,
  LuSparkles as Sparkles,
} from "react-icons/lu";
import { verifySponsorshipPayment } from "../services/marketplaceService";
import { getErrorMessage } from "../../../shared/utils/errors";
import { listingSegment } from "../../../shared/services/entityLinks";

const formatWhen = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(value);
  }
};

export default function PromoteSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [purchase, setPurchase] = useState(null);

  useEffect(() => {
    const transactionId =
      searchParams.get("transaction_id") || searchParams.get("transactionId");
    const status = String(searchParams.get("status") || "").toLowerCase();
    let cancelled = false;

    const run = async () => {
      if (!transactionId) {
        if (status === "cancelled" || status === "failed") {
          setPhase("failed");
          setError("Checkout was cancelled or failed. No boost was activated.");
          return;
        }
        setPhase("waiting");
        setError(
          "Waiting for Flutterwave payment details. If you already paid, open My listings in a moment — webhook activation may still complete."
        );
        return;
      }

      try {
        const result = await verifySponsorshipPayment(transactionId);
        if (cancelled) return;
        if (!result?.success || !result.purchase) {
          setPhase("failed");
          setError(result?.message || "Payment could not be verified.");
          return;
        }
        setPurchase(result.purchase);
        setPhase("success");
      } catch (err) {
        if (cancelled) return;
        setPhase("failed");
        setError(
          getErrorMessage(
            err,
            "Payment returned, but verification failed. Try refreshing or check My listings shortly."
          )
        );
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const listingPath = purchase
    ? `/marketplace/${
        listingSegment({
          id: purchase.listingId,
          shortCode: purchase.listingShortCode,
          title: purchase.listingTitle,
        }) || purchase.listingId
      }`
    : "/marketplace/my-listings";

  return (
    <div className="mx-auto w-full max-w-lg pb-10 text-fo-text">
      <div className="rounded-2xl border border-fo-border bg-fo-surface p-6 sm:p-8 space-y-5">
        {phase === "loading" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-fo-accent">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm text-fo-muted">Confirming your promotion payment…</p>
          </div>
        ) : null}

        {phase === "waiting" || phase === "failed" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <Clock size={22} />
            </div>
            <h1 className="text-xl font-semibold">
              {phase === "failed" ? "Promotion not confirmed" : "Almost there"}
            </h1>
            <p className="text-sm text-fo-subtle">{error}</p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => navigate("/marketplace/my-listings")}
                className="rounded-xl bg-fo-accent px-4 py-2.5 text-sm font-semibold text-black"
              >
                Go to my listings
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-fo-border px-4 py-2.5 text-sm font-semibold text-fo-muted"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {phase === "success" && purchase ? (
          <div className="space-y-5">
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <Check size={24} strokeWidth={2.5} />
              </div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fo-accent">
                <Sparkles size={14} /> Promotion confirmed
              </p>
              <h1 className="text-xl font-semibold leading-snug">
                {purchase.listingTitle}
              </h1>
              <p className="text-sm text-fo-subtle">
                {purchase.packageName}
                {purchase.durationDays ? ` · ${purchase.durationDays} days` : ""}
                {purchase.communityName
                  ? ` · ${purchase.communityName}`
                  : " · platform-wide"}
              </p>
            </div>

            <div className="rounded-xl border border-fo-accent/30 bg-fo-accent/5 p-4 space-y-3">
              {purchase.isLive ? (
                <>
                  <p className="text-sm font-semibold text-fo-text">
                    Active until {formatWhen(purchase.expiresAt)}
                  </p>
                  <p className="text-xs text-fo-subtle">
                    Your listing is live with sponsored visibility on the marketplace
                    {purchase.communityName ? " and in the attributed community" : ""}.
                  </p>
                </>
              ) : purchase.isQueued ? (
                <>
                  <p className="text-sm font-semibold text-fo-text inline-flex items-center gap-2">
                    <CalendarDays size={16} className="text-fo-accent" />
                    Queued — starts {formatWhen(purchase.startsAt)}
                  </p>
                  <p className="text-xs text-fo-subtle">
                    Active until {formatWhen(purchase.expiresAt)}. This extends after your current boost ends (no overlapping double boost).
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-fo-text">
                    Payment recorded
                  </p>
                  <p className="text-xs text-fo-subtle">
                    Status: {purchase.paymentStatus}. Check My listings if the boost window is not showing yet.
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-fo-border px-3 py-2">
                <p className="text-fo-subtle">Starts</p>
                <p className="mt-0.5 font-medium">{formatWhen(purchase.startsAt)}</p>
              </div>
              <div className="rounded-lg border border-fo-border px-3 py-2">
                <p className="text-fo-subtle">Active until</p>
                <p className="mt-0.5 font-medium">{formatWhen(purchase.expiresAt)}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Link
                to={listingPath}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-fo-accent px-4 text-sm font-semibold text-black"
              >
                View listing
              </Link>
              <Link
                to="/marketplace/my-listings"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-fo-border px-4 text-sm font-semibold text-fo-muted hover:text-fo-accent"
              >
                My listings
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
