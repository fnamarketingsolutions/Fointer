import { Link } from "react-router-dom";
import {
  LuTrash2 as Trash2,
  LuShieldCheck as ShieldCheck,
  LuLogIn as LogIn,
} from "react-icons/lu";

/**
 * Public account-deletion instructions for App Store / Play Store data-safety links.
 * Path: /user-delete (rename later if you prefer a different public URL).
 */
export default function UserDelete() {
  return (
    <div className="bg-fo-bg text-fo-text min-h-screen py-16 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-fo-accent/10 rounded-full blur-[180px] pointer-events-none z-0" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-10">
        <header className="text-center space-y-4 pt-6">
          <span className="text-[11px] font-semibold tracking-[0.25em] text-fo-accent uppercase px-4 py-1.5 rounded-full border border-fo-accent/30 bg-fo-surface/80 inline-block">
            Account deletion
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif text-fo-text leading-tight">
            Delete your Fointer account
          </h1>
          <p className="text-fo-muted text-sm sm:text-base font-light leading-relaxed max-w-xl mx-auto">
            You can permanently delete your account and associated personal data
            from inside the Fointer app or website. This cannot be undone.
          </p>
        </header>

        <section className="bg-fo-surface/90 border border-fo-accent/25 rounded-3xl p-6 sm:p-8 space-y-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-fo-accent/10 text-fo-accent border border-fo-accent/30">
              <LogIn className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif text-fo-text">
              How to delete
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
              <Link to="/profile?tab=security" className="text-fo-accent hover:underline">
                Profile → Security
              </Link>
              .
            </li>
            <li>
              Under <strong className="text-fo-text font-medium">Danger zone</strong>,
              open{" "}
              <Link to="/delete-me" className="text-fo-accent hover:underline">
                Delete account
              </Link>{" "}
              (route: <code className="text-fo-text">/delete-me</code>).
            </li>
            <li>
              Confirm with your password (or type DELETE if you use social login
              only).
            </li>
          </ol>
          <p className="text-xs text-fo-subtle leading-relaxed">
            If you own a community or watch group, transfer ownership or delete
            it first. The app will show which ones are blocking deletion.
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
            <li>Your profile and personal information (email, phone, location, avatar)</li>
            <li>Your posts, comments, and marketplace listings (including media)</li>
            <li>Follows, likes, bookmarks, and push notification devices</li>
          </ul>
          <div className="flex items-start gap-3 pt-2 border-t border-fo-border">
            <ShieldCheck className="w-5 h-5 text-fo-accent shrink-0 mt-0.5" />
            <p className="text-sm text-fo-muted font-light leading-relaxed">
              Direct messages you sent may remain visible to the other person as{" "}
              <strong className="text-fo-text font-medium">Deleted User</strong>,
              without your name or profile. Some moderation records may be kept
              in anonymized form where required for safety or law.
            </p>
          </div>
        </section>

        <p className="text-center text-xs text-fo-subtle pb-8">
          More detail:{" "}
          <Link to="/privacy-policy" className="text-fo-accent hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
