import { useCallback, useEffect, useState } from "react";
import {
  LuLoaderCircle as Loader2,
  LuMegaphone as Megaphone,
  LuRefreshCw as RefreshCw,
} from "react-icons/lu";
import { PageLoader } from "../../../../shared/components/ThemeSpinner";
import AdminActionBtn from "../../../../shared/components/AdminActionBtn";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import { getErrorMessage } from "../../../../shared/utils/errors";
import { timeAgo } from "../../../../shared/utils/date";
import {
  fetchAdminBroadcasts,
  sendAdminBroadcast,
} from "../../../../api/dashboard";

const inputClass =
  "w-full bg-fo-surface-hover border border-fo-border rounded-lg p-2.5 text-xs text-fo-text placeholder:text-fo-subtle focus:outline-none focus:border-fo-accent";

const statusLabel = (status) => {
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  if (status === "sending") return "Sending";
  return status || "Sent";
};

export default function BroadcastManagement() {
  const { showToast } = useToast();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminBroadcasts();
      setBroadcasts(data?.broadcasts || []);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to load broadcasts."));
      setBroadcasts([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextTitle = title.trim();
    const nextBody = body.trim();
    if (!nextTitle || !nextBody) {
      showToast("Write a title and a message.");
      return;
    }
    setSending(true);
    try {
      const data = await sendAdminBroadcast({
        title: nextTitle,
        body: nextBody,
      });
      showToast(data?.message || "Broadcast sent.");
      setTitle("");
      setBody("");
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to send broadcast."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-fo-text">
            Broadcast Management
          </h1>
          <p className="text-xs text-fo-subtle mt-1">
            Send one message to every active user. It lands in their
            notification inbox under Admin Broadcast, and as a push
            notification on devices that allowed alerts.
          </p>
        </div>
        <AdminActionBtn onClick={load} disabled={loading || sending}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </AdminActionBtn>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-fo-surface border border-fo-border rounded-xl p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-fo-text">New broadcast</h2>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium text-fo-muted">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Short headline"
            className={inputClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium text-fo-muted">Message</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="What should every user see?"
            className={`${inputClass} resize-y min-h-24`}
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-fo-subtle">
            Suspended and banned accounts are skipped.
          </p>
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fo-accent text-black text-xs font-semibold hover:bg-fo-accent-hover disabled:opacity-60"
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Megaphone size={14} />
            )}
            {sending ? "Sending…" : "Send to all users"}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fo-text">Recent broadcasts</h2>
        {loading ? (
          <PageLoader minHeight="py-12" size="md" />
        ) : broadcasts.length ? (
          broadcasts.map((item) => (
            <article
              key={item.id}
              className="bg-fo-surface border border-fo-border rounded-xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-fo-text">
                  {item.title}
                </h3>
                <span className="text-[10px] uppercase tracking-wide text-fo-accent font-semibold shrink-0">
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="text-xs text-fo-muted whitespace-pre-wrap">
                {item.body}
              </p>
              <p className="text-[11px] text-fo-subtle">
                {item.recipientCount} users
                {item.author?.name || item.author?.username
                  ? ` · ${item.author.name || item.author.username}`
                  : ""}
                {item.createdAt ? ` · ${timeAgo(item.createdAt)}` : ""}
              </p>
              {item.error ? (
                <p className="text-[11px] text-red-400">{item.error}</p>
              ) : null}
            </article>
          ))
        ) : (
          <div className="border border-dashed border-fo-border rounded-xl py-12 text-center text-sm text-fo-subtle">
            No broadcasts yet.
          </div>
        )}
      </section>
    </div>
  );
}
