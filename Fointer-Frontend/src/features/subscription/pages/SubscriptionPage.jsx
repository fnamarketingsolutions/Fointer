import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LuBadgeCheck as BadgeCheck,
  LuLoaderCircle as Loader2,
  LuShield as Shield,
} from 'react-icons/lu';
import { useToast } from '../../../shared/components/feedback/ToastContext';
import { getErrorMessage } from '../../../shared/utils/errors';
import { useEntitlement } from '../context/EntitlementContext';
import {
  cancelSubscription,
  fetchSubscriptionManage,
  fetchSubscriptionPlans,
  startSubscriptionCheckout,
} from '../services/subscriptionService';

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

export default function SubscriptionPage() {
  const { showToast } = useToast();
  const { entitlement, refreshEntitlement, adFreeActive } = useEntitlement();
  const [plans, setPlans] = useState([]);
  const [manage, setManage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [planData, manageData] = await Promise.all([
        fetchSubscriptionPlans(),
        fetchSubscriptionManage(),
        refreshEntitlement(),
      ]);
      setPlans(planData?.plans || []);
      setManage(manageData || null);
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to load subscription.'));
    } finally {
      setLoading(false);
    }
  }, [refreshEntitlement, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const checkout = async (planCode) => {
    setBusy(true);
    try {
      const result = await startSubscriptionCheckout(planCode);
      if (result?.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      showToast('Checkout did not return a payment link.');
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to start checkout.'));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (
      !window.confirm(
        'Cancel auto-renewal? You keep ad-free access until the current paid period ends.'
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await cancelSubscription('user_requested');
      await refreshEntitlement();
      await load();
      showToast('Cancellation recorded. Access continues until period end.');
    } catch (error) {
      showToast(getErrorMessage(error, 'Unable to cancel.'));
    } finally {
      setBusy(false);
    }
  };

  const plan = plans[0];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 text-fo-text pb-8">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <Shield size={20} className="text-fo-accent" />
          Ad-Free Subscription
        </h1>
        <p className="text-sm text-fo-subtle">
          Hide designated third-party display ads across Fointer. Organic posts,
          messages, and Sponsored Marketplace Listings are never removed by this
          plan.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-fo-subtle py-10 justify-center">
          <Loader2 className="animate-spin" size={18} /> Loading…
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-fo-border bg-fo-surface p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-fo-subtle">
                  Current status
                </p>
                <p className="mt-1 text-lg font-semibold flex items-center gap-2">
                  {adFreeActive ? (
                    <>
                      <BadgeCheck className="text-fo-accent" size={20} />
                      Ad-free active
                    </>
                  ) : (
                    'Ads enabled'
                  )}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-lg border border-fo-border text-fo-muted capitalize">
                {entitlement?.subscriptionStatus || 'none'}
              </span>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-fo-subtle text-xs">Period ends</dt>
                <dd>{formatDate(entitlement?.currentPeriodEnd)}</dd>
              </div>
              <div>
                <dt className="text-fo-subtle text-xs">Renewal</dt>
                <dd className="capitalize">{entitlement?.renewalStatus || 'none'}</dd>
              </div>
              <div>
                <dt className="text-fo-subtle text-xs">Billing platform</dt>
                <dd className="capitalize">{entitlement?.platform || '—'}</dd>
              </div>
              <div>
                <dt className="text-fo-subtle text-xs">Cancel at period end</dt>
                <dd>{entitlement?.cancelAtPeriodEnd ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
            {manage?.management?.canRequestCancelAtPeriodEnd ? (
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="text-sm text-fo-muted hover:text-fo-accent underline-offset-2 hover:underline disabled:opacity-50"
              >
                Cancel renewal
              </button>
            ) : null}
            {entitlement?.platform === 'android' ? (
              <a
                className="block text-sm text-fo-accent hover:underline"
                href={manage?.management?.androidManageUrl}
                target="_blank"
                rel="noreferrer"
              >
                Manage on Google Play
              </a>
            ) : null}
            {entitlement?.platform === 'ios' ? (
              <a
                className="block text-sm text-fo-accent hover:underline"
                href={manage?.management?.iosManageUrl}
                target="_blank"
                rel="noreferrer"
              >
                Manage in App Store
              </a>
            ) : null}
          </section>

          {plan ? (
            <section className="rounded-xl border border-fo-border bg-fo-surface p-4 space-y-3">
              <h2 className="font-semibold">{plan.name}</h2>
              <p className="text-sm text-fo-subtle">{plan.description}</p>
              <p className="text-2xl font-semibold">
                {plan.currency} {Number(plan.price).toFixed(2)}
                <span className="text-sm font-normal text-fo-subtle">
                  {' '}
                  / {plan.billingPeriodDays} days
                </span>
              </p>
              {!adFreeActive || entitlement?.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => checkout(plan.code)}
                  className="inline-flex items-center justify-center gap-2 min-h-10 px-4 rounded-lg bg-fo-accent text-black text-sm font-semibold hover:bg-fo-accent-hover disabled:opacity-60"
                >
                  {busy ? <Loader2 className="animate-spin" size={16} /> : null}
                  {adFreeActive ? 'Renew / extend' : 'Go ad-free'}
                </button>
              ) : (
                <p className="text-sm text-fo-subtle">
                  Your subscription is already active on this account across web
                  and mobile.
                </p>
              )}
            </section>
          ) : (
            <p className="text-sm text-fo-subtle">No active plans are available.</p>
          )}

          <p className="text-xs text-fo-subtle">
            Purchases are verified on the Fointer server. Returning from a payment
            page alone does not activate entitlement.{' '}
            <Link to="/profile" className="text-fo-accent hover:underline">
              Back to profile
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
