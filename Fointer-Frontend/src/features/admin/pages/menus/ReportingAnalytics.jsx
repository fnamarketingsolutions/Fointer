import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LuBan as Ban,
  LuChartColumn as BarChart3,
  LuCircleCheck as CheckCircle2,
  LuFlag as Flag,
  LuFileText as FileText,
  LuLoaderCircle as Loader2,
  LuMessageCircle as MessageCircle,
  LuRefreshCw as RefreshCw,
  LuSearch as Search,
  LuShield as Shield,
  LuTrash2 as Trash2,
  LuUsers as Users,
  LuX as X,
  LuCircleX as XCircle
} from "react-icons/lu";
import {
  fetchAdminAnalytics,
  fetchAdminReports,
  updateAdminReport,
} from "../../services/adminService";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";

const STATUS_FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "actioned", label: "Actioned" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
];

const STATUS_META = {
  pending: { label: "Pending", className: "text-[#D4AF37]" },
  reviewed: { label: "Reviewed", className: "text-sky-400" },
  actioned: { label: "Actioned", className: "text-emerald-400" },
  dismissed: { label: "Dismissed", className: "text-[#8C8070]" },
};

const VIEWS = [
  { id: "reports", label: "Reports" },
  { id: "analytics", label: "Analytics" },
];

function ActionBtn({ onClick, disabled, tone = "ghost", children }) {
  const tones = {
    ghost:
      "border border-[#2A241E] text-[#A69B8D] hover:text-[#E5E0D8] hover:border-[#D4AF37]/30",
    danger:
      "border border-red-500/30 text-red-400 hover:bg-red-500/10",
    primary:
      "border border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/10",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export default function ReportingAnalytics() {
  const { showToast } = useToast();
  const [view, setView] = useState("reports");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({
    all: 0,
    pending: 0,
    actioned: 0,
    dismissed: 0,
    reviewed: 0,
  });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [adminNote, setAdminNote] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminReports({
        status,
        ...(query.trim() ? { q: query.trim() } : {}),
      });
      setReports(data?.reports || []);
      setSummary(
        data?.summary || {
          all: 0,
          pending: 0,
          actioned: 0,
          dismissed: 0,
          reviewed: 0,
        }
      );
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load reports."));
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [status, query, showToast]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await fetchAdminAnalytics();
      setAnalytics(data?.analytics || null);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load analytics."));
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (view === "reports") loadReports();
    else loadAnalytics();
  }, [view, loadReports, loadAnalytics]);

  const visibleReports = useMemo(() => reports, [reports]);

  const handleAction = async (report, action) => {
    const labels = {
      dismiss: "Dismiss this report as not a violation?",
      delete_content: "Delete the reported content?",
      ban_author: "Ban the content author?",
      delete_and_ban: "Delete the content and ban the author?",
    };
    if (!window.confirm(labels[action] || "Continue?")) return;

    setBusyId(report.id);
    try {
      const data = await updateAdminReport(report.id, {
        action,
        adminNote: adminNote.trim(),
      });
      showToast(data?.message || "Report updated.");
      setSelected(null);
      setAdminNote("");
      await loadReports();
      if (view === "analytics") await loadAnalytics();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update report."));
    } finally {
      setBusyId(null);
    }
  };

  const openReport = (report) => {
    setSelected(report);
    setAdminNote(report.adminNote || "");
  };

  const statCards = analytics
    ? [
        {
          label: "Pending reports",
          value: analytics.pendingReports,
          icon: Flag,
          tone: "text-[#D4AF37]",
        },
        {
          label: "Reports this week",
          value: analytics.reportsThisWeek,
          icon: BarChart3,
          tone: "text-sky-400",
        },
        {
          label: "Actioned",
          value: analytics.actionedReports,
          icon: CheckCircle2,
          tone: "text-emerald-400",
        },
        {
          label: "Dismissed",
          value: analytics.dismissedReports,
          icon: XCircle,
          tone: "text-[#8C8070]",
        },
        {
          label: "Total posts",
          value: analytics.totalPosts,
          icon: FileText,
          tone: "text-[#D4AF37]",
        },
        {
          label: "Total comments",
          value: analytics.totalComments,
          icon: MessageCircle,
          tone: "text-[#D4AF37]",
        },
        {
          label: "Users",
          value: analytics.totalUsers,
          icon: Users,
          tone: "text-[#D4AF37]",
        },
        {
          label: "Banned users",
          value: analytics.bannedUsers,
          icon: Ban,
          tone: "text-red-400",
        },
      ]
    : [];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#E5E0D8]">
            Reports & Analytics
          </h1>
          <p className="text-sm text-[#8C8070]">
            Review reports and monitor platform health.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (view === "reports" ? loadReports() : loadAnalytics())}
          disabled={loading || analyticsLoading}
          className="p-2 rounded-lg border border-[#2A241E] text-[#A69B8D] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition-colors disabled:opacity-50 shrink-0"
          title="Refresh"
        >
          <RefreshCw
            size={16}
            className={loading || analyticsLoading ? "animate-spin" : ""}
          />
        </button>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E]">
        {VIEWS.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                active
                  ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                  : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
              }`}
            >
              {item.label}
              {item.id === "reports" && summary.pending ? (
                <span className="ml-1.5 text-[10px] opacity-70">
                  {summary.pending}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {view === "analytics" ? (
        analyticsLoading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
            <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
            Loading analytics…
          </div>
        ) : !analytics ? (
          <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070]">
            No analytics available.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="bg-[#14100D] border border-[#2A241E] rounded-xl p-3.5"
                  >
                    <Icon size={14} className={card.tone} />
                    <p className="text-xl font-semibold text-[#E5E0D8] mt-2 tabular-nums">
                      {card.value ?? 0}
                    </p>
                    <p className="text-[11px] text-[#8C8070] mt-0.5">
                      {card.label}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[#E5E0D8]">
                  Reports by reason
                </h3>
                {(analytics.reportsByReason || []).length === 0 ? (
                  <p className="text-xs text-[#8C8070]">No reports yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {analytics.reportsByReason.map((row) => (
                      <li
                        key={row.reason}
                        className="flex items-center justify-between text-xs gap-3"
                      >
                        <span className="text-[#A69B8D] truncate">
                          {row.label}
                        </span>
                        <span className="text-[#D4AF37] tabular-nums shrink-0">
                          {row.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bg-[#14100D] border border-[#2A241E] rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[#E5E0D8]">
                  Last 7 days
                </h3>
                {(analytics.reportsByDay || []).length === 0 ? (
                  <p className="text-xs text-[#8C8070]">No reports this week.</p>
                ) : (
                  <ul className="space-y-2">
                    {analytics.reportsByDay.map((row) => (
                      <li
                        key={row.date}
                        className="flex items-center justify-between text-xs gap-3"
                      >
                        <span className="text-[#8C8070] tabular-nums">
                          {row.date}
                        </span>
                        <span className="text-[#D4AF37] tabular-nums">
                          {row.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: "Communities", value: analytics.totalCommunities },
                { label: "Live events", value: analytics.liveEvents },
                { label: "Watch groups", value: analytics.watchGroups },
                { label: "Open queue", value: analytics.pendingReports },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-[#14100D] border border-[#2A241E] rounded-xl p-3.5"
                >
                  <p className="text-[11px] text-[#8C8070]">{item.label}</p>
                  <p className="text-lg font-semibold text-[#E5E0D8] mt-1 tabular-nums">
                    {item.value ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8070] pointer-events-none"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reports…"
                className="w-full bg-[#14100D] border border-[#2A241E] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#E5E0D8] placeholder:text-[#5C5348] focus:outline-none focus:border-[#D4AF37]/50"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#e0c04a] shrink-0"
            >
              Search
            </button>
          </form>

          <div className="flex gap-1 p-1 rounded-xl bg-[#0E0C0A] border border-[#2A241E] overflow-x-auto">
            {STATUS_FILTERS.map((item) => {
              const active = status === item.id;
              const count = summary[item.id] ?? 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatus(item.id)}
                  className={`flex-1 min-w-[4.5rem] py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? "bg-[#1A1510] text-[#D4AF37] border border-[#D4AF37]/35"
                      : "text-[#8C8070] hover:text-[#E5E0D8] border border-transparent"
                  }`}
                >
                  {item.label}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#A69B8D]">
              <Loader2 size={16} className="animate-spin text-[#D4AF37]" />
              Loading reports…
            </div>
          ) : visibleReports.length === 0 ? (
            <div className="border border-dashed border-[#2A241E] rounded-xl py-14 text-center text-sm text-[#8C8070] px-4 space-y-2">
              <Shield className="w-8 h-8 mx-auto text-[#D4AF37]/40" />
              <p>
                {query
                  ? `No reports match “${query}”.`
                  : status === "pending"
                    ? "No pending reports. Great job."
                    : "No reports in this filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleReports.map((report) => {
                const meta = STATUS_META[report.status] || STATUS_META.pending;
                return (
                  <article
                    key={report.id}
                    className="bg-[#14100D] border border-[#2A241E] hover:border-[#D4AF37]/35 rounded-xl p-3.5 sm:p-4 transition-colors space-y-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => openReport(report)}
                      className="w-full text-left space-y-1.5"
                    >
                      <div className="flex items-center gap-2 text-[11px] text-[#8C8070] flex-wrap">
                        <span className={`font-medium ${meta.className}`}>
                          {meta.label}
                        </span>
                        <span>·</span>
                        <span className="text-[#A69B8D]">
                          {report.reasonLabel}
                        </span>
                        <span>·</span>
                        <span className="capitalize">{report.targetType}</span>
                        <span>·</span>
                        <span>{timeAgo(report.createdAt)}</span>
                      </div>
                      <h2 className="text-sm font-semibold text-[#E5E0D8] line-clamp-2 leading-snug">
                        {report.snapshot?.title ||
                          report.snapshot?.text?.slice(0, 80) ||
                          "Reported content"}
                      </h2>
                      {report.snapshot?.text ? (
                        <p className="text-xs text-[#A69B8D] line-clamp-2 leading-relaxed">
                          {report.snapshot.text}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-[#8C8070]">
                        by {report.snapshot?.authorName || "Unknown"}
                        {report.snapshot?.communityName
                          ? ` · ${report.snapshot.communityName}`
                          : ""}
                        {" · reported by "}
                        {report.reporter?.name ||
                          report.reporter?.username ||
                          "User"}
                        {!report.targetExists ? (
                          <span className="text-red-400"> · Removed</span>
                        ) : null}
                      </p>
                    </button>

                    <div className="flex flex-wrap gap-1.5">
                      <ActionBtn
                        tone="primary"
                        onClick={() => openReport(report)}
                      >
                        Review
                      </ActionBtn>
                      {report.status === "pending" ? (
                        <>
                          <ActionBtn
                            disabled={busyId === report.id}
                            onClick={() => handleAction(report, "dismiss")}
                          >
                            <XCircle size={12} /> Dismiss
                          </ActionBtn>
                          <ActionBtn
                            tone="danger"
                            disabled={
                              busyId === report.id || !report.targetExists
                            }
                            onClick={() =>
                              handleAction(report, "delete_content")
                            }
                          >
                            <Trash2 size={12} /> Delete
                          </ActionBtn>
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full sm:max-w-lg max-h-[88vh] overflow-hidden flex flex-col bg-[#14100D] border border-[#2A241E] border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#2A241E] shrink-0">
              <h2 className="text-sm font-semibold text-[#E5E0D8]">
                Report review
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-[#A69B8D] hover:text-[#E5E0D8] hover:bg-[#1A1510]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 text-[11px] flex-wrap">
                <span
                  className={`font-medium ${
                    (STATUS_META[selected.status] || STATUS_META.pending)
                      .className
                  }`}
                >
                  {(STATUS_META[selected.status] || STATUS_META.pending).label}
                </span>
                <span className="text-[#8C8070]">·</span>
                <span className="text-[#A69B8D]">{selected.reasonLabel}</span>
                <span className="text-[#8C8070]">·</span>
                <span className="text-[#8C8070] capitalize">
                  {selected.targetType}
                </span>
              </div>

              <div className="space-y-1">
                {selected.snapshot?.title ? (
                  <h3 className="text-base font-semibold text-[#E5E0D8]">
                    {selected.snapshot.title}
                  </h3>
                ) : null}
                <p className="text-sm text-[#A69B8D] whitespace-pre-wrap break-words leading-relaxed">
                  {selected.snapshot?.text || "No text snapshot."}
                </p>
                <p className="text-[11px] text-[#8C8070] pt-1">
                  Author: {selected.snapshot?.authorName || "Unknown"}
                  {selected.snapshot?.authorId ? (
                    <>
                      {" · "}
                      <Link
                        to={`/admin/users/${selected.snapshot.authorId}`}
                        className="text-[#D4AF37] hover:underline"
                      >
                        View user
                      </Link>
                    </>
                  ) : null}
                </p>
                {!selected.targetExists ? (
                  <p className="text-[11px] text-red-400">
                    Original content is no longer on the platform.
                  </p>
                ) : null}
              </div>

              {selected.details ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#8C8070] mb-1">
                    Reporter note
                  </p>
                  <p className="text-xs text-[#A69B8D] whitespace-pre-wrap">
                    {selected.details}
                  </p>
                </div>
              ) : null}

              <p className="text-[11px] text-[#8C8070]">
                Reported by{" "}
                {selected.reporter?.name ||
                  selected.reporter?.username ||
                  "User"}{" "}
                · {timeAgo(selected.createdAt)}
              </p>

              {selected.actionTaken ? (
                <p className="text-xs text-emerald-400">
                  Action taken: {selected.actionTaken}
                </p>
              ) : null}

              {selected.status === "pending" ? (
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-[#8C8070] mb-1.5">
                    Admin note{" "}
                    <span className="normal-case tracking-normal text-[#5C5348]">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Internal note about this decision…"
                    className="w-full bg-[#0E0C0A] border border-[#2A241E] rounded-xl px-3 py-2.5 text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/50 placeholder:text-[#5C5348] resize-none"
                  />
                </div>
              ) : null}
            </div>

            {selected.status === "pending" ? (
              <div className="shrink-0 flex flex-wrap gap-1.5 px-4 py-3 border-t border-[#2A241E]">
                <ActionBtn
                  disabled={busyId === selected.id}
                  onClick={() => handleAction(selected, "dismiss")}
                >
                  <XCircle size={12} /> Dismiss
                </ActionBtn>
                <ActionBtn
                  tone="danger"
                  disabled={busyId === selected.id || !selected.targetExists}
                  onClick={() => handleAction(selected, "delete_content")}
                >
                  <Trash2 size={12} /> Delete
                </ActionBtn>
                <ActionBtn
                  tone="danger"
                  disabled={
                    busyId === selected.id || !selected.snapshot?.authorId
                  }
                  onClick={() => handleAction(selected, "ban_author")}
                >
                  <Ban size={12} /> Ban
                </ActionBtn>
                <ActionBtn
                  tone="danger"
                  disabled={
                    busyId === selected.id ||
                    !selected.targetExists ||
                    !selected.snapshot?.authorId
                  }
                  onClick={() => handleAction(selected, "delete_and_ban")}
                >
                  <Shield size={12} /> Delete & ban
                </ActionBtn>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
