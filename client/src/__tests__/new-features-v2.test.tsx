/**
 * Gap coverage tests for:
 *   1. ArbitrageScanner — DEX-CEX Tab
 *   2. ArbitrageScanner — Fee Columns
 *   3. ArbitrageScanner — Alert Modal
 *   4. Portfolio — Performance Analytics
 *   5. Copilot — Morning Brief
 *   6. WatchlistStrip — Quick Price Alerts
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
      ['BTCUSDT', { price: 95000, change24h: 1.5, volume: 1e9, high: 96000, low: 94000 }],
      ['ETHUSDT', { price: 3200, change24h: -0.8, volume: 5e8, high: 3300, low: 3100 }],
      ['BNBUSDT', { price: 620, change24h: 0.5, volume: 2e8, high: 630, low: 610 }],
      ['SOLUSDT', { price: 180, change24h: 2.1, volume: 3e8, high: 185, low: 175 }],
      ['XRPUSDT', { price: 0.62, change24h: -1.2, volume: 1e8, high: 0.65, low: 0.60 }],
      ['ADAUSDT', { price: 0.45, change24h: 0.3, volume: 5e7, high: 0.47, low: 0.43 }],
      ['DOGEUSDT', { price: 0.08, change24h: -0.5, volume: 3e7, high: 0.085, low: 0.075 }],
      ['AVAXUSDT', { price: 35, change24h: 1.8, volume: 1e8, high: 36, low: 34 }],
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
    __state: state,
  };
});

vi.mock('@/stores/auth', () => {
  const state = {
    user: { id: 'u1', email: 'a@b.com', tier: 'pro', display_name: 'Test', is_admin: false },
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
  return {
    useAuthStore: vi.fn((sel?: any) => (typeof sel === 'function' ? sel(state) : state)),
  };
});

vi.mock('@/stores/toast', () => {
  const state = { toasts: [], addToast: vi.fn(), removeToast: vi.fn() };
  return {
    useToastStore: vi.fn((sel?: any) => (typeof sel === 'function' ? sel(state) : state)),
    __state: state,
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
  lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), closePath: vi.fn(), arc: vi.fn(),
  scale: vi.fn(), setLineDash: vi.fn(), fillText: vi.fn(), strokeText: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: '', lineCap: '', font: '',
  textAlign: '', textBaseline: '', globalAlpha: 1, save: vi.fn(), restore: vi.fn(),
  measureText: vi.fn(() => ({ width: 50 })),
};
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as any;

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// ---------------------------------------------------------------------------
// Fetch router — returns correct shapes per URL
// ---------------------------------------------------------------------------

const MOCK_CROSS_EXCHANGE = [
  {
    pair: 'BTC/USDT', buyExchange: 'Binance', buyPrice: 94900, sellExchange: 'Bybit',
    sellPrice: 95100, spreadPct: 0.21, estProfit: 2.1, buyFeePct: 0.1, sellFeePct: 0.1,
    totalFeesPct: 0.20, netProfitPct: 0.01, netProfit1k: 0.10,
  },
  {
    pair: 'ETH/USDT', buyExchange: 'Kraken', buyPrice: 3190, sellExchange: 'OKX',
    sellPrice: 3210, spreadPct: 0.63, estProfit: 6.3, buyFeePct: 0.15, sellFeePct: 0.1,
    totalFeesPct: 0.25, netProfitPct: 0.38, netProfit1k: 3.80,
  },
  {
    pair: 'SOL/USDT', buyExchange: 'OKX', buyPrice: 178, sellExchange: 'Coinbase',
    sellPrice: 177, spreadPct: -0.56, estProfit: -5.6, buyFeePct: 0.1, sellFeePct: 0.2,
    totalFeesPct: 0.30, netProfitPct: -0.86, netProfit1k: -8.60,
  },
];

const MOCK_DEX_CEX = [
  {
    symbol: 'UNI', dexName: 'Uniswap', dexPrice: 12.30, cexExchange: 'Binance',
    cexPrice: 12.50, spreadPct: 1.63, direction: 'buy_dex_sell_cex',
    dexLiquidity: 500000, estProfit: 16.3, netProfit: 12.5,
  },
  {
    symbol: 'SUSHI', dexName: 'SushiSwap', dexPrice: 1.85, cexExchange: 'OKX',
    cexPrice: 1.80, spreadPct: -2.78, direction: 'buy_cex_sell_dex',
    dexLiquidity: 200000, estProfit: -27.8, netProfit: -30.0,
  },
];

const MOCK_ANALYTICS = {
  totalTrades: 42,
  winRate: 61.9,
  profitFactor: 1.72,
  sharpeRatio: 1.35,
  maxDrawdown: 8.2,
  totalPnl: 2850.50,
  bestTrade: { symbol: 'BTCUSDT', pnl: 650 },
  worstTrade: { symbol: 'SOLUSDT', pnl: -210 },
  equityCurve: [
    { date: '2026-01-01', equity: 10000 },
    { date: '2026-01-15', equity: 10500 },
    { date: '2026-02-01', equity: 10200 },
    { date: '2026-02-15', equity: 11000 },
    { date: '2026-03-01', equity: 12850 },
  ],
  monthlyReturns: [
    { month: 'Jan', pnl: 500 },
    { month: 'Feb', pnl: -300 },
    { month: 'Mar', pnl: 2650.50 },
  ],
};

const MOCK_BRIEF = {
  brief: 'BTC is trading above the 200-day MA. Risk sentiment is cautiously bullish.',
  generatedAt: '2026-03-25T08:00:00Z',
  context: {
    btcPrice: 95000,
    ethPrice: 3200,
    sentiment: 65,
    topGainers: [{ symbol: 'SOL', change: 5.2 }],
    topLosers: [{ symbol: 'DOGE', change: -3.1 }],
  },
};

function safeFetchImpl(url: string, opts?: any): Promise<{ ok: boolean; json: () => Promise<any> }> {
  const u = typeof url === 'string' ? url : '';
  const ok = (data: any) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data }) });

  if (u.includes('/arbitrage/cross-exchange')) return ok(MOCK_CROSS_EXCHANGE);
  if (u.includes('/arbitrage/dex-cex'))        return ok(MOCK_DEX_CEX);
  if (u.includes('/arbitrage/funding-rate'))    return ok([]);
  if (u.includes('/arbitrage/triangular'))      return ok([]);
  if (u.includes('/arbitrage/alerts'))          return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
  if (u.includes('/portfolio/analytics'))       return ok(MOCK_ANALYTICS);
  if (u.includes('/copilot/morning-brief'))     return ok(MOCK_BRIEF);
  if (u.includes('/alerts'))                    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
  return ok([]);
}

const mockFetch = vi.fn().mockImplementation(safeFetchImpl);
global.fetch = mockFetch;

beforeEach(() => {
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

function wrap(ui: React.ReactElement, initialRoute = '/') {
  return render(<MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>);
}

// Access mock state via module imports
// @ts-expect-error — test-only mock state export
import { __state as toastState } from '@/stores/toast';
// @ts-expect-error — test-only mock state export
import { __state as marketState } from '@/stores/market';

// ---------------------------------------------------------------------------
// 1. ArbitrageScanner — DEX-CEX Tab
// ---------------------------------------------------------------------------
import ArbitrageScanner from '@/pages/ArbitrageScanner';

describe('ArbitrageScanner - DEX-CEX Tab', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders DEX-CEX tab button', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    expect(screen.getByText('DEX-CEX')).toBeTruthy();
  });

  it('switches to DEX-CEX tab on click', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await act(async () => { fireEvent.click(screen.getByText('DEX-CEX')); });
    // DEX-CEX tab should be active (bg-primary/20 class indicates active)
    const btn = screen.getByText('DEX-CEX');
    expect(btn.className).toContain('bg-primary/20');
  });

  it('fetches /dex-cex data on tab switch', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    mockFetch.mockClear();
    await act(async () => { fireEvent.click(screen.getByText('DEX-CEX')); });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/market/arbitrage/dex-cex',
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });
  });

  it('displays DEX name badges', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await act(async () => { fireEvent.click(screen.getByText('DEX-CEX')); });
    await waitFor(() => {
      expect(screen.getByText('Uniswap')).toBeTruthy();
      expect(screen.getByText('SushiSwap')).toBeTruthy();
    });
  });

  it('shows spread percentage', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await act(async () => { fireEvent.click(screen.getByText('DEX-CEX')); });
    await waitFor(() => {
      expect(screen.getByText('1.63%')).toBeTruthy();
    });
  });

  it('shows direction (buy DEX → sell CEX)', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await act(async () => { fireEvent.click(screen.getByText('DEX-CEX')); });
    await waitFor(() => {
      // The component uses &rarr; which renders as →
      const directionCells = screen.getAllByText(/Buy DEX/);
      expect(directionCells.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. ArbitrageScanner — Fee Accounting
// ---------------------------------------------------------------------------
describe('ArbitrageScanner - Fee Accounting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('displays fees column in cross-exchange table', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await waitFor(() => {
      expect(screen.getByText('Fees')).toBeTruthy();
    });
  });

  it('shows net profit column', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await waitFor(() => {
      expect(screen.getByText('Net Profit ($1K)')).toBeTruthy();
    });
  });

  it('net profit colored green when positive', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await waitFor(() => {
      // ETH/USDT has netProfit1k = 3.80 (positive)
      const cell = screen.getByText('$3.80');
      expect(cell.className).toContain('text-green-500');
    });
  });

  it('net profit colored red when negative', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await waitFor(() => {
      // SOL/USDT has netProfit1k = -8.60 (negative)
      const cell = screen.getByText('$-8.60');
      expect(cell.className).toContain('text-red-500');
    });
  });
});

// ---------------------------------------------------------------------------
// 3. ArbitrageScanner — Alert Modal
// ---------------------------------------------------------------------------
describe('ArbitrageScanner - Alert Modal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows alert button with bell icon', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    // The button text says "Alert"
    const alertButton = screen.getByText('Alert');
    expect(alertButton).toBeTruthy();
  });

  it('opens alert modal on click', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    const alertButton = screen.getByText('Alert');
    await act(async () => { fireEvent.click(alertButton); });
    expect(screen.getByText('Set Alert Threshold')).toBeTruthy();
  });

  it('has threshold input field', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await act(async () => { fireEvent.click(screen.getByText('Alert')); });
    const label = screen.getByText('Spread Threshold (%)');
    expect(label).toBeTruthy();
    const input = screen.getByPlaceholderText('0.3');
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('0.3');
  });

  it('creates alert on submit', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await act(async () => { fireEvent.click(screen.getByText('Alert')); });

    // Change threshold
    const input = screen.getByPlaceholderText('0.3');
    await act(async () => {
      fireEvent.change(input, { target: { value: '0.5' } });
    });

    mockFetch.mockClear();
    await act(async () => { fireEvent.click(screen.getByText('Create Alert')); });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/market/arbitrage/alerts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"threshold":0.5'),
        }),
      );
    });
  });

  it('closes modal after creation', async () => {
    await act(async () => { wrap(<ArbitrageScanner />); });
    await act(async () => { fireEvent.click(screen.getByText('Alert')); });
    expect(screen.getByText('Set Alert Threshold')).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByText('Create Alert')); });
    await waitFor(() => {
      expect(screen.queryByText('Set Alert Threshold')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Portfolio — Performance Analytics
// ---------------------------------------------------------------------------
import Portfolio from '@/pages/Portfolio';

describe('Portfolio - Performance Analytics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders Performance Analytics section', async () => {
    await act(async () => { wrap(<Portfolio />); });
    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeTruthy();
    });
  });

  it('shows stat cards (win rate, Sharpe, drawdown, P&L)', async () => {
    await act(async () => { wrap(<Portfolio />); });
    await waitFor(() => {
      expect(screen.getByText('Win Rate')).toBeTruthy();
      expect(screen.getByText('61.9%')).toBeTruthy();
      expect(screen.getByText('Sharpe Ratio')).toBeTruthy();
      expect(screen.getByText('1.35')).toBeTruthy();
      expect(screen.getByText('Max Drawdown')).toBeTruthy();
      expect(screen.getByText('8.2%')).toBeTruthy();
      expect(screen.getByText('Total P&L')).toBeTruthy();
    });
  });

  it('handles no trades state', async () => {
    // Override fetch to return no analytics
    mockFetch.mockImplementation((url: string) => {
      const u = typeof url === 'string' ? url : '';
      if (u.includes('/portfolio/analytics')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { totalTrades: 0, winRate: 0, profitFactor: 0, sharpeRatio: 0, maxDrawdown: 0, totalPnl: 0, bestTrade: null, worstTrade: null, equityCurve: [], monthlyReturns: [] } }),
        });
      }
      return safeFetchImpl(url);
    });

    await act(async () => { wrap(<Portfolio />); });
    await waitFor(() => {
      expect(screen.getByText(/Start paper trading to see analytics/)).toBeTruthy();
    });
  });

  it('handles analytics loading state', async () => {
    // Make analytics fetch never resolve
    mockFetch.mockImplementation((url: string) => {
      const u = typeof url === 'string' ? url : '';
      if (u.includes('/portfolio/analytics')) {
        return new Promise(() => {}); // never resolves
      }
      return safeFetchImpl(url);
    });

    await act(async () => { wrap(<Portfolio />); });
    // The loading state shows the Spinner — the "Performance Analytics" header should still render
    expect(screen.getByText('Performance Analytics')).toBeTruthy();
  });

  it('renders equity curve canvas', async () => {
    await act(async () => { wrap(<Portfolio />); });
    await waitFor(() => {
      expect(screen.getByText('Equity Curve')).toBeTruthy();
    });
    // Canvas element should be present (the EquityCurveChart renders a <canvas>)
    const canvasElements = document.querySelectorAll('canvas');
    expect(canvasElements.length).toBeGreaterThan(0);
  });

  it('renders monthly returns', async () => {
    await act(async () => { wrap(<Portfolio />); });
    await waitFor(() => {
      expect(screen.getByText('Monthly Returns')).toBeTruthy();
      expect(screen.getByText('Jan')).toBeTruthy();
      expect(screen.getByText('Feb')).toBeTruthy();
      expect(screen.getByText('Mar')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Copilot — Morning Brief
// ---------------------------------------------------------------------------
import Copilot from '@/pages/Copilot';

describe('Copilot - Morning Brief', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders morning brief card', async () => {
    await act(async () => { wrap(<Copilot />); });
    await waitFor(() => {
      expect(screen.getByText('Morning Brief')).toBeTruthy();
    });
  });

  it('fetches /morning-brief on mount', async () => {
    await act(async () => { wrap(<Copilot />); });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/copilot/morning-brief',
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });
  });

  it('shows brief text when loaded', async () => {
    await act(async () => { wrap(<Copilot />); });
    await waitFor(() => {
      expect(screen.getByText(/BTC is trading above the 200-day MA/)).toBeTruthy();
    });
  });

  it('shows context badges (BTC, ETH prices)', async () => {
    await act(async () => { wrap(<Copilot />); });
    await waitFor(() => {
      expect(screen.getByText(/BTC \$95,000\.00/)).toBeTruthy();
      expect(screen.getByText(/ETH \$3,200\.00/)).toBeTruthy();
    });
  });

  it('collapses on header click', async () => {
    await act(async () => { wrap(<Copilot />); });
    await waitFor(() => {
      expect(screen.getByText(/BTC is trading above/)).toBeTruthy();
    });

    // Click the brief header to collapse
    const header = screen.getByText('Morning Brief');
    await act(async () => { fireEvent.click(header.closest('button')!); });

    // After collapse, the brief text should not be visible
    expect(screen.queryByText(/BTC is trading above/)).toBeNull();
  });

  it('shows refresh button', async () => {
    await act(async () => { wrap(<Copilot />); });
    await waitFor(() => {
      const refreshBtn = screen.getByTitle('Refresh brief');
      expect(refreshBtn).toBeTruthy();
    });
  });

  it('handles loading state', async () => {
    // Make brief fetch never resolve
    mockFetch.mockImplementation((url: string) => {
      const u = typeof url === 'string' ? url : '';
      if (u.includes('/morning-brief')) {
        return new Promise(() => {}); // never resolves
      }
      return safeFetchImpl(url);
    });

    await act(async () => { wrap(<Copilot />); });
    // Loading state shows pulse animations — the brief header should still be visible
    expect(screen.getByText('Morning Brief')).toBeTruthy();
    // Brief text should NOT be visible since it's still loading
    expect(screen.queryByText(/BTC is trading above/)).toBeNull();
  });

  it('handles error state', async () => {
    // Make brief fetch fail
    mockFetch.mockImplementation((url: string) => {
      const u = typeof url === 'string' ? url : '';
      if (u.includes('/morning-brief')) {
        return Promise.reject(new Error('Network error'));
      }
      return safeFetchImpl(url);
    });

    await act(async () => { wrap(<Copilot />); });
    await waitFor(() => {
      expect(screen.getByText(/Unable to load morning brief/)).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// 6. WatchlistStrip — Quick Price Alerts
// ---------------------------------------------------------------------------
import { WatchlistStrip } from '@/components/dashboard/WatchlistStrip';

describe('WatchlistStrip - Quick Alerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders bell icon on each card', async () => {
    await act(async () => { wrap(<WatchlistStrip />); });
    // WatchlistStrip renders 8 symbols, each with a bell icon role="button"
    const bells = screen.getAllByRole('button');
    // There are 8 card buttons + 8 bell buttons = 16 total; bells have the Bell icon
    // Just check that we have multiple bell-like role=button elements
    expect(bells.length).toBeGreaterThanOrEqual(8);
  });

  it('opens alert dropdown on bell click', async () => {
    await act(async () => { wrap(<WatchlistStrip />); });
    // The bell icons are span[role=button] elements — find all and click the first
    const allButtons = screen.getAllByRole('button');
    // Bell buttons are the span elements; find one for BTCUSDT
    // The card shows "BTC" text, and its bell is a sibling
    const btcCard = screen.getByText('BTC');
    const cardButton = btcCard.closest('button');
    // The bell is inside the same button
    const bellSpan = cardButton?.querySelector('span[role="button"]');
    expect(bellSpan).toBeTruthy();

    await act(async () => {
      fireEvent.click(bellSpan!);
    });

    // Dropdown should show the price input
    expect(screen.getByPlaceholderText('Target price')).toBeTruthy();
  });

  it('shows price input in dropdown', async () => {
    await act(async () => { wrap(<WatchlistStrip />); });
    const btcCard = screen.getByText('BTC');
    const bellSpan = btcCard.closest('button')?.querySelector('span[role="button"]');
    await act(async () => { fireEvent.click(bellSpan!); });

    const input = screen.getByPlaceholderText('Target price') as HTMLInputElement;
    expect(input).toBeTruthy();
    // Should default to rounded current price (95000)
    expect(input.value).toBe('95000');
  });

  it('creates above alert on button click', async () => {
    await act(async () => { wrap(<WatchlistStrip />); });
    const btcCard = screen.getByText('BTC');
    const bellSpan = btcCard.closest('button')?.querySelector('span[role="button"]');
    await act(async () => { fireEvent.click(bellSpan!); });

    mockFetch.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByText('Alert Above'));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/alerts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('price_above'),
        }),
      );
    });
  });

  it('creates below alert on button click', async () => {
    await act(async () => { wrap(<WatchlistStrip />); });
    const btcCard = screen.getByText('BTC');
    const bellSpan = btcCard.closest('button')?.querySelector('span[role="button"]');
    await act(async () => { fireEvent.click(bellSpan!); });

    mockFetch.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByText('Alert Below'));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/alerts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('price_below'),
        }),
      );
    });
  });

  it('closes dropdown after alert creation', async () => {
    await act(async () => { wrap(<WatchlistStrip />); });
    const btcCard = screen.getByText('BTC');
    const bellSpan = btcCard.closest('button')?.querySelector('span[role="button"]');
    await act(async () => { fireEvent.click(bellSpan!); });

    expect(screen.getByPlaceholderText('Target price')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText('Alert Above'));
    });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Target price')).toBeNull();
    });
  });

  it('shows toast on success', async () => {
    await act(async () => { wrap(<WatchlistStrip />); });
    const btcCard = screen.getByText('BTC');
    const bellSpan = btcCard.closest('button')?.querySelector('span[role="button"]');
    await act(async () => { fireEvent.click(bellSpan!); });

    await act(async () => {
      fireEvent.click(screen.getByText('Alert Above'));
    });

    await waitFor(() => {
      expect(toastState.addToast).toHaveBeenCalledWith(
        expect.stringContaining('Alert created'),
        'success',
      );
    });
  });
});
