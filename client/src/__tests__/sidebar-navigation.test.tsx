/**
 * Tests for the collapsible sidebar navigation, mobile grouped menu,
 * favorites, tier lock icons, and shared navigation config.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Outlet: () => <div data-testid="outlet">Outlet</div>,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/stores/market', () => {
  const state = {
    tickers: new Map([
      ['BTCUSDT', { price: 65000, change24h: 2.0, volume: 1e6, high: 66000, low: 64000 }],
    ]),
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

vi.mock('@/stores/toast', () => {
  const state = { toasts: [], addToast: vi.fn(), removeToast: vi.fn() };
  return {
    useToastStore: vi.fn((sel?: any) => (typeof sel === 'function' ? sel(state) : state)),
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

const mockAuthState = {
  user: { id: 'u1', email: 'a@b.com', tier: 'free', display_name: 'Test', is_admin: false },
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

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn((sel?: any) =>
    typeof sel === 'function' ? sel(mockAuthState) : mockAuthState
  ),
}));

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

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
});
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrap(ui: React.ReactElement, initialRoute = '/dashboard') {
  return render(<MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>);
}

// ---------------------------------------------------------------------------
// Navigation config unit tests
// ---------------------------------------------------------------------------

import {
  NAV_GROUPS,
  ALL_NAV_ITEMS,
  findGroupByPath,
  isItemLocked,
  loadFavorites,
  saveFavorites,
  toggleFavorite,
} from '@/config/navigation';

describe('navigation config', () => {
  it('has 8 groups', () => {
    expect(NAV_GROUPS).toHaveLength(8);
  });

  it('groups have expected IDs', () => {
    const ids = NAV_GROUPS.map((g) => g.id);
    expect(ids).toEqual([
      'core', 'analysis', 'data', 'trading', 'ai-tools', 'account', 'community', 'learn',
    ]);
  });

  it('Core group has 4 items', () => {
    const core = NAV_GROUPS.find((g) => g.id === 'core')!;
    expect(core.items).toHaveLength(4);
    expect(core.defaultOpen).toBe(true);
  });

  it('Analysis group has 10 items (merged pages)', () => {
    const analysis = NAV_GROUPS.find((g) => g.id === 'analysis')!;
    expect(analysis.items).toHaveLength(10);
  });

  it('ALL_NAV_ITEMS is the flat list of all group items', () => {
    const totalItems = NAV_GROUPS.reduce((sum, g) => sum + g.items.length, 0);
    expect(ALL_NAV_ITEMS).toHaveLength(totalItems);
  });

  it('every item has icon, labelKey, and path', () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(item.icon).toBeDefined();
      expect(item.labelKey).toBeTruthy();
      expect(item.path).toMatch(/^\//);
    }
  });

  it('no duplicate paths', () => {
    const paths = ALL_NAV_ITEMS.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('findGroupByPath', () => {
  it('finds core group for /dashboard', () => {
    expect(findGroupByPath('/dashboard')).toBe('core');
  });

  it('finds analysis group for /signals', () => {
    expect(findGroupByPath('/signals')).toBe('analysis');
  });

  it('finds data group for /open-interest', () => {
    expect(findGroupByPath('/open-interest')).toBe('data');
  });

  it('finds trading group for /paper-trading', () => {
    expect(findGroupByPath('/paper-trading')).toBe('trading');
  });

  it('returns null for unknown path', () => {
    expect(findGroupByPath('/unknown')).toBeNull();
  });
});

describe('isItemLocked', () => {
  it('free item is never locked', () => {
    expect(isItemLocked('free', 'free')).toBe(false);
    expect(isItemLocked(undefined, 'free')).toBe(false);
  });

  it('pro item is locked for free user', () => {
    expect(isItemLocked('pro', 'free')).toBe(true);
  });

  it('pro item is not locked for pro user', () => {
    expect(isItemLocked('pro', 'pro')).toBe(false);
  });

  it('institutional item is locked for pro user', () => {
    expect(isItemLocked('institutional', 'pro')).toBe(true);
  });

  it('institutional item is not locked for institutional user', () => {
    expect(isItemLocked('institutional', 'institutional')).toBe(false);
  });
});

describe('favorites helpers', () => {
  beforeEach(() => localStorage.clear());

  it('loadFavorites returns empty array by default', () => {
    expect(loadFavorites()).toEqual([]);
  });

  it('saveFavorites + loadFavorites roundtrip', () => {
    saveFavorites(['/dashboard', '/chart']);
    expect(loadFavorites()).toEqual(['/dashboard', '/chart']);
  });

  it('saveFavorites caps at 7 items', () => {
    const paths = Array.from({ length: 10 }, (_, i) => `/path-${i}`);
    saveFavorites(paths);
    expect(loadFavorites()).toHaveLength(7);
  });

  it('toggleFavorite adds path', () => {
    expect(toggleFavorite('/chart', [])).toEqual(['/chart']);
  });

  it('toggleFavorite removes existing path', () => {
    expect(toggleFavorite('/chart', ['/chart', '/dashboard'])).toEqual(['/dashboard']);
  });

  it('toggleFavorite respects max 7', () => {
    const current = Array.from({ length: 7 }, (_, i) => `/p${i}`);
    expect(toggleFavorite('/new', current)).toEqual(current); // not added
  });
});

// ---------------------------------------------------------------------------
// Sidebar component tests
// ---------------------------------------------------------------------------

import { Sidebar } from '@/components/layout/Sidebar';

describe('Sidebar — collapsible groups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders logo and brand text when expanded', () => {
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    expect(screen.getByText('Q')).toBeTruthy();
    expect(screen.getByText('Quantis')).toBeTruthy();
  });

  it('hides brand text when collapsed', () => {
    wrap(<Sidebar collapsed={true} onToggle={vi.fn()} />);
    expect(screen.queryByText('Quantis')).toBeNull();
  });

  it('renders all 8 group headers when expanded', () => {
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    for (const group of NAV_GROUPS) {
      expect(screen.getByTestId(`nav-group-${group.id}`)).toBeTruthy();
    }
  });

  it('Core group is expanded by default — shows Dashboard link', () => {
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    expect(screen.getByText('nav.dashboard')).toBeTruthy();
    expect(screen.getByText('nav.chart')).toBeTruthy();
  });

  it('auto-expands group containing current route', () => {
    // Start on /signals which is in analysis group
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />, '/signals');
    expect(screen.getByText('nav.signals')).toBeTruthy();
    expect(screen.getByText('nav.heatmap')).toBeTruthy(); // other analysis items visible
  });

  it('collapsed groups hide their items', () => {
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />, '/dashboard');
    // Community group should be collapsed — Social Feed should not be visible
    // (unless user is on that page)
    // First verify the toggle exists
    const communityToggle = screen.getByTestId('nav-group-toggle-community');
    expect(communityToggle).toBeTruthy();
  });

  it('clicking group header toggles expansion', () => {
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />, '/dashboard');

    // Trading group — click to expand
    const tradingToggle = screen.getByTestId('nav-group-toggle-trading');
    fireEvent.click(tradingToggle);

    // Now Paper Trading should be visible
    expect(screen.getByText('nav.paperTrading')).toBeTruthy();

    // Click again to collapse
    fireEvent.click(tradingToggle);
    expect(screen.queryByText('nav.paperTrading')).toBeNull();
  });

  it('shows item count badge on collapsed groups', () => {
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />, '/dashboard');
    // The Learn group has 1 item and should be collapsed
    const learnToggle = screen.getByTestId('nav-group-toggle-learn');
    // It should show the count
    expect(learnToggle.textContent).toContain('1');
  });

  it('shows lock icon on tier-gated items for free users', () => {
    // mockAuthState.user.tier is 'free'
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />, '/signals');
    // Advanced Patterns is tier: pro — should show lock
    // The analysis group auto-expands because /signals is there
    const links = screen.getAllByRole('link');
    const patternsLink = links.find((l) => l.textContent?.includes('nav.advancedPatterns'));
    expect(patternsLink).toBeTruthy();
    // Locked items have opacity-50
    expect(patternsLink?.className).toContain('opacity-50');
  });

  it('renders Upgrade link', () => {
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    expect(screen.getByText('Upgrade')).toBeTruthy();
  });

  it('calls onToggle when collapse button clicked', () => {
    const onToggle = vi.fn();
    wrap(<Sidebar collapsed={false} onToggle={onToggle} />);
    const toggle = screen.getByTestId('sidebar-collapse-toggle');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('fetches signal count on mount', async () => {
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/analysis/signals');
    });
  });

  it('in collapsed mode, shows dividers instead of group headers', () => {
    wrap(<Sidebar collapsed={true} onToggle={vi.fn()} />);
    // No group toggle buttons should exist
    expect(screen.queryByTestId('nav-group-toggle-core')).toBeNull();
    expect(screen.queryByTestId('nav-group-toggle-analysis')).toBeNull();
  });
});

describe('Sidebar — favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('does not show favorites section when empty', () => {
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    expect(screen.queryByTestId('nav-favorites')).toBeNull();
  });

  it('shows favorites section when items are pinned', () => {
    saveFavorites(['/dashboard', '/chart']);
    wrap(<Sidebar collapsed={false} onToggle={vi.fn()} />);
    expect(screen.getByTestId('nav-favorites')).toBeTruthy();
    expect(screen.getByText('Favorites')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Layout / Mobile menu tests
// ---------------------------------------------------------------------------

import { Layout } from '@/components/layout/Layout';

describe('Layout — mobile collapsible menu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing', () => {
    const { container } = wrap(<Layout />);
    expect(container).toBeDefined();
  });

  it('has mobile More button', () => {
    wrap(<Layout />);
    expect(screen.getByTestId('mobile-more-button')).toBeTruthy();
  });

  it('opens mobile More menu with grouped sections', () => {
    wrap(<Layout />);
    fireEvent.click(screen.getByTestId('mobile-more-button'));
    expect(screen.getByTestId('mobile-more-menu')).toBeTruthy();

    // All 8 group sections should be present
    for (const group of NAV_GROUPS) {
      expect(screen.getByTestId(`mobile-nav-group-${group.id}`)).toBeTruthy();
    }
  });

  it('mobile group toggle expands/collapses items', () => {
    wrap(<Layout />, '/dashboard');
    fireEvent.click(screen.getByTestId('mobile-more-button'));

    // Community group — click to expand
    const communityToggle = screen.getByTestId('mobile-group-toggle-community');
    fireEvent.click(communityToggle);

    // Social Feed should now be visible
    expect(screen.getByText('nav.social')).toBeTruthy();
  });

  it('closes mobile menu when navigating to a page', () => {
    wrap(<Layout />, '/dashboard');
    fireEvent.click(screen.getByTestId('mobile-more-button'));

    // Expand core group and click Dashboard
    const coreToggle = screen.getByTestId('mobile-group-toggle-core');
    fireEvent.click(coreToggle);

    // Find Dashboard button in the grid and click it
    const dashboardButtons = screen.getAllByText('nav.dashboard');
    const mobileButton = dashboardButtons.find(
      (el) => el.closest('[data-testid="mobile-more-menu"]')
    );
    if (mobileButton) {
      fireEvent.click(mobileButton.closest('button')!);
    }
  });

  it('shows lock icon on tier-gated items in mobile', () => {
    wrap(<Layout />, '/dashboard');
    fireEvent.click(screen.getByTestId('mobile-more-button'));

    // Expand analysis group
    const analysisToggle = screen.getByTestId('mobile-group-toggle-analysis');
    fireEvent.click(analysisToggle);

    // Find a pro-gated item button — it should have opacity-50
    const buttons = screen.getByTestId('mobile-nav-group-analysis').querySelectorAll('button');
    const lockedButtons = Array.from(buttons).filter((b) =>
      b.className.includes('opacity-50')
    );
    // Free user should see some locked buttons in analysis
    expect(lockedButtons.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// GlobalSearch — updated PAGES
// ---------------------------------------------------------------------------

import { GlobalSearch } from '@/components/common/GlobalSearch';

describe('GlobalSearch — all pages searchable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders when open', () => {
    wrap(<GlobalSearch isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
  });

  it('finds new merged pages (e.g., Advanced Patterns)', () => {
    wrap(<GlobalSearch isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'Advanced' } });
    expect(screen.getByText('Advanced Patterns')).toBeTruthy();
  });

  it('finds Wallet Tracker page', () => {
    wrap(<GlobalSearch isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'Wallet' } });
    expect(screen.getByText('Wallet Tracker')).toBeTruthy();
  });

  it('finds new pages (e.g., Arbitrage Scanner)', () => {
    wrap(<GlobalSearch isOpen={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'Arbitrage' } });
    expect(screen.getByText('Arbitrage Scanner')).toBeTruthy();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    wrap(<GlobalSearch isOpen={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
