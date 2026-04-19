import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as notificationsApi from '../api/notificationsApi';

const POLL_INTERVAL_MS = 120000;

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      try {
        await notificationsApi.syncExpenseAnomalyNotifications();
      } catch {
        // Non-fatal: still show existing notifications if sync fails
      }
      try {
        await notificationsApi.syncTwoFactorReminderNotifications();
      } catch {
        // Non-fatal
      }
      const data = await notificationsApi.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    if (typeof document === 'undefined') return;

    let intervalId = null;

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startPolling = () => {
      if (intervalId || document.visibilityState !== 'visible') return;
      intervalId = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, token, fetchNotifications]);

  const markAsRead = useCallback(async (id) => {
    try {
      await notificationsApi.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // keep UI unchanged on error
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const data = await notificationsApi.markAllNotificationsAsRead();
      setNotifications(data.notifications || []);
      setUnreadCount(0);
    } catch {
      // keep UI unchanged on error
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    /** Refetch list + unread count (e.g. after bulk delete on Notifications page). */
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
