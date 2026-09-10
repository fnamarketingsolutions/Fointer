import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getMe, logoutUser } from '../api/auth';
import { setUnauthorizedHandler } from '../shared/services/http/client';
import {
  canAccessAdminTab,
  getAdminTabs,
  isAdminUser,
  isSuperAdminUser,
} from '../shared/lib/roles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearUser = useCallback(() => {
    setUser(null);
  }, []);

  const loginSuccess = useCallback((nextUser) => {
    if (!isAdminUser(nextUser)) {
      setUser(null);
      return false;
    }
    setUser(nextUser);
    return true;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Cookie may already be cleared
    } finally {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await getMe();
      if (data?.success && isAdminUser(data.user)) {
        setUser(data.user);
      } else {
        if (data?.success && data.user && !isAdminUser(data.user)) {
          try {
            await logoutUser();
          } catch {
            /* ignore */
          }
        }
        setUser((prev) => (prev ? null : prev));
      }
    } catch {
      setUser((prev) => (prev ? null : prev));
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser((prev) => (prev ? null : prev));
    });

    let cancelled = false;

    (async () => {
      try {
        const data = await getMe();
        if (cancelled) return;

        if (data?.success && isAdminUser(data.user)) {
          setUser(data.user);
        } else {
          if (data?.success && data.user && !isAdminUser(data.user)) {
            try {
              await logoutUser();
            } catch {
              /* ignore */
            }
          }
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
      isSuperAdmin: isSuperAdminUser(user),
      adminTabs: getAdminTabs(user),
      canAccessTab: (tabId) => canAccessAdminTab(user, tabId),
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
