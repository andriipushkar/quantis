/**
 * Zustand store tests
 *
 * Tests for market, auth, and theme stores.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- localStorage mock ----
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ---------------------------------------------------------------------------
// Market Store
// ---------------------------------------------------------------------------

describe('useMarketStore', () => {
  let useMarketStore: typeof import('@/stores/market').useMarketStore;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/stores/market');
    useMarketStore = mod.useMarketStore;
  });

  it('has correct default values', () => {
    const state = useMarketStore.getState();
    expect(state.selectedPair).toBe('BTCUSDT');
    expect(state.selectedTimeframe).toBe('1h');
    expect(state.selectedExchange).toBe('binance');
    expect(state.tickers.size).toBe(0);
  });

  it('setSelectedPair updates pair', () => {
    useMarketStore.getState().setSelectedPair('ETHUSDT');
    expect(useMarketStore.getState().selectedPair).toBe('ETHUSDT');
  });

  it('setSelectedTimeframe updates timeframe', () => {
    useMarketStore.getState().setSelectedTimeframe('4h');
    expect(useMarketStore.getState().selectedTimeframe).toBe('4h');
  });

  it('setSelectedExchange updates exchange', () => {
    useMarketStore.getState().setSelectedExchange('bybit');
    expect(useMarketStore.getState().selectedExchange).toBe('bybit');
  });

  it('updateTicker adds a single ticker', () => {
    const ticker = { symbol: 'BTCUSDT', exchange: 'binance', price: 50000, change24h: 2.5, volume: 1000000, timestamp: Date.now() };
    useMarketStore.getState().updateTicker('BTCUSDT', ticker);
    const tickers = useMarketStore.getState().tickers;
    expect(tickers.size).toBe(1);
    expect(tickers.get('BTCUSDT')?.price).toBe(50000);
  });

  it('updateTicker overwrites existing ticker', () => {
    const ticker1 = { symbol: 'BTCUSDT', exchange: 'binance', price: 50000, change24h: 2.5, volume: 1000000, timestamp: 1 };
    const ticker2 = { symbol: 'BTCUSDT', exchange: 'binance', price: 51000, change24h: 3.0, volume: 1100000, timestamp: 2 };
    useMarketStore.getState().updateTicker('BTCUSDT', ticker1);
    useMarketStore.getState().updateTicker('BTCUSDT', ticker2);
    expect(useMarketStore.getState().tickers.get('BTCUSDT')?.price).toBe(51000);
    expect(useMarketStore.getState().tickers.size).toBe(1);
  });

  it('updateTickers adds multiple tickers at once', () => {
    const batch = {
      BTCUSDT: { symbol: 'BTCUSDT', exchange: 'binance', price: 50000, change24h: 2, volume: 100, timestamp: 1 },
      ETHUSDT: { symbol: 'ETHUSDT', exchange: 'binance', price: 3000, change24h: -1, volume: 50, timestamp: 1 },
    };
    useMarketStore.getState().updateTickers(batch);
    expect(useMarketStore.getState().tickers.size).toBe(2);
    expect(useMarketStore.getState().tickers.get('ETHUSDT')?.price).toBe(3000);
  });

  it('updateTickers merges with existing tickers', () => {
    const ticker = { symbol: 'SOLUSDT', exchange: 'binance', price: 100, change24h: 5, volume: 200, timestamp: 1 };
    useMarketStore.getState().updateTicker('SOLUSDT', ticker);

    const batch = {
      BTCUSDT: { symbol: 'BTCUSDT', exchange: 'binance', price: 50000, change24h: 2, volume: 100, timestamp: 2 },
    };
    useMarketStore.getState().updateTickers(batch);
    expect(useMarketStore.getState().tickers.size).toBe(2);
    expect(useMarketStore.getState().tickers.get('SOLUSDT')?.price).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Auth Store
// ---------------------------------------------------------------------------

describe('useAuthStore', () => {
  let useAuthStore: typeof import('@/stores/auth').useAuthStore;

  beforeEach(async () => {
    vi.resetModules();
    localStorageMock.clear();
    // Mock the api module
    vi.doMock('@/services/api', () => ({
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getProfile: vi.fn(),
      getToken: vi.fn(() => localStorageMock.getItem('quantis_token')),
      clearToken: vi.fn(() => localStorageMock.removeItem('quantis_token')),
      setToken: vi.fn((t: string) => localStorageMock.setItem('quantis_token', t)),
    }));
    const mod = await import('@/stores/auth');
    useAuthStore = mod.useAuthStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts unauthenticated when no token in localStorage', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('starts authenticated when token exists in localStorage', async () => {
    vi.resetModules();
    localStorageMock.setItem('quantis_token', 'existing-jwt');
    vi.doMock('@/services/api', () => ({
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getProfile: vi.fn(),
      getToken: vi.fn(() => 'existing-jwt'),
      clearToken: vi.fn(),
      setToken: vi.fn(),
    }));
    const mod2 = await import('@/stores/auth');
    const state = mod2.useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('existing-jwt');
  });

  it('login sets user, token, and isAuthenticated', async () => {
    const mockUser = { id: 'u1', email: 'a@b.com', tier: 'pro' };
    const apiMod = await import('@/services/api');
    (apiMod.login as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser, token: 'new-jwt' });

    await useAuthStore.getState().login('a@b.com', 'pass');
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('new-jwt');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('login sets error on failure', async () => {
    const apiMod = await import('@/services/api');
    (apiMod.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Bad credentials'));

    await expect(useAuthStore.getState().login('a@b.com', 'wrong')).rejects.toThrow('Bad credentials');
    const state = useAuthStore.getState();
    expect(state.error).toBe('Bad credentials');
    expect(state.isLoading).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  it('register sets user and token', async () => {
    const mockUser = { id: 'u2', email: 'new@b.com', tier: 'free' };
    const apiMod = await import('@/services/api');
    (apiMod.register as ReturnType<typeof vi.fn>).mockResolvedValue({ user: mockUser, token: 'reg-jwt' });

    await useAuthStore.getState().register('new@b.com', 'pass123');
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('logout clears user, token, and isAuthenticated', async () => {
    const apiMod = await import('@/services/api');
    (apiMod.login as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1' }, token: 'jwt' });
    (apiMod.logout as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await useAuthStore.getState().login('a@b.com', 'pass');
    await useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('loadUser fetches profile when token exists', async () => {
    localStorageMock.setItem('quantis_token', 'valid-jwt');
    vi.resetModules();
    const mockUser = { id: 'u1', email: 'a@b.com', tier: 'pro' };
    vi.doMock('@/services/api', () => ({
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getProfile: vi.fn().mockResolvedValue(mockUser),
      getToken: vi.fn(() => 'valid-jwt'),
      clearToken: vi.fn(),
      setToken: vi.fn(),
    }));
    const mod = await import('@/stores/auth');
    await mod.useAuthStore.getState().loadUser();
    expect(mod.useAuthStore.getState().user).toEqual(mockUser);
    expect(mod.useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('loadUser clears state when no token exists', async () => {
    await useAuthStore.getState().loadUser();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('clearError resets error to null', async () => {
    const apiMod = await import('@/services/api');
    (apiMod.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    try { await useAuthStore.getState().login('a@b.com', 'x'); } catch { /* expected */ }

    expect(useAuthStore.getState().error).toBe('fail');
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Theme Store
// ---------------------------------------------------------------------------

describe('useThemeStore', () => {
  let useThemeStore: typeof import('@/stores/theme').useThemeStore;

  beforeEach(async () => {
    vi.resetModules();
    localStorageMock.clear();
    // Ensure document.documentElement exists for applyTheme
    document.documentElement.classList.remove('dark', 'light');
    const mod = await import('@/stores/theme');
    useThemeStore = mod.useThemeStore;
  });

  it('defaults to dark theme', () => {
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('toggleTheme switches dark to light', () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('toggleTheme switches light back to dark', () => {
    useThemeStore.getState().toggleTheme(); // dark -> light
    useThemeStore.getState().toggleTheme(); // light -> dark
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('setTheme explicitly sets theme', () => {
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('quantis-theme', 'light');
  });

  it('persists theme to localStorage', () => {
    useThemeStore.getState().toggleTheme();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('quantis-theme', 'light');
  });
});

// ---------------------------------------------------------------------------
// Toast Store
// ---------------------------------------------------------------------------

describe('useToastStore', () => {
  let useToastStore: typeof import('@/stores/toast').useToastStore;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const mod = await import('@/stores/toast');
    useToastStore = mod.useToastStore;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty toasts', () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('addToast adds a toast with default info type', () => {
    useToastStore.getState().addToast('Hello');
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hello');
    expect(toasts[0].type).toBe('info');
  });

  it('addToast with custom type', () => {
    useToastStore.getState().addToast('Success!', 'success');
    expect(useToastStore.getState().toasts[0].type).toBe('success');
  });

  it('removeToast removes by id', () => {
    useToastStore.getState().addToast('A');
    const id = useToastStore.getState().toasts[0].id;
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('auto-removes toast after 5 seconds', () => {
    useToastStore.getState().addToast('Temp');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Notification Store
// ---------------------------------------------------------------------------

describe('useNotificationStore', () => {
  let useNotificationStore: typeof import('@/stores/notifications').useNotificationStore;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/stores/notifications');
    useNotificationStore = mod.useNotificationStore;
  });

  it('starts empty with 0 unread', () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
  });

  it('addNotification adds and increments unread', () => {
    useNotificationStore.getState().addNotification('Title', 'Message', 'signal');
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
    expect(state.notifications[0].read).toBe(false);
  });

  it('markAsRead decrements unread count', () => {
    useNotificationStore.getState().addNotification('T', 'M', 'alert');
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().markAsRead(id);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it('markAllAsRead sets all to read', () => {
    useNotificationStore.getState().addNotification('A', 'a', 'info');
    useNotificationStore.getState().addNotification('B', 'b', 'system');
    useNotificationStore.getState().markAllAsRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('clearAll removes everything', () => {
    useNotificationStore.getState().addNotification('A', 'a', 'info');
    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toEqual([]);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });
});
