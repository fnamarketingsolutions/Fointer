import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { fetchUnreadCount } from '../features/notifications/services/notificationService';
import { getLiveSocket } from '../shared/services/liveSocket';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return 0;
    }
    try {
      const data = await fetchUnreadCount();
      const next = Number(data?.unreadCount) || 0;
      setUnreadCount(next);
      return next;
    } catch {
      return 0;
    }
  }, [user]);

  const adjustUnread = useCallback((delta) => {
    setUnreadCount((current) => Math.max(0, current + Number(delta || 0)));
  }, []);

  const setUnread = useCallback((value) => {
    setUnreadCount(Math.max(0, Number(value) || 0));
  }, []);

  useEffect(() => {
    if (loading) return undefined;
    if (!user) {
      setUnreadCount(0);
      return undefined;
    }
    refreshUnread();
    return undefined;
  }, [loading, user, refreshUnread]);

  useEffect(() => {
    if (!user) return undefined;

    const socket = getLiveSocket();
    const onNew = () => {
      refreshUnread();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshUnread();
      }
    };

    socket.on('notification:new', onNew);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      socket.off('notification:new', onNew);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refreshUnread]);

  const value = useMemo(
    () => ({
      unreadCount,
      refreshUnread,
      adjustUnread,
      setUnread,
    }),
    [unreadCount, refreshUnread, adjustUnread, setUnread]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
