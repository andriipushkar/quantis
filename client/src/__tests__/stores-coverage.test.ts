/**
 * Store coverage tests — theme + notifications
 *
 * Tests all branches in theme store (getInitialTheme, applyTheme, toggleTheme, setTheme)
 * and notification store (add, markAsRead, markAllAsRead, clearAll, MAX limit).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Theme store
// ---------------------------------------------------------------------------

describe('useThemeStore', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light');
  });

  it('defaults to dark theme when no localStorage value', async () => {
    const { useThemeStore } = await import('@/stores/theme');
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('reads stored "light" theme from localStorage', async () => {
    localStorage.setItem('quantis-theme', 'light');
    const { useThemeStore } = await import('@/stores/theme');
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('reads stored "dark" theme from localStorage', async () => {
    localStorage.setItem('quantis-theme', 'dark');
    const { useThemeStore } = await import('@/stores/theme');
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('ignores invalid stored value, defaults to dark', async () => {
    localStorage.setItem('quantis-theme', 'invalid');
    const { useThemeStore } = await import('@/stores/theme');
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('toggleTheme: dark → light', async () => {
    const { useThemeStore } = await import('@/stores/theme');
    expect(useThemeStore.getState().theme).toBe('dark');
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(localStorage.getItem('quantis-theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('toggleTheme: light → dark', async () => {
    localStorage.setItem('quantis-theme', 'light');
    const { useThemeStore } = await import('@/stores/theme');
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('setTheme sets specific theme', async () => {
    const { useThemeStore } = await import('@/stores/theme');
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applyTheme removes previous class and adds new one', async () => {
    document.documentElement.classList.add('dark');
    const { useThemeStore } = await import('@/stores/theme');
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Notification store
// ---------------------------------------------------------------------------

describe('useNotificationStore', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('starts with empty notifications', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    expect(useNotificationStore.getState().notifications).toEqual([]);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('addNotification adds a notification', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    useNotificationStore.getState().addNotification('Test', 'Hello', 'info');
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].title).toBe('Test');
    expect(state.notifications[0].message).toBe('Hello');
    expect(state.notifications[0].type).toBe('info');
    expect(state.notifications[0].read).toBe(false);
    expect(state.unreadCount).toBe(1);
  });

  it('addNotification: newest first', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    useNotificationStore.getState().addNotification('First', 'msg1', 'info');
    useNotificationStore.getState().addNotification('Second', 'msg2', 'alert');
    const { notifications } = useNotificationStore.getState();
    expect(notifications[0].title).toBe('Second');
    expect(notifications[1].title).toBe('First');
  });

  it('addNotification: max 50 notifications', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    for (let i = 0; i < 55; i++) {
      useNotificationStore.getState().addNotification(`N${i}`, `msg${i}`, 'info');
    }
    expect(useNotificationStore.getState().notifications.length).toBe(50);
  });

  it('markAsRead marks a specific notification', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    useNotificationStore.getState().addNotification('Test', 'msg', 'signal');
    const id = useNotificationStore.getState().notifications[0].id;

    useNotificationStore.getState().markAsRead(id);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('markAsRead: non-existent id has no effect', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    useNotificationStore.getState().addNotification('Test', 'msg', 'info');
    useNotificationStore.getState().markAsRead('nonexistent');
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('markAllAsRead marks all as read', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    useNotificationStore.getState().addNotification('A', 'msg', 'info');
    useNotificationStore.getState().addNotification('B', 'msg', 'alert');
    useNotificationStore.getState().addNotification('C', 'msg', 'signal');

    useNotificationStore.getState().markAllAsRead();
    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(0);
    expect(state.notifications.every(n => n.read)).toBe(true);
  });

  it('clearAll removes all notifications', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    useNotificationStore.getState().addNotification('A', 'msg', 'info');
    useNotificationStore.getState().addNotification('B', 'msg', 'alert');

    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toEqual([]);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('unreadCount updates correctly after mix of operations', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    useNotificationStore.getState().addNotification('A', 'm', 'info');
    useNotificationStore.getState().addNotification('B', 'm', 'alert');
    useNotificationStore.getState().addNotification('C', 'm', 'signal');
    expect(useNotificationStore.getState().unreadCount).toBe(3);

    const idB = useNotificationStore.getState().notifications[1].id;
    useNotificationStore.getState().markAsRead(idB);
    expect(useNotificationStore.getState().unreadCount).toBe(2);

    useNotificationStore.getState().markAllAsRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);

    useNotificationStore.getState().addNotification('D', 'm', 'system');
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('each notification gets a unique id', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    useNotificationStore.getState().addNotification('A', 'm', 'info');
    useNotificationStore.getState().addNotification('B', 'm', 'info');
    const ids = useNotificationStore.getState().notifications.map(n => n.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('notification types: signal, alert, system, info', async () => {
    const { useNotificationStore } = await import('@/stores/notifications');
    const types = ['signal', 'alert', 'system', 'info'] as const;
    for (const type of types) {
      useNotificationStore.getState().addNotification('T', 'm', type);
    }
    const stored = useNotificationStore.getState().notifications.map(n => n.type);
    for (const type of types) {
      expect(stored).toContain(type);
    }
  });
});
