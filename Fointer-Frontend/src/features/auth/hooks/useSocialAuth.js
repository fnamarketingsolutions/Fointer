import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleAuth, facebookAuth } from '../services/authService';
import { loginWithFacebook, ensureFacebookSdk } from '../../../shared/lib/facebookSdk';
import { useAuth } from '../../../context/AuthContext';

export function useSocialAuth() {
  const navigate = useNavigate();
  const { loginSuccess } = useAuth();
  const [loading, setLoading] = useState({ google: false, facebook: false });
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(null);

  const clearPendingVerification = () => setPendingVerification(null);

  const completeAuth = useCallback(async (provider, token, authApiCall) => {
    setLoading((prev) => ({ ...prev, [provider]: true }));
    setError('');
    setPendingVerification(null);

    try {
      const response = await authApiCall(token);
      if (response?.success && response.user) {
        loginSuccess(response.user);
        navigate(response.user.role === 'admin' ? '/admin' : '/');
        return;
      }
      if (response?.requiresEmailVerification && response?.email) {
        setPendingVerification({ email: response.email, provider });
      }
      setError(response?.message || `${provider} authentication failed.`);
    } catch (err) {
      if (err?.response?.data?.requiresEmailVerification && err?.response?.data?.email) {
        setPendingVerification({
          email: err.response.data.email,
          provider,
        });
      }
      setError(err?.response?.data?.message || `${provider} authentication failed.`);
    } finally {
      setLoading((prev) => ({ ...prev, [provider]: false }));
    }
  }, [loginSuccess, navigate]);

  const handleGoogleCredential = useCallback((credential) => {
    if (!credential) {
      setError('Failed to retrieve token from Google.');
      return;
    }
    completeAuth('google', credential, googleAuth);
  }, [completeAuth]);

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

      await completeAuth('facebook', accessToken, facebookAuth);
    } catch (err) {
      setError(err?.message || 'Facebook login failed.');
      setLoading((prev) => ({ ...prev, facebook: false }));
    }
  };

  return {
    loading,
    error,
    setError,
    pendingVerification,
    clearPendingVerification,
    handleGoogleCredential,
    handleFacebookAuth,
  };
}
