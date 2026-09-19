import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuCircleCheck as CheckCircle2,
  LuClock3 as Clock3,
  LuHeadset as Headset,
  LuLoaderCircle as Loader2,
  LuPencil as Pencil,
  LuPlus as Plus,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuX as X,
} from "react-icons/lu";
import {
  createAdminUserSupportCategory,
  fetchAdminUserSupportCategories,
  fetchAdminUserSupportRequests,
  updateAdminUserSupportCategory,
  updateAdminUserSupportRequestStatus,
} from "../../services/adminService";
import AdminActionBtn from "../../../../shared/components/AdminActionBtn";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";

const PAGE_TABS = [
  { id: "categories", label: "Categories" },
  { id: "requests", label: "Requests" },
];

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In progress" },
  { id: "resolved", label: "Resolved" },
];

const STATUS_META = {
  pending: {
    label: "Pending",
    className: "text-fo-accent",
    icon: Clock3,
  },
  in_progress: {
    label: "In progress",
    className: "text-sky-400",
    icon: Loader2,
  },
  resolved: {
    label: "Resolved",
    className: "text-emerald-400",
    icon: CheckCircle2,
  },
};

const inputClass =
  "w-full bg-fo-surface-hover border border-fo-border rounded-lg p-2.5 text-xs text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent";

export default function UserSupportManagement() {
  const { showToast } = useToast();
  const [pageTab, setPageTab] = useState("categories");
  const [categories, setCategories] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadCategories = useCallback(async () => {
    const data = await fetchAdminUserSupportCategories();
    setCategories(data?.categories || []);
  }, []);

  const loadRequests = useCallback(async () => {
    const data = await fetchAdminUserSupportRequests();
    setRequests(data?.requests || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadCategories(), loadRequests()]);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load user support."));
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadRequests, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setName("");
    setEditingId(null);
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setName(category.name || "");
  };

  const handleSaveCategory = async (event) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      showToast("Category name is required.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateAdminUserSupportCategory(editingId, { name: nextName });
        showToast("Category updated.");
      } else {
        await createAdminUserSupportCategory({ name: nextName, isActive: true });
        showToast("Category created.");
      }
      resetForm();
      await loadCategories();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to save category."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (category) => {
    setUpdatingId(category.id);
    try {
      await updateAdminUserSupportCategory(category.id, {
        isActive: !category.isActive,
      });
      await loadCategories();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update category."));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatus = async (requestId, status) => {
    setUpdatingId(requestId);
    try {
      await updateAdminUserSupportRequestStatus(requestId, status);
      await loadRequests();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update request."));
    } finally {
      setUpdatingId(null);
    }
  };

  const counts = useMemo(() => {
    const base = {
      all: requests.length,
      pending: 0,
      in_progress: 0,
      resolved: 0,
    };
    requests.forEach((item) => {
      if (base[item.status] !== undefined) base[item.status] += 1;
    });
    return base;
  }, [requests]);

  const visibleRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!q) return true;
      return (
        String(item.email || "")
          .toLowerCase()
          .includes(q) ||
        String(item.phone || "")
          .toLowerCase()
          .includes(q) ||
        String(item.categoryName || "")
          .toLowerCase()
          .includes(q) ||
        String(item.message || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [filter, requests, search]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
            User Support Management
          </h1>
          <p className="text-xs text-fo-subtle">
            Create categories for the public User Support page, then review
            submitted requests.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg border border-fo-border text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border">
        {PAGE_TABS.map((tab) => {
          const active = pageTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPageTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                active
                  ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                  : "text-fo-subtle hover:text-fo-text border border-transparent"
              }`}
            >
              {tab.label}
              {tab.id === "requests" ? (
                <span className="ml-1.5 text-[10px] opacity-70">
                  {counts.all}
                </span>
              ) : (
                <span className="ml-1.5 text-[10px] opacity-70">
                  {categories.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {pageTab === "categories" ? (
        <section className="space-y-4">
          <form
            onSubmit={handleSaveCategory}
            className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-fo-text">
                {editingId ? "Edit category" : "New category"}
              </p>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-fo-subtle hover:text-fo-text p-1"
                  title="Cancel edit"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>
            <label className="block space-y-1.5">
              <span className="text-[11px] uppercase tracking-wide text-fo-subtle">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Account, Billing, Technical…"
                className={inputClass}
                maxLength={80}
              />
            </label>
            <div className="flex justify-end">
              <AdminActionBtn type="submit" tone="accent" disabled={saving}>
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : editingId ? (
                  <Pencil size={12} />
                ) : (
                  <Plus size={12} />
                )}
                {editingId ? "Save changes" : "Create category"}
              </AdminActionBtn>
            </div>
          </form>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
              <Loader2 size={16} className="animate-spin text-fo-accent" />
              Loading categories…
            </div>
          ) : categories.length === 0 ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4 space-y-2">
              <Headset className="w-8 h-8 mx-auto text-fo-accent/40" />
              <p>No categories yet. Create one to show it on User Support.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => {
                const busy = updatingId === category.id;
                return (
                  <article
                    key={category.id}
                    className="bg-fo-surface border border-fo-border rounded-xl p-3.5 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fo-text truncate">
                        {category.name}
                      </p>
                      <p className="text-[11px] text-fo-subtle">
                        {category.isActive
                          ? "Visible on User Support"
                          : "Hidden from User Support"}
                      </p>
                    </div>
                    <AdminActionBtn
                      tone="ghost"
                      disabled={busy}
                      onClick={() => startEdit(category)}
                    >
                      <Pencil size={12} />
                      Edit
                    </AdminActionBtn>
                    <AdminActionBtn
                      tone={category.isActive ? "danger" : "success"}
                      disabled={busy}
                      onClick={() => handleToggleActive(category)}
                    >
                      {busy ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : null}
                      {category.isActive ? "Hide" : "Show"}
                    </AdminActionBtn>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex gap-1 p-1 rounded-xl bg-fo-bg border border-fo-border overflow-x-auto">
            {STATUS_FILTERS.map((item) => {
              const active = filter === item.id;
              const count = item.id === "all" ? counts.all : counts[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`flex-1 min-w-[4.5rem] py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? "bg-[#1A1510] text-fo-accent border border-fo-accent/35"
                      : "text-fo-subtle hover:text-fo-text border border-transparent"
                  }`}
                >
                  {item.label}
                  <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-fo-subtle pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, phone, category, or request…"
              className="w-full bg-fo-surface border border-fo-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent/50"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-fo-muted">
              <Loader2 size={16} className="animate-spin text-fo-accent" />
              Loading requests…
            </div>
          ) : requests.length === 0 ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle px-4 space-y-2">
              <Headset className="w-8 h-8 mx-auto text-fo-accent/40" />
              <p>No user support requests yet.</p>
            </div>
          ) : visibleRequests.length === 0 ? (
            <div className="border border-dashed border-fo-border rounded-xl py-14 text-center text-sm text-fo-subtle">
              No requests match this filter.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleRequests.map((item) => {
                const meta = STATUS_META[item.status] || STATUS_META.pending;
                const StatusIcon = meta.icon;
                const busy = updatingId === item.id;
                return (
                  <article
                    key={item.id}
                    className="bg-fo-surface border border-fo-border hover:border-fo-accent/35 rounded-xl p-3.5 sm:p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-[11px] text-fo-subtle flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${meta.className}`}
                          >
                            <StatusIcon size={12} />
                            {meta.label}
                          </span>
                          <span>·</span>
                          <span className="text-fo-muted">
                            {item.categoryName || "Category"}
                          </span>
                          {item.createdAt ? (
                            <>
                              <span>·</span>
                              <span>{timeAgo(item.createdAt)}</span>
                            </>
                          ) : null}
                        </div>
                        <p className="text-[12px] text-fo-text">
                          {item.email}
                          <span className="text-fo-subtle"> · </span>
                          {item.phone}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-fo-text whitespace-pre-wrap break-words leading-relaxed">
                      {item.message}
                    </p>
                    {item.status !== "resolved" ? (
                      <div className="flex flex-wrap gap-1.5">
                        {item.status === "pending" ? (
                          <AdminActionBtn
                            tone="accent"
                            disabled={busy}
                            onClick={() => handleStatus(item.id, "in_progress")}
                          >
                            Mark in progress
                          </AdminActionBtn>
                        ) : null}
                        <AdminActionBtn
                          tone="success"
                          disabled={busy}
                          onClick={() => handleStatus(item.id, "resolved")}
                        >
                          {busy ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={12} />
                          )}
                          Resolve
                        </AdminActionBtn>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
