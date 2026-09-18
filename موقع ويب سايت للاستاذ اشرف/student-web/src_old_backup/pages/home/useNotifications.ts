import { useEffect, useState } from 'react';
import { ApiService } from '../../services/api';

/** Notifications bell state: list, unread count, the modal open flag, and polling. */
export function useNotifications(profile: any | null) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const fetchNotificationsList = async () => {
    if (!profile) return;
    try {
      const res = await ApiService.getNotifications();
      const list = res.notifications || [];
      setNotifications(list);
      setUnreadCount(list.filter((n: any) => n.is_read === 0).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await ApiService.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  useEffect(() => {
    if (!profile) return;
    fetchNotificationsList();
    const interval = setInterval(() => {
      // Skip polling while the tab is in the background
      if (document.hidden) return;
      fetchNotificationsList();
    }, 120000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  return {
    notifications,
    unreadCount,
    showNotificationsModal,
    setShowNotificationsModal,
    fetchNotificationsList,
    markNotificationAsRead,
  };
}
