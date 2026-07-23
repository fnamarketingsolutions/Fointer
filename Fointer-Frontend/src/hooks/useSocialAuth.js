import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { googleAuth, facebookAuth } from '../api/auth';
import { loginWithFacebook, ensureFacebookSdk } from '../lib/facebookSdk';
import { useAuth } from '../context/AuthContext';

export function useSocialAuth() {
  const navigate = useNavigate();
  const { loginSuccess, refreshUser } = useAuth();
  const [loading, setLoading] = useState({ google: false, facebook: false });
  const [error, setError] = useState('');

  const clearError = () => setError('');

  const completeAuth = async (provider, token, authApiCall) => {
    setLoading((prev) => ({ ...prev, [provider]: true }));
    setError('');

    try {
      const response = await authApiCall(token);
      if (response?.success && response.user) {
        loginSuccess(response.user);
        navigate(response.user.role === 'admin' ? '/admin' : '/dashboard');
        return;
      }
      setError(response?.message || `${provider} authentication failed.`);
    } catch (err) {
      setError(err?.response?.data?.message || `${provider} authentication failed.`);
    } finally {
      setLoading((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleGoogleAuth = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      const googleToken = tokenResponse?.access_token;
      if (!googleToken) {
        setError('Failed to retrieve token from Google.');
        return;
      }
      completeAuth('google', googleToken, googleAuth);
    },
    onError: () => {
      setError('Google Sign-In was cancelled or failed.');
    },
  });

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
    clearError,
    handleGoogleAuth,
    handleFacebookAuth,
  };
}
