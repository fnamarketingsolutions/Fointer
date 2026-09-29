import { Link } from "react-router-dom";
import {
  LuTrash2 as Trash2,
  LuShieldCheck as ShieldCheck,
  LuLogIn as LogIn,
  LuArrowRightLeft as Transfer,
  LuExternalLink as ExternalLink,
  LuLoaderCircle as Loader2,
} from "react-icons/lu";
import { useAuth } from "../../../../context/AuthContext";

/**
 * Public account-deletion instructions for App Store / Play Store.
 * URL: https://fointer.net/user-delete (also listed in site footer).
 */
export default function UserDelete() {
  const { user, loading } = useAuth();
  const isLoggedIn = Boolean(user);

  return (
    <div className="bg-fo-bg text-fo-text min-h-screen py-16 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-fo-accent/10 rounded-full blur-[180px] pointer-events-none z-0" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8">
        <header className="text-center space-y-4 pt-6">
          <span className="text-[11px] font-semibold tracking-[0.25em] text-fo-accent uppercase px-4 py-1.5 rounded-full border border-fo-accent/30 bg-fo-surface/80 inline-block">
            Account deletion
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif text-fo-text leading-tight">
            Delete your Fointer account
          </h1>
          <p className="text-fo-muted text-sm sm:text-base font-light leading-relaxed max-w-xl mx-auto">
            Permanently delete your Fointer account and personal data from the
            app or website. This cannot be undone.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 min-h-11">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-sm text-fo-subtle">
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Checking session…
              </span>
            ) : isLoggedIn ? (
              <Link
                to="/delete-me"
                className="inline-flex items-center gap-2 min-h-11 px-5 rounded-xl bg-fo-accent text-black text-sm font-semibold hover:bg-fo-accent-hover"
              >
                <Trash2 size={16} aria-hidden />
                Go to delete account
              </Link>
            ) : (
              <Link
                to="/login"
                state={{ from: "/delete-me" }}
                className="inline-flex items-center gap-2 min-h-11 px-5 rounded-xl border border-fo-border text-sm font-semibold text-fo-text hover:border-fo-accent/40"
              >
                <LogIn size={16} aria-hidden />
                Log in first
              </Link>
            )}
          </div>
            
        </header>

        <section className="bg-fo-surface/90 border border-fo-accent/25 rounded-3xl p-6 sm:p-8 space-y-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-fo-accent/10 text-fo-accent border border-fo-accent/30">
              <LogIn className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif text-fo-text">
              How to delete in the app
            </h2>
          </div>
          <ol className="list-decimal list-inside space-y-3 text-sm text-fo-muted font-light leading-relaxed">
            <li>
              Sign in to Fointer (
              <Link to="/login" className="text-fo-accent hover:underline">
                Log in
              </Link>
              ).
            </li>
            <li>
              Open{" "}
              <Link
                to="/profile?tab=security"
                className="text-fo-accent hover:underline"
              >
                Profile → Security
              </Link>
              .
            </li>
            <li>
              Under <strong className="text-fo-text font-medium">Danger zone</strong>,
              tap <strong className="text-fo-text font-medium">Delete account</strong>.
              You will land on{" "}
              <Link to="/delete-me" className="text-fo-accent hover:underline">
                /delete-me
              </Link>
              .
            </li>
            <li>
              Confirm with your current password. If you only use Google /
              Facebook login, type <strong className="text-fo-text font-medium">DELETE</strong>.
            </li>
          </ol>
        </section>

        <section className="bg-fo-surface/90 border border-fo-border rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-fo-accent/10 text-fo-accent border border-fo-accent/30">
              <Transfer className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif text-fo-text">
              If you own a community or watch group
            </h2>
          </div>
          <p className="text-sm text-fo-muted font-light leading-relaxed">
            Account deletion is blocked until you resolve ownership. On{" "}
            <Link to="/delete-me" className="text-fo-accent hover:underline">
              /delete-me
            </Link>{" "}
            you will see each owned item with:
          </p>
          <ul className="space-y-2 text-sm text-fo-muted font-light leading-relaxed list-disc list-inside">
            <li>
              <strong className="text-fo-text font-medium">Transfer</strong> —
              hand ownership to another active member
            </li>
            <li>
              <strong className="text-fo-text font-medium">Delete</strong> —
              permanently remove that community or watch group
            </li>
          </ul>
          <p className="text-xs text-fo-subtle leading-relaxed">
            You can also transfer from community manage or the watch group room.
            After the list is empty, account deletion unlocks.
          </p>
        </section>

        <section className="bg-fo-surface/90 border border-fo-border rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-fo-accent/10 text-fo-accent border border-fo-accent/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif text-fo-text">
              What is deleted
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-fo-muted font-light leading-relaxed list-disc list-inside">
            <li>Profile and personal information (email, phone, location, avatar)</li>
            <li>Posts, comments, and marketplace listings (including media)</li>
            <li>Follows, likes, bookmarks, and push notification devices</li>
          </ul>
          <div className="flex items-start gap-3 pt-2 border-t border-fo-border">
            <ShieldCheck className="w-5 h-5 text-fo-accent shrink-0 mt-0.5" />
            <p className="text-sm text-fo-muted font-light leading-relaxed">
              Messages you sent may stay visible to the other person as{" "}
              <strong className="text-fo-text font-medium">Deleted User</strong>,
              without your name or profile. Some moderation records may be kept
              in anonymized form where required for safety or law.
            </p>
          </div>
        </section>

         
      </div>
    </div>
  );
}
