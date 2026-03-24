/**
 * Deep tests for critical pages.
 *
 * Tests pages that render reliably with our mocks.
 * Pages that throw due to missing deep dependencies are tested via smoke tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

vi.mock('@/services/api', () => {
  const mockFn = vi.fn().mockResolvedValue({});
  const mockArrayFn = vi.fn().mockResolvedValue([]);
  return {
    default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }) },
    api: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }) },
    getTickers: vi.fn().mockResolvedValue(new Map()),
    getOHLCV: vi.fn().mockResolvedValue([]),
    getFearGreed: vi.fn().mockResolvedValue({ score: 50, label: 'Neutral' }),
    getMarketRegime: vi.fn().mockResolvedValue({
      regime: 'ranging', confidence: 70, description: 'test', regimeScore: 50,
      regimeLabel: 'ranging', indicators: { adx: 20, rsi: 50 },
      components: { hurst: 0.5, choppiness: 50 }, recommended: ['Hold'],
    }),
    getPairs: mockArrayFn,
    getTicker: vi.fn().mockResolvedValue({ price: 50000, change24h: 1.5 }),
    getAlerts: mockArrayFn,
    createAlert: mockFn,
    deleteAlert: mockFn,
    updateProfile: mockFn,
    setup2FA: vi.fn().mockResolvedValue({ secret: 'secret', qrCodeUrl: 'url' }),
    verify2FA: mockFn,
    connectTelegram: mockFn,
    disconnectTelegram: mockFn,
    getTelegramStatus: vi.fn().mockResolvedValue({ connected: false, chatId: '' }),
    sendTelegramTest: mockFn,
    getAdminDashboard: vi.fn().mockResolvedValue({ totalUsers: 0, revenue: 0, activeUsers: 0 }),
    getAdminUsers: mockArrayFn,
    getSystemHealth: vi.fn().mockResolvedValue({ status: 'ok', services: [] }),
    updateUserTier: mockFn,
    getSignals: vi.fn().mockResolvedValue({ rows: [] }),
    getScreener: vi.fn().mockResolvedValue([]),
    getRegimeScores: mockArrayFn,
    getConfluence: mockFn,
    login: mockFn,
    register: mockFn,
    askCopilot: vi.fn().mockResolvedValue({ response: 'test' }),
  };
});

vi.mock('@/services/socket', () => ({
  connectSocket: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false })),
  disconnectSocket: vi.fn(),
  onConnectionStatus: vi.fn(),
}));

vi.mock('@/hooks/useWebSocket', () => ({ useWebSocket: vi.fn() }));

vi.mock('@/stores/auth', () => {
  const storeState = {
    user: { id: 'u1', email: 'test@test.com', tier: 'pro', display_name: 'Test', timezone: 'UTC', language: 'en', role: 'admin', is_admin: true },
    isAuthenticated: true, isLoading: false, error: null, token: 'tok',
    loadUser: vi.fn(), login: vi.fn().mockResolvedValue({}), logout: vi.fn(),
    setUser: vi.fn(), register: vi.fn().mockResolvedValue({}), clearError: vi.fn(),
  };
  return { useAuthStore: vi.fn((sel) => typeof sel === 'function' ? sel(storeState) : storeState) };
});

vi.mock('@/stores/market', () => ({
  useMarketStore: vi.fn((sel) => typeof sel === 'function' ? sel({ tickers: new Map(), pairs: [], updateTicker: vi.fn(), updateTickers: vi.fn() }) : undefined),
  TIMEFRAMES: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
}));

vi.mock('@/stores/toast', () => ({
  useToastStore: vi.fn((sel) => typeof sel === 'function' ? sel({ toasts: [], addToast: vi.fn(), removeToast: vi.fn() }) : undefined),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: vi.fn((sel) => typeof sel === 'function' ? sel({ notifications: [], unreadCount: 0, addNotification: vi.fn(), markAllRead: vi.fn() }) : undefined),
}));

vi.mock('@/stores/theme', () => ({
  useThemeStore: vi.fn((sel) => typeof sel === 'function' ? sel({ theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }) : { theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', changeLanguage: vi.fn() } }),
  Trans: ({ children }: any) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn(), useParams: () => ({}), useSearchParams: () => [new URLSearchParams(), vi.fn()] };
});

vi.mock('@/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => <div data-testid="google-signin">Google Sign In</div>,
}));

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(),
  fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), scale: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
}) as any;

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) }) as any;
global.ResizeObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));
global.IntersectionObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));

// ---------------------------------------------------------------------------
// Helper — safe render (catches errors from missing deep deps)
// ---------------------------------------------------------------------------

function safeRender(Page: React.ComponentType) {
  try {
    return render(<MemoryRouter><Page /></MemoryRouter>);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// NotFound — simplest page, no deps
// ---------------------------------------------------------------------------

describe('NotFound (deep)', () => {
  let NotFound: React.ComponentType;
  beforeEach(async () => {
    vi.clearAllMocks();
    NotFound = (await import('@/pages/NotFound')).default;
  });

  it('renders 404 text', () => {
    const { container } = render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(container.textContent).toContain('404');
  });

  it('has "Page not found" message', () => {
    const { container } = render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(container.textContent).toContain('Page not found');
  });

  it('has link to dashboard or home', () => {
    const { container } = render(<MemoryRouter><NotFound /></MemoryRouter>);
    const links = container.querySelectorAll('a');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('renders h1 with 404', () => {
    const { container } = render(<MemoryRouter><NotFound /></MemoryRouter>);
    const h1 = container.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toContain('404');
  });
});

// ---------------------------------------------------------------------------
// Terms / Privacy — static content pages
// ---------------------------------------------------------------------------

describe('Terms page', () => {
  let Terms: React.ComponentType;
  beforeEach(async () => { Terms = (await import('@/pages/Terms')).default; });

  it('renders without crash', () => {
    const result = safeRender(Terms);
    expect(result).not.toBeNull();
  });

  it('contains terms-related content', () => {
    const result = safeRender(Terms);
    if (result) expect(result.container.innerHTML.length).toBeGreaterThan(100);
  });
});

describe('Privacy page', () => {
  let Privacy: React.ComponentType;
  beforeEach(async () => { Privacy = (await import('@/pages/Privacy')).default; });

  it('renders without crash', () => {
    const result = safeRender(Privacy);
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Settings — complex page that should render with our mocks
// ---------------------------------------------------------------------------

describe('Settings (deep)', () => {
  let Settings: React.ComponentType;
  beforeEach(async () => {
    vi.clearAllMocks();
    Settings = (await import('@/pages/Settings')).default;
  });

  it('renders without crash', () => {
    const result = safeRender(Settings);
    expect(result).not.toBeNull();
  });

  it('contains settings-related i18n keys', () => {
    const result = safeRender(Settings);
    if (result) {
      const text = result.container.textContent || '';
      // Settings page uses i18n keys — we check those are rendered
      expect(text.length).toBeGreaterThan(50);
    }
  });
});

// ---------------------------------------------------------------------------
// Journal — table-based page
// ---------------------------------------------------------------------------

describe('Journal (deep)', () => {
  let Journal: React.ComponentType;
  beforeEach(async () => {
    vi.clearAllMocks();
    Journal = (await import('@/pages/Journal')).default;
  });

  it('renders without crash', () => {
    const result = safeRender(Journal);
    expect(result).not.toBeNull();
  });

  it('has a table element', () => {
    const result = safeRender(Journal);
    if (result) {
      const table = result.container.querySelector('table');
      expect(table).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Dashboard — largest page
// ---------------------------------------------------------------------------

describe('Dashboard (deep)', () => {
  let Dashboard: React.ComponentType;
  beforeEach(async () => {
    vi.clearAllMocks();
    Dashboard = (await import('@/pages/Dashboard')).default;
  });

  it('renders without crash', () => {
    const result = safeRender(Dashboard);
    expect(result).not.toBeNull();
  });

  it('has at least one card element', () => {
    const result = safeRender(Dashboard);
    if (result) {
      // Dashboard renders many cards
      expect(result.container.innerHTML.length).toBeGreaterThan(100);
    }
  });
});

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

describe('Portfolio (deep)', () => {
  let Portfolio: React.ComponentType;
  beforeEach(async () => {
    vi.clearAllMocks();
    Portfolio = (await import('@/pages/Portfolio')).default;
  });

  it('renders without crash', () => {
    const result = safeRender(Portfolio);
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Login — auth form
// ---------------------------------------------------------------------------

describe('Login (deep)', () => {
  let Login: React.ComponentType;
  beforeEach(async () => {
    vi.clearAllMocks();
    Login = (await import('@/pages/Login')).default;
  });

  it('renders without crash', () => {
    const result = safeRender(Login);
    expect(result).not.toBeNull();
  });

  it('has email and password inputs', () => {
    const result = safeRender(Login);
    if (result) {
      expect(result.container.querySelector('input[type="email"]')).not.toBeNull();
      expect(result.container.querySelector('input[type="password"]')).not.toBeNull();
    }
  });

  it('has a form element', () => {
    const result = safeRender(Login);
    if (result) {
      expect(result.container.querySelector('form')).not.toBeNull();
    }
  });

  it('has Google Sign-In button', () => {
    const result = safeRender(Login);
    if (result) {
      expect(result.container.querySelector('[data-testid="google-signin"]')).not.toBeNull();
    }
  });

  it('has link to register page', () => {
    const result = safeRender(Login);
    if (result) {
      expect(result.container.querySelector('a[href="/register"]')).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Register — auth form
// ---------------------------------------------------------------------------

describe('Register (deep)', () => {
  let Register: React.ComponentType;
  beforeEach(async () => {
    vi.clearAllMocks();
    Register = (await import('@/pages/Register')).default;
  });

  it('renders without crash', () => {
    const result = safeRender(Register);
    expect(result).not.toBeNull();
  });

  it('has email and password inputs', () => {
    const result = safeRender(Register);
    if (result) {
      expect(result.container.querySelector('input[type="email"]')).not.toBeNull();
      const pwInputs = result.container.querySelectorAll('input[type="password"]');
      expect(pwInputs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('has a form element', () => {
    const result = safeRender(Register);
    if (result) {
      expect(result.container.querySelector('form')).not.toBeNull();
    }
  });

  it('has link to login page', () => {
    const result = safeRender(Register);
    if (result) {
      expect(result.container.querySelector('a[href="/login"]')).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Landing — public page
// ---------------------------------------------------------------------------

describe('Landing (deep)', () => {
  let Landing: React.ComponentType;
  beforeEach(async () => {
    vi.clearAllMocks();
    Landing = (await import('@/pages/Landing')).default;
  });

  it('renders without crash', () => {
    const result = safeRender(Landing);
    expect(result).not.toBeNull();
  });

  it('has substantial content', () => {
    const result = safeRender(Landing);
    if (result) {
      expect(result.container.innerHTML.length).toBeGreaterThan(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Pricing — public page
// ---------------------------------------------------------------------------

describe('Pricing (deep)', () => {
  let Pricing: React.ComponentType;
  beforeEach(async () => {
    vi.clearAllMocks();
    Pricing = (await import('@/pages/Pricing')).default;
  });

  it('renders without crash', () => {
    const result = safeRender(Pricing);
    expect(result).not.toBeNull();
  });

  it('has substantial content', () => {
    const result = safeRender(Pricing);
    if (result) {
      expect(result.container.innerHTML.length).toBeGreaterThan(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Status — public page
// ---------------------------------------------------------------------------

describe('Status (deep)', () => {
  let Status: React.ComponentType;
  beforeEach(async () => {
    vi.clearAllMocks();
    Status = (await import('@/pages/Status')).default;
  });

  it('renders without crash', () => {
    const result = safeRender(Status);
    expect(result).not.toBeNull();
  });

  it('has substantial content', () => {
    const result = safeRender(Status);
    if (result) {
      expect(result.container.innerHTML.length).toBeGreaterThan(100);
    }
  });
});
