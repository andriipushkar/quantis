import { create } from 'zustand';

export type NotificationType = 'signal' | 'alert' | 'system' | 'info';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: number;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (title: string, message: string, type: NotificationType) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const MAX_NOTIFICATIONS = 50;

function computeUnread(notifications: Notification[]): number {
  return notifications.filter((n) => !n.read).length;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (title, message, type) =>
    set((state) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newNotification: Notification = {
        id,
        title,
        message,
        type,
        read: false,
        createdAt: Date.now(),
      };
      const updated = [newNotification, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      return { notifications: updated, unreadCount: computeUnread(updated) };
    }),

  markAsRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return { notifications: updated, unreadCount: computeUnread(updated) };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));
