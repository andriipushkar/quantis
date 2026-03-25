/**
 * Admin Panel tests — 23 tests covering:
 *   1. Admin access control (3)
 *   2. Tab navigation (4)
 *   3. Overview tab (4)
 *   4. Users tab (5)
 *   5. Revenue tab (4)
 *   6. System tab (3)
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted above all imports
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to}>Redirecting to {to}</div>,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

// Admin user state (default)
const adminState = {
  user: { id: '1', email: 'admin@test.com', display_name: 'Admin', tier: 'institutional', is_admin: true },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  token: 'tok',
  loadUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
  register: vi.fn(),
  googleLogin: vi.fn(),
};

// Non-admin user state
const nonAdminState = {
  ...adminState,
  user: { id: '2', email: 'user@test.com', display_name: 'User', tier: 'starter', is_admin: false },
};

let currentAuthState = adminState;

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn((sel?: any) => (typeof sel === 'function' ? sel(currentAuthState) : currentAuthState)),
}));

vi.mock('@/stores/toast', () => {
  const state = { toasts: [], addToast: vi.fn(), removeToast: vi.fn() };
  return {
    useToastStore: vi.fn((sel?: any) => (typeof sel === 'function' ? sel(state) : state)),
    __state: state,
  };
});

vi.mock('@/stores/market', () => {
  const state = {
    tickers: new Map(),
    pairs: [],
    selectedPair: 'BTCUSDT',
    setSelectedPair: vi.fn(),
    selectedTimeframe: '1h',
    setSelectedTimeframe: vi.fn(),
    selectedExchange: 'binance',
    setSelectedExchange: vi.fn(),
    updateTicker: vi.fn(),
    updateTickers: vi.fn(),
  };
  return {
    useMarketStore: vi.fn((sel?: any) => (typeof sel === 'function' ? sel(state) : state)),
  };
});

vi.mock('@/stores/notifications', () => {
  const state = {
    notifications: [],
    unreadCount: 0,
    addNotification: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearAll: vi.fn(),
  };
  return {
    useNotificationStore: vi.fn((sel?: any) => (typeof sel === 'function' ? sel(state) : state)),
  };
});

vi.mock('@/stores/theme', () => {
  const state = { theme: 'dark' as const, setTheme: vi.fn(), toggleTheme: vi.fn() };
  return {
    useThemeStore: vi.fn((sel?: any) => (typeof sel === 'function' ? sel(state) : state)),
  };
});

vi.mock('@/services/socket', () => ({
  connectSocket: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false })),
  disconnectSocket: vi.fn(),
  onConnectionStatus: vi.fn(() => vi.fn()),
  subscribeTicker: vi.fn(),
  unsubscribeTicker: vi.fn(),
  subscribeAlerts: vi.fn(),
  unsubscribeAlerts: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: {} }) },
  getToken: vi.fn(() => 'tok'),
  getTickers: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('@/hooks/useWebSocket', () => ({ useWebSocket: vi.fn() }));

vi.mock('@/components/common/NotificationCenter', () => ({
  NotificationCenter: () => <div data-testid="notification-center">NC</div>,
}));

// Canvas mock
const mockCtx = {
  clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
  lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), closePath: vi.fn(), arc: vi.fn(), arcTo: vi.fn(),
  scale: vi.fn(), setLineDash: vi.fn(), fillText: vi.fn(), strokeText: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: '', lineCap: '', font: '',
  textAlign: '', textBaseline: '', globalAlpha: 1, save: vi.fn(), restore: vi.fn(),
  measureText: vi.fn(() => ({ width: 50 })),
};
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as any;

// Mock getBoundingClientRect for canvas
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  width: 800,
  height: 300,
  top: 0,
  left: 0,
  bottom: 300,
  right: 800,
  x: 0,
  y: 0,
  toJSON: vi.fn(),
})) as any;

Element.prototype.scrollIntoView = vi.fn();

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_DASHBOARD = {
  totalUsers: 150,
  usersToday: 5,
  mrr: 2500,
  arr: 30000,
  totalRevenue: 15000,
  activeSubscriptions: 45,
  totalSignals: 1200,
  activePairs: 10,
};

const MOCK_USER_GROWTH = [
  { date: '2026-03-20', count: 3 },
  { date: '2026-03-21', count: 5 },
];

const MOCK_TIER_DISTRIBUTION = [
  { tier: 'starter', count: 100 },
  { tier: 'trader', count: 30 },
  { tier: 'pro', count: 15 },
  { tier: 'institutional', count: 5 },
];

const MOCK_USERS_LIST = {
  users: [
    { id: 'u1', email: 'alice@test.com', display_name: 'Alice', tier: 'pro', created_at: '2026-01-01T00:00:00Z', is_banned: false },
    { id: 'u2', email: 'bob@test.com', display_name: 'Bob', tier: 'starter', created_at: '2026-02-15T00:00:00Z', is_banned: false },
    { id: 'u3', email: 'carol@test.com', display_name: null, tier: 'trader', created_at: '2026-03-01T00:00:00Z', is_banned: true },
  ],
  total: 3,
};

const MOCK_USER_DETAIL = {
  id: 'u1',
  email: 'alice@test.com',
  display_name: 'Alice',
  tier: 'pro',
  created_at: '2026-01-01T00:00:00Z',
  is_banned: false,
  language: 'en',
  timezone: 'UTC',
  subscriptionHistory: [
    { id: 's1', tier: 'pro', status: 'active', started_at: '2026-01-01T00:00:00Z', expires_at: '2027-01-01T00:00:00Z' },
  ],
  payments: [
    { id: 'p1', amount: 49.99, currency: 'BTC', status: 'confirmed', tx_hash: '0xabc123def456', created_at: '2026-01-01T00:00:00Z' },
  ],
  stats: { alertsCount: 12, paperTradingPnl: 500.00 },
};

const MOCK_REVENUE = {
  stats: { mrr: 2500, arr: 30000, revenueToday: 150, revenueMonth: 3200, growthPercent: 12.5 },
  daily: [
    { date: '2026-03-20', amount: 120 },
    { date: '2026-03-21', amount: 180 },
  ],
};

const MOCK_SUBSCRIPTIONS = {
  active: 45,
  expired: 20,
  cancelled: 5,
  expiringSoon: [
    { user_email: 'alice@test.com', tier: 'pro', expires_at: '2026-04-01T00:00:00Z' },
  ],
  churnRate: 3.2,
};

const MOCK_PAYMENTS = {
  payments: [
    { id: 'p1', user_email: 'alice@test.com', amount: 49.99, currency: 'BTC', status: 'confirmed', tx_hash: '0xabc123', created_at: '2026-03-20T00:00:00Z' },
  ],
  total: 1,
};

const MOCK_SYSTEM_HEALTH = {
  dbStatus: 'ok',
  redisStatus: 'ok',
  latestSignalTime: '2026-03-25T08:00:00Z',
  candlesByExchange: [
    { exchange: 'binance', count: '50000' },
    { exchange: 'bybit', count: '30000' },
  ],
};

const MOCK_COLLECTORS = [
  { exchange: 'binance', lastTick: '2026-03-25T08:00:00Z', lagSeconds: 2.5 },
  { exchange: 'bybit', lastTick: '2026-03-25T07:59:55Z', lagSeconds: 7.3 },
];

// ---------------------------------------------------------------------------
// Fetch router
// ---------------------------------------------------------------------------

function safeFetchImpl(url: string, _opts?: any): Promise<{ ok: boolean; json: () => Promise<any> }> {
  const u = typeof url === 'string' ? url : '';
  const ok = (data: any) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data }) });

  if (u.includes('/admin/dashboard')) return ok(MOCK_DASHBOARD);
  if (u.includes('/admin/analytics/user-growth')) return ok(MOCK_USER_GROWTH);
  if (u.includes('/admin/analytics/tier-distribution')) return ok(MOCK_TIER_DISTRIBUTION);
  if (u.includes('/admin/analytics/collector-status')) return ok(MOCK_COLLECTORS);
  if (u.includes('/admin/users/') && !u.includes('?')) return ok(MOCK_USER_DETAIL);
  if (u.includes('/admin/users')) return ok(MOCK_USERS_LIST);
  if (u.includes('/admin/revenue/subscriptions')) return ok(MOCK_SUBSCRIPTIONS);
  if (u.includes('/admin/revenue/payments')) return ok(MOCK_PAYMENTS);
  if (u.includes('/admin/revenue')) return ok(MOCK_REVENUE);
  if (u.includes('/admin/system')) return ok(MOCK_SYSTEM_HEALTH);
  return ok({});
}

const mockFetch = vi.fn().mockImplementation(safeFetchImpl);
global.fetch = mockFetch;

beforeEach(() => {
  currentAuthState = adminState;
  mockFetch.mockImplementation(safeFetchImpl);
  localStorage.clear();
  localStorage.setItem('quantis_token', 'test-token');
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrap(ui: React.ReactElement, initialRoute = '/admin') {
  return render(<MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>);
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import Admin from '@/pages/Admin';

// ===========================================================================
// 1. Admin Access
// ===========================================================================

describe('Admin Panel - Access Control', () => {
  beforeEach(() => vi.clearAllMocks());

  test('renders admin panel for admin user', async () => {
    currentAuthState = adminState;
    await act(async () => { wrap(<Admin />); });
    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeTruthy();
    });
  });

  test('redirects non-admin to /dashboard', async () => {
    currentAuthState = nonAdminState;
    await act(async () => { wrap(<Admin />); });
    const nav = screen.getByTestId('navigate');
    expect(nav.getAttribute('data-to')).toBe('/dashboard');
  });

  test('shows "Admin Panel" heading and admin badge', async () => {
    currentAuthState = adminState;
    await act(async () => { wrap(<Admin />); });
    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeTruthy();
      expect(screen.getByText('Admin')).toBeTruthy();
    });
  });
});

// ===========================================================================
// 2. Tab Navigation
// ===========================================================================

describe('Admin Panel - Tab Navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  test('Overview tab is active by default', async () => {
    await act(async () => { wrap(<Admin />); });
    await waitFor(() => {
      const overviewBtn = screen.getByText('Overview');
      expect(overviewBtn.closest('button')?.className).toContain('bg-primary');
    });
  });

  test('clicking Users tab switches content', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Users')); });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by email or name...')).toBeTruthy();
    });
  });

  test('clicking Revenue tab switches content', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Revenue')); });
    await waitFor(() => {
      expect(screen.getByText('Payments')).toBeTruthy();
    });
  });

  test('clicking System tab switches content', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('System')); });
    await waitFor(() => {
      expect(screen.getByText('Health Status')).toBeTruthy();
    });
  });
});

// ===========================================================================
// 3. Overview Tab
// ===========================================================================

describe('Admin Panel - Overview Tab', () => {
  beforeEach(() => vi.clearAllMocks());

  test('shows stat cards (Total Users, MRR, ARR)', async () => {
    await act(async () => { wrap(<Admin />); });
    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeTruthy();
      expect(screen.getByText('150')).toBeTruthy();
      expect(screen.getByText('MRR')).toBeTruthy();
      expect(screen.getByText('$2,500')).toBeTruthy();
      expect(screen.getByText('ARR')).toBeTruthy();
      expect(screen.getByText('$30,000')).toBeTruthy();
    });
  });

  test('shows user growth section', async () => {
    await act(async () => { wrap(<Admin />); });
    await waitFor(() => {
      expect(screen.getByText('User Growth (Last 90 Days)')).toBeTruthy();
    });
  });

  test('shows tier distribution section', async () => {
    await act(async () => { wrap(<Admin />); });
    await waitFor(() => {
      expect(screen.getByText('Tier Distribution')).toBeTruthy();
    });
  });

  test('handles loading state', async () => {
    // Make dashboard fetch never resolve
    mockFetch.mockImplementation((url: string) => {
      const u = typeof url === 'string' ? url : '';
      if (u.includes('/admin/dashboard')) {
        return new Promise(() => {}); // never resolves
      }
      return safeFetchImpl(url);
    });

    await act(async () => { wrap(<Admin />); });
    // Loading state shows spinner with "Loading..." text
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});

// ===========================================================================
// 4. Users Tab
// ===========================================================================

describe('Admin Panel - Users Tab', () => {
  beforeEach(() => vi.clearAllMocks());

  test('shows search input and tier filter', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Users')); });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by email or name...')).toBeTruthy();
      expect(screen.getByText('All Tiers')).toBeTruthy();
    });
  });

  test('shows users table with columns', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Users')); });
    await waitFor(() => {
      expect(screen.getByText('Email')).toBeTruthy();
      expect(screen.getByText('Name')).toBeTruthy();
      // "Tier" appears in the column header and in the filter — just check it exists
      expect(screen.getAllByText('Tier').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Created')).toBeTruthy();
      expect(screen.getByText('Actions')).toBeTruthy();
    });
  });

  test('shows user count', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Users')); });
    await waitFor(() => {
      expect(screen.getByText('3 users')).toBeTruthy();
    });
  });

  test('shows user email rows from mock data', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Users')); });
    await waitFor(() => {
      expect(screen.getByText('alice@test.com')).toBeTruthy();
      expect(screen.getByText('bob@test.com')).toBeTruthy();
      expect(screen.getByText('carol@test.com')).toBeTruthy();
    });
  });

  test('clicking a row opens detail modal', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Users')); });
    await waitFor(() => {
      expect(screen.getByText('alice@test.com')).toBeTruthy();
    });

    // Click on the row with alice@test.com
    const aliceRow = screen.getByText('alice@test.com').closest('tr');
    await act(async () => { fireEvent.click(aliceRow!); });

    await waitFor(() => {
      expect(screen.getByText('User Details')).toBeTruthy();
    });
  });
});

// ===========================================================================
// 5. Revenue Tab
// ===========================================================================

describe('Admin Panel - Revenue Tab', () => {
  beforeEach(() => vi.clearAllMocks());

  test('shows revenue stat cards (MRR, ARR)', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Revenue')); });
    await waitFor(() => {
      // Revenue tab has its own MRR and ARR cards
      const mrrElements = screen.getAllByText('MRR');
      expect(mrrElements.length).toBeGreaterThanOrEqual(1);
      const arrElements = screen.getAllByText('ARR');
      expect(arrElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Revenue Today')).toBeTruthy();
      expect(screen.getByText('Revenue This Month')).toBeTruthy();
    });
  });

  test('shows payments table section', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Revenue')); });
    await waitFor(() => {
      expect(screen.getByText('Payments')).toBeTruthy();
      // Table column headers
      expect(screen.getByText('User')).toBeTruthy();
      expect(screen.getByText('Amount')).toBeTruthy();
    });
  });

  test('status filter dropdown exists', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Revenue')); });
    await waitFor(() => {
      expect(screen.getByText('All Statuses')).toBeTruthy();
      expect(screen.getByText('Pending')).toBeTruthy();
      expect(screen.getByText('Confirmed')).toBeTruthy();
    });
  });

  test('subscriptions overview section exists', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('Revenue')); });
    await waitFor(() => {
      expect(screen.getByText('Subscriptions Overview')).toBeTruthy();
      expect(screen.getByText('Active')).toBeTruthy();
      expect(screen.getByText('Expired')).toBeTruthy();
      expect(screen.getByText('Cancelled')).toBeTruthy();
      expect(screen.getByText('Churn Rate')).toBeTruthy();
    });
  });
});

// ===========================================================================
// 6. System Tab
// ===========================================================================

describe('Admin Panel - System Tab', () => {
  beforeEach(() => vi.clearAllMocks());

  test('shows DB status indicator', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('System')); });
    await waitFor(() => {
      expect(screen.getByText('Database (PostgreSQL)')).toBeTruthy();
      const connectedElements = screen.getAllByText('Connected');
      expect(connectedElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('shows Redis status indicator', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('System')); });
    await waitFor(() => {
      expect(screen.getByText('Redis')).toBeTruthy();
      // Both DB and Redis show "Connected"
      const connectedElements = screen.getAllByText('Connected');
      expect(connectedElements.length).toBe(2);
    });
  });

  test('shows data collector section', async () => {
    await act(async () => { wrap(<Admin />); });
    await act(async () => { fireEvent.click(screen.getByText('System')); });
    await waitFor(() => {
      expect(screen.getByText('Data Collector Monitor')).toBeTruthy();
      expect(screen.getByText('Exchange')).toBeTruthy();
      expect(screen.getByText('Last Tick')).toBeTruthy();
      expect(screen.getByText('Lag')).toBeTruthy();
    });
  });
});
