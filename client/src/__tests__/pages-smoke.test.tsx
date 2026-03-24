/**
 * Smoke tests for ALL 65 pages.
 *
 * Each page is dynamically imported and rendered inside a MemoryRouter.
 * The test passes if the component renders without throwing.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Global mocks — must appear before any page import
// ---------------------------------------------------------------------------

// Services
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

vi.mock('@/stores/market', () => {
  const state = { tickers: new Map(), pairs: [], updateTicker: vi.fn(), updateTickers: vi.fn(), selectedPair: 'BTCUSDT', setSelectedPair: vi.fn(), selectedTimeframe: '1h', setSelectedTimeframe: vi.fn() };
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

// Mock chart components that use canvas/lightweight-charts
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


// Mock canvas getContext for pages using canvas (Dashboard, Portfolio, etc.)
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
  createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
}) as any;

// Mock fetch globally for pages that call fetch() directly
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true, data: [] }),
}) as any;

// Mock ResizeObserver
// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Page smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const pages: [string, () => Promise<{ default: React.ComponentType }>][] = [
    ['Academy', () => import('@/pages/Academy')],
    ['Admin', () => import('@/pages/Admin')],
    ['Alerts', () => import('@/pages/Alerts')],
    ['AntiLiquidation', () => import('@/pages/AntiLiquidation')],
    ['APIDocs', () => import('@/pages/APIDocs')],
    ['BitcoinModels', () => import('@/pages/BitcoinModels')],
    ['Chart', () => import('@/pages/Chart')],
    ['ChartReplay', () => import('@/pages/ChartReplay')],
    ['Confluence', () => import('@/pages/Confluence')],
    ['Copilot', () => import('@/pages/Copilot')],
    ['CopyTrading', () => import('@/pages/CopyTrading')],
    ['Correlation', () => import('@/pages/Correlation')],
    ['Dashboard', () => import('@/pages/Dashboard')],
    ['DCABot', () => import('@/pages/DCABot')],
    ['DeFi', () => import('@/pages/DeFi')],
    ['DevActivity', () => import('@/pages/DevActivity')],
    ['ElliottWave', () => import('@/pages/ElliottWave')],
    ['ExchangeHealth', () => import('@/pages/ExchangeHealth')],
    ['FundingRates', () => import('@/pages/FundingRates')],
    ['HarmonicPatterns', () => import('@/pages/HarmonicPatterns')],
    ['Heatmap', () => import('@/pages/Heatmap')],
    ['IndicatorLibrary', () => import('@/pages/IndicatorLibrary')],
    ['InfluencerTracker', () => import('@/pages/InfluencerTracker')],
    ['IntermarketAnalysis', () => import('@/pages/IntermarketAnalysis')],
    ['Journal', () => import('@/pages/Journal')],
    ['Landing', () => import('@/pages/Landing')],
    ['Leaderboard', () => import('@/pages/Leaderboard')],
    ['Liquidations', () => import('@/pages/Liquidations')],
    ['Login', () => import('@/pages/Login')],
    ['MarketBreadth', () => import('@/pages/MarketBreadth')],
    ['MarketProfile', () => import('@/pages/MarketProfile')],
    ['MarketRegime', () => import('@/pages/MarketRegime')],
    ['Marketplace', () => import('@/pages/Marketplace')],
    ['MultiChart', () => import('@/pages/MultiChart')],
    ['Narratives', () => import('@/pages/Narratives')],
    ['NetworkMetrics', () => import('@/pages/NetworkMetrics')],
    ['News', () => import('@/pages/News')],
    ['NotFound', () => import('@/pages/NotFound')],
    ['OpenInterest', () => import('@/pages/OpenInterest')],
    ['Options', () => import('@/pages/Options')],
    ['OrderFlow', () => import('@/pages/OrderFlow')],
    ['PaperTrading', () => import('@/pages/PaperTrading')],
    ['PatternScanner', () => import('@/pages/PatternScanner')],
    ['Portfolio', () => import('@/pages/Portfolio')],
    ['Pricing', () => import('@/pages/Pricing')],
    ['Privacy', () => import('@/pages/Privacy')],
    ['Profile', () => import('@/pages/Profile')],
    ['Referral', () => import('@/pages/Referral')],
    ['Register', () => import('@/pages/Register')],
    ['RenkoChart', () => import('@/pages/RenkoChart')],
    ['Screener', () => import('@/pages/Screener')],
    ['ScriptEditor', () => import('@/pages/ScriptEditor')],
    ['Seasonality', () => import('@/pages/Seasonality')],
    ['Settings', () => import('@/pages/Settings')],
    ['Signals', () => import('@/pages/Signals')],
    ['SocialFeed', () => import('@/pages/SocialFeed')],
    ['Status', () => import('@/pages/Status')],
    ['TaxReport', () => import('@/pages/TaxReport')],
    ['Terms', () => import('@/pages/Terms')],
    ['Tokenomics', () => import('@/pages/Tokenomics')],
    ['TokenScanner', () => import('@/pages/TokenScanner')],
    ['WalletTracker', () => import('@/pages/WalletTracker')],
    ['WhaleAlert', () => import('@/pages/WhaleAlert')],
    ['WyckoffPhase', () => import('@/pages/WyckoffPhase')],
  ];

  // Verify we have all 64 pages listed (all page files in src/pages/)
  it('has all 64 pages in the test list', () => {
    expect(pages.length).toBe(64);
    // Landing is included, NotFound is included — double-check a few
    expect(pages.map((p) => p[0])).toContain('Dashboard');
    expect(pages.map((p) => p[0])).toContain('NotFound');
    expect(pages.map((p) => p[0])).toContain('Landing');
  });

  it.each(pages)('%s renders without crash', async (_name, loader) => {
    const mod = await loader();
    const Page = mod.default;
    const { container } = render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    expect(container).toBeDefined();
  });
});
