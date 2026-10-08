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
import LocationFields from "../../../shared/components/LocationFields";
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

const formatWhen = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const normalizePlace = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ");

const matchLoc = (allowed = [], value = "") => {
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  const needle = normalizePlace(value);
  if (!needle) return false;
  return allowed.some((item) => {
    const hay = normalizePlace(item);
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
};

/** Package geo empty = global; else must match promote location (5.6). */
const packageOkForLocation = (pkg, loc) => {
  const geo = pkg?.geo || {};
  const empty =
    !geo.countries?.length && !geo.states?.length && !geo.cities?.length;
  if (empty || pkg?.isGlobal) return true;
  return (
    matchLoc(geo.countries, loc.country) &&
    matchLoc(geo.states, loc.state) &&
    matchLoc(geo.cities, loc.city)
  );
};

const fieldClass =
  "w-full rounded-xl border border-fo-border bg-fo-bg px-3 py-2.5 text-sm text-fo-text";
const labelClass = "block text-xs font-medium text-fo-muted mb-1.5";

export default function SponsorListing() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [packageId, setPackageId] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [location, setLocation] = useState({
    country: "",
    state: "",
    city: "",
    zipCode: "",
  });
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
        setLocation({
          country: options.listing?.country || "",
          state: options.listing?.state || "",
          city: options.listing?.city || "",
          zipCode: "",
        });
        const firstOk =
          options.packages.find((item) =>
            packageOkForLocation(item, {
              country: options.listing?.country || "",
              state: options.listing?.state || "",
              city: options.listing?.city || "",
            })
          ) || options.packages[0];
        setPackageId(firstOk?.id || "");
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

  const packagesWithAvailability = useMemo(
    () =>
      (data?.packages || []).map((item) => ({
        ...item,
        availableForLocation: packageOkForLocation(item, location),
      })),
    [data, location]
  );

  useEffect(() => {
    if (!packagesWithAvailability.length) return;
    const selected = packagesWithAvailability.find((item) => item.id === packageId);
    if (selected?.availableForLocation) return;
    const next = packagesWithAvailability.find((item) => item.availableForLocation);
    if (next) setPackageId(next.id);
  }, [packagesWithAvailability, packageId]);

  const selectedPackage = useMemo(
    () => packagesWithAvailability.find((item) => item.id === packageId) || null,
    [packagesWithAvailability, packageId]
  );
  const availableCommunities = useMemo(() => {
    const allowedIds = selectedPackage?.communityAllowList || [];
    return (data?.communities || []).filter(
      (community) => !allowedIds.length || allowedIds.includes(community.id)
    );
  }, [data, selectedPackage]);

  const state = data?.sponsorshipState;
  const checkoutBlocked = Boolean(state && !state.canCheckout);
  const isExtend = state?.mode === "extend";
  const locationReady = Boolean(
    location.country?.trim() && location.state?.trim() && location.city?.trim()
  );
  const packageReady =
    selectedPackage &&
    (selectedPackage.availableForLocation || selectedPackage.isGlobal);

  const checkout = async (event) => {
    event.preventDefault();
    if (!selectedPackage || checkoutBlocked) return;
    if (!locationReady) {
      showToast("Choose country, state, and city for this promotion.");
      return;
    }
    if (!packageReady) {
      showToast(
        "This package is not available for the selected location. Choose another package or location."
      );
      return;
    }
    if (selectedPackage.placement.communityRequired && !communityId) {
      showToast("Choose a community for this promotion package.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await startSponsorshipCheckout(listingId, {
        packageId,
        communityId: communityId || undefined,
        country: location.country.trim(),
        state: location.state.trim(),
        city: location.city.trim(),
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
            <Sparkles size={15} />{" "}
            {isExtend ? "Extend promotion" : "Promote listing"}
          </p>
          <h1 className="mt-2 text-xl font-semibold">{data?.listing?.title}</h1>
          <p className="mt-1 text-sm text-fo-subtle">
            Choose a package, set the promotion location, optionally attribute a
            community, then pay the boost fee. Item sales stay between you and the buyer.
          </p>
        </div>

        {state?.hasActive || state?.hasQueued || state?.hasPendingCheckout ? (
          <div className="rounded-xl border border-fo-accent/30 bg-fo-accent/5 p-4 space-y-1.5 text-sm">
            {state.hasActive ? (
              <p>
                <span className="font-semibold text-fo-text">Live now</span>
                <span className="text-fo-subtle">
                  {" "}
                  · ends {formatWhen(state.activeExpiresAt)}
                </span>
              </p>
            ) : null}
            {state.hasQueued ? (
              <p>
                <span className="font-semibold text-fo-text">Queued next</span>
                <span className="text-fo-subtle">
                  {" "}
                  · {formatWhen(state.queuedStartsAt)} →{" "}
                  {formatWhen(state.queuedExpiresAt)}
                </span>
              </p>
            ) : null}
            {state.hasPendingCheckout ? (
              <p className="text-amber-600 dark:text-amber-400">
                A checkout is already pending for this listing. Finish that payment
                (or wait up to 2 hours) before buying another boost.
              </p>
            ) : isExtend ? (
              <p className="text-fo-subtle text-xs">
                Buying again will queue after the current period
                {state.nextStartsAt
                  ? ` (starts ${formatWhen(state.nextStartsAt)})`
                  : ""}
                .
              </p>
            ) : null}
          </div>
        ) : null}

        {!data?.packages?.length ? (
          <p className="rounded-xl border border-fo-border p-4 text-sm text-fo-muted">
            No promotion packages yet. Ask an admin to create global tiers (e.g.
            Starter, Medium, Full) with blank location limits.
          </p>
        ) : (
          <form onSubmit={checkout} className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">1. Promotion location</h2>
              <p className="text-xs text-fo-subtle">
                Where should this boost be targeted? Prefills from your listing — you
                can change it. Some regional packages only work in certain areas.
              </p>
              <LocationFields
                value={location}
                onChange={setLocation}
                inputClass={fieldClass}
                labelClass={labelClass}
              />
            </div>

            <fieldset className="space-y-2" disabled={checkoutBlocked}>
              <legend className="mb-2 text-sm font-semibold">2. Choose a package</legend>
              <p className="text-xs text-fo-subtle -mt-1 mb-2">
                Prefer global tiers (Starter / Medium / Full). Regional packages stay
                listed but only pay if your location matches.
              </p>
              {packagesWithAvailability.map((item) => {
                const ok = item.availableForLocation;
                return (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                      checkoutBlocked || !ok
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer"
                    } ${
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
                      disabled={!ok}
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
                        {item.placement.top ? " · top" : ""}
                        {item.placement.section ? " · Sponsored section" : ""}
                        {item.placement.badge ? " · badge" : ""}
                        {item.isGlobal ||
                        (!item.geo?.countries?.length &&
                          !item.geo?.states?.length &&
                          !item.geo?.cities?.length)
                          ? " · available everywhere"
                          : " · regional package"}
                      </span>
                      {!ok ? (
                        <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">
                          Not available for the location above — change location or pick
                          another package.
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {selectedPackage && availableCommunities.length ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">
                  3. Community{" "}
                  {selectedPackage.placement.communityRequired
                    ? "(required)"
                    : "(optional)"}
                </span>
                <select
                  value={communityId}
                  onChange={(event) => setCommunityId(event.target.value)}
                  disabled={checkoutBlocked}
                  className={`${fieldClass} disabled:opacity-60`}
                  required={selectedPackage.placement.communityRequired}
                >
                  <option value="">
                    No community — platform boost only (no owner commission)
                  </option>
                  {availableCommunities.map((community) => (
                    <option key={community.id} value={community.id}>
                      {community.name}
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-fo-subtle">
                  Marketplace visibility still applies. Choosing a community also
                  credits that owner from the admin commission % (Phase 2 revenue share).
                </span>
              </label>
            ) : selectedPackage?.placement.communityRequired ? (
              <p className="text-sm text-red-500">
                This package requires a community, but no eligible communities are
                available.
              </p>
            ) : (
              <p className="text-xs text-fo-subtle">
                3. Community — optional. Skip for platform-wide boost with no owner cut.
              </p>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                checkoutBlocked ||
                !selectedPackage ||
                !locationReady ||
                !packageReady ||
                (selectedPackage.placement.communityRequired &&
                  !availableCommunities.length)
              }
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-fo-accent px-4 text-sm font-semibold text-black disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {checkoutBlocked
                ? "Checkout pending"
                : isExtend
                  ? `Queue ${
                      selectedPackage
                        ? formatPrice(
                            selectedPackage.price,
                            selectedPackage.currency
                          )
                        : "promotion"
                    }`
                  : `Pay ${
                      selectedPackage
                        ? formatPrice(
                            selectedPackage.price,
                            selectedPackage.currency
                          )
                        : "promotion fee"
                    }`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
