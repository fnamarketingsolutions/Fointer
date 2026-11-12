import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isProfileIdentityComplete, isProfilePage } from "../lib/profilePrompt";

export default function CompleteProfilePrompt() {
  const { user, loading, profilePromptNonce } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [profilePromptNonce]);

  const open =
    !loading
    && user
    && !dismissed
    && !isProfilePage(location.pathname)
    && !isProfileIdentityComplete(user);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/55">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-profile-title"
        className="w-full max-w-md rounded-2xl border border-fo-border bg-fo-surface text-fo-text shadow-2xl p-5 sm:p-6"
      >
        <h2 id="complete-profile-title" className="text-xl font-serif">
          Complete your profile
        </h2>
        <p className="mt-2 text-sm text-fo-subtle leading-relaxed">
          Add your gender, age range, and location so people can get to know you.
          Bio and interests are optional.
        </p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="min-h-11 px-4 py-2 rounded-lg border border-fo-border text-sm font-semibold text-fo-muted hover:text-fo-text hover:border-fo-accent/40"
          >
            Remind me later
          </button>
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="min-h-11 px-4 py-2 rounded-lg bg-fo-brand text-fo-brand-fg text-sm font-bold hover:bg-fo-brand-hover"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
