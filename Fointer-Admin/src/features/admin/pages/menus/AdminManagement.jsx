import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LuLoaderCircle as Loader2,
  LuPlus as Plus,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuShield as Shield,
  LuShieldOff as ShieldOff,
  LuUserCog as UserCog,
  LuX as X,
} from 'react-icons/lu';
import {
  createAdmin,
  fetchAdmins,
  updateAdminSuper,
  updateAdminTabs,
} from '../../services/adminService';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../shared/components/feedback/ToastContext';
import ConfirmDeleteModal from '../../../../shared/components/modals/ConfirmDeleteModal';
import AdminActionBtn from '../../../../shared/components/AdminActionBtn';
import { getErrorMessage } from '../../../../shared/utils/errors';
import {
  ADMIN_TAB_LABELS,
  ASSIGNABLE_ADMIN_TAB_IDS,
} from '../../../../shared/lib/roles';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'super', label: 'Super' },
  { id: 'limited', label: 'Limited' },
];

const inputClass =
  'w-full bg-fo-bg border border-fo-border rounded-lg px-3 py-2.5 text-sm text-fo-text focus:outline-none focus:border-fo-accent/50 placeholder:text-fo-subtle';

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

function TabChecklist({ selected, onChange, disabled = false, error = '' }) {
  const allSelected = selected.length === ASSIGNABLE_ADMIN_TAB_IDS.length;

  const toggle = (id) => {
    if (disabled) return;
    if (selected.includes(id)) {
      onChange(selected.filter((t) => t !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[11px] uppercase tracking-wider text-fo-subtle">
          Tab access <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange(
                allSelected ? [] : [...ASSIGNABLE_ADMIN_TAB_IDS]
              )
            }
            className="text-[10px] font-medium text-fo-accent hover:underline disabled:opacity-50"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
          <span className="text-[10px] text-fo-subtle">
            {selected.length} selected
          </span>
        </div>
      </div>
      <div
        className={`max-h-48 overflow-y-auto rounded-lg border bg-fo-bg p-2 space-y-1 ${
          error ? 'border-red-500/40' : 'border-fo-border'
        }`}
      >
        {ASSIGNABLE_ADMIN_TAB_IDS.map((id) => {
          const checked = selected.includes(id);
          return (
            <label
              key={id}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                checked
                  ? 'bg-fo-accent/10 text-fo-text'
                  : 'text-fo-muted hover:bg-fo-surface-hover'
              } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(id)}
                disabled={disabled}
                className="rounded border-fo-border text-fo-accent focus:ring-fo-accent/40"
              />
              <span>{ADMIN_TAB_LABELS[id] || id}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="text-[11px] text-red-400">{error}</p>
      ) : (
        <p className="text-[11px] text-fo-subtle">
          At least one tab is required. Admin Management stays super-admin only.
        </p>
      )}
    </div>
  );
}

const EMPTY_TABS = [];

function AdminFormModal({
  open,
  mode = 'create',
  initialTabs = EMPTY_TABS,
  admin = null,
  isSelf = false,
  loading = false,
  onClose,
  onSubmit,
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [adminTabs, setAdminTabs] = useState([]);
  const [touched, setTouched] = useState(false);

  // Reset only when the modal opens (or mode/admin target changes) — not on
  // every keystroke. A default `initialTabs = []` would be a new array each
  // render and wipe fields if listed as an effect dependency.
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (mode === 'create') {
      setName('');
      setEmail('');
      setPassword('');
      setUsername('');
      setAdminTabs([]);
      return;
    }
    const tabs = Array.isArray(initialTabs) ? initialTabs : EMPTY_TABS;
    setAdminTabs(
      tabs.filter((t) => ASSIGNABLE_ADMIN_TAB_IDS.includes(t))
    );
    // intentionally omit initialTabs array identity; open/mode/admin id gate reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, admin?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const title =
    mode === 'create'
      ? 'Create admin'
      : mode === 'demote'
        ? 'Demote to limited admin'
        : 'Edit tab access';

  const emailOk = isValidEmail(email);
  const passwordOk = password.length >= 8;
  const tabsOk = adminTabs.length > 0;
  const nameOk = Boolean(name.trim());

  const fieldErrors = {
    name: touched && mode === 'create' && !nameOk ? 'Name is required.' : '',
    email:
      touched && mode === 'create' && !email.trim()
        ? 'Email is required.'
        : touched && mode === 'create' && !emailOk
          ? 'Enter a valid email.'
          : '',
    password:
      touched && mode === 'create' && !password
        ? 'Password is required.'
        : touched && mode === 'create' && !passwordOk
          ? 'Password must be at least 8 characters.'
          : '',
    tabs: touched && !tabsOk ? 'Select at least one tab.' : '',
  };

  const canSubmit =
    mode === 'create'
      ? nameOk && emailOk && passwordOk && tabsOk
      : tabsOk;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit || loading) return;
    if (mode === 'create') {
      await onSubmit({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        username: username.trim() || undefined,
        adminTabs,
      });
      return;
    }
    await onSubmit({ adminTabs });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--theme-overlay)] backdrop-blur-sm">
      <div className="relative w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-fo-surface border border-fo-border rounded-2xl p-6 space-y-5 shadow-2xl text-fo-text">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-medium text-fo-text">{title}</h3>
            {admin ? (
              <p className="text-xs text-fo-subtle mt-1 truncate">
                {admin.name || admin.username} · {admin.email}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="text-fo-subtle hover:text-fo-text transition-colors p-1 shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {mode === 'demote' && isSelf ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            You are demoting your own account. After this you will lose Admin
            Management and only keep the tabs you select below.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'create' ? (
            <>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  autoFocus
                />
                {fieldErrors.name ? (
                  <p className="mt-1 text-[11px] text-red-400">
                    {fieldErrors.name}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
                {fieldErrors.email ? (
                  <p className="mt-1 text-[11px] text-red-400">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1.5">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  placeholder="At least 8 characters"
                  className={inputClass}
                  autoComplete="new-password"
                />
                {fieldErrors.password ? (
                  <p className="mt-1 text-[11px] text-red-400">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-fo-subtle mb-1.5">
                  Username{' '}
                  <span className="text-fo-subtle normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className={inputClass}
                />
              </div>
            </>
          ) : null}

          {mode === 'demote' ? (
            <p className="text-xs text-fo-muted">
              Choose which tabs this admin may use after demotion.
            </p>
          ) : null}

          <TabChecklist
            selected={adminTabs}
            onChange={setAdminTabs}
            disabled={loading}
            error={fieldErrors.tabs}
          />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-fo-border text-xs font-semibold text-fo-muted hover:text-fo-text transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fo-brand text-xs font-semibold text-fo-brand-fg disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {mode === 'create'
                ? 'Create admin'
                : mode === 'demote'
                  ? 'Demote'
                  : 'Save tabs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function tabChips(admin) {
  if (admin.isSuperAdmin) {
    return (
      <span className="text-[10px] font-medium text-fo-accent">All tabs</span>
    );
  }
  const tabs = (admin.adminTabs || []).filter((t) => t !== 'admins');
  if (!tabs.length) {
    return <span className="text-[10px] text-fo-subtle">No tabs</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.slice(0, 4).map((t) => (
        <span
          key={t}
          className="px-1.5 py-0.5 rounded bg-fo-bg border border-fo-border text-[10px] text-fo-muted"
        >
          {ADMIN_TAB_LABELS[t] || t}
        </span>
      ))}
      {tabs.length > 4 ? (
        <span className="text-[10px] text-fo-subtle">+{tabs.length - 4}</span>
      ) : null}
    </div>
  );
}

export default function AdminManagement() {
  const { user: currentUser, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [admins, setAdmins] = useState([]);
  const [summary, setSummary] = useState({ all: 0, superAdmins: 0 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [modal, setModal] = useState(null);
  const [promoteTarget, setPromoteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentId = String(currentUser?.id || currentUser?._id || '');

  const loadAdmins = useCallback(
    async (opts = {}) => {
      const nextSearch = opts.search ?? search;
      setLoading(true);
      try {
        const params = {};
        if (nextSearch.trim()) params.q = nextSearch.trim();
        const data = await fetchAdmins(params);
        setAdmins(data?.admins || []);
        setSummary(data?.summary || { all: 0, superAdmins: 0 });
      } catch (err) {
        showToast(getErrorMessage(err, 'Failed to load admins.'));
      } finally {
        setLoading(false);
      }
    },
    [search, showToast]
  );

  useEffect(() => {
    loadAdmins({ search: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load
  }, []);

  const superAdminCount = useMemo(() => {
    if (summary.superAdmins != null) return summary.superAdmins;
    return admins.filter((a) => a.isSuperAdmin).length;
  }, [summary.superAdmins, admins]);

  const limitedCount = useMemo(
    () => Math.max(0, (summary.all || admins.length) - superAdminCount),
    [summary.all, admins.length, superAdminCount]
  );

  const filteredAdmins = useMemo(() => {
    if (filter === 'super') return admins.filter((a) => a.isSuperAdmin);
    if (filter === 'limited') return admins.filter((a) => !a.isSuperAdmin);
    return admins;
  }, [admins, filter]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadAdmins({ search });
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
  };

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      await createAdmin(payload);
      showToast('Admin created. They can sign in on the admin portal.');
      setModal(null);
      await loadAdmins();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create admin.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTabs = async ({ adminTabs }) => {
    if (!modal?.admin?.id) return;
    setSaving(true);
    try {
      await updateAdminTabs(modal.admin.id, adminTabs);
      showToast('Tab access updated.');
      setModal(null);
      await loadAdmins();
      if (String(modal.admin.id) === currentId) {
        await refreshUser();
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update tabs.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDemote = async ({ adminTabs }) => {
    if (!modal?.admin?.id) return;
    setSaving(true);
    try {
      await updateAdminSuper(modal.admin.id, {
        isSuperAdmin: false,
        adminTabs,
      });
      showToast('Admin demoted to limited access.');
      setModal(null);
      await loadAdmins();
      if (String(modal.admin.id) === currentId) {
        await refreshUser();
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to demote admin.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmPromote = async () => {
    if (!promoteTarget) return;
    setBusyId(promoteTarget.id);
    try {
      await updateAdminSuper(promoteTarget.id, { isSuperAdmin: true });
      showToast('Promoted to super admin.');
      setPromoteTarget(null);
      await loadAdmins();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to promote admin.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
            Admin Management ({summary.all})
          </h1>
          <p className="text-sm text-fo-subtle">
            {superAdminCount} super · {limitedCount} limited · new admins are
            created only here
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadAdmins()}
            disabled={loading}
            className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-fo-brand text-xs font-semibold text-fo-brand-fg"
          >
            <Plus size={14} />
            Create admin
          </button>
        </div>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count =
            f.id === 'all'
              ? summary.all
              : f.id === 'super'
                ? superAdminCount
                : limitedCount;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#1A1510] text-fo-accent border border-fo-accent/35'
                  : 'text-fo-subtle hover:text-fo-text border border-transparent'
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSearch} className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by name, username, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-fo-surface border border-fo-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
        />
      </form>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
          <Loader2 size={16} className="animate-spin text-fo-accent" />
          Loading admins…
        </div>
      ) : filteredAdmins.length === 0 ? (
        <div className="border border-dashed border-fo-border rounded-xl py-14 text-center space-y-3">
          <p className="text-sm text-fo-subtle">
            {search.trim() || filter !== 'all'
              ? 'No admins match this filter.'
              : 'No admins yet.'}
          </p>
          {!search.trim() && filter === 'all' ? (
            <button
              type="button"
              onClick={() => setModal({ mode: 'create' })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fo-border text-xs font-semibold text-fo-accent hover:border-fo-accent/40"
            >
              <Plus size={14} />
              Create your first limited admin
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAdmins.map((admin) => {
            const isSelf = String(admin.id) === currentId;
            const busy = busyId === admin.id;
            const canDemote = admin.isSuperAdmin && superAdminCount > 1;

            return (
              <article
                key={admin.id}
                className="bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl overflow-hidden transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 sm:p-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {admin.avatar ? (
                      <img
                        src={admin.avatar}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-fo-border shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#1A1510] border border-fo-border flex items-center justify-center text-fo-accent text-sm font-semibold shrink-0">
                        {(admin.name || admin.username || '?')
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold text-fo-text truncate">
                          {admin.name || admin.username}
                        </h2>
                        {admin.isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-fo-accent">
                            <Shield size={10} />
                            Super
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-fo-subtle">
                            <UserCog size={10} />
                            Limited
                          </span>
                        )}
                        {isSelf ? (
                          <span className="text-[10px] text-fo-subtle">You</span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-fo-subtle truncate">
                        @{admin.username}
                        {admin.email ? ` · ${admin.email}` : ''}
                      </p>
                      {tabChips(admin)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 sm:justify-end">
                    {admin.isSuperAdmin ? (
                      <AdminActionBtn
                        tone="danger"
                        disabled={busy || !canDemote}
                        onClick={() => setModal({ mode: 'demote', admin })}
                        title={
                          !canDemote
                            ? 'Cannot demote the last super admin'
                            : 'Demote to limited admin'
                        }
                      >
                        <ShieldOff size={12} />
                        Demote
                      </AdminActionBtn>
                    ) : (
                      <>
                        <AdminActionBtn
                          tone="brand"
                          disabled={busy}
                          onClick={() =>
                            setModal({
                              mode: 'edit',
                              admin,
                              initialTabs: admin.adminTabs || [],
                            })
                          }
                        >
                          Edit tabs
                        </AdminActionBtn>
                        <AdminActionBtn
                          tone="success"
                          disabled={busy}
                          onClick={() => setPromoteTarget(admin)}
                        >
                          {busy ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Shield size={12} />
                          )}
                          Make super
                        </AdminActionBtn>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AdminFormModal
        open={modal?.mode === 'create'}
        mode="create"
        loading={saving}
        onClose={closeModal}
        onSubmit={handleCreate}
      />
      <AdminFormModal
        open={modal?.mode === 'edit'}
        mode="edit"
        admin={modal?.admin}
        initialTabs={modal?.initialTabs || []}
        loading={saving}
        onClose={closeModal}
        onSubmit={handleSaveTabs}
      />
      <AdminFormModal
        open={modal?.mode === 'demote'}
        mode="demote"
        admin={modal?.admin}
        isSelf={String(modal?.admin?.id || '') === currentId}
        initialTabs={[]}
        loading={saving}
        onClose={closeModal}
        onSubmit={handleDemote}
      />

      <ConfirmDeleteModal
        open={Boolean(promoteTarget)}
        variant="dashboard"
        title="Make super admin?"
        confirmLabel="Make super"
        onClose={() => {
          if (!busyId) setPromoteTarget(null);
        }}
        onConfirm={confirmPromote}
        loading={Boolean(busyId && promoteTarget && busyId === promoteTarget.id)}
      >
        <p>
          <span className="text-fo-text font-medium">
            {promoteTarget?.name || promoteTarget?.username}
          </span>{' '}
          will get full panel access, including Admin Management.
        </p>
      </ConfirmDeleteModal>
    </div>
  );
}
