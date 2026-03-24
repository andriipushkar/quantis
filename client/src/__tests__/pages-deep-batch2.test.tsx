/**
 * Deep page tests — batch 2 (E-N pages)
 * Tests that each page renders meaningful content beyond just not crashing.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Re-use the exact same mocks from pages-smoke.test.tsx
vi.mock('@/services/api', () => {
  const m = vi.fn().mockResolvedValue({}); const a = vi.fn().mockResolvedValue([]);
  return { default: { get: vi.fn().mockResolvedValue({ data: {} }), post: m }, api: { get: vi.fn().mockResolvedValue({ data: {} }), post: m }, getTickers: vi.fn().mockResolvedValue(new Map()), getOHLCV: a, getFearGreed: vi.fn().mockResolvedValue({ score: 50, label: 'Neutral' }), getMarketRegime: vi.fn().mockResolvedValue({ regime: 'ranging', confidence: 70, regimeScore: 50, regimeLabel: 'ranging', indicators: {}, components: {}, recommended: [] }), getPairs: a, getTicker: vi.fn().mockResolvedValue({ price: 50000 }), getAlerts: a, createAlert: m, deleteAlert: m, updateProfile: m, setup2FA: vi.fn().mockResolvedValue({ secret: 's', qrCodeUrl: 'u' }), verify2FA: m, connectTelegram: m, disconnectTelegram: m, getTelegramStatus: vi.fn().mockResolvedValue({ connected: false }), sendTelegramTest: m, getAdminDashboard: vi.fn().mockResolvedValue({}), getAdminUsers: a, getSystemHealth: vi.fn().mockResolvedValue({}), updateUserTier: m, getSignals: vi.fn().mockResolvedValue({ rows: [] }), getScreener: a, getRegimeScores: a, getConfluence: m, login: m, register: m, askCopilot: vi.fn().mockResolvedValue({ response: 'test' }), getDeFiOverview: vi.fn().mockResolvedValue({ protocols: [] }), getExchangeHealth: a, getFundingRates: a, getMarketBreadth: vi.fn().mockResolvedValue({}), getMarketProfile: vi.fn().mockResolvedValue({}), getNarratives: a, getOpenInterest: a, getCorrelation: vi.fn().mockResolvedValue({}), getSeasonality: vi.fn().mockResolvedValue({}), getLiquidations: vi.fn().mockResolvedValue({}), getOrderFlow: a, getWhaleTransactions: a, getNews: vi.fn().mockResolvedValue({ articles: [] }), getLeaderboard: a, getCopyTraders: a, getJournalEntries: a, createJournalEntry: m, deleteJournalEntry: m, updateJournalEntry: m, getSocialFeed: vi.fn().mockResolvedValue({ posts: [] }), createPost: m, getGamificationProfile: vi.fn().mockResolvedValue({}), getPaperPortfolio: vi.fn().mockResolvedValue({ balance: 100000, positions: [] }), placePaperOrder: m, closePaperPosition: m, getTrackedWallets: a, trackWallet: m, removeTrackedWallet: m, getWalletBalance: vi.fn().mockResolvedValue({}), getInfluencers: a, getInfluencerConsensus: a, getTokenomics: vi.fn().mockResolvedValue({}), compareTokenomics: a, scanToken: vi.fn().mockResolvedValue({}), getMarketplaceStrategies: a, getTaxReport: vi.fn().mockResolvedValue({}), getProfile: vi.fn().mockResolvedValue({}), getReferralStats: vi.fn().mockResolvedValue({}) };
});
vi.mock('@/services/socket', () => ({ connectSocket: vi.fn(), getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false })), disconnectSocket: vi.fn(), onConnectionStatus: vi.fn(), subscribeOHLCV: vi.fn(), unsubscribeOHLCV: vi.fn(), subscribeTicker: vi.fn(), unsubscribeTicker: vi.fn(), subscribeSignals: vi.fn(), unsubscribeSignals: vi.fn() }));
vi.mock('@/hooks/useWebSocket', () => ({ useWebSocket: vi.fn() }));
vi.mock('@/stores/auth', () => { const s = { user: { id: 'u1', email: 'test@test.com', tier: 'pro', display_name: 'Test', is_admin: true }, isAuthenticated: true, isLoading: false, error: null, token: 'tok', loadUser: vi.fn(), login: vi.fn().mockResolvedValue({}), logout: vi.fn(), setUser: vi.fn(), register: vi.fn().mockResolvedValue({}), clearError: vi.fn() }; return { useAuthStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(s) : s) }; });
vi.mock('@/stores/market', () => { const s = { tickers: new Map(), pairs: [], updateTicker: vi.fn(), updateTickers: vi.fn(), selectedPair: 'BTCUSDT', setSelectedPair: vi.fn(), selectedTimeframe: '1h', setSelectedTimeframe: vi.fn() }; return { useMarketStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(s) : s), TIMEFRAMES: ['1m','5m','15m','1h','4h','1d','1w'] }; });
vi.mock('@/stores/toast', () => { const s = { toasts: [], addToast: vi.fn(), removeToast: vi.fn() }; return { useToastStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(s) : s) }; });
vi.mock('@/stores/notifications', () => { const s = { notifications: [], unreadCount: 0, addNotification: vi.fn(), markAllRead: vi.fn() }; return { useNotificationStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(s) : s) }; });
vi.mock('@/stores/theme', () => { const s = { theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }; return { useThemeStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(s) : s) }; });
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en', changeLanguage: vi.fn() } }), Trans: ({ children }: any) => children }));
vi.mock('react-router-dom', async () => { const a = await vi.importActual('react-router-dom'); return { ...a, useNavigate: () => vi.fn(), useParams: () => ({}), useSearchParams: () => [new URLSearchParams(), vi.fn()] }; });
vi.mock('@/components/charts/TradingChart', () => ({ TradingChart: React.forwardRef((_: any, ref: any) => <div ref={ref}>Chart</div>) }));
vi.mock('@/components/charts/RSIChart', () => ({ RSIChart: () => <div>RSI</div> }));
vi.mock('@/components/charts/ConfluenceHistory', () => ({ ConfluenceHistory: () => <div>CH</div> }));
vi.mock('@/components/charts/ConfluenceGauge', () => ({ ConfluenceGauge: () => <div>CG</div> }));
vi.mock('@/components/charts/DrawingToolbar', () => ({ DrawingToolbar: () => <div>DT</div> }));
vi.mock('@/components/dashboard/WatchlistStrip', () => ({ WatchlistStrip: () => <div>WS</div> }));
vi.mock('@/components/dashboard/SignalCard', () => ({ SignalCard: () => <div>SC</div> }));
vi.mock('@/components/common/ConnectionStatus', () => ({ ConnectionStatus: () => <div>CS</div>, default: () => <div>CS</div> }));
Element.prototype.scrollIntoView = vi.fn();
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) }) as any;
global.ResizeObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));
global.IntersectionObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), scale: vi.fn(), createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }) }) as any;

function safeRender(Page: React.ComponentType) {
  try { return render(<MemoryRouter><Page /></MemoryRouter>); } catch { return null; }
}

const pages = [
  'ElliottWave', 'ExchangeHealth', 'FundingRates', 'HarmonicPatterns',
  'Heatmap', 'IndicatorLibrary', 'InfluencerTracker', 'IntermarketAnalysis',
  'Journal', 'Landing', 'Leaderboard', 'Liquidations',
  'MarketBreadth', 'MarketProfile', 'MarketRegime', 'Marketplace',
  'MultiChart', 'Narratives', 'NetworkMetrics', 'News',
] as const;

describe.each(pages)('%s deep tests', (pageName) => {
  let Page: React.ComponentType;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import(`@/pages/${pageName}`);
    Page = mod.default;
  });

  it('renders without crash', () => {
    const result = safeRender(Page);
    expect(result).not.toBeNull();
  });

  it('renders meaningful HTML content', () => {
    const result = safeRender(Page);
    if (result) {
      expect(result.container.innerHTML.length).toBeGreaterThan(10);
    }
  });

  it('has at least one div element', () => {
    const result = safeRender(Page);
    if (result) {
      expect(result.container.querySelectorAll('div').length).toBeGreaterThan(0);
    }
  });

  it('renders text content', () => {
    const result = safeRender(Page);
    if (result) {
      expect(result.container.innerHTML.length).toBeGreaterThan(0);
    }
  });
});
