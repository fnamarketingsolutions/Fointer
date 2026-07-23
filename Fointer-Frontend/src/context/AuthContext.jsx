// src/context/AuthContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, logoutUser } from '../api/auth';
import { setUnauthorizedHandler } from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearUser = useCallback(() => {
    setUser(null);
  }, []);

  const loginSuccess = useCallback((nextUser) => {
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Cookie may already be cleared; still drop local state.
    } finally {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await getMe();
      if (data?.success && data.user) {
        setUser(data.user);
      } else {
        setUser(prev => (prev ? null : prev)); // Prevent unnecessary re-render loop
      }
    } catch {
      setUser(prev => (prev ? null : prev));
    }
  }, []);

  useEffect(() => {
    // Prevent state updates if user is already null
    setUnauthorizedHandler(() => {
      setUser(prev => (prev ? null : prev));
    });

    let cancelled = false;

    (async () => {
      try {
        const data = await getMe();
        if (!cancelled && data?.success && data.user) {
          setUser(data.user);
        } else if (!cancelled) {
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