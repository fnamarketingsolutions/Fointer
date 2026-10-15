import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LuCreditCard as CreditCard,
  LuLoaderCircle as Loader2,
  LuMegaphone as Megaphone,
  LuRefreshCw as RefreshCw,
  LuSave as Save,
} from 'react-icons/lu';
import {
  fetchAdminAdsSettings,
  fetchAdminSubscriptionPlans,
  fetchAdminSubscribers,
  fetchAdminSubscriptionTransactions,
  updateAdminAdsSettings,
  upsertAdminSubscriptionPlan,
} from '../../services/adminService';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import { getErrorMessage } from '../../../../shared/utils/errors';

const PLACEMENT_LABELS = {
  home_feed: 'Home feed',
  community_feed: 'Community feed',
  marketplace_browse: 'Marketplace browse',
  feed_banner: 'Feed banner',
};

const StatusDot = ({ ok, label }) => (
  <span className="inline-flex items-center gap-1.5 text-xs">
    <span
      className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
      aria-hidden
    />
    {label}
  </span>
);

export default function SubscriptionManagement() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingAds, setSavingAds] = useState(false);
  const [plan, setPlan] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [ads, setAds] = useState(null);
  const [integration, setIntegration] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, subsRes, txRes, adsRes] = await Promise.all([
        fetchAdminSubscriptionPlans(),
        fetchAdminSubscribers({ limit: 40 }),
        fetchAdminSubscriptionTransactions({ limit: 40 }),
        fetchAdminAdsSettings(),
      ]);
      setPlan(plansRes?.plans?.[0] || null);
      setSubscribers(subsRes?.subscribers || []);
      setTransactions(txRes?.transactions || []);
      setAds(adsRes?.settings || null);
      setIntegration(adsRes?.integration || null);
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to load subscription admin data.'));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const savePlan = async (event) => {
    event.preventDefault();
    if (!plan) return;
    setSavingPlan(true);
    try {
      const result = await upsertAdminSubscriptionPlan(plan);
      setPlan(result?.plan || plan);
      showToast('Plan saved.');
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to save plan.'));
    } finally {
      setSavingPlan(false);
    }
  };

  const saveAds = async (event) => {
    event.preventDefault();
    if (!ads) return;
    setSavingAds(true);
    try {
      const result = await updateAdminAdsSettings(ads);
      setAds(result?.settings || ads);
      setIntegration(result?.integration || integration);
      showToast('Advertising settings saved.');
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to save ads settings.'));
    } finally {
      setSavingAds(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-fo-subtle">
        <Loader2 className="animate-spin" size={18} /> Loading…
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 text-fo-text">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
            <CreditCard size={20} className="text-fo-accent" />
            Subscriptions & Ads
          </h1>
          <p className="mt-1 text-sm text-fo-subtle">
            Monthly ad-free plan, subscriber visibility, and third-party ad
            placement controls. Provider secrets stay in server environment
            variables.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent"
          aria-label="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </header>

      <section className="rounded-xl border border-fo-border bg-fo-surface p-4 space-y-3">
        <h2 className="text-sm font-semibold">Integration status</h2>
        <div className="flex flex-wrap gap-4">
          <StatusDot
            ok={Boolean(integration?.billing?.web?.configured)}
            label={`Web / Flutterwave ${integration?.billing?.web?.configured ? 'ready' : 'needs FLW keys'}`}
          />
          <StatusDot
            ok={Boolean(integration?.billing?.android?.configured)}
            label={`Android / Play ${integration?.billing?.android?.configured ? 'ready' : 'needs Play credentials'}`}
          />
          <StatusDot
            ok={Boolean(integration?.billing?.ios?.configured)}
            label={`iOS / App Store ${integration?.billing?.ios?.configured ? 'ready' : 'needs Apple API key'}`}
          />
          <StatusDot
            ok={Boolean(integration?.advertising?.adsenseConfigured)}
            label={`Web ads ${integration?.advertising?.adsenseConfigured ? 'configured' : 'needs AdSense client/slots'}`}
          />
        </div>
      </section>

      {plan ? (
        <form
          onSubmit={savePlan}
          className="rounded-xl border border-fo-border bg-fo-surface p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold">Subscription plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs space-y-1">
              <span className="text-fo-subtle">Name</span>
              <input
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
                value={plan.name || ''}
                onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-fo-subtle">Price</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
                value={plan.price ?? 0}
                onChange={(e) =>
                  setPlan((p) => ({ ...p, price: Number(e.target.value) }))
                }
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-fo-subtle">Currency</span>
              <input
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm uppercase"
                value={plan.currency || 'USD'}
                onChange={(e) =>
                  setPlan((p) => ({ ...p, currency: e.target.value.toUpperCase() }))
                }
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-fo-subtle">Billing period (days)</span>
              <input
                type="number"
                min="1"
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
                value={plan.billingPeriodDays ?? 30}
                onChange={(e) =>
                  setPlan((p) => ({
                    ...p,
                    billingPeriodDays: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-fo-subtle">Google Play product id</span>
              <input
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
                value={plan.googlePlayProductId || ''}
                onChange={(e) =>
                  setPlan((p) => ({ ...p, googlePlayProductId: e.target.value }))
                }
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-fo-subtle">Apple product id</span>
              <input
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
                value={plan.appleProductId || ''}
                onChange={(e) =>
                  setPlan((p) => ({ ...p, appleProductId: e.target.value }))
                }
              />
            </label>
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="text-fo-subtle">Flutterwave payment plan id (optional recurring)</span>
              <input
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
                value={plan.flutterwavePaymentPlanId || ''}
                onChange={(e) =>
                  setPlan((p) => ({
                    ...p,
                    flutterwavePaymentPlanId: e.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="text-fo-subtle">Description</span>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
                value={plan.description || ''}
                onChange={(e) =>
                  setPlan((p) => ({ ...p, description: e.target.value }))
                }
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(plan.isActive)}
                onChange={(e) =>
                  setPlan((p) => ({ ...p, isActive: e.target.checked }))
                }
              />
              Plan active
            </label>
          </div>
          <button
            type="submit"
            disabled={savingPlan}
            className="inline-flex items-center gap-2 min-h-9 px-3 rounded-lg bg-fo-accent text-black text-sm font-semibold disabled:opacity-60"
          >
            {savingPlan ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            Save plan
          </button>
        </form>
      ) : null}

      {ads ? (
        <form
          onSubmit={saveAds}
          className="rounded-xl border border-fo-border bg-fo-surface p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Megaphone size={16} className="text-fo-accent" />
            Advertising placements
          </h2>
          <p className="text-xs text-fo-subtle">
            Only third-party display ads. Sponsored Marketplace Listings are
            managed separately under Sponsorships.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs space-y-1">
              <span className="text-fo-subtle">Web provider</span>
              <select
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
                value={ads.webProvider || 'none'}
                onChange={(e) =>
                  setAds((a) => ({ ...a, webProvider: e.target.value }))
                }
              >
                <option value="none">None</option>
                <option value="google_adsense">Google AdSense</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-fo-subtle">AdSense client id (ca-pub-…)</span>
              <input
                className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm"
                value={ads.adsenseClientId || ''}
                onChange={(e) =>
                  setAds((a) => ({ ...a, adsenseClientId: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.keys(PLACEMENT_LABELS).map((id) => (
              <div key={id} className="rounded-lg border border-fo-border p-3 space-y-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(ads.placements?.[id])}
                    onChange={(e) =>
                      setAds((a) => ({
                        ...a,
                        placements: {
                          ...(a.placements || {}),
                          [id]: e.target.checked,
                        },
                      }))
                    }
                  />
                  Enable {PLACEMENT_LABELS[id]}
                </label>
                <input
                  placeholder="AdSense slot id"
                  className="w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-xs"
                  value={ads.adsenseSlots?.[id] || ''}
                  onChange={(e) =>
                    setAds((a) => ({
                      ...a,
                      adsenseSlots: {
                        ...(a.adsenseSlots || {}),
                        [id]: e.target.value,
                      },
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={savingAds}
            className="inline-flex items-center gap-2 min-h-9 px-3 rounded-lg bg-fo-accent text-black text-sm font-semibold disabled:opacity-60"
          >
            {savingAds ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            Save ads settings
          </button>
        </form>
      ) : null}

      <section className="rounded-xl border border-fo-border bg-fo-surface p-4 space-y-3 overflow-x-auto">
        <h2 className="text-sm font-semibold">Subscribers</h2>
        <table className="w-full text-left text-xs min-w-[640px]">
          <thead className="text-fo-subtle">
            <tr>
              <th className="py-2 pr-2">User</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Ad-free</th>
              <th className="py-2 pr-2">Period end</th>
              <th className="py-2 pr-2">Platform</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length ? (
              subscribers.map((row) => (
                <tr key={row.id} className="border-t border-fo-border">
                  <td className="py-2 pr-2">
                    {row.user?.id ? (
                      <Link
                        to={`/users/${row.user.id}`}
                        className="text-fo-accent hover:underline"
                      >
                        {row.user.username || row.user.email}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 pr-2 capitalize">
                    {row.entitlement?.subscriptionStatus}
                  </td>
                  <td className="py-2 pr-2">
                    {row.entitlement?.adFreeActive ? 'Yes' : 'No'}
                  </td>
                  <td className="py-2 pr-2">
                    {row.entitlement?.currentPeriodEnd
                      ? new Date(row.entitlement.currentPeriodEnd).toLocaleString()
                      : '—'}
                  </td>
                  <td className="py-2 pr-2 capitalize">
                    {row.platform || '—'} / {row.provider || '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="py-6 text-center text-fo-subtle">
                  No subscribers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-fo-border bg-fo-surface p-4 space-y-3 overflow-x-auto">
        <h2 className="text-sm font-semibold">Payment / subscription records</h2>
        <table className="w-full text-left text-xs min-w-[720px]">
          <thead className="text-fo-subtle">
            <tr>
              <th className="py-2 pr-2">User</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Amount</th>
              <th className="py-2 pr-2">Provider ref</th>
              <th className="py-2 pr-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length ? (
              transactions.map((row) => (
                <tr key={row.id} className="border-t border-fo-border">
                  <td className="py-2 pr-2">
                    {row.user?.username || row.user?.email || '—'}
                  </td>
                  <td className="py-2 pr-2 capitalize">{row.status}</td>
                  <td className="py-2 pr-2">
                    {row.currency} {Number(row.amount).toFixed(2)}
                  </td>
                  <td className="py-2 pr-2 font-mono text-[10px]">
                    {row.providerReference}
                  </td>
                  <td className="py-2 pr-2">
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="py-6 text-center text-fo-subtle">
                  No subscription transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
