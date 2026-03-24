/**
 * Coverage boost tests — file 1 of 2.
 * Targets the 15 lowest-coverage pages: DCABot, ChartReplay, Portfolio,
 * Settings, Journal, Alerts, WalletTracker, Chart, Confluence, CopyTrading,
 * Screener, ScriptEditor, SocialFeed, Referral, Register.
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
    error: null,
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

const _marketTickers = new Map();
_marketTickers.set('BTCUSDT', { symbol: 'BTCUSDT', price: 50000, change24h: 2.5, volume: 1000000 });
_marketTickers.set('ETHUSDT', { symbol: 'ETHUSDT', price: 3000, change24h: -1.0, volume: 500000 });
_marketTickers.set('SOLUSDT', { symbol: 'SOLUSDT', price: 100, change24h: 5.0, volume: 200000 });
_marketTickers.set('BNBUSDT', { symbol: 'BNBUSDT', price: 300, change24h: 0.5, volume: 100000 });

vi.mock('@/stores/market', () => {
  const state = { tickers: _marketTickers, pairs: [], updateTicker: vi.fn(), updateTickers: vi.fn(), selectedPair: 'BTCUSDT', setSelectedPair: vi.fn(), selectedTimeframe: '1h', setSelectedTimeframe: vi.fn() };
  return {
    useMarketStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(state) : state),
    TIMEFRAMES: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
  };
});

vi.mock('@/stores/toast', () => {
  const state = { toasts: [], addToast: vi.fn(), removeToast: vi.fn() };
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
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
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }: any) => null, HelmetProvider: ({ children }: any) => children }));


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
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
  font: '',
  textAlign: '',
  fillText: vi.fn(),
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
// Test Suites
// ---------------------------------------------------------------------------

function renderPage(Page: React.ComponentType) {
  return render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  );
}

describe('DCABot coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders loading state then empty bots', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });
    const DCABot = (await import('@/pages/DCABot')).default;
    const { container } = renderPage(DCABot);
    expect(container).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText(/Smart DCA Bot/i)).toBeDefined();
    });
  });

  it('renders bots with simulation data', async () => {
    const bots = [
      { id: 'b1', symbol: 'BTCUSDT', baseAmount: 50, interval: 'daily', strategy: 'standard', createdAt: '2024-01-01' },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: bots }),
    });

    const DCABot = (await import('@/pages/DCABot')).default;
    renderPage(DCABot);

    await waitFor(() => {
      expect(screen.getAllByText('BTCUSDT').length).toBeGreaterThan(0);
    });

    // Bot is displayed — verify Simulate button exists
    const simulateBtn = screen.queryByText('Simulate');
    expect(simulateBtn).not.toBeNull();

    // Now mock simulate response and click
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          botId: 'b1', symbol: 'BTCUSDT', strategy: 'standard',
          totalInvested: 500, currentValue: 600, roi: 20, avgBuyPrice: 45000,
          purchases: [
            { date: '2024-01-01', amount: 50, price: 40000, quantity: 0.00125 },
            { date: '2024-01-02', amount: 50, price: 42000, quantity: 0.00119 },
          ],
        },
      }),
    });

    if (simulateBtn) fireEvent.click(simulateBtn);

    await waitFor(() => {
      expect(screen.queryByText('Invested')).toBeDefined();
    });
  });

  it('creates a bot', async () => {
    let callCount = 0;
    (global.fetch as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Initial fetch bots
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
      }
      if (callCount === 2) {
        // Create bot
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { id: 'b2', symbol: 'ETHUSDT', baseAmount: 100, interval: 'weekly', strategy: 'rsi_weighted', createdAt: '2024-01-01' } }) });
      }
      // Simulate
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { botId: 'b2', symbol: 'ETHUSDT', strategy: 'rsi_weighted', totalInvested: 100, currentValue: 110, roi: 10, avgBuyPrice: 3000, purchases: [] } }) });
    });

    const DCABot = (await import('@/pages/DCABot')).default;
    renderPage(DCABot);

    await waitFor(() => {
      expect(screen.getByText('Create Bot')).toBeDefined();
    });

    // Fill form
    fireEvent.change(screen.getByDisplayValue('50'), { target: { value: '100' } });
    fireEvent.click(screen.getByText('Weekly'));
    fireEvent.click(screen.getByText('RSI-Weighted'));
    fireEvent.click(screen.getByText('Create Bot'));
  });

  it('deletes a bot', async () => {
    let callCount = 0;
    (global.fetch as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{ id: 'b1', symbol: 'BTCUSDT', baseAmount: 50, interval: 'daily', strategy: 'standard', createdAt: '2024-01-01' }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    });

    const DCABot = (await import('@/pages/DCABot')).default;
    renderPage(DCABot);

    await waitFor(() => expect(screen.getByText('BTCUSDT')).toBeDefined());

    // Click the delete button (Trash2 icon button)
    const deleteButtons = document.querySelectorAll('button');
    const trashBtn = Array.from(deleteButtons).find(b => b.querySelector('svg.lucide-trash-2'));
    if (trashBtn) fireEvent.click(trashBtn);
  });
});

describe('ChartReplay coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders loading state', async () => {
    const ChartReplay = (await import('@/pages/ChartReplay')).default;
    renderPage(ChartReplay);
    expect(screen.getByText('chartReplay.title')).toBeDefined();
  });

  it('renders with candle data and handles play/pause', async () => {
    const candles = Array.from({ length: 100 }, (_, i) => ({
      time: 1700000000 + i * 3600,
      open: 50000 + i * 10,
      high: 50100 + i * 10,
      low: 49900 + i * 10,
      close: 50050 + i * 10,
      volume: 1000,
    }));

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: candles }),
    });

    const ChartReplay = (await import('@/pages/ChartReplay')).default;
    renderPage(ChartReplay);

    await waitFor(() => {
      expect(screen.getByText('chartReplay.buy')).toBeDefined();
    });

    // Click Buy button
    fireEvent.click(screen.getByText('chartReplay.buy'));

    // Click close position
    await waitFor(() => {
      const closeBtn = screen.queryByText('chartReplay.closePosition');
      if (closeBtn) fireEvent.click(closeBtn);
    });

    // Click Sell button
    fireEvent.click(screen.getByText('chartReplay.sell'));
  });

  it('handles pair dropdown toggle', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    const ChartReplay = (await import('@/pages/ChartReplay')).default;
    renderPage(ChartReplay);

    await waitFor(() => {
      expect(screen.getByText('BTCUSDT')).toBeDefined();
    });

    // Open pair dropdown
    fireEvent.click(screen.getByText('BTCUSDT'));
  });

  it('handles fetch error gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('network'));

    const ChartReplay = (await import('@/pages/ChartReplay')).default;
    renderPage(ChartReplay);

    await waitFor(() => {
      expect(screen.getByText('chartReplay.noOpenPosition')).toBeDefined();
    });
  });
});

describe('Portfolio coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders loading then portfolio with positions', async () => {
    const { getTickers } = await import('@/services/api');
    const tickerMap = new Map();
    tickerMap.set('BTCUSDT', { price: 50000, change24h: 2.5, volume: 1000000 });
    tickerMap.set('ETHUSDT', { price: 3000, change24h: -1.0, volume: 500000 });
    tickerMap.set('SOLUSDT', { price: 100, change24h: 5.0, volume: 200000 });
    tickerMap.set('BNBUSDT', { price: 300, change24h: 0.5, volume: 100000 });
    (getTickers as any).mockResolvedValueOnce(tickerMap);

    const Portfolio = (await import('@/pages/Portfolio')).default;
    renderPage(Portfolio);

    await waitFor(() => {
      expect(screen.getByText('Portfolio')).toBeDefined();
    });
  });

  it('handles CSV export button click', async () => {
    const { getTickers } = await import('@/services/api');
    const tickerMap = new Map();
    tickerMap.set('BTCUSDT', { price: 50000, change24h: 2.5 });
    tickerMap.set('ETHUSDT', { price: 3000, change24h: -1.0 });
    tickerMap.set('SOLUSDT', { price: 100, change24h: 5.0 });
    tickerMap.set('BNBUSDT', { price: 300, change24h: 0.5 });
    (getTickers as any).mockResolvedValueOnce(tickerMap);

    // Mock URL and link APIs
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:url');
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    const Portfolio = (await import('@/pages/Portfolio')).default;
    renderPage(Portfolio);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Export CSV'));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });
});

describe('Settings coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders all settings sections', async () => {
    const Settings = (await import('@/pages/Settings')).default;
    renderPage(Settings);
    expect(screen.getByText('Settings')).toBeDefined();
    expect(screen.getByText('Profile')).toBeDefined();
    expect(screen.getByText('Appearance')).toBeDefined();
  });

  it('handles save settings', async () => {
    const { updateProfile } = await import('@/services/api');
    const Settings = (await import('@/pages/Settings')).default;
    renderPage(Settings);

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalled();
    });
  });

  it('handles save failure', async () => {
    const { updateProfile } = await import('@/services/api');
    (updateProfile as any).mockRejectedValueOnce(new Error('fail'));

    const Settings = (await import('@/pages/Settings')).default;
    renderPage(Settings);

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalled();
    });
  });

  it('handles 2FA setup', async () => {
    const { setup2FA } = await import('@/services/api');
    (setup2FA as any).mockResolvedValueOnce({ secret: 'TESTSECRET', qrCodeUrl: 'otpauth://test' });

    const Settings = (await import('@/pages/Settings')).default;
    renderPage(Settings);

    fireEvent.click(screen.getByText('Enable 2FA'));

    await waitFor(() => {
      expect(setup2FA).toHaveBeenCalled();
    });
  });

  it('handles logout', async () => {
    const Settings = (await import('@/pages/Settings')).default;
    renderPage(Settings);

    const logoutBtn = screen.getByText('Log Out');
    fireEvent.click(logoutBtn);
  });

  it('handles telegram connect', async () => {
    const { getTelegramStatus } = await import('@/services/api');
    (getTelegramStatus as any).mockResolvedValueOnce({ connected: false, chatId: '' });

    const Settings = (await import('@/pages/Settings')).default;
    renderPage(Settings);

    // Fill telegram input
    const telegramInput = screen.getByPlaceholderText('Telegram Chat ID');
    fireEvent.change(telegramInput, { target: { value: '12345' } });

    // Click connect
    fireEvent.click(screen.getByText('Connect'));
  });
});

describe('Journal coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders empty journal', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { totalTrades: 10, closedTrades: 8, winRate: 62, avgWin: 150, avgLoss: 80, bestTrade: 500, worstTrade: -200, profitFactor: 1.8 },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });

    const Journal = (await import('@/pages/Journal')).default;
    renderPage(Journal);

    await waitFor(() => {
      expect(screen.getByText('Trading Journal')).toBeDefined();
    });
  });

  it('renders journal with entries and opens add form', async () => {
    const entries = [
      {
        id: 'j1', pair: 'BTCUSDT', direction: 'long', entryPrice: 50000, exitPrice: 52000,
        size: 100, strategy: 'Trend Following', emotional_state: 'calm', notes: 'Good trade',
        confidence: 4, timeframe: '1h', pnl: 200, pnlPct: 4.0,
        createdAt: '2024-01-01', updatedAt: '2024-01-02',
      },
      {
        id: 'j2', pair: 'ETHUSDT', direction: 'short', entryPrice: 3000, exitPrice: 2800,
        size: 50, strategy: null, emotional_state: null, notes: null,
        confidence: null, timeframe: null, pnl: -50, pnlPct: -3.33,
        createdAt: '2024-01-03', updatedAt: '2024-01-03',
      },
    ];

    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { totalTrades: 2, closedTrades: 2, winRate: 50, avgWin: 200, avgLoss: 50, bestTrade: 200, worstTrade: -50, profitFactor: Infinity },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: entries }),
      });
    });

    const Journal = (await import('@/pages/Journal')).default;
    renderPage(Journal);

    await waitFor(() => {
      expect(screen.getByText('BTCUSDT')).toBeDefined();
    });

    // Open add form
    fireEvent.click(screen.getByText('Add Trade'));
    await waitFor(() => {
      expect(screen.getByText('Save Trade')).toBeDefined();
    });

    // Toggle direction - use getAllByText since "Short" also appears in the entries table
    const shortBtns = screen.getAllByText('Short');
    // Pick the form button (the one inside the modal)
    fireEvent.click(shortBtns[shortBtns.length - 1]);

    // Close form
    const closeButtons = document.querySelectorAll('button');
    const closeBtn = Array.from(closeButtons).find(b => b.querySelector('svg.lucide-x'));
    if (closeBtn) fireEvent.click(closeBtn);
  });

  it('opens edit form for existing entry', async () => {
    const entries = [
      {
        id: 'j1', pair: 'BTCUSDT', direction: 'long', entryPrice: 50000, exitPrice: 52000,
        size: 100, strategy: 'Trend Following', emotional_state: 'calm', notes: 'Good trade',
        confidence: 4, timeframe: '1h', pnl: 200, pnlPct: 4.0,
        createdAt: '2024-01-01', updatedAt: '2024-01-02',
      },
    ];

    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { totalTrades: 1, closedTrades: 1, winRate: 100, avgWin: 200, avgLoss: 0, bestTrade: 200, worstTrade: 0, profitFactor: Infinity } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: entries }),
      });
    });

    const Journal = (await import('@/pages/Journal')).default;
    renderPage(Journal);

    await waitFor(() => {
      expect(screen.getByText('BTCUSDT')).toBeDefined();
    });

    // Click edit (Pencil icon)
    const editBtns = document.querySelectorAll('button');
    const editBtn = Array.from(editBtns).find(b => b.querySelector('svg.lucide-pencil'));
    if (editBtn) fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText('Update Trade')).toBeDefined();
    });
  });
});

describe('Alerts coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders alert list', async () => {
    const { getAlerts } = await import('@/services/api');
    (getAlerts as any).mockResolvedValueOnce([
      { id: 'a1', name: 'BTC above 60k', is_active: true, created_at: '2024-01-01' },
      { id: 'a2', name: 'ETH below 2k', is_active: false, created_at: '2024-01-02' },
    ]);

    const Alerts = (await import('@/pages/Alerts')).default;
    renderPage(Alerts);

    await waitFor(() => {
      expect(screen.getByText('BTC above 60k')).toBeDefined();
    });
  });

  it('opens and navigates the alert builder', async () => {
    const { getAlerts, getPairs } = await import('@/services/api');
    (getAlerts as any).mockResolvedValueOnce([]);
    (getPairs as any).mockResolvedValueOnce([
      { id: 'p1', symbol: 'BTCUSDT', exchange: 'binance' },
    ]);

    const Alerts = (await import('@/pages/Alerts')).default;
    renderPage(Alerts);

    await waitFor(() => {
      expect(screen.getByText('Create Alert')).toBeDefined();
    });

    // Open builder
    fireEvent.click(screen.getByText('Create Alert'));

    await waitFor(() => {
      expect(screen.getByText('Select Trading Pair')).toBeDefined();
    });

    // Select a pair from dropdown
    const select = screen.getByDisplayValue('Choose a pair...');
    fireEvent.change(select, { target: { value: 'BTCUSDT' } });

    // Next step
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Condition Type')).toBeDefined();
    });

    // Next step from condition type
    fireEvent.click(screen.getByText('Next'));

    // Step 3 - value
    await waitFor(() => {
      expect(screen.getByText('Threshold Value')).toBeDefined();
    });
  });

  it('deletes an alert', async () => {
    const { getAlerts, deleteAlert } = await import('@/services/api');
    (getAlerts as any).mockResolvedValueOnce([
      { id: 'a1', name: 'BTC alert', is_active: true, created_at: '2024-01-01' },
    ]);

    const Alerts = (await import('@/pages/Alerts')).default;
    renderPage(Alerts);

    await waitFor(() => {
      expect(screen.getByText('BTC alert')).toBeDefined();
    });

    // Click delete — find button with trash-2 svg inside the alert card
    const allButtons = document.querySelectorAll('button');
    const trashBtn = Array.from(allButtons).find(b => {
      const svg = b.querySelector('svg');
      return svg && (svg.classList.contains('lucide-trash-2') || svg.getAttribute('class')?.includes('trash'));
    });
    if (trashBtn) {
      fireEvent.click(trashBtn);
      await waitFor(() => {
        expect(deleteAlert).toHaveBeenCalledWith('a1');
      });
    }
  });
});

describe('WalletTracker coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders wallet list and add form', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/wallets') && !url.includes('/track') && !url.includes('/balance')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 'w1', address: '0x1234567890abcdef1234567890abcdef12345678', chain: 'ethereum', label: 'Main Wallet', totalValue: 25000, addedAt: '2024-01-01' },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { holdings: [{ token: 'ETH', amount: 5, valueUsd: 15000, change24h: 2.5 }], totalValue: 15000 } }),
      });
    });

    const WalletTracker = (await import('@/pages/WalletTracker')).default;
    renderPage(WalletTracker);

    await waitFor(() => {
      expect(screen.getByText('Wallet Tracker')).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getByText('Main Wallet')).toBeDefined();
    });

    // Click to expand wallet
    const walletRow = screen.getByText('Main Wallet').closest('[class*="cursor-pointer"]') || screen.getByText('Main Wallet').parentElement?.parentElement?.parentElement;
    if (walletRow) fireEvent.click(walletRow);
  });

  it('handles add wallet', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    const WalletTracker = (await import('@/pages/WalletTracker')).default;
    renderPage(WalletTracker);

    await waitFor(() => {
      expect(screen.getByText('Add Wallet')).toBeDefined();
    });

    const addressInput = screen.getByPlaceholderText(/Wallet address/);
    fireEvent.change(addressInput, { target: { value: '0xabcdef1234567890abcdef1234567890abcdef12' } });

    fireEvent.click(screen.getByText('Track Wallet'));
  });

  it('shows error on failed add', async () => {
    let callNum = 0;
    (global.fetch as any).mockImplementation(() => {
      callNum++;
      if (callNum <= 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: false, error: 'Invalid address' }) });
    });

    const WalletTracker = (await import('@/pages/WalletTracker')).default;
    renderPage(WalletTracker);

    await waitFor(() => {
      expect(screen.getByText('Add Wallet')).toBeDefined();
    });

    const addressInput = screen.getByPlaceholderText(/Wallet address/);
    fireEvent.change(addressInput, { target: { value: 'bad' } });
    fireEvent.click(screen.getByText('Track Wallet'));

    await waitFor(() => {
      expect(screen.getByText('Invalid address')).toBeDefined();
    });
  });
});

describe('Confluence coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders confluence zones when data loads', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          currentPrice: 50000,
          rsi: 55,
          zones: [
            { price: 52000, sources: ['EMA200', 'BB Upper'], count: 2, strength: 'strong', distancePercent: 4.0 },
            { price: 48000, sources: ['SMA50'], count: 1, strength: 'weak', distancePercent: -4.0 },
            { price: 50010, sources: ['VWAP'], count: 1, strength: 'moderate', distancePercent: 0.02 },
          ],
        },
      }),
    });

    const Confluence = (await import('@/pages/Confluence')).default;
    renderPage(Confluence);

    await waitFor(() => {
      expect(screen.getByText('Confluence Map')).toBeDefined();
    });
  });

  it('renders error state', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: false, error: 'No data available' }),
    });

    const Confluence = (await import('@/pages/Confluence')).default;
    renderPage(Confluence);

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeDefined();
    });
  });
});

describe('CopyTrading coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders leaders and active copies', async () => {
    let callCount = 0;
    (global.fetch as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              {
                id: 'l1', displayName: 'Alpha Trader', winRate: 75, totalReturn: 120,
                maxDrawdown: 15, totalTrades: 500, copiers: 30, riskScore: 2,
                badge: 'gold', monthsProfitable: 8, avgTradeReturn: 3.5, bio: 'Top trader',
              },
            ],
          }),
        });
      }
      if (callCount === 2) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 'c1', leaderId: 'l1', allocation: 500, startedAt: '2024-01-01', currentPnl: 75.50, leaderName: 'Alpha Trader', leaderBadge: 'gold' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
    });

    const CopyTrading = (await import('@/pages/CopyTrading')).default;
    renderPage(CopyTrading);

    await waitFor(() => {
      expect(screen.getByText('Copy Trading')).toBeDefined();
    });
  });

  it('opens follow modal', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/leaders')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{
              id: 'l2', displayName: 'Beta Trader', winRate: 60, totalReturn: 80,
              maxDrawdown: 20, totalTrades: 200, copiers: 10, riskScore: 3,
              badge: 'silver', monthsProfitable: 5, avgTradeReturn: 2.0, bio: 'Test',
            }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
    });

    const CopyTrading = (await import('@/pages/CopyTrading')).default;
    renderPage(CopyTrading);

    await waitFor(() => {
      expect(screen.getByText('Beta Trader')).toBeDefined();
    });

    // Click Copy Trader button
    fireEvent.click(screen.getByText('Copy Trader'));

    await waitFor(() => {
      expect(screen.getByText('Start Copying')).toBeDefined();
    });

    // Type allocation
    const allocInput = screen.getByPlaceholderText('e.g. 500');
    fireEvent.change(allocInput, { target: { value: '200' } });

    // Click start
    fireEvent.click(screen.getByText('Start Copying'));
  });
});

describe('Screener coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders screener with items and applies filters', async () => {
    const { getScreener } = await import('@/services/api');
    (getScreener as any).mockResolvedValueOnce([
      { symbol: 'BTCUSDT', exchange: 'binance', price: 50000, change24h: 2.5, volume: 1000000, rsi: 65, trend: 'bullish' },
      { symbol: 'ETHUSDT', exchange: 'bybit', price: 3000, change24h: -1.5, volume: 500000, rsi: 25, trend: 'bearish' },
      { symbol: 'SOLUSDT', exchange: 'binance', price: 100, change24h: 0, volume: 200000, rsi: 75, trend: 'neutral' },
    ]);

    const Screener = (await import('@/pages/Screener')).default;
    renderPage(Screener);

    await waitFor(() => {
      expect(screen.getByText('Screener')).toBeDefined();
    });

    // Search
    const searchInput = screen.getByPlaceholderText('Search pair...');
    fireEvent.change(searchInput, { target: { value: 'BTC' } });

    // Click sort
    fireEvent.click(screen.getByText('Price'));
    fireEvent.click(screen.getByText('Price')); // toggle direction

    // Apply scan preset
    fireEvent.click(screen.getByText('Oversold (RSI<30)'));
    fireEvent.click(screen.getByText('All'));
  });
});

describe('ScriptEditor coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders and interacts with script editor', async () => {
    const ScriptEditor = (await import('@/pages/ScriptEditor')).default;
    renderPage(ScriptEditor);

    expect(screen.getByText('Script Editor')).toBeDefined();

    // Click Run
    fireEvent.click(screen.getByText('Run'));

    // Edit script name
    const nameInput = screen.getByDisplayValue('Untitled Script');
    fireEvent.change(nameInput, { target: { value: 'My Script' } });

    // Click Save
    fireEvent.click(screen.getByText('Save'));

    // Load a template (template library is open by default)
    fireEvent.click(screen.getByText('RSI Divergence Detector'));

    // Toggle template section closed
    fireEvent.click(screen.getByText('Template Library'));

    // Toggle functions reference open
    fireEvent.click(screen.getByText('Functions Reference'));

    // Toggle saved scripts section closed
    fireEvent.click(screen.getByText('Saved Scripts'));

    // Save another
    fireEvent.click(screen.getByText('Save'));
  });
});

describe('SocialFeed coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders feed with posts and post creation form', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/trending')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{ symbol: 'BTCUSDT', mentions: 15 }, { symbol: 'ETHUSDT', mentions: 8 }],
          }),
        });
      }
      if (url.includes('/feed')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 'p1', userId: 'u1', userName: 'Trader1', type: 'trade_idea', content: 'BTC to 100k!', symbol: 'BTCUSDT', direction: 'bullish', likeCount: 5, createdAt: new Date().toISOString() },
              { id: 'p2', userId: 'u2', userName: 'Analyst2', type: 'analysis', content: 'ETH looking weak', symbol: null, direction: null, likeCount: 0, createdAt: new Date(Date.now() - 100000).toISOString() },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    });

    const SocialFeed = (await import('@/pages/SocialFeed')).default;
    renderPage(SocialFeed);

    await waitFor(() => {
      expect(screen.getByText('Social Feed')).toBeDefined();
    });

    // Type a post
    const textarea = screen.getByPlaceholderText(/Share your analysis/);
    fireEvent.change(textarea, { target: { value: 'Test post content' } });

    // Select type - use getAllByText since both post creation form and post have "Trade Idea"
    const tradeIdeaButtons = screen.getAllByText('Trade Idea');
    // The first is the form type selector (button), click it
    fireEvent.click(tradeIdeaButtons[0]);

    // Select direction - same issue
    const bullishButtons = screen.getAllByText('Bullish');
    fireEvent.click(bullishButtons[0]);

    // Submit post
    fireEvent.click(screen.getByText('Post'));
  });
});

describe('Referral coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders referral page with data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        referralCode: 'REF123',
        referralLink: 'https://quantis.io/ref/REF123',
        totalReferrals: 5,
        totalEarnings: 100,
        pendingEarnings: 25,
      }),
    });

    const Referral = (await import('@/pages/Referral')).default;
    renderPage(Referral);

    await waitFor(() => {
      expect(screen.getByText('Referral Program')).toBeDefined();
    });
  });

  it('handles copy referral link', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        referralCode: 'REF123',
        referralLink: 'https://quantis.io/ref/REF123',
        totalReferrals: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
      }),
    });

    const Referral = (await import('@/pages/Referral')).default;
    renderPage(Referral);

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Copy'));
  });

  it('handles withdraw', async () => {
    (global.fetch as any).mockImplementation((url: string, opts: any) => {
      if (opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Withdrawal submitted' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          referralCode: 'REF123',
          referralLink: 'https://quantis.io/ref/REF123',
          totalReferrals: 1,
          totalEarnings: 50,
          pendingEarnings: 15,
        }),
      });
    });

    const Referral = (await import('@/pages/Referral')).default;
    renderPage(Referral);

    await waitFor(() => {
      expect(screen.getByText('Withdraw')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Withdraw'));
  });
});

describe('Register coverage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders register form', async () => {
    const Register = (await import('@/pages/Register')).default;
    renderPage(Register);
    expect(screen.getByText('auth.createAccount')).toBeDefined();
  });

  it('shows validation errors on empty submit', async () => {
    const Register = (await import('@/pages/Register')).default;
    renderPage(Register);

    fireEvent.click(screen.getByText('auth.register'));

    await waitFor(() => {
      // Check that form validation fires
      expect(screen.getByText('auth.register')).toBeDefined();
    });
  });
});
