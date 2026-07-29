import React from 'react';
import { FaFacebookF } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';

/**
 * Shared Google + Facebook buttons for Login and SignUp.
 * `primarySlot` is typically the email submit button (left of Facebook).
 */
export default function SocialAuthButtons({
  primarySlot,
  onGoogleClick,
  onFacebookClick,
  googleLoading = false,
  facebookLoading = false,
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 pt-4">
        {primarySlot}

        <button
          type="button"
          onClick={onFacebookClick}
          disabled={facebookLoading}
          className="w-full py-3 px-4 bg-[#1877F2] text-white font-medium text-xs rounded-lg hover:bg-[#165ec2] transition-colors flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
        >
          <FaFacebookF size={15} />
          <span>{facebookLoading ? 'Connecting...' : 'Facebook'}</span>
        </button>
      </div>

      <div>
        <button
          type="button"
          onClick={onGoogleClick}
          disabled={googleLoading}
          className="w-full py-3 px-4 bg-[#1c140d] border border-amber-900/30 text-gray-200 font-medium text-xs rounded-lg hover:border-[#F8A201]/50 hover:bg-[#251b12] transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-50"
        >
          <FcGoogle size={18} />
          <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
        </button>
      </div>
    </>
  );
}
