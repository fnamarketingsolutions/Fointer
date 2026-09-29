import { useEffect, useState } from "react";
import { LuX as X } from "react-icons/lu";
import { fetchTrendingTopics } from "../../features/posts/services/postService";

const PREVIEW = 10;

const normalizeTag = (value) => String(value || "").trim().replace(/^#/, "");

export default function InterestSuggestions({
  selected = [],
  onAdd,
  onRemove,
  inputClass,
}) {
  const [query, setQuery] = useState("");
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = normalizeTag(query);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchTrendingTopics({
          limit: PREVIEW,
          ...(q ? { q } : {}),
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setTopics(data?.topics || []);
      } catch (error) {
        if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") return;
        if (!controller.signal.aborted) setTopics([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, q ? 300 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const selectedKeys = new Set(
    selected.map((tag) => normalizeTag(tag).toLowerCase()).filter(Boolean)
  );
  const visible = topics
    .map((topic) => normalizeTag(topic.tag))
    .filter((tag) => tag && !selectedKeys.has(tag.toLowerCase()))
    .slice(0, PREVIEW);

  const addTag = (tag) => {
    const value = normalizeTag(tag);
    if (!value || selectedKeys.has(value.toLowerCase())) return;
    onAdd(value);
    setQuery("");
  };

  return (
    <div>
      {selected.length ? (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((tag) => {
            const label = normalizeTag(tag);
            return (
              <button
                key={label}
                type="button"
                onClick={() => onRemove(label)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-fo-brand/10 text-fo-brand text-[11px] font-medium"
              >
                #{label}
                <X size={12} />
              </button>
            );
          })}
        </div>
      ) : null}
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (visible[0]) addTag(visible[0]);
          }
        }}
        placeholder="Search interests"
        className={inputClass}
      />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {loading ? (
          <p className="text-[11px] text-fo-subtle">Loading interests…</p>
        ) : visible.length === 0 ? (
          <p className="text-[11px] text-fo-subtle">
            {query.trim() ? "No matching interests." : "Nothing trending yet."}
          </p>
        ) : (
          visible.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="px-2 py-1 rounded-md border border-fo-border text-[11px] text-fo-muted hover:border-fo-brand/40 hover:text-fo-brand transition-colors"
            >
              + #{tag}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
