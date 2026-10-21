import { useState } from "react";
import { LuDownload as Download, LuLoaderCircle as Loader2 } from "react-icons/lu";
import { downloadCsv } from "../utils/csv";

const ROW_LIMITS = [
  { id: "20", label: "Latest 20" },
  { id: "50", label: "Latest 50" },
  { id: "100", label: "Latest 100" },
  { id: "all", label: "All" },
];

const TIME_RANGES = [
  { id: "any", label: "Any time" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "last-month", label: "Last month" },
  { id: "this-month", label: "This month" },
];

const rangeBounds = (range) => {
  const now = new Date();
  if (range === "7d") return { start: new Date(now.getTime() - 7 * 86400000) };
  if (range === "30d") return { start: new Date(now.getTime() - 30 * 86400000) };
  if (range === "this-month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  if (range === "last-month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }
  return {};
};

const applyExportWindow = (rows, { limit, range, order, dateOf }) => {
  const { start, end } = rangeBounds(range);
  let list = rows.filter((row) => {
    if (!start) return true;
    const raw = dateOf?.(row);
    const time = raw ? new Date(raw).getTime() : NaN;
    if (Number.isNaN(time)) return false;
    if (time < start.getTime()) return false;
    if (end && time >= end.getTime()) return false;
    return true;
  });
  list.sort((left, right) => {
    const a = new Date(dateOf?.(left) || 0).getTime() || 0;
    const b = new Date(dateOf?.(right) || 0).getTime() || 0;
    return order === "oldest" ? a - b : b - a;
  });
  if (limit !== "all") list = list.slice(0, Number(limit) || 20);
  return list;
};

/**
 * Admin picks columns plus how many rows and which dates.
 * Nothing is written until Download is clicked.
 */
export default function CsvExportButton({
  filename,
  datasets,
  disabled = false,
  onError,
}) {
  const [open, setOpen] = useState(false);
  const [datasetId, setDatasetId] = useState(datasets[0]?.id || "");
  const [selected, setSelected] = useState(() => new Set());
  const [limit, setLimit] = useState("20");
  const [range, setRange] = useState("any");
  const [order, setOrder] = useState("newest");
  const [busy, setBusy] = useState(false);

  const dataset =
    datasets.find((item) => item.id === datasetId) || datasets[0];

  const openPicker = () => {
    setDatasetId(datasets[0]?.id || "");
    setSelected(new Set());
    setLimit("20");
    setRange("any");
    setOrder("newest");
    setOpen(true);
  };

  const switchDataset = (id) => {
    setDatasetId(id);
    setSelected(new Set());
  };

  const toggle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const download = async () => {
    if (!dataset || selected.size === 0 || busy) return;
    const columns = dataset.columns.filter((column) => selected.has(column.id));
    setBusy(true);
    try {
      const rows = await dataset.loadRows();
      const list = applyExportWindow(Array.isArray(rows) ? rows : [], {
        limit,
        range,
        order,
        dateOf: dataset.dateValue,
      });
      if (!list.length) {
        onError?.("Nothing to download for this selection.");
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`${filename}-${dataset.id}-${stamp}`, columns, list);
      setOpen(false);
    } catch (error) {
      onError?.(error?.message || "Could not build the CSV.");
    } finally {
      setBusy(false);
    }
  };

  if (!datasets.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fo-border text-xs font-semibold text-fo-muted hover:text-fo-accent hover:border-fo-accent/40 disabled:opacity-50"
        title="Download CSV"
      >
        <Download size={14} />
        CSV
      </button>
      {open && dataset ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/50">
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-fo-border bg-fo-surface p-4 sm:p-5 space-y-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Choose CSV columns"
          >
            <div>
              <h2 className="text-base font-semibold text-fo-text">Download CSV</h2>
              <p className="mt-1 text-xs text-fo-subtle">
                Pick how many rows, which dates, and which columns. Page search still applies.
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-fo-subtle">How many</legend>
              <div className="flex flex-wrap gap-1.5">
                {ROW_LIMITS.map((item) => (
                  <FilterChip
                    key={item.id}
                    active={limit === item.id}
                    onClick={() => setLimit(item.id)}
                    label={item.label}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-fo-subtle">When</legend>
              <div className="flex flex-wrap gap-1.5">
                {TIME_RANGES.map((item) => (
                  <FilterChip
                    key={item.id}
                    active={range === item.id}
                    onClick={() => setRange(item.id)}
                    label={item.label}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-fo-subtle">Order</legend>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  active={order === "newest"}
                  onClick={() => setOrder("newest")}
                  label="Recent first"
                />
                <FilterChip
                  active={order === "oldest"}
                  onClick={() => setOrder("oldest")}
                  label="Oldest first"
                />
              </div>
            </fieldset>
            {datasets.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {datasets.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchDataset(item.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                      item.id === dataset.id
                        ? "border-fo-accent/40 text-fo-accent bg-fo-accent/10"
                        : "border-fo-border text-fo-muted"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs">
              <span className="text-fo-subtle">{selected.size} selected</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-fo-accent font-semibold"
                  onClick={() =>
                    setSelected(new Set(dataset.columns.map((column) => column.id)))
                  }
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-fo-muted font-semibold"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {dataset.columns.map((column) => (
                <label
                  key={column.id}
                  className="flex items-center gap-2 text-sm text-fo-text"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(column.id)}
                    onChange={() => toggle(column.id)}
                    className="accent-[var(--theme-accent,#e8a838)]"
                  />
                  {column.label}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-3 py-2 rounded-lg border border-fo-border text-xs text-fo-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={download}
                disabled={busy || selected.size === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Download
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
        active
          ? "border-fo-accent/40 text-fo-accent bg-fo-accent/10"
          : "border-fo-border text-fo-muted"
      }`}
    >
      {label}
    </button>
  );
}
