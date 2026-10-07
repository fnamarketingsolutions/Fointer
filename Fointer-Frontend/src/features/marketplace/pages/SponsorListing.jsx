import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LuArrowLeft as ArrowLeft,
  LuLoaderCircle as Loader2,
  LuSparkles as Sparkles,
} from "react-icons/lu";
import {
  fetchSponsorOptions,
  startSponsorshipCheckout,
} from "../services/marketplaceService";
import { useToast } from "../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../shared/utils/errors";

const formatPrice = (amount, currency) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

export default function SponsorListing() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [packageId, setPackageId] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchOptions = async () => {
      try {
        const options = await fetchSponsorOptions(listingId);
        if (!active) return;
        setData(options);
        setPackageId((current) =>
          options.packages.some((item) => item.id === current)
            ? current
            : options.packages[0]?.id || ""
        );
        setLoadError("");
      } catch (error) {
        if (!active) return;
        const message = getErrorMessage(error, "Unable to load promotion options.");
        setLoadError(message);
        showToast(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchOptions();
    return () => {
      active = false;
    };
  }, [listingId, retryCount, showToast]);

  const selectedPackage = useMemo(
    () => data?.packages?.find((item) => item.id === packageId) || null,
    [data, packageId]
  );
  const availableCommunities = useMemo(() => {
    const allowedIds = selectedPackage?.communityAllowList || [];
    return (data?.communities || []).filter(
      (community) => !allowedIds.length || allowedIds.includes(community.id)
    );
  }, [data, selectedPackage]);

  const checkout = async (event) => {
    event.preventDefault();
    if (!selectedPackage) return;
    if (selectedPackage.placement.communityRequired && !communityId) {
      showToast("Choose a community for this promotion package.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await startSponsorshipCheckout(listingId, {
        packageId,
        communityId: communityId || undefined,
      });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      showToast(getErrorMessage(error, "Unable to start checkout."));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-fo-accent">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-16 text-center">
        <p className="text-sm text-red-400">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setLoadError("");
            setRetryCount((count) => count + 1);
          }}
          className="rounded-lg border border-fo-border px-4 py-2 text-sm text-fo-accent"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto pb-8 text-fo-text">
      <button
        type="button"
        onClick={() => navigate("/marketplace/my-listings")}
        className="inline-flex items-center gap-2 mb-4 text-sm text-fo-muted hover:text-fo-accent"
      >
        <ArrowLeft size={16} /> Back to my listings
      </button>
      <div className="rounded-2xl border border-fo-border bg-fo-surface p-5 sm:p-7 space-y-5">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fo-accent">
            <Sparkles size={15} /> Promote listing
          </p>
          <h1 className="mt-2 text-xl font-semibold">{data?.listing?.title}</h1>
          <p className="mt-1 text-sm text-fo-subtle">
            Pay a separate promotion fee. Buyers still arrange item payment directly with the seller; Fointer does not process item sales.
          </p>
        </div>

        {!data?.packages?.length ? (
          <p className="rounded-xl border border-fo-border p-4 text-sm text-fo-muted">
            {data?.hasActivePackages
              ? "No active package matches this listing's city, state, or country."
              : "No active promotion packages are available right now."}
          </p>
        ) : (
          <form onSubmit={checkout} className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Choose a package</legend>
              {data.packages.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer ${
                    packageId === item.id
                      ? "border-fo-accent bg-fo-accent/5"
                      : "border-fo-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="package"
                    value={item.id}
                    checked={packageId === item.id}
                    onChange={() => {
                      setPackageId(item.id);
                      setCommunityId("");
                    }}
                    className="mt-1 accent-[var(--color-fo-accent)]"
                  />
                  <span className="flex-1">
                    <span className="flex justify-between gap-3 text-sm font-semibold">
                      <span>{item.name}</span>
                      <span>{formatPrice(item.price, item.currency)}</span>
                    </span>
                    <span className="mt-1 block text-xs text-fo-subtle">
                      {item.durationDays} days
                      {item.placement.top ? " · top placement" : ""}
                      {item.placement.section ? " · sponsored section" : ""}
                      {item.placement.badge ? " · sponsored badge" : ""}
                    </span>
                    {item.geo.countries.length || item.geo.states.length || item.geo.cities.length ? (
                      <span className="mt-1 block text-xs text-fo-subtle">
                        Location targeting: {[...item.geo.countries, ...item.geo.states, ...item.geo.cities].join(", ")}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>

            {selectedPackage && availableCommunities.length ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">
                  Community attribution {selectedPackage.placement.communityRequired ? "(required)" : "(optional)"}
                </span>
                <select
                  value={communityId}
                  onChange={(event) => setCommunityId(event.target.value)}
                  className="w-full rounded-xl border border-fo-border bg-fo-bg px-3 py-2.5 text-sm"
                  required={selectedPackage.placement.communityRequired}
                >
                  <option value="">Platform-wide (no community commission)</option>
                  {availableCommunities.map((community) => (
                    <option key={community.id} value={community.id}>{community.name}</option>
                  ))}
                </select>
                <span className="block text-xs text-fo-subtle">
                  Community owner earnings are recorded from the configured commission; no automatic payout is made.
                </span>
              </label>
            ) : selectedPackage?.placement.communityRequired ? (
              <p className="text-sm text-red-500">
                This package requires a community, but no eligible communities are available.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !selectedPackage || (selectedPackage.placement.communityRequired && !availableCommunities.length)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-fo-accent px-4 text-sm font-semibold text-black disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Pay {selectedPackage ? formatPrice(selectedPackage.price, selectedPackage.currency) : "promotion fee"}
            </button>
            <p className="text-center text-xs text-fo-subtle">
              Secure checkout is processed by Flutterwave. Sponsorship starts only after payment is verified.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
