import { LuBell as Bell } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import {
  beginPushPermissionPrompt,
  syncPushRegistration,
} from '../services/pushClient';

const DISMISS_KEY = 'fointer-push-prompt-dismissed';

export default function PushPermissionPrompt({ open, onClose }) {
  const { user } = useAuth();
  if (!open || !user) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    onClose();
  };

  const allow = () => {
    beginPushPermissionPrompt();
    syncPushRegistration(user.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div
        role="dialog"
        aria-labelledby="push-permission-title"
        className="w-full max-w-sm rounded-2xl border border-fo-border bg-fo-surface p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fo-accent/15 text-fo-accent">
            <Bell size={18} />
          </span>
          <div>
            <h2 id="push-permission-title" className="text-base font-semibold text-fo-text">
              Allow push notifications?
            </h2>
            <p className="mt-1 text-sm text-fo-subtle">
              Get alerts for messages, comments and likes.
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="px-3 py-2 rounded-lg text-sm font-medium text-fo-muted hover:text-fo-text"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={allow}
            className="px-4 py-2 rounded-lg bg-fo-accent text-black text-sm font-semibold hover:bg-fo-accent-hover"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

export const wasPushPromptDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};
