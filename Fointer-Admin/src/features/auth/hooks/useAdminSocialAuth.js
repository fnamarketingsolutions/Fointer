import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminGoogleAuth, adminFacebookAuth } from '../../../api/auth';
import {
  loginWithFacebook,
  ensureFacebookSdk,
} from '../../../shared/lib/facebookSdk';
import { useAuth } from '../../../context/AuthContext';

export function useAdminSocialAuth() {
  const navigate = useNavigate();
  const { loginSuccess } = useAuth();
  const [loading, setLoading] = useState({ google: false, facebook: false });
  const [error, setError] = useState('');

  const completeAuth = useCallback(
    async (provider, token, authApiCall) => {
      setLoading((prev) => ({ ...prev, [provider]: true }));
      setError('');

      try {
        const response = await authApiCall(token);
        if (response?.success && response.user) {
          const ok = loginSuccess(response.user);
          if (!ok) {
            setError('This portal is for administrators only.');
            return;
          }
          navigate('/users', { replace: true });
          return;
        }
        setError(response?.message || `${provider} authentication failed.`);
      } catch (err) {
        setError(
          err?.response?.data?.message || `${provider} authentication failed.`
        );
      } finally {
        setLoading((prev) => ({ ...prev, [provider]: false }));
      }
    },
    [loginSuccess, navigate]
  );

  const handleGoogleCredential = useCallback(
    (credential) => {
      if (!credential) {
        setError('Failed to retrieve token from Google.');
        return;
      }
      completeAuth('google', credential, adminGoogleAuth);
    },
    [completeAuth]
  );

  const handleFacebookAuth = async () => {
    setError('');
    setLoading((prev) => ({ ...prev, facebook: true }));

    try {
      await ensureFacebookSdk();
      const accessToken = await loginWithFacebook();

      if (!accessToken) {
        setError('Facebook login was cancelled or unverified.');
        setLoading((prev) => ({ ...prev, facebook: false }));
        return;
      }

      await completeAuth('facebook', accessToken, adminFacebookAuth);
    } catch (err) {
      setError(err?.message || 'Facebook login failed.');
      setLoading((prev) => ({ ...prev, facebook: false }));
    }
  };

  return {
    loading,
    error,
    setError,
    handleGoogleCredential,
    handleFacebookAuth,
  };
}
