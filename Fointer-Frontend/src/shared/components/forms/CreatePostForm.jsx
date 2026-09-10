import {
  LuArrowLeft as ArrowLeft,
  LuLoaderCircle as Loader2
} from "react-icons/lu";
import MediaPicker from "../media/MediaPicker";

/**
 * Full-page post composer (not a modal) — Reddit-style submit layout.
 */
export default function CreatePostForm({
  title,
  text,
  media,
  onTitleChange,
  onTextChange,
  onMediaChange,
  onSubmit,
  onCancel,
  saving = false,
  communityLabel,
  showCommunitySelect = false,
  communities = [],
  communityId = "",
  onCommunityChange,
  onError,
  submitLabel = "Post",
}) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <button
        type="button"
        disabled={saving}
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-xs text-fo-muted hover:text-fo-accent mb-4 disabled:opacity-50"
      >
        <ArrowLeft size={14} /> Cancel
      </button>

      <div className="space-y-1 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-fo-text">
          Create post
        </h1>
        {communityLabel ? (
          <p className="text-sm text-fo-subtle">
            Posting to{" "}
            <span className="text-fo-accent">{communityLabel}</span>
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {showCommunitySelect ? (
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-fo-subtle mb-1.5">
              Community (optional)
            </label>
            <select
              value={communityId}
              onChange={(e) => onCommunityChange?.(e.target.value)}
              className="w-full bg-fo-bg border border-fo-border rounded-xl px-3 py-2.5 text-sm text-fo-text focus:outline-none focus:border-fo-accent/50"
            >
              <option value="">No community</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="block text-[11px] uppercase tracking-wide text-fo-subtle mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
            maxLength={200}
            placeholder="Post title"
            className="w-full bg-fo-bg border border-fo-border rounded-xl px-3 py-3 text-sm text-fo-text focus:outline-none focus:border-fo-accent/50 placeholder:text-fo-subtle"
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wide text-fo-subtle mb-1.5">
            Text
          </label>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={8}
            placeholder="Share something with the community…"
            className="w-full bg-fo-bg border border-fo-border rounded-xl px-3 py-3 text-sm text-fo-text focus:outline-none focus:border-fo-accent/50 placeholder:text-fo-subtle resize-y min-h-[160px]"
          />
        </div>

        <MediaPicker
          media={media}
          onChange={onMediaChange}
          onError={onError}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm text-fo-muted hover:text-fo-text border border-fo-border disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-fo-accent hover:bg-fo-accent-hover text-black text-sm font-semibold disabled:opacity-50 min-w-[100px]"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Posting…
              </>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
