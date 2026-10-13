import { useEffect, useMemo, useState } from "react";
import { LuX as X } from "react-icons/lu";
import { fetchChannels } from "../../api/channels";
import ThemeSpinner from "./ThemeSpinner";

const PREVIEW_COUNT = 10;

const normalize = (value) => String(value || "").trim().replace(/^#/, "");

export default function InterestSuggestions({
  selected = [],
  onAdd,
  onRemove,
  inputClass,
}) {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PREVIEW_COUNT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchChannels();
        if (!cancelled) setCategories(data?.channels || []);
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedKeys = useMemo(
    () =>
      new Set(
        selected.map((item) => normalize(item).toLowerCase()).filter(Boolean)
      ),
    [selected]
  );

  const matches = categories.filter((category) => {
    const name = normalize(category?.name);
    if (!name || selectedKeys.has(name.toLowerCase())) return false;
    const q = normalize(query).toLowerCase();
    return !q || name.toLowerCase().includes(q);
  });

  const visible = matches.slice(0, visibleCount);
  const hiddenCount = Math.max(0, matches.length - visible.length);

  const addCategory = (name) => {
    const value = normalize(name);
    if (!value || selectedKeys.has(value.toLowerCase())) return;
    onAdd(value);
    setQuery("");
    setVisibleCount(PREVIEW_COUNT);
  };

  return (
    <div>
      {selected.length ? (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((item) => {
            const label = normalize(item);
            return (
              <button
                key={label}
                type="button"
                onClick={() => onRemove(label)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-fo-brand/10 text-fo-brand text-[11px] font-medium"
              >
                {label}
                <X size={12} />
              </button>
            );
          })}
        </div>
      ) : null}
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setVisibleCount(PREVIEW_COUNT);
        }}
        placeholder="Search categories"
        className={inputClass}
      />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {loading ? (
          <div className="flex items-center py-0.5">
            <ThemeSpinner size="sm" label="Loading categories" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-[11px] text-fo-subtle">
            {query.trim() ? "No matching categories." : "No categories yet."}
          </p>
        ) : (
          visible.map((category) => (
            <button
              key={category.id || category.name}
              type="button"
              onClick={() => addCategory(category.name)}
              className="px-2 py-1 rounded-md border border-fo-border text-[11px] text-fo-muted hover:border-fo-brand/40 hover:text-fo-brand transition-colors"
            >
              + {category.name}
            </button>
          ))
        )}
      </div>
      {!loading && matches.length > PREVIEW_COUNT ? (
        <button
          type="button"
          onClick={() =>
            setVisibleCount((count) =>
              count >= matches.length ? PREVIEW_COUNT : count + PREVIEW_COUNT
            )
          }
          className="mt-2 text-[11px] font-medium text-fo-brand hover:underline"
        >
          {hiddenCount > 0 ? `View more (${hiddenCount})` : "Show less"}
        </button>
      ) : null}
    </div>
  );
}
