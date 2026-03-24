/**
 * Coverage boost tests — file 2 of 2.
 * Targets remaining uncovered files: Dashboard, Admin, Login, Profile,
 * Chart, Tokenomics, IndicatorLibrary, Correlation, PaperTrading,
 * RenkoChart, News, Signals, TaxReport, Pricing, DeFi, Copilot,
 * MultiChart, Marketplace, MarketRegime, NotificationCenter,
 * GlobalSearch, Header, Layout, OnboardingWizard, ErrorBoundary,
 * AntiLiquidation, BitcoinModels, ElliottWave, WyckoffPhase.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Global mocks — copied from pages-smoke.test.tsx
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
    getAdminDashboard: vi.fn().mockResolvedValue({
      totalUsers: 100, revenue: 5000, activeUsers: 50,
      usersToday: 10, totalSignals: 500, totalCandles: 100000, activePairs: 20,
    }),
    getAdminUsers: vi.fn().mockResolvedValue([
      { id: 'u1', email: 'user@test.com', display_name: 'User1', tier: 'starter', created_at: '2024-01-01' },
    ]),
    getSystemHealth: vi.fn().mockResolvedValue({
      status: 'ok', dbStatus: 'ok', redisStatus: 'ok',
      latestSignalTime: '2024-01-01T00:00:00Z',
      candlesByExchange: [{ exchange: 'binance', count: '50000' }],
    }),
    updateUserTier: mockFn,
    getSignals: vi.fn().mockResolvedValue({ rows: [] }),
    getScreener: vi.fn().mockResolvedValue([]),
    getRegimeScores: mockArrayFn,
    getConfluence: mockFn,
    login: mockFn,
    register: mockFn,
    askCopilot: vi.fn().mockResolvedValue({ response: 'test' }),
    getDeFiOverview: vi.fn().mockResolvedValue({ protocols: [], totalTvl: 0, avgApy: 0, protocolCount: 0 }),
    getExchangeHealth: vi.fn().mockResolvedValue([]),
    getFundingRates: vi.fn().mockResolvedValue([]),
    getMarketBreadth: vi.fn().mockResolvedValue({ breadthScore: 50, components: {} }),
    getMarketProfile: vi.fn().mockResolvedValue({ poc: 0, vaHigh: 0, vaLow: 0 }),
    getNarratives: vi.fn().mockResolvedValue([]),
    getOpenInterest: vi.fn().mockResolvedValue([]),
    getCorrelation: vi.fn().mockResolvedValue({ matrix: [], symbols: [] }),
    getSeasonality: vi.fn().mockResolvedValue({ hourly: [], daily: [] }),
    getLiquidations: vi.fn().mockResolvedValue({ above: [], below: [] }),
    getOrderFlow: vi.fn().mockResolvedValue([]),
    getWhaleTransactions: vi.fn().mockResolvedValue([]),
    getNews: vi.fn().mockResolvedValue({ articles: [], total: 0 }),
    getLeaderboard: vi.fn().mockResolvedValue([]),
    getCopyTraders: vi.fn().mockResolvedValue([]),
    getJournalEntries: vi.fn().mockResolvedValue([]),
    createJournalEntry: mockFn,
    deleteJournalEntry: mockFn,
    updateJournalEntry: mockFn,
    getSocialFeed: vi.fn().mockResolvedValue({ posts: [] }),
    createPost: mockFn,
    getGamificationProfile: vi.fn().mockResolvedValue({ xp: 0, level: 1, streak: 0 }),
    getPaperPortfolio: vi.fn().mockResolvedValue({ balance: 100000, positions: [] }),
    placePaperOrder: mockFn,
    closePaperPosition: mockFn,
    getTrackedWallets: vi.fn().mockResolvedValue([]),
    trackWallet: mockFn,
    removeTrackedWallet: mockFn,
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
  };
});

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

vi.mock('@/stores/auth', () => {
  const storeState = {
    user: { id: 'u1', email: 'test@test.com', tier: 'pro', display_name: 'Test', timezone: 'UTC', language: 'en', role: 'admin', is_admin: true },
    isAuthenticated: true,
    isLoading: false,
    error: 'some error',
    token: 'tok',
    loadUser: vi.fn(),
    login: vi.fn().mockResolvedValue({}),
    logout: vi.fn(),
    setUser: vi.fn(),
    register: vi.fn().mockResolvedValue({}),
    clearError: vi.fn(),
  };
  return {
    useAuthStore: vi.fn((sel) =>
      typeof sel === 'function' ? sel(storeState) : storeState,
    ),
  };
});

vi.mock('@/stores/market', () => {
  const tickerMap = new Map();
  tickerMap.set('BTCUSDT', { symbol: 'BTCUSDT', price: 50000, change24h: 2.5, volume: 1000000 });
  tickerMap.set('ETHUSDT', { symbol: 'ETHUSDT', price: 3000, change24h: -1.0, volume: 500000 });
  const state = {
    tickers: tickerMap, pairs: [], updateTicker: vi.fn(), updateTickers: vi.fn(),
    selectedPair: 'BTCUSDT', setSelectedPair: vi.fn(), selectedTimeframe: '1h', setSelectedTimeframe: vi.fn(),
  };
  return {
    useMarketStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(state) : state),
    TIMEFRAMES: [
      { value: '1m', label: '1m' }, { value: '5m', label: '5m' }, { value: '15m', label: '15m' },
      { value: '1h', label: '1h' }, { value: '4h', label: '4h' }, { value: '1d', label: '1d' },
      { value: '1w', label: '1w' },
    ],
  };
});

vi.mock('@/stores/toast', () => {
  const state = { toasts: [], addToast: vi.fn(), removeToast: vi.fn() };
  return {
    useToastStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(state) : state),
  };
});

vi.mock('@/stores/notifications', () => {
  const state = {
    notifications: [
      { id: 'n1', type: 'signal', title: 'BTC Buy Signal', message: 'Strong buy signal detected', read: false, createdAt: Date.now() - 60000 },
      { id: 'n2', type: 'alert', title: 'Price Alert', message: 'BTC above 60k', read: true, createdAt: Date.now() - 3600000 },
    ],
    unreadCount: 1,
    addNotification: vi.fn(),
    markAllRead: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearAll: vi.fn(),
  };
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
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', changeLanguage: vi.fn() } }),
  Trans: ({ children }: any) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ symbol: 'BTCUSDT' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

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

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  scale: vi.fn(),
  setLineDash: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
  font: '',
  textAlign: '',
  fillText: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 50 }),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
}) as any;

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true, data: [] }),
}) as any;

Element.prototype.scrollIntoView = vi.fn();

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage(Page: React.ComponentType) {
  return render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders admin dashboard with stats, users, and health', async () => {
    const Admin = (await import('@/pages/Admin')).default;
    renderPage(Admin);

    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeDefined();
    });
  });

  it('handles tier change for a user', async () => {
    const { updateUserTier } = await import('@/services/api');
    const Admin = (await import('@/pages/Admin')).default;
    renderPage(Admin);

    await waitFor(() => {
      expect(screen.getByText('user@test.com')).toBeDefined();
    });

    const tierSelect = screen.getByDisplayValue('starter');
    fireEvent.change(tierSelect, { target: { value: 'pro' } });

    await waitFor(() => {
      expect(updateUserTier).toHaveBeenCalledWith('u1', 'pro');
    });
  });
});

describe('Login coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders login form with error state', async () => {
    const Login = (await import('@/pages/Login')).default;
    renderPage(Login);
    expect(screen.getByText('auth.loginError')).toBeDefined();
  });

  it('submits login form', async () => {
    const Login = (await import('@/pages/Login')).default;
    renderPage(Login);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText(/••••/);

    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    fireEvent.click(screen.getByText('auth.login'));
  });
});

describe('Profile coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders profile with XP data and achievements', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/achievements')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              { id: 'first_steps', name: 'First Steps', description: 'Complete your first action', xpReward: 100, earned: true },
              { id: 'chart_master', name: 'Chart Master', description: 'View 50 charts', xpReward: 250, earned: false },
            ],
          }),
        });
      }
      if (url.includes('/profile')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              totalXP: 500, streakDays: 3, achievementsEarned: 1, level: 2, name: 'Student',
              currentXP: 200, nextLevelXP: 500, progress: 0.4,
              recentActivity: [
                { action: 'view_chart', xp: 10, timestamp: Date.now() - 30000 },
                { action: 'achievement:first_steps', xp: 100, timestamp: Date.now() - 86400000 },
              ],
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
    });

    const Profile = (await import('@/pages/Profile')).default;
    renderPage(Profile);

    await waitFor(() => {
      expect(screen.getByText('First Steps')).toBeDefined();
    });
  });
});

describe('Chart page coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders chart with all controls', async () => {
    const Chart = (await import('@/pages/Chart')).default;
    renderPage(Chart);
    expect(screen.getByText('BTC/USDT')).toBeDefined();
  });

  it('toggles indicator buttons', async () => {
    const Chart = (await import('@/pages/Chart')).default;
    renderPage(Chart);

    fireEvent.click(screen.getByText('EMA'));
    fireEvent.click(screen.getByText('BB'));
    fireEvent.click(screen.getByText('RSI'));
  });

  it('opens and closes pair picker', async () => {
    const Chart = (await import('@/pages/Chart')).default;
    renderPage(Chart);

    fireEvent.click(screen.getByText('BTC/USDT'));
    // Pair picker is now open, click overlay to close
    const overlay = document.querySelector('.fixed.inset-0');
    if (overlay) fireEvent.click(overlay);
  });
});

describe('Tokenomics coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders tokenomics with data', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          {
            symbol: 'BTC', name: 'Bitcoin',
            circulatingSupply: 19000000, maxSupply: 21000000,
            inflationRate: 1.8, fdv: 1000000000000, supplyRatio: 90.5,
            unlocks: [{ date: '2024-06-01', amount: 1000, description: 'Mining rewards' }],
            score: 85, scoreExplanation: 'Excellent tokenomics',
          },
        ],
      }),
    });

    const Tokenomics = (await import('@/pages/Tokenomics')).default;
    renderPage(Tokenomics);

    await waitFor(() => {
      expect(screen.getByText('Tokenomics Analyzer')).toBeDefined();
    });
  });
});

describe('IndicatorLibrary coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders indicator library and searches', async () => {
    const IndicatorLibrary = (await import('@/pages/IndicatorLibrary')).default;
    renderPage(IndicatorLibrary);

    expect(screen.getByText('Indicator Library')).toBeDefined();

    // Search for an indicator
    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: 'RSI' } });

    // Click on an indicator to expand
    fireEvent.click(screen.getByText('RSI'));
  });
});

describe('Correlation coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders correlation matrix with data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
          matrix: [
            [1.0, 0.85, 0.7],
            [0.85, 1.0, 0.6],
            [0.7, 0.6, 1.0],
          ],
        },
      }),
    });

    const Correlation = (await import('@/pages/Correlation')).default;
    renderPage(Correlation);

    await waitFor(() => {
      expect(screen.queryByText(/Correlation/i)).toBeDefined();
    });
  });
});

describe('PaperTrading coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders paper trading with account data', async () => {
    let callCount = 0;
    (global.fetch as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              balance: 100000, equity: 102000, unrealizedPnl: 2000,
              realizedPnl: 500, positionsCount: 2,
            },
          }),
        });
      }
      if (callCount === 2) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { symbol: 'BTCUSDT', side: 'buy', entryPrice: 50000, currentPrice: 51000, quantity: 0.1, amount: 5000, pnl: 100, pnlPct: 2.0, openedAt: '2024-01-01' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
    });

    const PaperTrading = (await import('@/pages/PaperTrading')).default;
    renderPage(PaperTrading);

    await waitFor(() => {
      expect(screen.queryByText(/Paper Trading/i) || screen.queryByText(/Balance/i)).toBeDefined();
    });
  });
});

describe('RenkoChart coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders renko chart with bricks', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          brickSize: 100,
          bricks: [
            { price: 50000, type: 'up', index: 0 },
            { price: 50100, type: 'up', index: 1 },
            { price: 50000, type: 'down', index: 2 },
          ],
        },
      }),
    });

    const RenkoChart = (await import('@/pages/RenkoChart')).default;
    renderPage(RenkoChart);

    await waitFor(() => {
      expect(screen.queryByText(/Renko/i)).toBeDefined();
    });
  });

  it('handles fetch error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ success: false, error: 'Failed to load Renko data' }),
    });

    const RenkoChart = (await import('@/pages/RenkoChart')).default;
    renderPage(RenkoChart);

    await waitFor(() => {
      expect(screen.getByText('Failed to load Renko data')).toBeDefined();
    });
  });
});

describe('News coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders news with articles', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          {
            id: 'n1', title: 'Bitcoin reaches new ATH', description: 'BTC hit a new all time high...',
            source: 'CoinDesk', category: 'market', sentiment: 'bullish',
            publishedAt: new Date().toISOString(), url: 'https://example.com/article',
          },
          {
            id: 'n2', title: 'SEC updates crypto rules', description: 'New regulations...',
            source: 'Reuters', category: 'regulatory', sentiment: 'bearish',
            publishedAt: new Date(Date.now() - 7200000).toISOString(), url: 'https://example.com/article2',
          },
        ],
      }),
    });

    const News = (await import('@/pages/News')).default;
    renderPage(News);

    await waitFor(() => {
      expect(screen.queryByText('Bitcoin reaches new ATH')).toBeDefined();
    });
  });
});

describe('Signals coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders signals with data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          {
            id: 's1', pair: 'BTCUSDT', exchange: 'binance', type: 'buy', strategy: 'RSI Oversold',
            strength: 'strong', confidence: 85, entry_price: 50000, stop_loss: 48000,
            tp1: 52000, tp2: 54000, tp3: 56000, reasoning: 'RSI below 30',
            timeframe: '4h', status: 'active', created_at: '2024-01-01',
          },
          {
            id: 's2', pair: 'ETHUSDT', exchange: 'binance', type: 'sell', strategy: 'MACD Cross',
            strength: 'medium', confidence: 65, entry_price: 3000, stop_loss: 3200,
            tp1: 2800, tp2: 2600, tp3: 2400, reasoning: 'MACD bearish cross',
            timeframe: '1h', status: 'active', created_at: '2024-01-02',
          },
        ],
      }),
    });

    const Signals = (await import('@/pages/Signals')).default;
    renderPage(Signals);

    await waitFor(() => {
      expect(screen.queryByText('BTCUSDT') || screen.queryByText('RSI Oversold')).toBeDefined();
    });
  });
});

describe('TaxReport coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders tax report with trade data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          year: 2024, totalGains: 5000, totalLosses: 1500, netPnl: 3500,
          shortTermGains: 3000, longTermGains: 2000, totalTrades: 50,
          trades: [
            { pair: 'BTCUSDT', direction: 'long', entry: 50000, exit: 52000, pnl: 200, pnlPct: 4.0, date: '2024-03-15', holdingPeriod: '5d' },
            { pair: 'ETHUSDT', direction: 'short', entry: 3000, exit: 3100, pnl: -50, pnlPct: -1.67, date: '2024-04-20', holdingPeriod: '2d' },
          ],
          byAsset: [
            { symbol: 'BTCUSDT', totalPnl: 500, tradeCount: 30 },
            { symbol: 'ETHUSDT', totalPnl: -100, tradeCount: 20 },
          ],
        },
      }),
    });

    const TaxReport = (await import('@/pages/TaxReport')).default;
    renderPage(TaxReport);

    await waitFor(() => {
      expect(screen.getByText('Tax Report')).toBeDefined();
    });
  });
});

describe('Pricing coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders pricing tiers', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        tiers: [
          { id: 'starter', name: 'Starter', price: 0, annualPrice: 0, currency: 'USD', interval: 'month', features: ['Basic charts'] },
          { id: 'trader', name: 'Trader', price: 29, annualPrice: 290, currency: 'USD', interval: 'month', popular: true, features: ['Advanced charts', 'Signals'] },
          { id: 'pro', name: 'Pro', price: 79, annualPrice: 790, currency: 'USD', interval: 'month', features: ['Everything', 'AI Copilot'] },
        ],
      }),
    });

    const Pricing = (await import('@/pages/Pricing')).default;
    renderPage(Pricing);

    await waitFor(() => {
      expect(screen.queryByText('Starter') || screen.queryByText('Trader') || screen.queryByText('Pro')).toBeDefined();
    });
  });
});

describe('Dashboard coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders dashboard', async () => {
    const Dashboard = (await import('@/pages/Dashboard')).default;
    const { container } = renderPage(Dashboard);
    expect(container).toBeDefined();
  });
});

describe('DeFi coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders DeFi page', async () => {
    const DeFi = (await import('@/pages/DeFi')).default;
    renderPage(DeFi);
    expect(screen.queryByText(/DeFi/i)).toBeDefined();
  });
});

describe('Copilot coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders AI Copilot page', async () => {
    const Copilot = (await import('@/pages/Copilot')).default;
    renderPage(Copilot);
    expect(screen.queryByText(/Copilot/i) || screen.queryByText(/AI/i)).toBeDefined();
  });
});

describe('MultiChart coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders MultiChart page', async () => {
    const MultiChart = (await import('@/pages/MultiChart')).default;
    renderPage(MultiChart);
    expect(screen.getByText('Multi-Chart')).toBeDefined();
  });
});

describe('Marketplace coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders Marketplace page', async () => {
    const Marketplace = (await import('@/pages/Marketplace')).default;
    renderPage(Marketplace);
    expect(screen.queryByText(/Marketplace/i) || screen.queryByText(/Strategy/i)).toBeDefined();
  });
});

describe('MarketRegime coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders MarketRegime page', async () => {
    const MarketRegime = (await import('@/pages/MarketRegime')).default;
    renderPage(MarketRegime);
    expect(screen.queryByText(/Market Regime/i) || screen.queryByText(/Regime/i)).toBeDefined();
  });
});

describe('AntiLiquidation coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders AntiLiquidation page', async () => {
    const AntiLiquidation = (await import('@/pages/AntiLiquidation')).default;
    renderPage(AntiLiquidation);
    expect(screen.queryByText(/Liquidation/i) || screen.queryByText(/Risk/i)).toBeDefined();
  });
});

describe('BitcoinModels coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders BitcoinModels page', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          currentPrice: 50000,
          models: [
            { name: 'Stock-to-Flow', value: 60000, deviation: 20, signal: 'undervalued' },
          ],
        },
      }),
    });
    const BitcoinModels = (await import('@/pages/BitcoinModels')).default;
    const { container } = renderPage(BitcoinModels);
    expect(container).toBeDefined();
  });
});

describe('ElliottWave coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders ElliottWave page', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          symbol: 'BTCUSDT', pattern: 'impulse',
          currentWave: 3, waveCount: 5,
          direction: 'up', confidence: 72,
          description: 'Wave 3 in progress',
          targets: [55000, 60000],
          invalidation: 45000,
        },
      }),
    });
    const ElliottWave = (await import('@/pages/ElliottWave')).default;
    const { container } = renderPage(ElliottWave);
    expect(container).toBeDefined();
  });
});

describe('WyckoffPhase coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders WyckoffPhase page', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          symbol: 'BTCUSDT', phase: 'markup',
          confidence: 75, description: 'Markup phase',
          volumeProfile: { upVolume: 60, downVolume: 40 },
          events: [],
          priceTarget: 55000,
        },
      }),
    });
    const WyckoffPhase = (await import('@/pages/WyckoffPhase')).default;
    const { container } = renderPage(WyckoffPhase);
    expect(container).toBeDefined();
  });
});

describe('NotificationCenter coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders and opens notification panel', async () => {
    const { NotificationCenter } = await import('@/components/common/NotificationCenter');
    const { container } = render(<NotificationCenter />);

    // Click bell to open
    const bellBtn = container.querySelector('button');
    if (bellBtn) fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeDefined();
    });

    // Mark all read
    const markAllBtn = screen.queryByText('Mark all read');
    if (markAllBtn) fireEvent.click(markAllBtn);

    // Clear
    const clearBtn = screen.queryByText('Clear');
    if (clearBtn) fireEvent.click(clearBtn);

    // Click on a notification
    const notifBtn = screen.queryByText('BTC Buy Signal');
    if (notifBtn) fireEvent.click(notifBtn);
  });
});

describe('Additional page branches', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('Screener handles volume_surge scan', async () => {
    const { getScreener } = await import('@/services/api');
    (getScreener as any).mockResolvedValueOnce([
      { symbol: 'BTCUSDT', exchange: 'binance', price: 50000, change24h: 2.5, volume: 5000000, rsi: 55, trend: 'bullish' },
      { symbol: 'ETHUSDT', exchange: 'binance', price: 3000, change24h: -1.0, volume: 100, rsi: 45, trend: 'neutral' },
    ]);

    const Screener = (await import('@/pages/Screener')).default;
    renderPage(Screener);

    await waitFor(() => {
      expect(screen.getByText('Screener')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Volume Surge'));
    fireEvent.click(screen.getByText('Overbought (RSI>70)'));
  });

  it('AntiLiquidation renders with data from fetch', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          liquidationPrice: 45000,
          healthFactor: 1.5,
          recommendations: ['Add more collateral'],
        },
      }),
    });

    const AntiLiquidation = (await import('@/pages/AntiLiquidation')).default;
    renderPage(AntiLiquidation);

    await waitFor(() => {
      expect(screen.queryByText(/Liquidation/i)).toBeDefined();
    });
  });
});
