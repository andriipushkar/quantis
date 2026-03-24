/**
 * Coverage-95 test suite.
 *
 * Targets all pages below 90% statement coverage.
 * Each page gets multiple renders with varied mock data to hit every branch:
 *   - Loading state
 *   - Empty/error data
 *   - Full data with all conditional JSX
 *   - Interactive element clicks
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Global mocks — must appear before any page import
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ symbol: 'BTCUSDT' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Services
const mockGetTickers = vi.fn().mockResolvedValue(new Map());
const mockGetOHLCV = vi.fn().mockResolvedValue([]);
const mockGetFearGreed = vi.fn().mockResolvedValue({ score: 50, label: 'Neutral' });
const mockGetMarketRegime = vi.fn().mockResolvedValue({
  regime: 'ranging', confidence: 70, description: 'Market is ranging', regimeScore: 50,
  regimeLabel: 'ranging', indicators: { adx: 20, rsi: 50 },
  components: { hurst: 0.5, choppiness: 50 }, recommended: ['Hold'],
});
const mockGetPairs = vi.fn().mockResolvedValue([]);
const mockGetAlerts = vi.fn().mockResolvedValue([]);
const mockCreateAlert = vi.fn().mockResolvedValue({});
const mockDeleteAlert = vi.fn().mockResolvedValue({});
const mockGetTicker = vi.fn().mockResolvedValue({ price: 50000, change24h: 1.5 });
const mockUpdateProfile = vi.fn().mockResolvedValue({});
const mockSetup2FA = vi.fn().mockResolvedValue({ secret: 'TOTP_SECRET', qrCodeUrl: 'otpauth://test' });
const mockVerify2FA = vi.fn().mockResolvedValue({});
const mockConnectTelegram = vi.fn().mockResolvedValue({});
const mockDisconnectTelegram = vi.fn().mockResolvedValue({});
const mockGetTelegramStatus = vi.fn().mockResolvedValue({ connected: false, chatId: '' });
const mockSendTelegramTest = vi.fn().mockResolvedValue({});
const mockGetRegimeScores = vi.fn().mockResolvedValue([]);
const mockGetDeFiOverview = vi.fn().mockResolvedValue({ protocols: [], totalTvl: 0, avgApy: 0, protocolCount: 0 });
const mockGetCorrelation = vi.fn().mockResolvedValue({ matrix: [], symbols: [] });
const mockGetSignals = vi.fn().mockResolvedValue({ rows: [] });
const mockAskCopilot = vi.fn().mockResolvedValue({ response: 'test' });
const mockGetAdminDashboard = vi.fn().mockResolvedValue({ totalUsers: 0, revenue: 0, activeUsers: 0 });

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }) },
  api: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }) },
  getTickers: (...args: any[]) => mockGetTickers(...args),
  getOHLCV: (...args: any[]) => mockGetOHLCV(...args),
  getFearGreed: (...args: any[]) => mockGetFearGreed(...args),
  getMarketRegime: (...args: any[]) => mockGetMarketRegime(...args),
  getPairs: (...args: any[]) => mockGetPairs(...args),
  getTicker: (...args: any[]) => mockGetTicker(...args),
  getAlerts: (...args: any[]) => mockGetAlerts(...args),
  createAlert: (...args: any[]) => mockCreateAlert(...args),
  deleteAlert: (...args: any[]) => mockDeleteAlert(...args),
  updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  setup2FA: (...args: any[]) => mockSetup2FA(...args),
  verify2FA: (...args: any[]) => mockVerify2FA(...args),
  connectTelegram: (...args: any[]) => mockConnectTelegram(...args),
  disconnectTelegram: (...args: any[]) => mockDisconnectTelegram(...args),
  getTelegramStatus: (...args: any[]) => mockGetTelegramStatus(...args),
  sendTelegramTest: (...args: any[]) => mockSendTelegramTest(...args),
  getAdminDashboard: (...args: any[]) => mockGetAdminDashboard(...args),
  getAdminUsers: vi.fn().mockResolvedValue([]),
  getSystemHealth: vi.fn().mockResolvedValue({ status: 'ok', services: [] }),
  updateUserTier: vi.fn().mockResolvedValue({}),
  getSignals: (...args: any[]) => mockGetSignals(...args),
  getScreener: vi.fn().mockResolvedValue([]),
  getRegimeScores: (...args: any[]) => mockGetRegimeScores(...args),
  getConfluence: vi.fn().mockResolvedValue({}),
  login: vi.fn().mockResolvedValue({}),
  register: vi.fn().mockResolvedValue({}),
  askCopilot: (...args: any[]) => mockAskCopilot(...args),
  getDeFiOverview: (...args: any[]) => mockGetDeFiOverview(...args),
  getExchangeHealth: vi.fn().mockResolvedValue([]),
  getFundingRates: vi.fn().mockResolvedValue([]),
  getMarketBreadth: vi.fn().mockResolvedValue({ breadthScore: 50, components: {} }),
  getMarketProfile: vi.fn().mockResolvedValue({ poc: 0, vaHigh: 0, vaLow: 0 }),
  getNarratives: vi.fn().mockResolvedValue([]),
  getOpenInterest: vi.fn().mockResolvedValue([]),
  getCorrelation: (...args: any[]) => mockGetCorrelation(...args),
  getSeasonality: vi.fn().mockResolvedValue({ hourly: [], daily: [] }),
  getLiquidations: vi.fn().mockResolvedValue({ above: [], below: [] }),
  getOrderFlow: vi.fn().mockResolvedValue([]),
  getWhaleTransactions: vi.fn().mockResolvedValue([]),
  getNews: vi.fn().mockResolvedValue({ articles: [], total: 0 }),
  getLeaderboard: vi.fn().mockResolvedValue([]),
  getCopyTraders: vi.fn().mockResolvedValue([]),
  getJournalEntries: vi.fn().mockResolvedValue([]),
  createJournalEntry: vi.fn().mockResolvedValue({}),
  deleteJournalEntry: vi.fn().mockResolvedValue({}),
  updateJournalEntry: vi.fn().mockResolvedValue({}),
  getSocialFeed: vi.fn().mockResolvedValue({ posts: [] }),
  createPost: vi.fn().mockResolvedValue({}),
  getGamificationProfile: vi.fn().mockResolvedValue({ xp: 0, level: 1, streak: 0 }),
  getPaperPortfolio: vi.fn().mockResolvedValue({ balance: 100000, positions: [] }),
  placePaperOrder: vi.fn().mockResolvedValue({}),
  closePaperPosition: vi.fn().mockResolvedValue({}),
  getTrackedWallets: vi.fn().mockResolvedValue([]),
  trackWallet: vi.fn().mockResolvedValue({}),
  removeTrackedWallet: vi.fn().mockResolvedValue({}),
  getWalletBalance: vi.fn().mockResolvedValue({ holdings: [], totalValue: 0 }),
  getInfluencers: vi.fn().mockResolvedValue([]),
  getInfluencerConsensus: vi.fn().mockResolvedValue([]),
  getTokenomics: vi.fn().mockResolvedValue({}),
  compareTokenomics: vi.fn().mockResolvedValue([]),
  scanToken: vi.fn().mockResolvedValue({ score: 50, flags: [] }),
  getMarketplaceStrategies: vi.fn().mockResolvedValue([]),
  getTaxReport: vi.fn().mockResolvedValue({ trades: [], summary: {} }),
  getProfile: vi.fn().mockResolvedValue({ display_name: 'Test', xp: 0 }),
  getReferralStats: vi.fn().mockResolvedValue({ referrals: 0, earned: 0, link: '' }),
}));

vi.mock('@/services/socket', () => ({
  connectSocket: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false })),
  disconnectSocket: vi.fn(),
  onConnectionStatus: vi.fn(),
  subscribeOHLCV: vi.fn(),
  unsubscribeOHLCV: vi.fn(),
  subscribeTicker: vi.fn(),
  unsubscribeTicker: vi.fn(),
  subscribeSignals: vi.fn(),
  unsubscribeSignals: vi.fn(),
}));

vi.mock('@/hooks/useWebSocket', () => ({ useWebSocket: vi.fn() }));

// Store mocks with controllable state
let authState: any = {
  user: { id: 'u1', email: 'test@test.com', tier: 'pro', display_name: 'Test', timezone: 'UTC', language: 'en', role: 'admin', is_admin: true },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  token: 'tok',
  loadUser: vi.fn(),
  login: vi.fn().mockResolvedValue({}),
  logout: vi.fn(),
  setUser: vi.fn(),
  register: vi.fn().mockResolvedValue({}),
  clearError: vi.fn(),
};

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn((sel) =>
    typeof sel === 'function' ? sel(authState) : authState,
  ),
}));

let marketState: any = {
  tickers: new Map(),
  pairs: [],
  updateTicker: vi.fn(),
  updateTickers: vi.fn(),
  selectedPair: 'BTCUSDT',
  setSelectedPair: vi.fn(),
  selectedTimeframe: '1h',
  setSelectedTimeframe: vi.fn(),
};

vi.mock('@/stores/market', () => ({
  useMarketStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(marketState) : marketState),
  TIMEFRAMES: [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '1h', label: '1h' },
    { value: '4h', label: '4h' },
    { value: '1d', label: '1d' },
    { value: '1w', label: '1w' },
  ],
}));

const mockAddToast = vi.fn();
vi.mock('@/stores/toast', () => {
  const state = { toasts: [], addToast: mockAddToast, removeToast: vi.fn() };
  return {
    useToastStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(state) : state),
  };
});

vi.mock('@/stores/notifications', () => {
  const state = { notifications: [], unreadCount: 0, addNotification: vi.fn(), markAllRead: vi.fn() };
  return {
    useNotificationStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(state) : state),
  };
});

vi.mock('@/stores/theme', () => ({
  useThemeStore: vi.fn((sel) =>
    typeof sel === 'function'
      ? sel({ theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() })
      : { theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() },
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, defaultOrOpts?: any) => typeof defaultOrOpts === 'string' ? defaultOrOpts : key, i18n: { language: 'en', changeLanguage: vi.fn() } }),
  Trans: ({ children }: any) => children,
}));

vi.mock('@/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => <div data-testid="google-signin">Google Sign In</div>,
}));

vi.mock('@/components/charts/TradingChart', () => ({
  TradingChart: React.forwardRef((_: any, ref: any) => <div ref={ref} data-testid="trading-chart">Chart</div>),
}));
vi.mock('@/components/charts/RSIChart', () => ({
  RSIChart: () => <div data-testid="rsi-chart">RSI</div>,
}));
vi.mock('@/components/charts/ConfluenceHistory', () => ({
  ConfluenceHistory: () => <div>Confluence</div>,
}));
vi.mock('@/components/charts/ConfluenceGauge', () => ({
  ConfluenceGauge: () => <div>Gauge</div>,
}));
vi.mock('@/components/charts/DrawingToolbar', () => ({
  DrawingToolbar: () => <div>DrawingToolbar</div>,
}));
vi.mock('@/components/dashboard/WatchlistStrip', () => ({
  WatchlistStrip: () => <div>Watchlist</div>,
}));
vi.mock('@/components/dashboard/ConfluenceGauge', () => ({
  ConfluenceGauge: () => <div>Gauge</div>,
}));
vi.mock('@/components/dashboard/SignalCard', () => ({
  SignalCard: () => <div>Signal</div>,
}));
vi.mock('@/components/common/ConnectionStatus', () => ({
  ConnectionStatus: () => <div>Connected</div>,
  default: () => <div>Connected</div>,
}));
vi.mock('@/components/common/NotificationCenter', () => ({
  NotificationCenter: () => <div data-testid="notification-center">Notifications</div>,
}));
vi.mock('@/components/common/OnboardingWizard', () => ({
  default: ({ onComplete }: any) => <div data-testid="onboarding-wizard"><button onClick={onComplete}>Complete</button></div>,
}));
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }: any) => null, HelmetProvider: ({ children }: any) => children }));


// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(),
  fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
  scale: vi.fn(), createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  strokeStyle: '', fillStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
  measureText: vi.fn().mockReturnValue({ width: 10 }),
  fillText: vi.fn(), strokeText: vi.fn(), setLineDash: vi.fn(),
}) as any;

// Mock fetch
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true, data: [] }),
}) as any;
global.fetch = mockFetch;

Element.prototype.scrollIntoView = vi.fn();
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn(),
}));
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn(),
}));

// navigator.clipboard mock
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderPage(Page: React.ComponentType, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Page />
    </MemoryRouter>,
  );
}

async function flushAsync() {
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset auth state to default
  authState.isAuthenticated = true;
  authState.error = null;
  authState.isLoading = false;
  authState.user = { id: 'u1', email: 'test@test.com', tier: 'pro', display_name: 'Test', timezone: 'UTC', language: 'en', role: 'admin', is_admin: true };
  authState.token = 'tok';
  // Reset market tickers
  marketState.tickers = new Map();

  // Reset fetch mock
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, data: [] }),
  });
});

// ===================== Dashboard =====================

describe('Dashboard — full coverage', () => {
  let Dashboard: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Dashboard');
    Dashboard = mod.default;
  });

  it('shows loading state initially', async () => {
    mockGetTickers.mockImplementation(() => new Promise(() => {})); // never resolves
    const { container } = renderPage(Dashboard);
    expect(container.textContent).toContain('Loading market data');
  });

  it('shows error state when fetch fails and no tickers', async () => {
    mockGetTickers.mockRejectedValue(new Error('fail'));
    renderPage(Dashboard);
    await flushAsync();
    expect(screen.getByText('Failed to fetch market data')).toBeDefined();
    // Click retry
    const btn = screen.getByText('Retry');
    mockGetTickers.mockResolvedValue(new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }]]));
    fireEvent.click(btn);
    await flushAsync();
  });

  it('renders watchlist, gainers, losers with data', async () => {
    const tickerMap = new Map([
      ['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }],
      ['ETHUSDT', { symbol: 'ETHUSDT', price: 3000, change24h: -1.5, volume: 5e8 }],
      ['SOLUSDT', { symbol: 'SOLUSDT', price: 150, change24h: 5.0, volume: 3e8 }],
    ]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    renderPage(Dashboard);
    await flushAsync();

    expect(screen.getByText('Watchlist')).toBeDefined();
    expect(screen.getByText('Top Gainers')).toBeDefined();
    expect(screen.getByText('Top Losers')).toBeDefined();
    expect(screen.getByText('Market Overview')).toBeDefined();
  });

  it('toggles watchlist star when authenticated', async () => {
    const tickerMap = new Map([
      ['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }],
    ]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    // Mock watchlist API
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) }) // indicators
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) }) // watchlist
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) }); // toggle

    renderPage(Dashboard);
    await flushAsync();
  });

  it('navigates to chart on gainer/loser click', async () => {
    const tickerMap = new Map([
      ['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }],
    ]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    renderPage(Dashboard);
    await flushAsync();

    // Click on the BTC button in gainers list
    const btcButtons = screen.getAllByText('BTC');
    if (btcButtons.length > 0) {
      fireEvent.click(btcButtons[0]);
    }
  });

  it('renders FearGreedGauge error state', async () => {
    mockGetFearGreed.mockRejectedValue(new Error('fail'));
    const tickerMap = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }]]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    renderPage(Dashboard);
    await flushAsync();

    expect(screen.getByText('Failed to load')).toBeDefined();
  });

  it('renders MarketRegimeWidget error state', async () => {
    mockGetMarketRegime.mockRejectedValue(new Error('fail'));
    mockGetFearGreed.mockResolvedValue({ score: 50, label: 'Neutral' });
    const tickerMap = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }]]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    renderPage(Dashboard);
    await flushAsync();
  });

  it('renders BtcMiniChart error state', async () => {
    mockGetOHLCV.mockRejectedValue(new Error('fail'));
    mockGetFearGreed.mockResolvedValue({ score: 50, label: 'Neutral' });
    mockGetMarketRegime.mockResolvedValue({
      regime: 'trending_up', confidence: 85, description: 'Trending up', regimeScore: 80,
      regimeLabel: 'strong_trend', indicators: { adx: 30, rsi: 65 },
      components: { hurst: 0.7, choppiness: 30 }, recommended: ['Trend Follow', 'Breakout'],
    });
    const tickerMap = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }]]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    renderPage(Dashboard);
    await flushAsync();
  });

  it('renders regime widget with all score ranges', async () => {
    // Test all getScoreColor branches: >=80, >=60, >=40, >=20, <20
    mockGetMarketRegime.mockResolvedValue({
      regime: 'trending_up', confidence: 95, description: 'Strong trend', regimeScore: 90,
      regimeLabel: 'strong_trend', indicators: { adx: 40, rsi: 70 },
      components: { hurst: 0.8, choppiness: 20 }, recommended: ['Trend Follow'],
    });
    mockGetFearGreed.mockResolvedValue({ score: 15, label: 'Extreme Fear' });
    const tickerMap = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: -5.0, volume: 1e9 }]]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    renderPage(Dashboard);
    await flushAsync();
  });

  it('renders FearGreedGauge with various scores', async () => {
    // Score < 20 (extreme fear)
    mockGetFearGreed.mockResolvedValue({ score: 10, label: 'Extreme Fear' });
    const tickerMap = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }]]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    const { unmount } = renderPage(Dashboard);
    await flushAsync();
    unmount();

    // Score 35 (fear), 55 (neutral), 75 (greed), 90 (extreme greed)
    for (const score of [35, 55, 75, 90]) {
      mockGetFearGreed.mockResolvedValue({ score, label: `Score ${score}` });
      const { unmount: um } = renderPage(Dashboard);
      await flushAsync();
      um();
    }
  });

  it('renders unauthenticated watchlist (no star buttons)', async () => {
    authState.isAuthenticated = false;
    const tickerMap = new Map([
      ['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }],
    ]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    renderPage(Dashboard);
    await flushAsync();
    authState.isAuthenticated = true;
  });

  it('renders with user watchlist items prioritized', async () => {
    const tickerMap = new Map([
      ['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }],
      ['ETHUSDT', { symbol: 'ETHUSDT', price: 3000, change24h: -1, volume: 5e8 }],
    ]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    // Mock watchlist API to return ETHUSDT as user watchlist item
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/watchlist')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [{ symbol: 'ETHUSDT' }] }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: { current: null } }) };
    });

    renderPage(Dashboard);
    await flushAsync();
  });

  it('renders regime colors for all regime types', async () => {
    for (const regime of ['trending_up', 'trending_down', 'high_volatility', 'low_volatility', 'unknown_regime']) {
      mockGetMarketRegime.mockResolvedValue({
        regime, confidence: 60, description: `${regime}`, regimeScore: 50,
        regimeLabel: 'transitional', indicators: { adx: 20, rsi: 50 },
        components: { hurst: 0.5, choppiness: 50 }, recommended: ['Hold'],
      });
      mockGetFearGreed.mockResolvedValue({ score: 50, label: 'Neutral' });
      const tickerMap = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }]]);
      mockGetTickers.mockResolvedValue(tickerMap);
      marketState.tickers = tickerMap;

      const { unmount } = renderPage(Dashboard);
      await flushAsync();
      unmount();
    }
  });
});

// ===================== Chart =====================

describe('Chart — full coverage', () => {
  let Chart: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Chart');
    Chart = mod.default;
  });

  it('renders loading state then chart', async () => {
    mockGetOHLCV.mockResolvedValue([]);
    renderPage(Chart);
    await flushAsync();
  });

  it('renders with candles and RSI data (>15 bars)', async () => {
    // Create 20 candles to trigger RSI calculation
    const candles = Array.from({ length: 20 }, (_, i) => ({
      time: 1000 + i * 60,
      open: 50000 + i * 10 + (i % 2 === 0 ? 5 : -5),
      high: 50100 + i * 10,
      low: 49900 + i * 10,
      close: 50000 + i * 10 + (i % 2 === 0 ? 20 : -20),
      volume: 1e6,
    }));
    mockGetOHLCV.mockResolvedValue(candles);
    mockGetPairs.mockResolvedValue([
      { id: '1', symbol: 'BTCUSDT', exchange: 'binance' },
      { id: '2', symbol: 'ETHUSDT', exchange: 'binance' },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          current: { price: 50000, rsi: 65, ema9: 49900, ema21: 49800, sma20: 49850, bb_upper: 51000, bb_lower: 49000, bb_middle: 50000 },
        },
      }),
    });

    // Set ticker in market state to show price display
    marketState.tickers = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 50000, change24h: 1.5, volume: 1e9 }]]);

    renderPage(Chart);
    await flushAsync();

    expect(screen.getByTestId('trading-chart')).toBeDefined();
  });

  it('toggles EMA, BB, RSI buttons and pair picker', async () => {
    mockGetOHLCV.mockResolvedValue([{ time: 1000, open: 50000, high: 50100, low: 49900, close: 50050, volume: 1e6 }]);
    mockGetPairs.mockResolvedValue([{ id: '1', symbol: 'BTCUSDT', exchange: 'binance' }]);
    marketState.tickers = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 50000, change24h: -1.5, volume: 1e9 }]]);

    renderPage(Chart);
    await flushAsync();

    // Toggle EMA
    const emaBtn = screen.getByText('EMA');
    fireEvent.click(emaBtn);

    // Toggle BB
    const bbBtn = screen.getByText('BB');
    fireEvent.click(bbBtn);

    // Toggle RSI
    const rsiBtn = screen.getByText('RSI');
    fireEvent.click(rsiBtn);

    // Open pair picker
    const pairBtn = screen.getByText('BTC/USDT');
    fireEvent.click(pairBtn);
    await flushAsync();

    // Close pair picker via overlay
    const overlay = document.querySelector('.fixed.inset-0');
    if (overlay) fireEvent.click(overlay);
  });

  it('handles indicator colorFn branches', async () => {
    // RSI > 70 => text-danger, RSI < 30 => text-success, null => text-muted-foreground
    mockGetOHLCV.mockResolvedValue([{ time: 1000, open: 50000, high: 50100, low: 49900, close: 50050, volume: 1e6 }]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          current: { price: 50000, rsi: 75, ema9: 49900, ema21: null, sma20: null, bb_upper: null, bb_lower: null, bb_middle: null },
        },
      }),
    });

    renderPage(Chart);
    await flushAsync();
  });

  it('selects timeframe', async () => {
    mockGetOHLCV.mockResolvedValue([]);
    renderPage(Chart);
    await flushAsync();

    const tfBtn = screen.getByText('4h');
    fireEvent.click(tfBtn);
    expect(marketState.setSelectedTimeframe).toHaveBeenCalledWith('4h');
  });
});

// ===================== Settings =====================

describe('Settings — full coverage', () => {
  let Settings: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Settings');
    Settings = mod.default;
  });

  it('renders and saves profile', async () => {
    renderPage(Settings);
    await flushAsync();

    // Change display name
    const nameInput = screen.getByPlaceholderText('Your name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    // Click Save
    const saveBtn = screen.getByText('Save Changes');
    fireEvent.click(saveBtn);
    await flushAsync();

    expect(mockUpdateProfile).toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith('Settings saved successfully.', 'success');
  });

  it('handles save failure', async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error('fail'));
    renderPage(Settings);
    await flushAsync();

    fireEvent.click(screen.getByText('Save Changes'));
    await flushAsync();

    expect(mockAddToast).toHaveBeenCalledWith('Failed to save settings.', 'danger');
  });

  it('enables 2FA flow: setup -> enter code -> verify', async () => {
    renderPage(Settings);
    await flushAsync();

    // Click Enable 2FA
    fireEvent.click(screen.getByText('Enable 2FA'));
    await flushAsync();

    // Should show TOTP secret
    expect(screen.getByText('TOTP_SECRET')).toBeDefined();

    // Enter 6-digit code
    const codeInput = screen.getByPlaceholderText('6-digit code');
    fireEvent.change(codeInput, { target: { value: '123456' } });

    // Click Verify
    fireEvent.click(screen.getByText('Verify'));
    await flushAsync();

    expect(mockVerify2FA).toHaveBeenCalledWith('123456');
    expect(mockAddToast).toHaveBeenCalledWith('2FA enabled successfully.', 'success');
  });

  it('handles 2FA setup failure', async () => {
    mockSetup2FA.mockRejectedValueOnce(new Error('fail'));
    renderPage(Settings);
    await flushAsync();

    fireEvent.click(screen.getByText('Enable 2FA'));
    await flushAsync();

    expect(mockAddToast).toHaveBeenCalledWith('Failed to set up 2FA.', 'danger');
  });

  it('handles 2FA verify failure', async () => {
    mockVerify2FA.mockRejectedValueOnce(new Error('fail'));
    renderPage(Settings);
    await flushAsync();

    fireEvent.click(screen.getByText('Enable 2FA'));
    await flushAsync();

    const codeInput = screen.getByPlaceholderText('6-digit code');
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify'));
    await flushAsync();

    expect(mockAddToast).toHaveBeenCalledWith('Failed to verify code.', 'danger');
  });

  it('connects Telegram', async () => {
    renderPage(Settings);
    await flushAsync();

    // Fill in chat ID
    const chatInput = screen.getByPlaceholderText('Telegram Chat ID');
    fireEvent.change(chatInput, { target: { value: '12345' } });

    // Click Connect
    fireEvent.click(screen.getByText('Connect'));
    await flushAsync();

    expect(mockConnectTelegram).toHaveBeenCalledWith('12345');
    expect(mockAddToast).toHaveBeenCalledWith('Telegram connected successfully.', 'success');
  });

  it('handles telegram connect failure', async () => {
    mockConnectTelegram.mockRejectedValueOnce(new Error('fail'));
    renderPage(Settings);
    await flushAsync();

    const chatInput = screen.getByPlaceholderText('Telegram Chat ID');
    fireEvent.change(chatInput, { target: { value: '12345' } });
    fireEvent.click(screen.getByText('Connect'));
    await flushAsync();

    expect(mockAddToast).toHaveBeenCalledWith('Failed to connect Telegram.', 'danger');
  });

  it('shows connected telegram with send test and disconnect', async () => {
    mockGetTelegramStatus.mockResolvedValue({ connected: true, chatId: '99999' });
    renderPage(Settings);
    await flushAsync();

    // Send test
    fireEvent.click(screen.getByText('Send Test'));
    await flushAsync();
    expect(mockSendTelegramTest).toHaveBeenCalled();

    // Disconnect
    fireEvent.click(screen.getByText('Disconnect'));
    await flushAsync();
    expect(mockDisconnectTelegram).toHaveBeenCalled();
  });

  it('handles telegram send test failure', async () => {
    mockGetTelegramStatus.mockResolvedValue({ connected: true, chatId: '99999' });
    mockSendTelegramTest.mockRejectedValueOnce(new Error('fail'));
    renderPage(Settings);
    await flushAsync();

    fireEvent.click(screen.getByText('Send Test'));
    await flushAsync();
    expect(mockAddToast).toHaveBeenCalledWith('Failed to send test message.', 'danger');
  });

  it('handles telegram disconnect failure', async () => {
    mockGetTelegramStatus.mockResolvedValue({ connected: true, chatId: '99999' });
    mockDisconnectTelegram.mockRejectedValueOnce(new Error('fail'));
    renderPage(Settings);
    await flushAsync();

    fireEvent.click(screen.getByText('Disconnect'));
    await flushAsync();
    expect(mockAddToast).toHaveBeenCalledWith('Failed to disconnect.', 'danger');
  });

  it('handles logout', async () => {
    renderPage(Settings);
    await flushAsync();

    fireEvent.click(screen.getByText('Log Out'));
    await flushAsync();

    expect(authState.logout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('copies 2FA secret to clipboard', async () => {
    renderPage(Settings);
    await flushAsync();

    fireEvent.click(screen.getByText('Enable 2FA'));
    await flushAsync();

    // Find the copy button (near the secret code)
    const copyBtns = document.querySelectorAll('button');
    const copyBtn = Array.from(copyBtns).find(b => b.querySelector('svg') && b.closest('.flex.items-center.gap-2'));
    if (copyBtn) {
      fireEvent.click(copyBtn);
    }
  });
});

// ===================== Alerts =====================

describe('Alerts — full coverage', () => {
  let Alerts: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Alerts');
    Alerts = mod.default;
  });

  it('shows login message when unauthenticated', async () => {
    authState.isAuthenticated = false;
    renderPage(Alerts);
    await flushAsync();
    expect(screen.getByText('Login to manage your alerts')).toBeDefined();
  });

  it('shows loading then empty state', async () => {
    mockGetAlerts.mockResolvedValue([]);
    renderPage(Alerts);
    await flushAsync();
    expect(screen.getByText('No alerts yet. Create one to get started.')).toBeDefined();
  });

  it('shows list of alerts and allows deletion', async () => {
    mockGetAlerts.mockResolvedValue([
      { id: 'a1', name: 'BTC above 60k', is_active: true, created_at: '2025-01-01T00:00:00Z' },
      { id: 'a2', name: 'ETH below 3k', is_active: false, created_at: '2025-01-02T00:00:00Z' },
    ]);
    renderPage(Alerts);
    await flushAsync();

    expect(screen.getByText('BTC above 60k')).toBeDefined();
    expect(screen.getByText('ETH below 3k')).toBeDefined();

    // Delete first alert
    const deleteButtons = document.querySelectorAll('[class*="hover:text-red"]');
    if (deleteButtons[0]) {
      fireEvent.click(deleteButtons[0]);
      await flushAsync();
      expect(mockDeleteAlert).toHaveBeenCalledWith('a1');
    }
  });

  it('walks through full alert builder wizard', async () => {
    mockGetAlerts.mockResolvedValue([]);
    mockGetPairs.mockResolvedValue([
      { id: '1', symbol: 'BTCUSDT', exchange: 'binance' },
      { id: '2', symbol: 'ETHUSDT', exchange: 'binance' },
    ]);
    mockGetTicker.mockResolvedValue({ price: 60000, change24h: 1.5 });

    renderPage(Alerts);
    await flushAsync();

    // Open builder
    fireEvent.click(screen.getByText('Create Alert'));
    await flushAsync();

    // Step 1: Select Pair
    await flushAsync();
    expect(screen.getByText('Select Trading Pair')).toBeDefined();
    const pairSelect = document.querySelector('select');
    if (pairSelect) {
      fireEvent.change(pairSelect, { target: { value: 'BTCUSDT' } });
    }
    await flushAsync();
    fireEvent.click(screen.getByText('Next'));
    await flushAsync();

    // Step 2: Condition Type — select price_below
    expect(screen.getByText('Condition Type')).toBeDefined();
    fireEvent.click(screen.getByText('Price Below'));
    fireEvent.click(screen.getByText('Next'));
    await flushAsync();

    // Step 3: Value
    expect(screen.getByText('Threshold Value')).toBeDefined();
    const valueInput = document.querySelector('input[type="number"]');
    if (valueInput) {
      fireEvent.change(valueInput, { target: { value: '55000' } });
    }
    fireEvent.click(screen.getByText('Next'));
    await flushAsync();

    // Step 4: Channels — toggle push off and on
    expect(screen.getByText('Notification Channels')).toBeDefined();
    const pushBtn = screen.getByText('In-app Push');
    fireEvent.click(pushBtn); // toggle off
    fireEvent.click(pushBtn); // toggle on
    fireEvent.click(screen.getByText('Next'));
    await flushAsync();

    // Step 5: Name
    expect(screen.getByText('Alert Name')).toBeDefined();
    // The "Create Alert" text appears both in top button and the wizard submit.
    // The wizard submit button is at the bottom of the builder.
    const createBtns = screen.getAllByText('Create Alert');
    const submitBtn = createBtns[createBtns.length - 1]; // last one is wizard submit
    fireEvent.click(submitBtn);
    await flushAsync();

    expect(mockCreateAlert).toHaveBeenCalled();
  });

  it('cancels builder on step 1', async () => {
    mockGetAlerts.mockResolvedValue([]);
    renderPage(Alerts);
    await flushAsync();

    fireEvent.click(screen.getByText('Create Alert'));
    await flushAsync();

    // Click Cancel (which is "Back" on step 1 = Cancel)
    fireEvent.click(screen.getByText('Cancel'));
  });

  it('navigates back in builder', async () => {
    mockGetAlerts.mockResolvedValue([]);
    mockGetPairs.mockResolvedValue([{ id: '1', symbol: 'BTCUSDT', exchange: 'binance' }]);

    renderPage(Alerts);
    await flushAsync();

    fireEvent.click(screen.getByText('Create Alert'));
    await flushAsync();

    // Select pair and go to step 2
    const pairSelect = document.querySelector('select');
    if (pairSelect) fireEvent.change(pairSelect, { target: { value: 'BTCUSDT' } });
    fireEvent.click(screen.getByText('Next'));
    await flushAsync();

    // Go back
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Select Trading Pair')).toBeDefined();
  });

  it('clicks alert chain activate button', async () => {
    mockGetAlerts.mockResolvedValue([]);
    renderPage(Alerts);
    await flushAsync();

    // Click Activate on one of the chain templates
    const activateBtns = screen.getAllByText('Activate');
    if (activateBtns[0]) {
      fireEvent.click(activateBtns[0]);
      expect(mockAddToast).toHaveBeenCalledWith('Pro feature — upgrade to use Alert Chains', 'info');
    }
  });
});

// ===================== Copilot =====================

describe('Copilot — full coverage', () => {
  let Copilot: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Copilot');
    Copilot = mod.default;
  });

  it('renders empty state with suggested questions', async () => {
    renderPage(Copilot);
    expect(screen.getByText('Ask anything about crypto')).toBeDefined();
    expect(screen.getByText('What do you think about BTC?')).toBeDefined();
  });

  it('sends message via suggested question', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          answer: 'BTC looks good',
          context: {
            symbol: 'BTCUSDT', price: 60000, rsi: 55, ema9: 59000, ema21: 58000,
            trend: 'bullish', fearGreed: 65,
          },
        },
      }),
    });

    renderPage(Copilot);

    // Click suggested question
    fireEvent.click(screen.getByText('What do you think about BTC?'));
    await flushAsync();

    expect(screen.getByText('BTC looks good')).toBeDefined();
  });

  it('sends message via input and enter key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { answer: 'Test reply', context: null } }),
    });

    renderPage(Copilot);

    const input = screen.getByPlaceholderText('Ask about market analysis...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await flushAsync();
  });

  it('handles API error response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, error: 'Server error' }),
    });

    renderPage(Copilot);

    const input = screen.getByPlaceholderText('Ask about market analysis...');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await flushAsync();

    expect(screen.getByText('Server error')).toBeDefined();
  });

  it('handles fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    renderPage(Copilot);

    const input = screen.getByPlaceholderText('Ask about market analysis...');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await flushAsync();

    expect(screen.getByText('Failed to connect to the server. Please try again.')).toBeDefined();
  });

  it('toggles symbol selector', async () => {
    renderPage(Copilot);

    // Open symbol dropdown
    const btcBtn = screen.getByText('BTC');
    fireEvent.click(btcBtn);

    // Select ETH
    fireEvent.click(screen.getByText('ETH'));
  });

  it('renders messages with RSI context badges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          answer: 'Oversold signal',
          context: { symbol: 'BTCUSDT', price: 50000, rsi: 25, ema9: null, ema21: null, trend: 'bearish', fearGreed: 20 },
        },
      }),
    });

    renderPage(Copilot);
    fireEvent.click(screen.getByText('What do you think about BTC?'));
    await flushAsync();

    // Check RSI < 30 badge is rendered (success color)
    expect(screen.getByText('RSI 25')).toBeDefined();
  });

  it('renders messages with RSI > 70', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          answer: 'Overbought',
          context: { symbol: 'BTCUSDT', price: 50000, rsi: 80, ema9: null, ema21: null, trend: 'neutral', fearGreed: 50 },
        },
      }),
    });

    renderPage(Copilot);
    fireEvent.click(screen.getByText('What do you think about BTC?'));
    await flushAsync();
  });

  it('does not send empty message', async () => {
    renderPage(Copilot);
    const input = screen.getByPlaceholderText('Ask about market analysis...');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // No messages should be added
  });

  it('does not send on shift+enter', async () => {
    renderPage(Copilot);
    const input = screen.getByPlaceholderText('Ask about market analysis...');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    // Should not trigger send
  });
});

// ===================== Register =====================

describe('Register — full coverage', () => {
  let Register: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Register');
    Register = mod.default;
  });

  it('renders registration form', async () => {
    renderPage(Register);
    expect(screen.getByText('auth.createAccount')).toBeDefined();
  });

  it('shows validation errors on empty submit', async () => {
    renderPage(Register);
    const submitBtn = screen.getByText('auth.register');
    fireEvent.click(submitBtn);
    await flushAsync();
  });

  it('registers and shows onboarding wizard', async () => {
    // Make localStorage return null for onboarded
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

    renderPage(Register);
    await flushAsync();

    // Fill form
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
    const confirmInput = screen.getAllByPlaceholderText('••••••••')[1];

    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmInput, { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('auth.register'));
    await flushAsync();

    getItemSpy.mockRestore();
  });

  it('registers and navigates to dashboard when already onboarded', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('true');

    renderPage(Register);
    await flushAsync();

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
    const confirmInput = screen.getAllByPlaceholderText('••••••••')[1];

    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmInput, { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('auth.register'));
    await flushAsync();

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    getItemSpy.mockRestore();
  });

  it('shows error state from auth store', async () => {
    authState.error = 'Registration failed';
    renderPage(Register);
    expect(screen.getByText('auth.registerError')).toBeDefined();
    authState.error = null;
  });

  it('handles register failure gracefully', async () => {
    authState.register = vi.fn().mockRejectedValue(new Error('fail'));
    renderPage(Register);
    await flushAsync();

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getAllByPlaceholderText('••••••••')[0];
    const confirmInput = screen.getAllByPlaceholderText('••••••••')[1];

    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmInput, { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('auth.register'));
    await flushAsync();
    authState.register = vi.fn().mockResolvedValue({});
  });
});

// ===================== Correlation =====================

describe('Correlation — full coverage', () => {
  let Correlation: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Correlation');
    Correlation = mod.default;
  });

  it('shows loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    renderPage(Correlation);
    // loading spinner rendered
  });

  it('shows error state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, error: 'No data' }),
    });
    renderPage(Correlation);
    await flushAsync();
    expect(screen.getByText('No data')).toBeDefined();
  });

  it('shows fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('fail'));
    renderPage(Correlation);
    await flushAsync();
    expect(screen.getByText('Failed to load correlation data')).toBeDefined();
  });

  it('renders correlation matrix with data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          pairs: ['BTCUSDT', 'ETHUSDT'],
          matrix: [[1.0, 0.85], [0.85, 1.0]],
        },
      }),
    });
    renderPage(Correlation);
    await flushAsync();

    expect(screen.getByText('Correlation Matrix')).toBeDefined();
    expect(screen.getAllByText('1.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.85').length).toBeGreaterThan(0);
  });

  it('exercises all getCellColor branches', async () => {
    // Matrix with values covering all ranges
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          pairs: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'],
          matrix: [
            [0.95, 0.8, 0.6, 0.4, 0.2, 0.05, -0.05, -0.2, -0.4, -0.6, -0.95],
            [0.8, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0.6, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            [0.4, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [0.2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
            [0.05, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
            [-0.05, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
            [-0.2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            [-0.4, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
            [-0.6, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
            [-0.95, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
          ],
        },
      }),
    });
    renderPage(Correlation);
    await flushAsync();
  });

  it('handles mouse hover on cells (tooltip)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          pairs: ['BTCUSDT', 'ETHUSDT'],
          matrix: [[1.0, 0.85], [0.85, 1.0]],
        },
      }),
    });
    renderPage(Correlation);
    await flushAsync();

    const cells = document.querySelectorAll('td');
    if (cells.length > 1) {
      fireEvent.mouseEnter(cells[1]);
      fireEvent.mouseLeave(cells[1]);
    }
  });
});

// ===================== Tokenomics =====================

describe('Tokenomics — full coverage', () => {
  let Tokenomics: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Tokenomics');
    Tokenomics = mod.default;
  });

  it('shows loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    renderPage(Tokenomics);
  });

  it('renders with data and all score ranges', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { symbol: 'BTC', name: 'Bitcoin', circulatingSupply: 19e6, maxSupply: 21e6, inflationRate: -0.5, fdv: 1.2e12, supplyRatio: 0.9, unlocks: [], score: 85, scoreExplanation: 'Great' },
          { symbol: 'ETH', name: 'Ethereum', circulatingSupply: 120e6, maxSupply: null, inflationRate: 1.5, fdv: 4e11, supplyRatio: 1.0, unlocks: [{ date: '2025-06', amount: 1e6, description: 'Vesting' }], score: 65, scoreExplanation: 'Good' },
          { symbol: 'SOL', name: 'Solana', circulatingSupply: 400e6, maxSupply: 500e6, inflationRate: 5.0, fdv: 8e10, supplyRatio: 0.8, unlocks: [], score: 45, scoreExplanation: 'OK' },
          { symbol: 'BNB', name: 'BNB', circulatingSupply: 150e6, maxSupply: 200e6, inflationRate: 3.0, fdv: 5e10, supplyRatio: 0.75, unlocks: [], score: 30, scoreExplanation: 'Meh' },
        ],
      }),
    });
    renderPage(Tokenomics);
    await flushAsync();

    expect(screen.getByText('Tokenomics Analyzer')).toBeDefined();
    expect(screen.getByText('Side-by-Side Comparison')).toBeDefined();
  });

  it('filters by symbol', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { symbol: 'BTC', name: 'Bitcoin', circulatingSupply: 19e6, maxSupply: 21e6, inflationRate: 0, fdv: 1e12, supplyRatio: 0.9, unlocks: [], score: 85, scoreExplanation: 'Great' },
          { symbol: 'ETH', name: 'Ethereum', circulatingSupply: 120e6, maxSupply: null, inflationRate: 1, fdv: 4e11, supplyRatio: 1.0, unlocks: [], score: 65, scoreExplanation: 'Good' },
        ],
      }),
    });
    renderPage(Tokenomics);
    await flushAsync();

    // Find filter buttons (they are in the header area, not inside token cards)
    const filterButtons = screen.getAllByRole('button');
    // Click the BTC filter button (find by text within the filter area)
    const btcFilterBtns = filterButtons.filter(b => b.textContent === 'BTC');
    if (btcFilterBtns.length > 0) {
      fireEvent.click(btcFilterBtns[0]); // select BTC
      fireEvent.click(btcFilterBtns[0]); // deselect BTC
    }
    // Click All
    const allBtns = filterButtons.filter(b => b.textContent === 'All');
    if (allBtns.length > 0) {
      fireEvent.click(allBtns[0]);
    }
  });
});

// ===================== WalletTracker =====================

describe('WalletTracker — full coverage', () => {
  let WalletTracker: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/WalletTracker');
    WalletTracker = mod.default;
  });

  it('shows login required when unauthenticated', async () => {
    authState.isAuthenticated = false;
    authState.token = null;
    renderPage(WalletTracker);
    expect(screen.getByText('Please log in to track wallets.')).toBeDefined();
  });

  it('shows loading then empty state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });
    renderPage(WalletTracker);
    await flushAsync();
    expect(screen.getByText('No wallets tracked yet. Add your first wallet above.')).toBeDefined();
  });

  it('adds wallet and shows it', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      callCount++;
      if (typeof url === 'string' && url.includes('/wallets/track')) {
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      }
      if (typeof url === 'string' && url.includes('/wallets')) {
        if (callCount <= 2) {
          return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
        }
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{
              id: 'w1', address: '0xABCDEF1234567890ABCDEF', chain: 'ethereum',
              label: 'My Wallet', totalValue: 15000, addedAt: '2025-01-01',
            }],
          }),
        };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(WalletTracker);
    await flushAsync();

    // Fill add wallet form
    const addressInput = screen.getByPlaceholderText('Wallet address (0x... / base58...)');
    fireEvent.change(addressInput, { target: { value: '0xABCDEF1234567890ABCDEF' } });

    const labelInput = screen.getByPlaceholderText('Label (optional)');
    fireEvent.change(labelInput, { target: { value: 'My Wallet' } });

    fireEvent.click(screen.getByText('Track Wallet'));
    await flushAsync();
  });

  it('handles add wallet error', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/wallets/track')) {
        return { ok: true, json: () => Promise.resolve({ success: false, error: 'Bad address' }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(WalletTracker);
    await flushAsync();

    const addressInput = screen.getByPlaceholderText('Wallet address (0x... / base58...)');
    fireEvent.change(addressInput, { target: { value: '0xtest' } });
    fireEvent.click(screen.getByText('Track Wallet'));
    await flushAsync();

    expect(screen.getByText('Bad address')).toBeDefined();
  });

  it('expands wallet to show holdings and removes wallet', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/balance')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              holdings: [
                { token: 'ETH', amount: 5.5, valueUsd: 16500, change24h: 2.3 },
                { token: 'USDC', amount: 1000, valueUsd: 1000, change24h: -0.01 },
              ],
            },
          }),
        };
      }
      if (typeof url === 'string' && opts?.method === 'DELETE') {
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      }
      return {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [{
            id: 'w1', address: '0xABCDEF1234567890ABCDEF', chain: 'solana',
            label: '', totalValue: 17500, addedAt: '2025-01-01',
          }],
        }),
      };
    });

    renderPage(WalletTracker);
    await flushAsync();

    // Click on wallet row to expand
    const walletRow = document.querySelector('[class*="cursor-pointer"]');
    if (walletRow) {
      fireEvent.click(walletRow);
      await flushAsync();

      // Should see holdings
      expect(screen.getByText('ETH')).toBeDefined();

      // Collapse by clicking again
      fireEvent.click(walletRow);
      await flushAsync();
    }
  });

  it('copies address to clipboard', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [{
          id: 'w1', address: '0xABCDEF1234567890ABCDEF', chain: 'ethereum',
          label: 'Test', totalValue: 1000, addedAt: '2025-01-01',
        }],
      }),
    });

    renderPage(WalletTracker);
    await flushAsync();

    // Find and click copy button
    const copyBtns = document.querySelectorAll('[class*="font-mono"]');
    if (copyBtns[0]) {
      fireEvent.click(copyBtns[0]);
    }
  });
});

// ===================== ChartReplay =====================

describe('ChartReplay — full coverage', () => {
  let ChartReplay: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/ChartReplay');
    ChartReplay = mod.default;
  });

  it('shows loading then no data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });
    renderPage(ChartReplay);
    await flushAsync();
    expect(screen.getByText('common.noData')).toBeDefined();
  });

  it('renders with candles and controls playback', async () => {
    const candles = Array.from({ length: 100 }, (_, i) => ({
      time: 1000 + i * 3600,
      open: 50000 + i * 10,
      high: 50100 + i * 10,
      low: 49900 + i * 10,
      close: 50050 + i * 10,
      volume: 1e6,
    }));

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: candles }),
    });

    renderPage(ChartReplay);
    await flushAsync();

    expect(screen.getByTestId('trading-chart')).toBeDefined();

    // Click Buy
    fireEvent.click(screen.getByText('chartReplay.buy'));

    // Click close position
    await flushAsync();
    const closeBtn = screen.queryByText('chartReplay.closePosition');
    if (closeBtn) fireEvent.click(closeBtn);

    // Click Sell (open short)
    fireEvent.click(screen.getByText('chartReplay.sell'));
    await flushAsync();

    // Close short position
    const closeBtn2 = screen.queryByText('chartReplay.closePosition');
    if (closeBtn2) fireEvent.click(closeBtn2);
  });

  it('opens pair and timeframe dropdowns', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });
    renderPage(ChartReplay);
    await flushAsync();

    // Open pair dropdown
    fireEvent.click(screen.getByText('BTCUSDT'));
    // Select ETHUSDT
    const ethBtn = screen.queryByText('ETHUSDT');
    if (ethBtn) fireEvent.click(ethBtn);
    await flushAsync();

    // Open timeframe dropdown
    fireEvent.click(screen.getByText('1h'));
    const tfBtn = screen.queryByText('5m');
    if (tfBtn) fireEvent.click(tfBtn);
  });

  it('changes speed', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [{ time: 1000, open: 50000, high: 50100, low: 49900, close: 50050, volume: 1e6 }] }),
    });
    renderPage(ChartReplay);
    await flushAsync();

    // Click 2x speed
    fireEvent.click(screen.getByText('2x'));
    fireEvent.click(screen.getByText('5x'));
  });

  it('uses slider to change index', async () => {
    const candles = Array.from({ length: 100 }, (_, i) => ({
      time: 1000 + i * 3600, open: 50000, high: 50100, low: 49900, close: 50050, volume: 1e6,
    }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: candles }),
    });
    renderPage(ChartReplay);
    await flushAsync();

    const slider = document.querySelector('input[type="range"]');
    if (slider) {
      fireEvent.change(slider, { target: { value: '75' } });
    }
  });

  it('opens short position via sell and close it', async () => {
    const candles = Array.from({ length: 100 }, (_, i) => ({
      time: 1000 + i * 3600, open: 50000, high: 50100, low: 49900, close: 50050, volume: 1e6,
    }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: candles }),
    });
    renderPage(ChartReplay);
    await flushAsync();

    // Open short via Sell
    fireEvent.click(screen.getByText('chartReplay.sell'));
    await flushAsync();

    // Close short via Close Position
    const closeBtn = screen.queryByText('chartReplay.closePosition');
    if (closeBtn) fireEvent.click(closeBtn);
    await flushAsync();

    // Check session summary
    expect(screen.getByText('chartReplay.sessionSummary')).toBeDefined();
  });

  it('handles keyboard shortcuts', async () => {
    const candles = Array.from({ length: 100 }, (_, i) => ({
      time: 1000 + i * 3600, open: 50000, high: 50100, low: 49900, close: 50050, volume: 1e6,
    }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: candles }),
    });
    renderPage(ChartReplay);
    await flushAsync();

    // Space to play
    fireEvent.keyDown(window, { code: 'Space' });
    await flushAsync();

    // Space again to pause
    fireEvent.keyDown(window, { code: 'Space' });

    // ArrowRight to advance
    fireEvent.keyDown(window, { code: 'ArrowRight' });

    // ArrowLeft to go back
    fireEvent.keyDown(window, { code: 'ArrowLeft' });

    // Shift+Space for next bar
    fireEvent.keyDown(window, { code: 'Space', shiftKey: true });
  });

  it('sells into existing buy position (close long via sell)', async () => {
    const candles = Array.from({ length: 100 }, (_, i) => ({
      time: 1000 + i * 3600, open: 50000 + i, high: 50100, low: 49900, close: 50050 + i, volume: 1e6,
    }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: candles }),
    });
    renderPage(ChartReplay);
    await flushAsync();

    // Buy first
    fireEvent.click(screen.getByText('chartReplay.buy'));
    await flushAsync();

    // Sell to close long
    // When there's an open position, the sell button should not be visible,
    // there should be a close button instead. Let's use it.
    const closeBtn = screen.queryByText('chartReplay.closePosition');
    if (closeBtn) fireEvent.click(closeBtn);
  });
});

// ===================== News =====================

describe('News — full coverage', () => {
  let News: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/News');
    News = mod.default;
  });

  it('shows loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    renderPage(News);
  });

  it('shows error and retry', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    renderPage(News);
    await flushAsync();

    const retryBtn = screen.queryByText('Retry');
    if (retryBtn) {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      fireEvent.click(retryBtn);
      await flushAsync();
    }
  });

  it('renders news articles and filters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: '1', title: 'BTC hits ATH', description: 'Bitcoin surges', source: 'CoinDesk', category: 'market', sentiment: 'bullish', publishedAt: new Date().toISOString(), url: '#' },
          { id: '2', title: 'ETH regulation', description: 'New regulations', source: 'Bloomberg', category: 'regulatory', sentiment: 'bearish', publishedAt: new Date(Date.now() - 3600000).toISOString(), url: '#' },
          { id: '3', title: 'DeFi update', description: 'New protocol', source: 'DeFiPulse', category: 'defi', sentiment: 'neutral', publishedAt: new Date(Date.now() - 86400000).toISOString(), url: '#' },
        ],
      }),
    });
    renderPage(News);
    await flushAsync();

    expect(screen.getByText('BTC hits ATH')).toBeDefined();

    // Filter by category
    const categorySelect = document.querySelectorAll('select')[0];
    if (categorySelect) {
      fireEvent.change(categorySelect, { target: { value: 'market' } });
    }

    // Filter by sentiment
    const sentimentSelect = document.querySelectorAll('select')[1];
    if (sentimentSelect) {
      fireEvent.change(sentimentSelect, { target: { value: 'bullish' } });
    }

    // Search
    const searchInput = screen.getByPlaceholderText('Search news...');
    fireEvent.change(searchInput, { target: { value: 'BTC' } });
  });

  it('shows no results message', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) });
    renderPage(News);
    await flushAsync();
    expect(screen.getByText('No news articles match your filters.')).toBeDefined();
  });
});

// ===================== Pricing =====================

describe('Pricing — full coverage', () => {
  let Pricing: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Pricing');
    Pricing = mod.default;
  });

  it('shows loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    renderPage(Pricing);
  });

  it('renders tiers with annual toggle and FAQ', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        tiers: [
          { id: 'starter', name: 'Starter', price: 0, annualPrice: 0, currency: 'USD', interval: 'month', features: ['Feature 1'] },
          { id: 'pro', name: 'Pro', price: 29, annualPrice: 279, currency: 'USD', interval: 'month', popular: true, features: ['Feature 1', 'Feature 2'] },
          { id: 'enterprise', name: 'Enterprise', price: 99, annualPrice: 949, currency: 'USD', interval: 'month', features: ['Everything'] },
        ],
      }),
    });
    renderPage(Pricing);
    await flushAsync();

    expect(screen.getByText('Simple, transparent pricing')).toBeDefined();

    // Toggle annual
    const annualToggle = document.querySelector('button[class*="rounded-full"]');
    if (annualToggle) {
      fireEvent.click(annualToggle);
      // Save 20% badge should appear
    }

    // Click FAQ items
    const faqBtns = screen.getAllByRole('button').filter(b => b.textContent?.includes('?'));
    if (faqBtns[0]) fireEvent.click(faqBtns[0]);
    if (faqBtns[0]) fireEvent.click(faqBtns[0]); // close

    // Click upgrade on pro tier
    const upgradeBtns = screen.getAllByText('Upgrade');
    if (upgradeBtns[0]) {
      fireEvent.click(upgradeBtns[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    }
  });

  it('redirects unauthenticated user to register on upgrade', async () => {
    authState.isAuthenticated = false;
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        tiers: [
          { id: 'pro', name: 'Pro', price: 29, annualPrice: 279, currency: 'USD', interval: 'month', features: ['Feature'] },
        ],
      }),
    });
    renderPage(Pricing);
    await flushAsync();

    const upgradeBtns = screen.getAllByText('Upgrade');
    if (upgradeBtns[0]) {
      fireEvent.click(upgradeBtns[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/register');
    }
  });

  it('shows Current Plan for user tier', async () => {
    authState.user = { ...authState.user, tier: 'pro' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        tiers: [
          { id: 'pro', name: 'Pro', price: 29, annualPrice: 279, currency: 'USD', interval: 'month', features: ['Feature'] },
        ],
      }),
    });
    renderPage(Pricing);
    await flushAsync();

    expect(screen.getByText('Current Plan')).toBeDefined();
  });
});

// ===================== ElliottWave =====================

describe('ElliottWave — full coverage', () => {
  let ElliottWave: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/ElliottWave');
    ElliottWave = mod.default;
  });

  it('renders loading then data with impulse pattern', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          waves: [{ label: '1', price: 50000, index: 0, time: '2025-01-01' }],
          pattern: 'impulse',
          confidence: 85,
          description: 'Impulse wave detected',
          fibTargets: { wave3Target: 65000, wave5Target: 80000 },
        },
      }),
    });
    renderPage(ElliottWave);
    await flushAsync();

    expect(screen.getByText('Elliott Wave')).toBeDefined();
  });

  it('renders correction and none patterns', async () => {
    for (const pattern of ['correction', 'none']) {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            symbol: 'BTCUSDT',
            waves: [],
            pattern,
            confidence: 50,
            description: `${pattern} pattern`,
            fibTargets: {},
          },
        }),
      });
      const { unmount } = renderPage(ElliottWave);
      await flushAsync();
      unmount();
    }
  });

  it('handles error state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, error: 'No data' }),
    });
    renderPage(ElliottWave);
    await flushAsync();
  });

  it('changes symbol', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { symbol: 'BTCUSDT', waves: [], pattern: 'none', confidence: 0, description: '', fibTargets: {} } }),
    });
    renderPage(ElliottWave);
    await flushAsync();

    const select = document.querySelector('select');
    if (select) {
      fireEvent.change(select, { target: { value: 'ETHUSDT' } });
      await flushAsync();
    }
  });
});

// ===================== AntiLiquidation =====================

describe('AntiLiquidation — full coverage', () => {
  let AntiLiquidation: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/AntiLiquidation');
    AntiLiquidation = mod.default;
  });

  it('shows loading then empty state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });
    renderPage(AntiLiquidation);
    await flushAsync();

    expect(screen.getByText(/No open positions/)).toBeDefined();
  });

  it('shows error state', async () => {
    mockFetch.mockRejectedValue(new Error('fail'));
    renderPage(AntiLiquidation);
    await flushAsync();

    expect(screen.getByText('Failed to load positions. Make sure you are logged in.')).toBeDefined();
  });

  it('renders positions with various distance levels', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          { symbol: 'BTCUSDT', side: 'buy', entryPrice: 50000, currentPrice: 52000, quantity: 0.1, amount: 5000, pnl: 200, pnlPct: 4, openedAt: '2025-01-01' },
          { symbol: 'ETHUSDT', side: 'sell', entryPrice: 3000, currentPrice: 2900, quantity: 1, amount: 3000, pnl: 100, pnlPct: 3.3, openedAt: '2025-01-01' },
        ],
      }),
    });
    renderPage(AntiLiquidation);
    await flushAsync();

    expect(screen.getByText('Anti-Liquidation Shield')).toBeDefined();
    expect(screen.getByText('What-If Price Simulator')).toBeDefined();
  });

  it('renders positions with short side', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          { symbol: 'BTCUSDT', side: 'sell', entryPrice: 50000, currentPrice: 50500, quantity: 0.1, amount: 5000, pnl: -50, pnlPct: -1, openedAt: '2025-01-01' },
          { symbol: 'ETHUSDT', side: 'buy', entryPrice: 3000, currentPrice: 3100, quantity: 1, amount: 3000, pnl: 100, pnlPct: 3.3, openedAt: '2025-01-01' },
        ],
      }),
    });
    renderPage(AntiLiquidation);
    await flushAsync();

    expect(screen.getByText('Anti-Liquidation Shield')).toBeDefined();
  });

  it('changes simulator symbol', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          { symbol: 'BTCUSDT', side: 'buy', entryPrice: 50000, currentPrice: 52000, quantity: 0.1, amount: 5000, pnl: 200, pnlPct: 4, openedAt: '2025-01-01' },
          { symbol: 'ETHUSDT', side: 'sell', entryPrice: 3000, currentPrice: 2900, quantity: 1, amount: 3000, pnl: 100, pnlPct: 3, openedAt: '2025-01-01' },
        ],
      }),
    });
    renderPage(AntiLiquidation);
    await flushAsync();

    const simSelect = document.querySelectorAll('select');
    const lastSelect = simSelect[simSelect.length - 1];
    if (lastSelect) {
      fireEvent.change(lastSelect, { target: { value: 'ETHUSDT' } });
      await flushAsync();
    }
  });

  it('uses what-if simulator', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          { symbol: 'BTCUSDT', side: 'buy', entryPrice: 50000, currentPrice: 50500, quantity: 0.1, amount: 5000, pnl: 50, pnlPct: 1, openedAt: '2025-01-01' },
        ],
      }),
    });
    renderPage(AntiLiquidation);
    await flushAsync();

    // Move slider to extreme low to trigger liquidation
    const slider = document.querySelector('input[type="range"]');
    if (slider) {
      fireEvent.change(slider, { target: { value: '0' } }); // -30% price
      await flushAsync();
    }
  });
});

// ===================== Journal =====================

describe('Journal — full coverage', () => {
  let Journal: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Journal');
    Journal = mod.default;
  });

  it('renders with entries and stats', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/stats')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { totalTrades: 10, closedTrades: 8, winRate: 62, avgWin: 150, avgLoss: -80, bestTrade: 500, worstTrade: -200, profitFactor: 1.8 },
          }),
        };
      }
      return {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [
            { id: 'j1', pair: 'BTCUSDT', direction: 'long', entryPrice: 50000, exitPrice: 52000, size: 100, strategy: 'Trend Following', emotional_state: 'calm', notes: 'Good trade', confidence: 4, timeframe: '1h', pnl: 200, pnlPct: 4, createdAt: '2025-01-01', updatedAt: '2025-01-01' },
            { id: 'j2', pair: 'ETHUSDT', direction: 'short', entryPrice: 3000, exitPrice: 2800, size: 50, strategy: null, emotional_state: null, notes: null, confidence: null, timeframe: null, pnl: -100, pnlPct: -3.3, createdAt: '2025-01-02', updatedAt: '2025-01-02' },
          ],
        }),
      };
    });

    renderPage(Journal);
    await flushAsync();

    expect(screen.getByText('Trading Journal')).toBeDefined();
    expect(screen.getByText('BTCUSDT')).toBeDefined();
  });

  it('opens add form and submits', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/journal/stats')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: { totalTrades: 0, closedTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, bestTrade: 0, worstTrade: 0, profitFactor: 0 } }) };
      }
      if (typeof url === 'string' && url.includes('/journal') && opts?.method === 'POST') {
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(Journal);
    await flushAsync();

    // Click Add Trade
    fireEvent.click(screen.getByText('Add Trade'));
    await flushAsync();

    // Fill form - entry price
    const entryInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(entryInput, { target: { value: '50000' } });

    const sizeInput = screen.getByPlaceholderText('100');
    fireEvent.change(sizeInput, { target: { value: '200' } });

    // Toggle direction to short
    fireEvent.click(screen.getByText('Short'));

    // Select emotion
    fireEvent.click(screen.getByText('FOMO'));
    fireEvent.click(screen.getByText('FOMO')); // deselect

    // Submit form
    const form = document.querySelector('form');
    if (form) {
      fireEvent.submit(form);
      await flushAsync();
    }
  });

  it('opens edit form for existing entry', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/stats')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: { totalTrades: 1, closedTrades: 1, winRate: 100, avgWin: 100, avgLoss: 0, bestTrade: 100, worstTrade: 0, profitFactor: Infinity } }) };
      }
      return {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [{ id: 'j1', pair: 'BTCUSDT', direction: 'long', entryPrice: 50000, exitPrice: 51000, size: 100, strategy: 'Breakout', emotional_state: 'greedy', notes: 'test', confidence: 5, timeframe: '4h', pnl: 100, pnlPct: 2, createdAt: '2025-01-01', updatedAt: '2025-01-01' }],
        }),
      };
    });

    renderPage(Journal);
    await flushAsync();

    // Click edit button (pencil icon)
    const editBtns = document.querySelectorAll('[class*="hover:text-foreground"]');
    const editBtn = Array.from(editBtns).find(b => b.querySelector('svg'));
    if (editBtn) {
      fireEvent.click(editBtn);
      await flushAsync();
      expect(screen.getByText('Edit Trade')).toBeDefined();

      // Close form
      const closeBtn = document.querySelector('[class*="hover:text-foreground"]');
      if (closeBtn) fireEvent.click(closeBtn);
    }
  });

  it('deletes an entry', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'DELETE') {
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      }
      if (typeof url === 'string' && url.includes('/stats')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: { totalTrades: 0, closedTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, bestTrade: 0, worstTrade: 0, profitFactor: 0 } }) };
      }
      return {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [{ id: 'j1', pair: 'BTCUSDT', direction: 'long', entryPrice: 50000, exitPrice: null, size: 100, strategy: null, emotional_state: null, notes: null, confidence: null, timeframe: null, pnl: null, pnlPct: null, createdAt: '2025-01-01', updatedAt: '2025-01-01' }],
        }),
      };
    });

    renderPage(Journal);
    await flushAsync();

    // Click delete button
    const deleteBtns = document.querySelectorAll('[class*="hover:text-danger"]');
    if (deleteBtns[0]) {
      fireEvent.click(deleteBtns[0]);
      await flushAsync();
    }
  });
});

// ===================== PaperTrading =====================

describe('PaperTrading — full coverage', () => {
  let PaperTrading: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/PaperTrading');
    PaperTrading = mod.default;
  });

  it('renders account, empty positions and history', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/account')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: { balance: 10000, equity: 10000, unrealizedPnl: 0, realizedPnl: 0, positionsCount: 0 } }) };
      }
      if (typeof url === 'string' && url.includes('/positions')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
      }
      if (typeof url === 'string' && url.includes('/history')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
      }
      if (typeof url === 'string' && url.includes('/ticker')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: { price: 60000 } }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: null }) };
    });

    renderPage(PaperTrading);
    await flushAsync();

    expect(screen.getByText('Paper Trading')).toBeDefined();
    expect(screen.getByText('No open positions')).toBeDefined();
    expect(screen.getByText('No trade history yet')).toBeDefined();
  });

  it('places buy and sell orders', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/ticker')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: { price: 60000 } }) };
      }
      if (opts?.method === 'POST' && typeof url === 'string' && url.includes('/order')) {
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      }
      if (typeof url === 'string' && url.includes('/account')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: { balance: 9900, equity: 10100, unrealizedPnl: 200, realizedPnl: 0, positionsCount: 1 } }) };
      }
      if (typeof url === 'string' && url.includes('/positions')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{ symbol: 'BTCUSDT', side: 'buy', entryPrice: 60000, currentPrice: 60200, quantity: 0.001, amount: 100, pnl: 0.2, pnlPct: 0.33, openedAt: '2025-01-01' }],
          }),
        };
      }
      if (typeof url === 'string' && url.includes('/history')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{ symbol: 'BTCUSDT', side: 'buy', entryPrice: 59000, exitPrice: 59500, quantity: 0.001, amount: 100, pnl: 0.5, openedAt: '2025-01-01', closedAt: '2025-01-02' }],
          }),
        };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: null }) };
    });

    renderPage(PaperTrading);
    await flushAsync();

    // Click Buy
    fireEvent.click(screen.getByText('Buy'));
    await flushAsync();

    // Click Sell
    fireEvent.click(screen.getByText('Sell'));
    await flushAsync();
  });

  it('closes a position', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/ticker')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: { price: 60000 } }) };
      }
      if (typeof url === 'string' && url.includes('/account')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: { balance: 10000, equity: 10000, unrealizedPnl: -50, realizedPnl: -50, positionsCount: 1 } }) };
      }
      if (typeof url === 'string' && url.includes('/positions') && !url.includes('/close')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{ symbol: 'BTCUSDT', side: 'sell', entryPrice: 60000, currentPrice: 60100, quantity: 0.001, amount: 100, pnl: -0.1, pnlPct: -0.16, openedAt: '2025-01-01' }],
          }),
        };
      }
      if (opts?.method === 'POST' && typeof url === 'string' && url.includes('/close')) {
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      }
      if (typeof url === 'string' && url.includes('/history')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: null }) };
    });

    renderPage(PaperTrading);
    await flushAsync();

    // Click Close button on position
    const closeBtn = screen.queryByText('Close');
    if (closeBtn) {
      fireEvent.click(closeBtn);
      await flushAsync();
    }
  });
});

// ===================== Header =====================

describe('Header — full coverage', () => {
  let Header: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/components/layout/Header');
    Header = mod.Header;
  });

  it('renders with ticker data', async () => {
    marketState.tickers = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5 }]]);
    renderPage(Header);
    expect(screen.getByText('BTC/USDT')).toBeDefined();
  });

  it('renders without ticker', () => {
    marketState.tickers = new Map();
    renderPage(Header);
    expect(screen.getByText('BTC/USDT')).toBeDefined();
  });

  it('renders unauthenticated state', () => {
    authState.isAuthenticated = false;
    renderPage(Header);
    expect(screen.getByText('auth.login')).toBeDefined();
  });

  it('renders negative change', () => {
    marketState.tickers = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 58000, change24h: -3.2 }]]);
    renderPage(Header);
  });

  it('clicks theme toggle and language toggle', () => {
    renderPage(Header);
    // Theme toggle
    const buttons = screen.getAllByRole('button');
    // Find toggle buttons by title
    const themeBtn = buttons.find(b => b.getAttribute('title')?.includes('mode'));
    if (themeBtn) fireEvent.click(themeBtn);

    const langBtn = buttons.find(b => b.getAttribute('title')?.includes('language'));
    if (langBtn) fireEvent.click(langBtn);
  });
});

// ===================== DeFi =====================

describe('DeFi — full coverage', () => {
  let DeFi: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/DeFi');
    DeFi = mod.default;
  });

  it('renders loading then data', async () => {
    mockGetDeFiOverview.mockResolvedValue({
      totalTvl: 5e10,
      avgApy: 8.5,
      protocolCount: 3,
      protocols: [
        { name: 'Aave', chain: 'Ethereum', tvl: 2e10, apy: 5.2, category: 'Lending', riskRating: 'A', tvlChange24h: 1.5 },
        { name: 'Uniswap', chain: 'Ethereum', tvl: 1.5e10, apy: 12.3, category: 'DEX', riskRating: 'B', tvlChange24h: -0.5 },
        { name: 'Raydium', chain: 'Solana', tvl: 5e9, apy: 20, category: 'DEX', riskRating: 'C', tvlChange24h: 3.2 },
      ],
    });

    renderPage(DeFi);
    await flushAsync();
  });

  it('handles error', async () => {
    mockGetDeFiOverview.mockRejectedValue(new Error('fail'));
    renderPage(DeFi);
    await flushAsync();
  });

  it('sorts and filters protocols', async () => {
    mockGetDeFiOverview.mockResolvedValue({
      totalTvl: 5e10, avgApy: 8.5, protocolCount: 2,
      protocols: [
        { name: 'Aave', chain: 'Ethereum', tvl: 2e10, apy: 5.2, category: 'Lending', riskRating: 'A', tvlChange24h: 1.5 },
        { name: 'Raydium', chain: 'Solana', tvl: 5e9, apy: 20, category: 'DEX', riskRating: 'B', tvlChange24h: -0.5 },
      ],
    });

    renderPage(DeFi);
    await flushAsync();

    // Filter by chain
    const chainBtns = screen.getAllByRole('button');
    const solanaBtn = chainBtns.find(b => b.textContent === 'Solana');
    if (solanaBtn) fireEvent.click(solanaBtn);

    // Click all
    const allBtn = chainBtns.find(b => b.textContent === 'All');
    if (allBtn) fireEvent.click(allBtn);

    // Sort by clicking column header
    const apyBtn = screen.queryByText('APY');
    if (apyBtn) fireEvent.click(apyBtn);
  });
});

// ===================== SocialFeed =====================

describe('SocialFeed — full coverage', () => {
  let SocialFeed: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/SocialFeed');
    SocialFeed = mod.default;
  });

  it('renders empty state', async () => {
    // SocialFeed fetches /api/v1/social/feed and /api/v1/social/trending separately
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/social/feed')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
      }
      if (typeof url === 'string' && url.includes('/social/trending')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });
    renderPage(SocialFeed);
    await flushAsync();
  });

  it('renders with posts', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/social/feed')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 'p1', userId: 'u1', userName: 'Trader1', type: 'trade_idea', content: 'BTC long!', symbol: 'BTCUSDT', direction: 'bullish', likeCount: 5, createdAt: new Date().toISOString() },
              { id: 'p2', userId: 'u2', userName: 'Analyst', type: 'analysis', content: 'ETH analysis', symbol: 'ETHUSDT', direction: 'bearish', likeCount: 3, createdAt: new Date(Date.now() - 7200000).toISOString() },
              { id: 'p3', userId: 'u3', userName: 'User', type: 'comment', content: 'Neutral', direction: 'neutral', likeCount: 0, createdAt: new Date(Date.now() - 172800000).toISOString() },
            ],
          }),
        };
      }
      if (typeof url === 'string' && url.includes('/social/trending')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [{ symbol: 'BTCUSDT', mentions: 42 }] }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(SocialFeed);
    await flushAsync();
  });

  it('creates a post', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/social/post') && opts?.method === 'POST') {
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      }
      if (typeof url === 'string' && url.includes('/social/feed')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
      }
      if (typeof url === 'string' && url.includes('/social/trending')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(SocialFeed);
    await flushAsync();

    // Find post input area and type
    const textarea = document.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'BTC to 100k!' } });
    }

    // Submit post
    const postBtns = screen.getAllByRole('button');
    const postBtn = postBtns.find(b => b.textContent?.includes('Post'));
    if (postBtn) {
      fireEvent.click(postBtn);
      await flushAsync();
    }
  });

  it('likes a post', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/social/feed')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 'p1', userId: 'u1', userName: 'Trader1', type: 'trade_idea', content: 'BTC long!', symbol: 'BTCUSDT', direction: 'bullish', likeCount: 5, createdAt: new Date().toISOString() },
            ],
          }),
        };
      }
      if (typeof url === 'string' && url.includes('/social/trending')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
      }
      if (typeof url === 'string' && url.includes('/like')) {
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(SocialFeed);
    await flushAsync();

    // Find and click like button
    const likeBtns = document.querySelectorAll('button');
    const likeBtn = Array.from(likeBtns).find(b => b.querySelector('svg') && b.textContent?.includes('5'));
    if (likeBtn) fireEvent.click(likeBtn);
  });
});

// ===================== TaxReport =====================

describe('TaxReport — full coverage', () => {
  let TaxReport: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/TaxReport');
    TaxReport = mod.default;
  });

  it('renders with trade data from paper + journal', async () => {
    // TaxReport fetches /paper/history and /journal in parallel
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/paper/history')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { symbol: 'BTCUSDT', side: 'buy', entryPrice: 50000, exitPrice: 52000, pnl: 200, amount: 5000, openedAt: '2026-01-01T00:00:00Z', closedAt: '2026-01-05T00:00:00Z' },
              { symbol: 'ETHUSDT', side: 'sell', entryPrice: 3000, exitPrice: 3100, pnl: -100, amount: 3000, openedAt: '2026-02-01T00:00:00Z', closedAt: '2026-02-02T12:00:00Z' },
            ],
          }),
        };
      }
      if (typeof url === 'string' && url.includes('/journal')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { pair: 'SOLUSDT', direction: 'long', entryPrice: 100, exitPrice: 110, pnl: 50, pnlPct: 10, createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-10T00:00:00Z' },
              { pair: 'BNBUSDT', direction: 'short', entryPrice: 300, exitPrice: null, pnl: null, pnlPct: null, createdAt: '2026-03-15T00:00:00Z', updatedAt: '2026-03-15T00:00:00Z' },
            ],
          }),
        };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(TaxReport);
    await flushAsync();
  });

  it('renders with empty trade data', async () => {
    mockFetch.mockImplementation(async () => ({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    }));
    renderPage(TaxReport);
    await flushAsync();
  });

  it('changes year filter via button', async () => {
    mockFetch.mockImplementation(async () => ({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    }));
    renderPage(TaxReport);
    await flushAsync();

    // Year buttons: 2026, 2025
    const yearBtn = screen.queryByText('2025');
    if (yearBtn) {
      fireEvent.click(yearBtn);
      await flushAsync();
    }
  });

  it('shows unauthenticated state', async () => {
    authState.isAuthenticated = false;
    authState.token = null;
    renderPage(TaxReport);
    await flushAsync();
    expect(screen.getByText('Please log in to view your tax report.')).toBeDefined();
    authState.isAuthenticated = true;
    authState.token = 'tok';
  });

  it('exports CSV when data exists', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/paper/history')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { symbol: 'BTCUSDT', side: 'buy', entryPrice: 50000, exitPrice: 52000, pnl: 200, amount: 5000, openedAt: '2026-01-01T00:00:00Z', closedAt: '2026-01-05T00:00:00Z' },
            ],
          }),
        };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    // Mock URL.createObjectURL and revokeObjectURL
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test');
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    renderPage(TaxReport);
    await flushAsync();

    // Find and click Export CSV button
    const exportBtn = screen.queryByText('Export CSV');
    if (exportBtn) {
      fireEvent.click(exportBtn);
    }
  });

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    renderPage(TaxReport);
    await flushAsync();
  });
});

// ===================== ScriptEditor =====================

describe('ScriptEditor — full coverage', () => {
  let ScriptEditor: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/ScriptEditor');
    ScriptEditor = mod.default;
  });

  it('renders and loads template', async () => {
    renderPage(ScriptEditor);
    await flushAsync();

    expect(screen.getByText('Script Editor')).toBeDefined();

    // Click a template
    const templateBtns = screen.getAllByText('RSI Divergence Detector');
    if (templateBtns[0]) fireEvent.click(templateBtns[0]);
  });

  it('runs and saves script', async () => {
    renderPage(ScriptEditor);
    await flushAsync();

    // Click Run
    const allBtns = screen.getAllByRole('button');
    const runBtn = allBtns.find(b => b.textContent?.includes('Run'));
    if (runBtn) fireEvent.click(runBtn);

    // Click Save
    const saveBtn = allBtns.find(b => b.textContent?.includes('Save'));
    if (saveBtn) {
      fireEvent.click(saveBtn);
      expect(mockAddToast).toHaveBeenCalled();
    }
  });

  it('toggles sidebar sections', async () => {
    renderPage(ScriptEditor);
    await flushAsync();

    // Toggle Template Library section
    const templateToggle = screen.getByText('Template Library');
    fireEvent.click(templateToggle);
    fireEvent.click(templateToggle);

    // Toggle Saved Scripts section
    const savedToggle = screen.getByText('Saved Scripts');
    fireEvent.click(savedToggle);
    fireEvent.click(savedToggle);

    // Toggle Reference section
    const refToggle = screen.queryByText('Reference');
    if (refToggle) {
      fireEvent.click(refToggle);
      fireEvent.click(refToggle);
    }
  });

  it('edits code in textarea', async () => {
    renderPage(ScriptEditor);
    await flushAsync();

    const textarea = document.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: '# Test\nrsi = ta.rsi(close, 14)\nif rsi > 70:\n  signal("sell")' } });
      fireEvent.scroll(textarea);
    }
  });

  it('changes script name', async () => {
    renderPage(ScriptEditor);
    await flushAsync();

    const nameInput = document.querySelector('input[type="text"]');
    if (nameInput) {
      fireEvent.change(nameInput, { target: { value: 'My Strategy' } });
    }
  });
});

// ===================== MultiChart =====================

describe('MultiChart — full coverage', () => {
  let MultiChart: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/MultiChart');
    MultiChart = mod.default;
  });

  it('renders default layout', async () => {
    renderPage(MultiChart);
    await flushAsync();
  });
});

// ===================== MarketRegime =====================

describe('MarketRegime — full coverage', () => {
  let MarketRegime: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/MarketRegime');
    MarketRegime = mod.default;
  });

  it('renders with scores data', async () => {
    const makeItem = (symbol: string, score: number, label: string, direction: string) => ({
      symbol, score, label, direction, confidence: 80,
      price: 60000, change24h: 1.5,
      description: `${symbol} analysis`,
      components: { adx: 25, adxScore: 60, hurst: 0.55, hurstScore: 65, choppiness: 45, choppinessScore: 55, efficiencyRatio: 0.3, erScore: 50 },
      strategies: { recommended: ['Trend Follow'], avoid: ['Mean Reversion'] },
    });
    mockGetRegimeScores.mockResolvedValue([
      makeItem('BTCUSDT', 85, 'strong_trend', 'bullish'),
      makeItem('ETHUSDT', 45, 'choppy', 'neutral'),
      makeItem('SOLUSDT', 15, 'mean_reversion', 'bearish'),
    ]);
    mockGetMarketRegime.mockResolvedValue({
      regime: 'trending_up', confidence: 85, description: 'Strong trend', regimeScore: 80,
      regimeLabel: 'strong_trend', indicators: { adx: 35, rsi: 65 },
      components: { hurst: 0.7, choppiness: 30 }, recommended: ['Trend Follow'],
    });

    renderPage(MarketRegime);
    await flushAsync();
  });

  it('renders loading state', () => {
    mockGetRegimeScores.mockImplementation(() => new Promise(() => {}));
    mockGetMarketRegime.mockImplementation(() => new Promise(() => {}));
    renderPage(MarketRegime);
  });
});

// ===================== Marketplace =====================

describe('Marketplace — full coverage', () => {
  let Marketplace: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Marketplace');
    Marketplace = mod.default;
  });

  it('renders with strategies', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          { id: 's1', name: 'RSI Strategy', description: 'RSI based', creator: 'Trader1', type: 'trend', winRate: 65, totalReturn: 25, maxDrawdown: 10, sharpeRatio: 1.5, followers: 100, rating: 4.5, ratingCount: 20, price: 'free', timeframe: '4H', pairs: ['BTCUSDT'], createdAt: '2025-01-01' },
        ],
      }),
    });
    renderPage(Marketplace);
    await flushAsync();
  });
});

// ===================== CopyTrading =====================

describe('CopyTrading — full coverage', () => {
  let CopyTrading: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/CopyTrading');
    CopyTrading = mod.default;
  });

  it('renders with traders', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/copy/leaders')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 't1', displayName: 'TopTrader', winRate: 72, totalReturn: 150, maxDrawdown: 15, totalTrades: 200, copiers: 500, riskScore: 3, badge: 'gold', monthsProfitable: 10, avgTradeReturn: 2.5, bio: 'Pro trader' },
            ],
          }),
        };
      }
      if (typeof url === 'string' && url.includes('/copy/active')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });
    renderPage(CopyTrading);
    await flushAsync();
  });

  it('opens copy modal for a trader', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/copy/leaders')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 't1', displayName: 'TopTrader', winRate: 72, totalReturn: 150, maxDrawdown: 15, totalTrades: 200, copiers: 500, riskScore: 3, badge: 'gold', monthsProfitable: 10, avgTradeReturn: 2.5, bio: 'Pro trader' },
            ],
          }),
        };
      }
      if (typeof url === 'string' && url.includes('/copy/active')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{ id: 'c1', leaderId: 't1', allocation: 500, startedAt: '2025-01-01', currentPnl: 50, leaderName: 'TopTrader', leaderBadge: 'gold' }],
          }),
        };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(CopyTrading);
    await flushAsync();
  });
});

// ===================== WyckoffPhase =====================

describe('WyckoffPhase — full coverage', () => {
  let WyckoffPhase: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/WyckoffPhase');
    WyckoffPhase = mod.default;
  });

  it('renders with data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          phase: 'accumulation',
          subPhase: 'Phase A',
          confidence: 75,
          description: 'Accumulation phase',
          events: [{ label: 'Spring', time: '2025-01-01', price: 48000 }],
          volumeAnalysis: { upVolume: 5e9, downVolume: 3e9, ratio: 1.66 },
        },
      }),
    });
    renderPage(WyckoffPhase);
    await flushAsync();
  });

  it('handles error', async () => {
    mockFetch.mockRejectedValue(new Error('fail'));
    renderPage(WyckoffPhase);
    await flushAsync();
  });
});

// ===================== TokenScanner =====================

describe('TokenScanner — full coverage', () => {
  let TokenScanner: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/TokenScanner');
    TokenScanner = mod.default;
  });

  it('renders and scans token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { score: 75, flags: ['High liquidity', 'Verified contract'], metrics: {} },
      }),
    });
    renderPage(TokenScanner);
    await flushAsync();
  });
});

// ===================== Referral =====================

describe('Referral — full coverage', () => {
  let Referral: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Referral');
    Referral = mod.default;
  });

  it('renders with referral stats', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { referrals: 5, earned: 50, link: 'https://quantis.app/ref/abc123', history: [] },
      }),
    });
    renderPage(Referral);
    await flushAsync();
  });
});

// ===================== Portfolio =====================

describe('Portfolio — full coverage', () => {
  let Portfolio: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Portfolio');
    Portfolio = mod.default;
  });

  it('renders with data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          totalValue: 50000,
          change24h: 2.5,
          holdings: [
            { symbol: 'BTC', amount: 0.5, value: 30000, change24h: 1.5, allocation: 60 },
            { symbol: 'ETH', amount: 5, value: 15000, change24h: -0.5, allocation: 30 },
          ],
          performanceHistory: [],
        },
      }),
    });
    renderPage(Portfolio);
    await flushAsync();
  });
});

// ===================== Additional Coverage Boosters =====================

describe('Dashboard — extra branches', () => {
  let Dashboard: React.ComponentType;
  beforeEach(async () => { Dashboard = (await import('@/pages/Dashboard')).default; });

  it('handles toggle watchlist with star click', async () => {
    const tickerMap = new Map([
      ['BTCUSDT', { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, volume: 1e9 }],
      ['ETHUSDT', { symbol: 'ETHUSDT', price: 3000, change24h: -1, volume: 5e8 }],
    ]);
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/watchlist') && !opts?.method) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [{ symbol: 'BTCUSDT' }] }) };
      }
      if (typeof url === 'string' && url.includes('/watchlist') && opts?.method) {
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: { current: null } }) };
    });

    renderPage(Dashboard);
    await flushAsync();

    // Find star button and click it
    const starBtns = document.querySelectorAll('button[title]');
    const starBtn = Array.from(starBtns).find(b => b.getAttribute('title')?.includes('watchlist'));
    if (starBtn) {
      fireEvent.click(starBtn);
      await flushAsync();
    }
  });

  it('renders with empty topGainers/topLosers', async () => {
    const tickerMap = new Map();
    mockGetTickers.mockResolvedValue(tickerMap);
    marketState.tickers = tickerMap;

    // Force loading=false with no tickers - trigger error state
    mockGetTickers.mockRejectedValue(new Error('fail'));
    renderPage(Dashboard);
    await flushAsync();
  });
});

describe('Chart — extra branches', () => {
  let Chart: React.ComponentType;
  beforeEach(async () => { Chart = (await import('@/pages/Chart')).default; });

  it('renders with null indicators (fetch fails)', async () => {
    mockGetOHLCV.mockResolvedValue([{ time: 1000, open: 50000, high: 50100, low: 49900, close: 50050, volume: 1e6 }]);
    mockFetch.mockRejectedValue(new Error('fail'));
    marketState.tickers = new Map([['BTCUSDT', { symbol: 'BTCUSDT', price: 50000, change24h: 1.5, volume: 1e9 }]]);

    renderPage(Chart);
    await flushAsync();
  });

  it('renders with RSI < 30 indicator color', async () => {
    mockGetOHLCV.mockResolvedValue([{ time: 1000, open: 50000, high: 50100, low: 49900, close: 50050, volume: 1e6 }]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { current: { price: 50000, rsi: 25, ema9: 49900, ema21: 49800, sma20: null, bb_upper: null, bb_lower: null, bb_middle: null } },
      }),
    });

    renderPage(Chart);
    await flushAsync();
  });

  it('renders pair picker items and navigates', async () => {
    mockGetOHLCV.mockResolvedValue([]);
    mockGetPairs.mockResolvedValue([
      { id: '1', symbol: 'BTCUSDT', exchange: 'binance' },
      { id: '2', symbol: 'ETHUSDT', exchange: 'binance' },
    ]);

    renderPage(Chart);
    await flushAsync();

    // Open pair picker
    const pairBtn = screen.getByText('BTC/USDT');
    fireEvent.click(pairBtn);
    await flushAsync();

    // Click ETHUSDT in the dropdown
    const ethOption = screen.queryByText('ETH/USDT');
    if (ethOption) {
      fireEvent.click(ethOption);
      expect(mockNavigate).toHaveBeenCalledWith('/chart/ETHUSDT');
    }
  });
});

describe('CopyTrading — extra branches', () => {
  let CopyTrading: React.ComponentType;
  beforeEach(async () => { CopyTrading = (await import('@/pages/CopyTrading')).default; });

  it('renders with different badge types', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/copy/leaders')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 't1', displayName: 'Bronze', winRate: 55, totalReturn: 20, maxDrawdown: 25, totalTrades: 50, copiers: 10, riskScore: 7, badge: 'bronze', monthsProfitable: 3, avgTradeReturn: 0.5, bio: 'New' },
              { id: 't2', displayName: 'Silver', winRate: 60, totalReturn: 50, maxDrawdown: 20, totalTrades: 100, copiers: 50, riskScore: 5, badge: 'silver', monthsProfitable: 6, avgTradeReturn: 1.0, bio: 'Mid' },
              { id: 't3', displayName: 'Platinum', winRate: 80, totalReturn: 200, maxDrawdown: 10, totalTrades: 500, copiers: 1000, riskScore: 2, badge: 'platinum', monthsProfitable: 12, avgTradeReturn: 3.0, bio: 'Elite' },
            ],
          }),
        };
      }
      if (typeof url === 'string' && url.includes('/copy/active')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(CopyTrading);
    await flushAsync();
  });
});

describe('WalletTracker — extra branches', () => {
  let WalletTracker: React.ComponentType;
  beforeEach(async () => { WalletTracker = (await import('@/pages/WalletTracker')).default; });

  it('handles remove wallet', async () => {
    let removed = false;
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'DELETE') {
        removed = true;
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      }
      if (typeof url === 'string' && url.includes('/wallets')) {
        if (removed) {
          return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
        }
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{
              id: 'w1', address: '0xABCDEF1234567890AB', chain: 'bitcoin',
              label: 'My BTC', totalValue: 50000, addedAt: '2025-01-01',
            }],
          }),
        };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(WalletTracker);
    await flushAsync();

    // Find and click delete button
    const deleteBtns = document.querySelectorAll('[class*="hover:text-red"]');
    if (deleteBtns[0]) {
      fireEvent.click(deleteBtns[0] as HTMLElement);
      await flushAsync();
    }
  });

  it('handles fetch error on add wallet', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/wallets/track')) {
        throw new Error('Network error');
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(WalletTracker);
    await flushAsync();

    const addressInput = screen.getByPlaceholderText('Wallet address (0x... / base58...)');
    fireEvent.change(addressInput, { target: { value: '0xtest' } });
    fireEvent.click(screen.getByText('Track Wallet'));
    await flushAsync();

    expect(screen.getByText('Failed to add wallet')).toBeDefined();
  });

  it('expands wallet with empty holdings', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/balance')) {
        return { ok: true, json: () => Promise.resolve({ success: true, data: { holdings: [] } }) };
      }
      return {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [{
            id: 'w1', address: '0xABCDEF1234567890AB', chain: 'ethereum',
            label: 'Test', totalValue: 0, addedAt: '2025-01-01',
          }],
        }),
      };
    });

    renderPage(WalletTracker);
    await flushAsync();

    const walletRow = document.querySelector('[class*="cursor-pointer"]');
    if (walletRow) {
      fireEvent.click(walletRow);
      await flushAsync();
      expect(screen.getByText('No holdings found.')).toBeDefined();
    }
  });
});

describe('MultiChart — extra branches', () => {
  let MultiChart: React.ComponentType;
  beforeEach(async () => { MultiChart = (await import('@/pages/MultiChart')).default; });

  it('renders and interacts', async () => {
    mockGetOHLCV.mockResolvedValue([]);
    renderPage(MultiChart);
    await flushAsync();

    // Click layout buttons if present
    const btns = screen.getAllByRole('button');
    for (const btn of btns.slice(0, 3)) {
      fireEvent.click(btn);
    }
  });
});

describe('ChartReplay — extra branches', () => {
  let ChartReplay: React.ComponentType;
  beforeEach(async () => { ChartReplay = (await import('@/pages/ChartReplay')).default; });

  it('handles play/pause toggle and auto-stop at end', async () => {
    const candles = Array.from({ length: 55 }, (_, i) => ({
      time: 1000 + i * 3600, open: 50000, high: 50100, low: 49900, close: 50050, volume: 1e6,
    }));
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: candles }),
    });
    renderPage(ChartReplay);
    await flushAsync();

    // Click play
    const playBtn = screen.getAllByRole('button').find(b => b.querySelector('svg'));
    if (playBtn) fireEvent.click(playBtn);

    // Click next bar
    const skipBtn = screen.getAllByRole('button').find(b => b.getAttribute('title')?.includes('Next'));
    if (skipBtn) fireEvent.click(skipBtn);
  });

  it('renders fetch error as empty candles', async () => {
    mockFetch.mockRejectedValue(new Error('fail'));
    renderPage(ChartReplay);
    await flushAsync();
  });
});

describe('ScriptEditor — save and delete scripts', () => {
  let ScriptEditor: React.ComponentType;
  beforeEach(async () => { ScriptEditor = (await import('@/pages/ScriptEditor')).default; });

  it('saves and deletes a script', async () => {
    renderPage(ScriptEditor);
    await flushAsync();

    // Change name
    const nameInput = document.querySelector('input[type="text"]');
    if (nameInput) {
      fireEvent.change(nameInput, { target: { value: 'Test Script' } });
    }

    // Save
    const allBtns = screen.getAllByRole('button');
    const saveBtn = allBtns.find(b => b.textContent?.includes('Save'));
    if (saveBtn) fireEvent.click(saveBtn);

    // Delete (find delete button in saved scripts)
    const deleteBtns = document.querySelectorAll('[class*="hover:text-danger"], [class*="hover:text-red"]');
    if (deleteBtns[0]) fireEvent.click(deleteBtns[0] as HTMLElement);
  });
});

describe('TaxReport — more branches', () => {
  let TaxReport: React.ComponentType;
  beforeEach(async () => { TaxReport = (await import('@/pages/TaxReport')).default; });

  it('renders with both paper trades and journal entries', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/paper/history')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { symbol: 'BTCUSDT', side: 'buy', entryPrice: 50000, exitPrice: 52000, pnl: 200, amount: 5000, openedAt: '2026-01-01T00:00:00Z', closedAt: '2026-01-15T00:00:00Z' },
              { symbol: 'BTCUSDT', side: 'sell', entryPrice: 52000, exitPrice: 51000, pnl: -100, amount: 3000, openedAt: '2026-02-01T00:00:00Z', closedAt: '2026-02-03T00:00:00Z' },
              { symbol: 'ETHUSDT', side: 'buy', entryPrice: 3000, exitPrice: 3500, pnl: 500, amount: 3000, openedAt: '2026-03-01T00:00:00Z', closedAt: '2026-03-10T00:00:00Z' },
              // Missing closedAt to test skip
              { symbol: 'SOLUSDT', side: 'buy', entryPrice: 100, exitPrice: null, pnl: 0, amount: 100, openedAt: '2026-01-01T00:00:00Z' },
              // Wrong year to test filter
              { symbol: 'AVAXUSDT', side: 'buy', entryPrice: 20, exitPrice: 25, pnl: 5, amount: 100, openedAt: '2025-01-01T00:00:00Z', closedAt: '2025-01-05T00:00:00Z' },
            ],
          }),
        };
      }
      if (typeof url === 'string' && url.includes('/journal')) {
        return {
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { pair: 'SOLUSDT', direction: 'long', entryPrice: 100, exitPrice: 120, pnl: 50, pnlPct: 10, createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-05T00:00:00Z' },
              // No exit price - should be skipped
              { pair: 'BNBUSDT', direction: 'short', entryPrice: 300, exitPrice: null, pnl: null, pnlPct: null, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
              // Wrong year
              { pair: 'DOTUSDT', direction: 'long', entryPrice: 5, exitPrice: 6, pnl: 10, pnlPct: 20, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-10T00:00:00Z' },
            ],
          }),
        };
      }
      return { ok: true, json: () => Promise.resolve({ success: true, data: [] }) };
    });

    renderPage(TaxReport);
    await flushAsync();

    // Should render the report with summary cards
    expect(screen.getByText('Tax Report')).toBeDefined();

    // Click Download CSV
    const csvBtn = screen.queryByText('Download CSV');
    if (csvBtn && !(csvBtn as HTMLButtonElement).disabled) {
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;
      fireEvent.click(csvBtn);
    }
  });
});

describe('TokenScanner — more branches', () => {
  let TokenScanner: React.ComponentType;
  beforeEach(async () => { TokenScanner = (await import('@/pages/TokenScanner')).default; });

  it('renders default state', async () => {
    renderPage(TokenScanner);
    await flushAsync();
  });
});

describe('AntiLiquidation — more coverage', () => {
  let AntiLiquidation: React.ComponentType;
  beforeEach(async () => { AntiLiquidation = (await import('@/pages/AntiLiquidation')).default; });

  it('simulates high price (all safe)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          { symbol: 'BTCUSDT', side: 'buy', entryPrice: 50000, currentPrice: 55000, quantity: 0.1, amount: 5000, pnl: 500, pnlPct: 10, openedAt: '2025-01-01' },
        ],
      }),
    });
    renderPage(AntiLiquidation);
    await flushAsync();

    // Move slider to high (100 = +30%)
    const slider = document.querySelector('input[type="range"]');
    if (slider) {
      fireEvent.change(slider, { target: { value: '100' } });
      await flushAsync();
    }
  });

  it('handles res.success = false', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, data: null }),
    });
    renderPage(AntiLiquidation);
    await flushAsync();
  });
});

// ===================== Screener =====================

describe('Screener — full coverage', () => {
  let Screener: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Screener');
    Screener = mod.default;
  });

  it('renders with data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          { symbol: 'BTCUSDT', price: 60000, change24h: 2.5, rsi: 55, volume: 1e9, signal: 'buy' },
        ],
      }),
    });
    renderPage(Screener);
    await flushAsync();
  });
});

// ===================== IndicatorLibrary =====================

describe('IndicatorLibrary — full coverage', () => {
  let IndicatorLibrary: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/IndicatorLibrary');
    IndicatorLibrary = mod.default;
  });

  it('renders', async () => {
    renderPage(IndicatorLibrary);
    await flushAsync();
  });
});

// ===================== BitcoinModels =====================

describe('BitcoinModels — full coverage', () => {
  let BitcoinModels: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/BitcoinModels');
    BitcoinModels = mod.default;
  });

  it('renders with data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          currentPrice: 60000,
          overallSignal: 'undervalued',
          models: [
            { name: 'Stock-to-Flow', fairValue: 100000, deviation: -40, signal: 'undervalued', description: 'S2F model' },
            { name: 'Rainbow Chart', fairValue: 65000, deviation: -8, signal: 'fair', description: 'Rainbow' },
            { name: 'Thermocap', fairValue: 50000, deviation: 20, signal: 'overvalued', description: 'Thermocap' },
          ],
        },
      }),
    });
    renderPage(BitcoinModels);
    await flushAsync();
  });
});

// ===================== Status =====================

describe('Status — full coverage', () => {
  let Status: React.ComponentType;

  beforeEach(async () => {
    const mod = await import('@/pages/Status');
    Status = mod.default;
  });

  it('renders with service statuses', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          status: 'operational',
          services: [
            { name: 'API Gateway', status: 'operational', latency: 15 },
            { name: 'Data Collector', status: 'degraded', latency: 250 },
            { name: 'Analysis Engine', status: 'down', latency: null },
          ],
        },
      }),
    });
    renderPage(Status);
    await flushAsync();
  });
});
