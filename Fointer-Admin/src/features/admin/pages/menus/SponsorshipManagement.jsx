import { useEffect, useState } from "react";
import {
  LuBadgeCheck as BadgeCheck,
  LuCalendarDays as CalendarDays,
  LuCirclePlus as CirclePlus,
  LuCreditCard as CreditCard,
  LuPackage as PackageIcon,
  LuReceipt as ReceiptIcon,
  LuMapPin as MapPin,
  LuPencil as Pencil,
  LuLoaderCircle as Loader2,
  LuRefreshCw as RefreshCw,
  LuSparkles as Sparkles,
  LuTrash2 as Trash2,
  LuTrophy as TrophyIcon,
  LuUsers as UsersIcon,
  LuWallet as WalletIcon,
} from "react-icons/lu";
import {
  createSponsoredPackage,
  deleteSponsoredPackage,
  fetchAdminSponsorshipData,
  updateSponsoredCommission,
  updateSponsoredPackage,
} from "../../services/adminService";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import ConfirmDeleteModal from "../../../../shared/components/modals/ConfirmDeleteModal";
import { getErrorMessage } from "../../../../shared/utils/errors";

const emptyPackage = {
  name: "",
  price: "",
  currency: "USD",
  durationDays: 7,
  status: "active",
  placement: {
    top: false,
    section: true,
    badge: true,
    priority: 0,
    communityRequired: false,
  },
  geo: { countries: [], states: [], cities: [] },
  communityAllowList: [],
};

const splitValues = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const dateLabel = (value) =>
  value ? new Date(value).toLocaleString() : "—";

const amountLabel = (amount, currency) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency || ""} ${Number(amount) || 0}`;
  }
};

const moneyListLabel = (rows, empty = "—") => {
  if (!rows?.length) return empty;
  return rows
    .map((row) => amountLabel(row.amount ?? row.net ?? row.earned, row.currency))
    .join(" · ");
};

const leaderPrimaryMoney = (byCurrency) => {
  if (!byCurrency?.length) return "—";
  const top = byCurrency[0];
  return amountLabel(top.net ?? top.earned ?? 0, top.currency);
};

function CheckField({ checked, label, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-fo-muted">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export default function SponsorshipManagement() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState(emptyPackage);
  const [commissionPercent, setCommissionPercent] = useState(20);
  const [reportView, setReportView] = useState("purchases");
  const [pageSection, setPageSection] = useState("packages");
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const result = await fetchAdminSponsorshipData();
        if (!active) return;
        setData(result);
        setCommissionPercent(result.communitySponsoredCommissionPercent ?? 20);
        setLoadError("");
      } catch (error) {
        if (active) {
          const message = getErrorMessage(error, "Failed to load sponsorship data.");
          setLoadError(message);
          showToast(message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {
      active = false;
    };
  }, [showToast]);

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await fetchAdminSponsorshipData();
      setData(result);
      setCommissionPercent(result.communitySponsoredCommissionPercent ?? 20);
      setLoadError("");
    } catch (error) {
      const message = getErrorMessage(error, "Failed to load sponsorship data.");
      setLoadError(message);
      showToast(message);
    } finally {
      setLoading(false);
    }
  };

  const updatePlacement = (key, value) =>
    setDraft((current) => ({
      ...current,
      placement: { ...current.placement, [key]: value },
    }));

  const toggleCommunity = (communityId) => {
    setDraft((current) => ({
      ...current,
      communityAllowList: current.communityAllowList.includes(communityId)
        ? current.communityAllowList.filter((id) => id !== communityId)
        : [...current.communityAllowList, communityId],
    }));
  };

  const editPackage = (item) => {
    setPageSection("packages");
    setShowPackageForm(true);
    setEditingId(item.id);
    setDraft({
      ...item,
      communityAllowList: item.communityAllowList.map((community) =>
        typeof community === "string" ? community : community.id
      ),
      geo: {
        countries: item.geo?.countries || [],
        states: item.geo?.states || [],
        cities: item.geo?.cities || [],
      },
    });
  };

  const savePackage = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...draft,
      price: Number(draft.price),
      durationDays: Number(draft.durationDays),
      placement: { ...draft.placement, priority: Number(draft.placement.priority) },
      geo: {
        countries: splitValues(
          Array.isArray(draft.geo.countries)
            ? draft.geo.countries.join(",")
            : draft.geo.countries
        ),
        states: splitValues(
          Array.isArray(draft.geo.states)
            ? draft.geo.states.join(",")
            : draft.geo.states
        ),
        cities: splitValues(
          Array.isArray(draft.geo.cities)
            ? draft.geo.cities.join(",")
            : draft.geo.cities
        ),
      },
    };
    try {
      if (editingId) await updateSponsoredPackage(editingId, payload);
      else await createSponsoredPackage(payload);
      showToast(editingId ? "Package updated." : "Package created.");
      setEditingId("");
      setDraft(emptyPackage);
      setShowPackageForm(false);
      await refresh();
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to save package."));
    } finally {
      setSaving(false);
    }
  };

  const saveCommission = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateSponsoredCommission(Number(commissionPercent));
      showToast("Commission setting updated.");
      await refresh();
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to update commission."));
    } finally {
      setSaving(false);
    }
  };

  const deactivatePackage = async (item) => {
    if (!item) return;
    setSaving(true);
    try {
      await updateSponsoredPackage(item.id, {
        ...item,
        status: "inactive",
        communityAllowList: (item.communityAllowList || []).map((community) =>
          typeof community === "string" ? community : community.id
        ),
        geo: {
          countries: item.geo?.countries || [],
          states: item.geo?.states || [],
          cities: item.geo?.cities || [],
        },
      });
      showToast(`“${item.name}” deactivated. Sellers can no longer buy it.`);
      setPackageToDelete(null);
      await refresh();
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to deactivate package."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePackage = async () => {
    if (!packageToDelete) return;
    setSaving(true);
    try {
      await deleteSponsoredPackage(packageToDelete.id);
      showToast("Package deleted.");
      setPackageToDelete(null);
      await refresh();
    } catch (error) {
      const code = error?.response?.data?.code;
      const counts = error?.response?.data?.counts;
      if (code === "PACKAGE_HAS_PURCHASE_HISTORY") {
        showToast(
          error?.response?.data?.message ||
            "Paid purchase history still exists (listings may be deleted). Deactivate instead."
        );
        // Keep modal open so admin can deactivate from the same dialog.
        if (counts) {
          setPackageToDelete((current) =>
            current
              ? { ...current, _historyCounts: counts, _blockedDelete: true }
              : current
          );
        } else {
          setPackageToDelete((current) =>
            current ? { ...current, _blockedDelete: true } : current
          );
        }
      } else {
        showToast(getErrorMessage(error, "Failed to delete package."));
        setPackageToDelete(null);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return <div className="flex justify-center py-20 text-fo-accent"><Loader2 className="animate-spin" /></div>;
  }
  if (!data && loadError) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-16 text-center">
        <p className="text-sm text-red-400">{loadError}</p>
        <button type="button" onClick={refresh} className="rounded-lg border border-fo-border px-4 py-2 text-sm text-fo-accent">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 text-fo-text">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
            <Sparkles size={20} className="text-fo-accent" /> Sponsorships
          </h1>
          <p className="mt-1 text-sm text-fo-subtle">Manage promotion packages, placements, purchase reports, and community earnings.</p>
        </div>
        <button type="button" onClick={refresh} className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent" aria-label="Refresh">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Active packages",
            value: `${data?.stats?.packagesActive ?? 0}/${data?.stats?.packagesTotal ?? data?.packages?.length ?? 0}`,
            icon: PackageIcon,
          },
          {
            label: "Live placements",
            value: data?.stats?.activePlacements ?? data?.activePlacements?.length ?? 0,
            icon: Sparkles,
          },
          {
            label: "Paid purchases",
            value: data?.stats?.purchases?.paid ?? 0,
            hint: `${data?.stats?.purchases?.pending ?? 0} pending · ${data?.stats?.purchases?.total ?? 0} total`,
            icon: CreditCard,
          },
          {
            label: "Commission earned",
            value: moneyListLabel(data?.stats?.commissionEarnedByCurrency, "0"),
            hint: data?.stats?.commissionReversedByCurrency?.length
              ? `Reversed ${moneyListLabel(data.stats.commissionReversedByCurrency)}`
              : `${data?.stats?.earningEntryCount ?? 0} ledger rows`,
            icon: WalletIcon,
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="flex items-start gap-3 rounded-2xl border border-fo-border bg-fo-surface p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fo-accent/10 text-fo-accent">
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold text-fo-text tabular-nums">
                  {metric.value}
                </span>
                <span className="block text-xs text-fo-subtle">{metric.label}</span>
                {metric.hint ? (
                  <span className="mt-0.5 block text-[10px] text-fo-subtle">{metric.hint}</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-fo-border bg-fo-surface p-4 sm:p-5 lg:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fo-accent">Paid GMV</p>
          <p className="mt-1 text-base font-semibold tabular-nums text-fo-text">
            {moneyListLabel(data?.stats?.paidGmvByCurrency, "No paid volume yet")}
          </p>
          <p className="mt-1 text-[11px] text-fo-subtle">
            Boost fees confirmed paid (all time in DB).
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fo-accent">
            Attributed promotion gross
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums text-fo-text">
            {moneyListLabel(data?.stats?.grossPromotedByCurrency, "—")}
          </p>
          <p className="mt-1 text-[11px] text-fo-subtle">
            Fees that generated community commission rows.
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fo-accent">
            Purchase mix
          </p>
          <p className="mt-1 text-xs text-fo-muted">
            Paid {data?.stats?.purchases?.paid ?? 0} · Pending{" "}
            {data?.stats?.purchases?.pending ?? 0} · Failed{" "}
            {data?.stats?.purchases?.failed ?? 0} · Refunded{" "}
            {data?.stats?.purchases?.refunded ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-fo-subtle">
            Commission rate: {data?.communitySponsoredCommissionPercent ?? 20}%
          </p>
        </div>
      </section>

      <nav className="grid grid-cols-1 gap-2 rounded-2xl border border-fo-border bg-fo-surface p-2 sm:grid-cols-3" aria-label="Sponsorship management sections">
        {[
          { id: "packages", label: "Packages", description: "Create and manage promotion offers", icon: PackageIcon, count: data?.packages?.length || 0 },
          { id: "activity", label: "Purchases & placements", description: "Review payment and live status", icon: ReceiptIcon, count: (data?.purchases?.length || 0) + (data?.activePlacements?.length || 0) },
          { id: "earnings", label: "Earnings & commission", description: "Community owner ledger and rate", icon: WalletIcon, count: data?.earnings?.length || 0 },
        ].map((item) => {
          const Icon = item.icon;
          const selected = pageSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPageSection(item.id)}
              aria-current={selected ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-fo-accent/35 bg-fo-accent/10"
                  : "border-transparent hover:bg-fo-bg"
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-fo-accent text-black" : "bg-fo-bg text-fo-muted"}`}><Icon size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-xs font-semibold ${selected ? "text-fo-accent" : "text-fo-text"}`}>{item.label}</span>
                <span className="mt-0.5 block truncate text-[10px] text-fo-subtle">{item.description}</span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${selected ? "bg-fo-accent/15 text-fo-accent" : "bg-fo-bg text-fo-subtle"}`}>{item.count}</span>
            </button>
          );
        })}
      </nav>

      {pageSection === "packages" ? (
      <>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fo-border bg-fo-surface p-4 sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fo-accent">Promotion catalog</p>
          <h2 className="mt-1 text-base font-semibold text-fo-text">Packages</h2>
          <p className="mt-1 text-xs text-fo-subtle">
            Recommended: 3–4 global tiers (Starter / Medium / Full) with blank geo.
            Optional regional packages can limit which promote locations may buy them (5.6).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showPackageForm && !editingId) {
              setShowPackageForm(false);
              return;
            }
            setEditingId("");
            setDraft(emptyPackage);
            setShowPackageForm(true);
          }}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-fo-accent px-4 py-2 text-xs font-semibold text-black transition hover:bg-fo-accent-hover"
        >
          <CirclePlus size={15} /> {showPackageForm && !editingId ? "Close form" : "New package"}
        </button>
      </section>

      {showPackageForm ? (
      <section id="sponsorship-package-form" className="scroll-mt-5 rounded-2xl border border-fo-accent/25 bg-fo-surface p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fo-accent">{editingId ? "Package settings" : "New promotion offer"}</p>
            <h2 className="mt-1 font-semibold text-fo-text">{editingId ? "Edit package" : "Create package"}</h2>
          </div>
          <button type="button" onClick={() => { setShowPackageForm(false); setEditingId(""); setDraft(emptyPackage); }} className="rounded-lg border border-fo-border px-3 py-1.5 text-xs text-fo-muted hover:text-fo-text">Cancel</button>
        </div>
        <form onSubmit={savePackage} className="space-y-5">
          <div className="space-y-3 rounded-xl border border-fo-border bg-fo-bg/40 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fo-accent">1 · Basics</p>
              <p className="mt-1 text-xs text-fo-subtle">Name, fee, duration and whether sellers can buy this offer.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <label className="space-y-1 text-xs text-fo-subtle sm:col-span-2">Package name
                <input required maxLength="100" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="block w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text" placeholder="e.g. Starter / Medium / Full" />
              </label>
              <label className="space-y-1 text-xs text-fo-subtle">Price
                <input required type="number" min="0.01" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="block w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text" />
              </label>
              <label className="space-y-1 text-xs text-fo-subtle">Currency
                <input required minLength="3" maxLength="3" value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} className="block w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm uppercase text-fo-text" />
              </label>
              <label className="space-y-1 text-xs text-fo-subtle">Duration (days)
                <input required type="number" min="1" max="365" step="1" value={draft.durationDays} onChange={(event) => setDraft({ ...draft, durationDays: event.target.value })} className="block w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text" />
              </label>
              <label className="space-y-1 text-xs text-fo-subtle">Status
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="block w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text">
                  <option value="active">Active (buyable)</option><option value="inactive">Inactive (hidden)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-fo-border bg-fo-bg/40 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fo-accent">2 · Where it shows</p>
              <p className="mt-1 text-xs text-fo-subtle">Enable at least one. These control marketplace top strip, Sponsored section, and card badge.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <CheckField checked={draft.placement.top} label="Top placement (above browse results)" onChange={(event) => updatePlacement("top", event.target.checked)} />
              <CheckField checked={draft.placement.section} label="Sponsored section block" onChange={(event) => updatePlacement("section", event.target.checked)} />
              <CheckField checked={draft.placement.badge} label="Sponsored badge on card" onChange={(event) => updatePlacement("badge", event.target.checked)} />
            </div>
            <label className="block max-w-xs space-y-1 text-xs text-fo-subtle">Sort priority (higher = earlier among sponsored)
              <input type="number" min="0" max="1000" step="1" value={draft.placement.priority} onChange={(event) => updatePlacement("priority", event.target.value)} className="block w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text" />
            </label>
            {!draft.placement.top && !draft.placement.section && !draft.placement.badge ? (
              <p className="text-xs text-red-500">Pick at least one visibility option or the package cannot be saved.</p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-xl border border-fo-border bg-fo-bg/40 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fo-accent">3 · Geolocation (optional)</p>
              <p className="mt-1 text-xs text-fo-subtle">
                Blank = global package (buyable for any promote location). Fill only for regional offers.
                Sellers still choose the audience location at checkout; that snapshot drives feed targeting and reports.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["countries", "states", "cities"].map((field) => (
                <label key={field} className="space-y-1 text-xs text-fo-subtle">
                  {field[0].toUpperCase() + field.slice(1)} (comma-separated; blank = all)
                  <input
                    value={
                      Array.isArray(draft.geo[field])
                        ? draft.geo[field].join(", ")
                        : draft.geo[field]
                    }
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        geo: { ...draft.geo, [field]: event.target.value },
                      })
                    }
                    className="block w-full rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text"
                    placeholder="Leave blank for global"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-fo-border bg-fo-bg/40 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fo-accent">4 · Community placement (optional)</p>
              <p className="mt-1 text-xs text-fo-subtle">
                Community attribution at checkout powers owner commission (5.7).
                Empty allow-list = any community. Commission only when a community is selected.
              </p>
            </div>
            <CheckField checked={draft.placement.communityRequired} label="Require seller to pick a community (for owner commission)" onChange={(event) => updatePlacement("communityRequired", event.target.checked)} />
            <fieldset className="space-y-2">
              <legend className="text-xs text-fo-subtle">Limit to these communities (optional — empty = any)</legend>
              {(data?.communities || []).length ? (
                <div className="flex flex-wrap gap-x-4 gap-y-2 max-h-40 overflow-y-auto">
                  {(data?.communities || []).map((community) => (
                    <CheckField key={community.id} checked={draft.communityAllowList.includes(community.id)} label={community.name} onChange={() => toggleCommunity(community.id)} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-fo-subtle">No communities found yet.</p>
              )}
            </fieldset>
          </div>

          <div className="flex justify-end border-t border-fo-border pt-4">
            <button disabled={saving || (!draft.placement.top && !draft.placement.section && !draft.placement.badge)} className="rounded-xl bg-fo-accent px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
              {saving ? "Saving…" : editingId ? "Save package" : "Create package"}
            </button>
          </div>
        </form>
      </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fo-accent">Your promotion lineup</p>
            <h2 className="mt-1 text-lg font-semibold text-fo-text">Sponsorship packages</h2>
            <p className="mt-1 text-xs text-fo-subtle">Curated placements, transparent pricing, and flexible audience targeting.</p>
          </div>
          <span className="rounded-full border border-fo-border bg-fo-surface px-3 py-1.5 text-xs text-fo-muted">
            {(data?.packages || []).length} {(data?.packages || []).length === 1 ? "package" : "packages"}
          </span>
        </div>

        {(data?.packages || []).length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.packages.map((item) => {
              const placementLabels = [
                item.placement.top && "Top placement",
                item.placement.section && "Sponsored section",
                item.placement.badge && "Sponsored badge",
              ].filter(Boolean);
              const communities = item.communityAllowList || [];
              return (
                <article
                  key={item.id}
                  className={`group relative flex min-h-[290px] flex-col overflow-hidden rounded-2xl border bg-fo-surface transition duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
                    item.status === "active"
                      ? "border-fo-accent/25 hover:border-fo-accent/55"
                      : "border-fo-border opacity-75"
                  }`}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-fo-accent/12 via-transparent to-transparent" />
                  <div className="relative flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-fo-accent/25 bg-fo-accent/10 text-fo-accent">
                        <Sparkles size={20} />
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                        item.status === "active"
                          ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
                          : "border border-fo-border bg-fo-bg text-fo-subtle"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${item.status === "active" ? "bg-emerald-500" : "bg-fo-subtle"}`} />
                        {item.status}
                      </span>
                    </div>

                    <div className="mt-5">
                      <h3 className="text-base font-semibold tracking-tight text-fo-text">{item.name}</h3>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-semibold tracking-tight text-fo-text">{amountLabel(item.price, item.currency)}</span>
                        <span className="text-xs text-fo-subtle">one-time promotion fee</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-fo-border bg-fo-bg/70 px-2.5 py-1.5 text-[11px] text-fo-muted">
                        <CalendarDays size={13} className="text-fo-accent" />
                        {item.durationDays} days
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-fo-border bg-fo-bg/70 px-2.5 py-1.5 text-[11px] text-fo-muted">
                        <MapPin size={13} className="text-fo-accent" />
                        {(item.geo?.countries || []).length ||
                        (item.geo?.states || []).length ||
                        (item.geo?.cities || []).length
                          ? "Regional availability"
                          : "Global tier"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3 border-t border-fo-border/80 pt-4">
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-fo-subtle">Placement benefits</p>
                        {placementLabels.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {placementLabels.map((label) => (
                              <span key={label} className="inline-flex items-center gap-1 rounded-full bg-fo-accent/10 px-2 py-1 text-[10px] font-medium text-fo-accent">
                                <BadgeCheck size={11} /> {label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-fo-subtle">Priority {item.placement.priority} marketplace visibility</span>
                        )}
                      </div>
                      <p className="text-[11px] text-fo-subtle">
                        {communities.length
                          ? `Available in ${communities.slice(0, 2).map((community) => community.name).join(", ")}${communities.length > 2 ? ` +${communities.length - 2} more` : ""}`
                          : item.placement.communityRequired
                            ? "Community attribution required"
                            : "Any community or platform-wide"}
                      </p>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => editPackage(item)}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-fo-border bg-fo-bg/70 px-3 py-2.5 text-xs font-semibold text-fo-text transition hover:border-fo-accent/50 hover:bg-fo-accent/10 hover:text-fo-accent"
                      >
                        <Pencil size={13} /> Edit package
                      </button>
                      {item.status === "active" ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => deactivatePackage(item)}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-fo-border px-3 py-2.5 text-xs font-semibold text-fo-muted hover:text-fo-accent disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPackageToDelete(item)}
                        aria-label={`Delete ${item.name}`}
                        title="Delete only if no paid history"
                        className="inline-flex min-h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 transition hover:border-red-500/50 hover:bg-red-500/10"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setEditingId("");
                setDraft(emptyPackage);
                setShowPackageForm(true);
              }}
              className="flex min-h-[290px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-fo-border bg-fo-surface/50 px-6 text-center transition hover:border-fo-accent/50 hover:bg-fo-accent/5"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fo-accent/25 bg-fo-accent/10 text-fo-accent">
                <CirclePlus size={22} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-fo-text">Create a package</span>
                <span className="mt-1 block max-w-[210px] text-xs leading-relaxed text-fo-subtle">Add a new promotion option with its own duration, placement, and targeting.</span>
              </span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-fo-border bg-fo-surface px-6 py-10 text-center">
            <Sparkles size={22} className="mx-auto text-fo-accent" />
            <p className="mt-3 text-sm font-semibold text-fo-text">No packages yet</p>
            <p className="mt-1 text-xs text-fo-subtle">Create your first package to make listing promotion available.</p>
            <button
              type="button"
              onClick={() => setShowPackageForm(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-fo-accent px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-fo-accent-hover"
            >
              <CirclePlus size={14} /> Create first package
            </button>
          </div>
        )}
      </section>
      </>
      ) : null}

      {pageSection === "activity" ? (
      <section className="rounded-2xl border border-fo-border bg-fo-surface p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fo-accent">Performance & delivery</p>
            <h2 className="mt-1 font-semibold text-fo-text">Purchases and active sponsorships</h2>
          </div>
          <div className="inline-flex rounded-xl border border-fo-border bg-fo-bg p-1" role="tablist" aria-label="Sponsorship reports">
            {[
              { id: "purchases", label: "Purchases", count: data?.purchases?.length || 0, icon: CreditCard },
              { id: "active", label: "Active placements", count: data?.activePlacements?.length || 0, icon: Sparkles },
            ].map((item) => {
              const Icon = item.icon;
              const selected = reportView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setReportView(item.id)}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    selected ? "bg-fo-surface text-fo-accent shadow-sm" : "text-fo-subtle hover:text-fo-text"
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selected ? "bg-fo-accent/10 text-fo-accent" : "bg-fo-surface-2 text-fo-subtle"}`}>{item.count}</span>
                </button>
              );
            })}
          </div>
        </div>
        {reportView === "purchases" ? (
          <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-fo-subtle"><tr><th className="p-2">Listing / buyer</th><th className="p-2">Package / fee</th><th className="p-2">Community</th><th className="p-2">Payment</th><th className="p-2">Window</th></tr></thead>
            <tbody>{(data?.purchases || []).length ? (data.purchases || []).map((item) => (
              <tr key={item._id} className="border-t border-fo-border">
                <td className="p-2">{item.listing?.title || "Listing unavailable"}<span className="block text-fo-subtle">{item.buyer?.name || item.buyer?.username || "Buyer unavailable"}</span><span className="block text-fo-subtle">Ref: {item.providerTransactionId || item.providerReference}</span></td>
                <td className="p-2">{item.package?.name || item.packageSnapshot?.name || "Package"}<span className="block">{amountLabel(item.amount, item.currency)}</span></td>
                <td className="p-2">{item.community?.name || "Platform-wide"}</td><td className="p-2">{item.paymentStatus}</td><td className="p-2">{dateLabel(item.startsAt)}<span className="block text-fo-subtle">to {dateLabel(item.expiresAt)}</span></td>
              </tr>
            )) : (
              <tr><td colSpan="5" className="p-8 text-center text-xs text-fo-subtle">No sponsorship purchases yet.</td></tr>
            )}</tbody>
          </table>
        </div>
          </>
        ) : (
        <>
        <p className="text-xs text-fo-subtle">Paid listings currently visible in their configured marketplace placements.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-fo-subtle"><tr><th className="p-2">Listing</th><th className="p-2">Community</th><th className="p-2">Placement</th><th className="p-2">Expires</th></tr></thead>
            <tbody>{(data?.activePlacements || []).length ? (data.activePlacements || []).map((item) => (
              <tr key={item._id} className="border-t border-fo-border">
                <td className="p-2">{item.listing?.title || "Listing unavailable"}</td>
                <td className="p-2">{item.community?.name || "Platform-wide"}</td>
                <td className="p-2">{[item.placement?.top && "top", item.placement?.section && "section", item.placement?.badge && "badge"].filter(Boolean).join(", ") || "priority " + item.placement?.priority}</td>
                <td className="p-2">{dateLabel(item.expiresAt)}</td>
              </tr>
            )) : (
              <tr><td colSpan="4" className="p-8 text-center text-xs text-fo-subtle">There are no active sponsorships right now.</td></tr>
            )}</tbody>
          </table>
        </div>
        </>
        )}
      </section>
      ) : null}

      {pageSection === "earnings" ? (
      <>
      <section className="rounded-xl border border-fo-border bg-fo-surface p-4 sm:p-5 space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fo-accent">Commission settings</p>
          <h2 className="mt-1 font-semibold text-fo-text">Community commission</h2>
          <p className="mt-1 text-xs text-fo-subtle">
            Default is <strong className="text-fo-text">20%</strong> of the boost fee.
            Platform-wide promotions (no community selected) = <strong className="text-fo-text">no owner cut</strong>.
          </p>
        </div>
        <form onSubmit={saveCommission} className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs text-fo-subtle">
            Commission percent (0–100)
            <input type="number" min="0" max="100" step="0.01" value={commissionPercent} onChange={(event) => setCommissionPercent(event.target.value)} className="block w-40 rounded-lg border border-fo-border bg-fo-bg px-3 py-2 text-sm text-fo-text" />
          </label>
          <button disabled={saving} className="rounded-lg bg-fo-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Save commission</button>
          <p className="max-w-lg text-xs text-fo-subtle">Applied when Flutterwave confirms payment. Ledger only — payouts are not automated.</p>
        </form>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-fo-border bg-fo-surface p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrophyIcon size={16} className="text-fo-accent" />
            <h2 className="font-semibold text-fo-text">Top earners</h2>
          </div>
          <p className="text-[11px] text-fo-subtle">
            Community owners ranked by earned commission (all-time ledger).
          </p>
          {(data?.topEarners || []).length ? (
            <ol className="space-y-2">
              {data.topEarners.map((row) => (
                <li
                  key={row.owner?.id || row.rank}
                  className="flex items-start justify-between gap-3 rounded-xl border border-fo-border bg-fo-bg/40 px-3 py-2.5"
                >
                  <div className="min-w-0 flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fo-accent/15 text-[11px] font-bold text-fo-accent">
                      {row.rank}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-fo-text">
                        {row.owner?.name || row.owner?.username || "Owner"}
                      </span>
                      <span className="block truncate text-[11px] text-fo-subtle">
                        {row.owner?.email || row.owner?.username || "—"}
                        {row.communityCount
                          ? ` · ${row.communityCount} communities`
                          : ""}
                      </span>
                    </span>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-fo-accent">
                      {leaderPrimaryMoney(row.byCurrency)}
                    </span>
                    {row.byCurrency?.length > 1 ? (
                      <span className="block text-[10px] text-fo-subtle">
                        {row.byCurrency
                          .slice(1)
                          .map((c) => amountLabel(c.net, c.currency))
                          .join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-center text-xs text-fo-subtle">No owner earnings yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-fo-border bg-fo-surface p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UsersIcon size={16} className="text-fo-accent" />
            <h2 className="font-semibold text-fo-text">Top communities</h2>
          </div>
          <p className="text-[11px] text-fo-subtle">
            Communities that generated the most owner commission.
          </p>
          {(data?.topCommunities || []).length ? (
            <ol className="space-y-2">
              {data.topCommunities.map((row) => (
                <li
                  key={row.community?.id || row.rank}
                  className="flex items-start justify-between gap-3 rounded-xl border border-fo-border bg-fo-bg/40 px-3 py-2.5"
                >
                  <div className="min-w-0 flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fo-accent/15 text-[11px] font-bold text-fo-accent">
                      {row.rank}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-fo-text">
                        {row.community?.name || "Community"}
                      </span>
                      <span className="block truncate text-[11px] text-fo-subtle">
                        {row.community?.shortCode
                          ? `#${row.community.shortCode}`
                          : "Attributed promotions"}
                      </span>
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-fo-accent">
                    {leaderPrimaryMoney(row.byCurrency)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-center text-xs text-fo-subtle">No community earnings yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-fo-border bg-fo-surface p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold">Community owner earnings ledger</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-fo-subtle"><tr><th className="p-2">Community</th><th className="p-2">Owner snapshot</th><th className="p-2">Gross</th><th className="p-2">Rate</th><th className="p-2">Commission</th><th className="p-2">Status</th></tr></thead>
            <tbody>{(data?.earnings || []).length ? (data.earnings || []).map((item) => (
              <tr key={`${item.community?._id || item.community}-${item.owner?._id || item.owner}-${item.currency}-${item.percentUsed}-${item.status}`} className="border-t border-fo-border">
                <td className="p-2">{item.community?.name || "Community unavailable"}</td><td className="p-2">{item.owner?.name || item.owner?.username || item.owner?.email || "Owner unavailable"}</td>
                <td className="p-2">{amountLabel(item.gross, item.currency)}</td><td className="p-2">{item.percentUsed}%</td><td className="p-2">{amountLabel(item.commissionAmount, item.currency)}</td><td className="p-2">{item.status} ({item.purchaseCount})</td>
              </tr>
            )) : (
              <tr><td colSpan="6" className="p-8 text-center text-xs text-fo-subtle">No community commission rows yet.</td></tr>
            )}</tbody>
          </table>
        </div>
        <p className="text-xs text-fo-subtle">Refunded payments reverse the ledger row; payouts are not automated.</p>
      </section>
      </>
      ) : null}

      <ConfirmDeleteModal
        open={Boolean(packageToDelete)}
        title={
          packageToDelete?._blockedDelete
            ? "Cannot delete — deactivate instead"
            : "Delete sponsorship package?"
        }
        loading={saving}
        confirmLabel={packageToDelete?._blockedDelete ? "Deactivate" : "Delete"}
        onConfirm={
          packageToDelete?._blockedDelete
            ? () => deactivatePackage(packageToDelete)
            : confirmDeletePackage
        }
        onClose={() => setPackageToDelete(null)}
      >
        {packageToDelete?._blockedDelete ? (
          <div className="space-y-2 text-sm text-fo-subtle">
            <p>
              “{packageToDelete.name}” still has purchase records
              {packageToDelete._historyCounts
                ? ` (${packageToDelete._historyCounts.paid || 0} paid, ${
                    packageToDelete._historyCounts.pending || 0
                  } pending)`
                : ""}
              . Deleting a listing does not remove those purchases — they stay for
              reports and commission history.
            </p>
            <p className="text-fo-text">
              Use <strong>Deactivate</strong> so sellers cannot buy it anymore, while
              history remains.
            </p>
          </div>
        ) : packageToDelete ? (
          `“${packageToDelete.name}” will be permanently removed. If it has paid purchases (even for deleted listings), delete is blocked — deactivate instead.`
        ) : null}
      </ConfirmDeleteModal>
    </div>
  );
}
