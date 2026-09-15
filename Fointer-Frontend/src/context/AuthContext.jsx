// src/context/AuthContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, logoutUser } from '../api/auth';
import { setUnauthorizedHandler } from '../shared/services/http/client';
import { resetLiveSocket } from '../shared/services/liveSocket';

const AuthContext = createContext(null);

const isMemberUser = (user) =>
  String(user?.role || '').toLowerCase().trim() === 'user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearUser = useCallback(() => {
    resetLiveSocket();
    setUser(null);
  }, []);

  const loginSuccess = useCallback((nextUser) => {
    if (!isMemberUser(nextUser)) {
      resetLiveSocket();
      setUser(null);
      return false;
    }
    setUser(nextUser);
    return true;
  }, []);

  const logout = useCallback(async () => {
    try {
      const { unregisterCurrentPush } = await import('../shared/services/pushClient');
      await unregisterCurrentPush();
    } catch {
      /* still log out */
    }
    try {
      await logoutUser();
    } catch {
      // Cookie may already be cleared; still drop local state.
    } finally {
      resetLiveSocket();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await getMe();
      if (data?.success && isMemberUser(data.user)) {
        setUser(data.user);
      } else {
        if (data?.success && data.user && !isMemberUser(data.user)) {
          try {
            await logoutUser();
          } catch {
            /* ignore */
          }
        }
        resetLiveSocket();
        setUser((prev) => (prev ? null : prev));
      }
    } catch {
      setUser((prev) => (prev ? null : prev));
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      resetLiveSocket();
      setUser((prev) => (prev ? null : prev));
    });

    let cancelled = false;

    (async () => {
      try {
        const data = await getMe();
        if (cancelled) return;

        if (data?.success && isMemberUser(data.user)) {
          setUser(data.user);
        } else {
          if (data?.success && data.user && !isMemberUser(data.user)) {
            try {
              await logoutUser();
            } catch {
              /* ignore */
            }
          }
          resetLiveSocket();
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      loginSuccess,
      logout,
      clearUser,
      refreshUser,
    }),
    [user, loading, loginSuccess, logout, clearUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
