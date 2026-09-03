import React, { useEffect, useRef } from 'react';
import { FaFacebookF } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';

/**
 * Shared Google + Facebook buttons for Login and SignUp.
 * `primarySlot` is typically the email submit button (left of Facebook).
 */
export default function SocialAuthButtons({
  primarySlot,
  onGoogleCredential,
  onFacebookClick,
  googleLoading = false,
  facebookLoading = false,
}) {
  const googleHostRef = useRef(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const host = googleHostRef.current;
    if (!clientId || !host || typeof onGoogleCredential !== 'function') return undefined;

    let cancelled = false;
    let tries = 0;

    const renderGoogleButton = () => {
      if (cancelled || !googleHostRef.current) return;
      const google = window.google;
      if (!google?.accounts?.id) {
        if (tries < 40) {
          tries += 1;
          window.setTimeout(renderGoogleButton, 50);
        }
        return;
      }

      host.innerHTML = '';
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) onGoogleCredential(response.credential);
        },
      });
      google.accounts.id.renderButton(host, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        width: Math.max(host.offsetWidth || 320, 240),
      });
    };

    renderGoogleButton();
    return () => {
      cancelled = true;
    };
  }, [onGoogleCredential]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 pt-4">
        {primarySlot}

        <button
          type="button"
          onClick={onFacebookClick}
          disabled={facebookLoading}
          className="w-full py-3 px-4 bg-[#1877F2] text-fo-text font-medium text-xs rounded-lg hover:bg-[#165ec2] transition-colors flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
        >
          <FaFacebookF size={15} />
          <span>{facebookLoading ? 'Connecting...' : 'Facebook'}</span>
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          disabled={googleLoading}
          className="w-full py-3 px-4 bg-fo-surface-hover border border-fo-border/60 text-fo-muted font-medium text-xs rounded-lg pointer-events-none flex items-center justify-center gap-2.5 disabled:opacity-50"
        >
          <FcGoogle size={18} />
          <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
        </button>
        <div
          ref={googleHostRef}
          className="absolute inset-0 z-10 overflow-hidden opacity-0 [&>div]:h-full [&>div]:w-full [&_iframe]:h-full [&_iframe]:w-full"
        />
      </div>
    </>
  );
}
