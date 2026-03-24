/**
 * Deep tests for pages batch 3:
 * OpenInterest, Options, OrderFlow, PaperTrading, PatternScanner, Portfolio,
 * Pricing, Profile, Referral, RenkoChart, Screener, ScriptEditor, Seasonality,
 * Settings, Signals, SocialFeed, Status, TaxReport, Tokenomics, TokenScanner,
 * WalletTracker, WhaleAlert, WyckoffPhase
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
    getMarketRegime: vi.fn().mockResolvedValue({ regime: 'ranging', confidence: 70, description: 'test', regimeScore: 50, regimeLabel: 'ranging', indicators: { adx: 20, rsi: 50 }, components: { hurst: 0.5, choppiness: 50 }, recommended: ['Hold'] }),
    getPairs: mockArrayFn, getTicker: vi.fn().mockResolvedValue({ price: 50000, change24h: 1.5 }),
    getAlerts: mockArrayFn, createAlert: mockFn, deleteAlert: mockFn, updateProfile: mockFn,
    setup2FA: vi.fn().mockResolvedValue({ secret: 'secret', qrCodeUrl: 'url' }), verify2FA: mockFn,
    connectTelegram: mockFn, disconnectTelegram: mockFn,
    getTelegramStatus: vi.fn().mockResolvedValue({ connected: false, chatId: '' }), sendTelegramTest: mockFn,
    getAdminDashboard: vi.fn().mockResolvedValue({ totalUsers: 0, revenue: 0, activeUsers: 0 }),
    getAdminUsers: mockArrayFn, getSystemHealth: vi.fn().mockResolvedValue({ status: 'ok', services: [] }),
    updateUserTier: mockFn, getSignals: vi.fn().mockResolvedValue({ rows: [] }),
    getScreener: vi.fn().mockResolvedValue([]), getRegimeScores: mockArrayFn,
    getConfluence: mockFn, login: mockFn, register: mockFn,
    askCopilot: vi.fn().mockResolvedValue({ response: 'test' }),
    getDeFiOverview: vi.fn().mockResolvedValue({ protocols: [], totalTvl: 0, avgApy: 0, protocolCount: 0 }),
    getExchangeHealth: vi.fn().mockResolvedValue([]), getFundingRates: vi.fn().mockResolvedValue([]),
    getMarketBreadth: vi.fn().mockResolvedValue({ breadthScore: 50, components: {} }),
    getMarketProfile: vi.fn().mockResolvedValue({ poc: 0, vaHigh: 0, vaLow: 0 }),
    getNarratives: vi.fn().mockResolvedValue([]), getOpenInterest: vi.fn().mockResolvedValue([]),
    getCorrelation: vi.fn().mockResolvedValue({ matrix: [], symbols: [] }),
    getSeasonality: vi.fn().mockResolvedValue({ hourly: [], daily: [] }),
    getLiquidations: vi.fn().mockResolvedValue({ above: [], below: [] }),
    getOrderFlow: vi.fn().mockResolvedValue([]), getWhaleTransactions: vi.fn().mockResolvedValue([]),
    getNews: vi.fn().mockResolvedValue({ articles: [], total: 0 }),
    getLeaderboard: vi.fn().mockResolvedValue([]), getCopyTraders: vi.fn().mockResolvedValue([]),
    getJournalEntries: vi.fn().mockResolvedValue([]),
    createJournalEntry: mockFn, deleteJournalEntry: mockFn, updateJournalEntry: mockFn,
    getSocialFeed: vi.fn().mockResolvedValue({ posts: [] }), createPost: mockFn,
    getGamificationProfile: vi.fn().mockResolvedValue({ xp: 0, level: 1, streak: 0 }),
    getPaperPortfolio: vi.fn().mockResolvedValue({ balance: 100000, positions: [] }),
    placePaperOrder: mockFn, closePaperPosition: mockFn,
    getTrackedWallets: vi.fn().mockResolvedValue([]), trackWallet: mockFn, removeTrackedWallet: mockFn,
    getWalletBalance: vi.fn().mockResolvedValue({ holdings: [], totalValue: 0 }),
    getInfluencers: vi.fn().mockResolvedValue([]), getInfluencerConsensus: vi.fn().mockResolvedValue([]),
    getTokenomics: vi.fn().mockResolvedValue({}), compareTokenomics: vi.fn().mockResolvedValue([]),
    scanToken: vi.fn().mockResolvedValue({ score: 50, flags: [] }),
    getMarketplaceStrategies: vi.fn().mockResolvedValue([]),
    getTaxReport: vi.fn().mockResolvedValue({ trades: [], summary: {} }),
    getProfile: vi.fn().mockResolvedValue({ display_name: 'Test', xp: 0 }),
    getReferralStats: vi.fn().mockResolvedValue({ referrals: 0, earned: 0, link: '' }),
  };
});
vi.mock('@/services/socket', () => ({ connectSocket: vi.fn(), getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false })), disconnectSocket: vi.fn(), onConnectionStatus: vi.fn(), subscribeOHLCV: vi.fn(), unsubscribeOHLCV: vi.fn(), subscribeTicker: vi.fn(), unsubscribeTicker: vi.fn(), subscribeSignals: vi.fn(), unsubscribeSignals: vi.fn() }));
vi.mock('@/hooks/useWebSocket', () => ({ useWebSocket: vi.fn() }));
vi.mock('@/stores/auth', () => { const s = { user: { id: 'u1', email: 'test@test.com', tier: 'pro', display_name: 'Test', timezone: 'UTC', language: 'en', role: 'admin', is_admin: true }, isAuthenticated: true, isLoading: false, error: null, token: 'tok', loadUser: vi.fn(), login: vi.fn().mockResolvedValue({}), logout: vi.fn(), setUser: vi.fn(), register: vi.fn().mockResolvedValue({}), clearError: vi.fn() }; return { useAuthStore: vi.fn((sel) => typeof sel === 'function' ? sel(s) : s) }; });
vi.mock('@/stores/market', () => { const s = { tickers: new Map(), pairs: [], updateTicker: vi.fn(), updateTickers: vi.fn(), selectedPair: 'BTCUSDT', setSelectedPair: vi.fn(), selectedTimeframe: '1h', setSelectedTimeframe: vi.fn() }; return { useMarketStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(s) : s), TIMEFRAMES: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] }; });
vi.mock('@/stores/toast', () => { const s = { toasts: [], addToast: vi.fn(), removeToast: vi.fn() }; return { useToastStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(s) : s) }; });
vi.mock('@/stores/notifications', () => { const s = { notifications: [], unreadCount: 0, addNotification: vi.fn(), markAllRead: vi.fn() }; return { useNotificationStore: vi.fn((sel?: any) => typeof sel === 'function' ? sel(s) : s) }; });
vi.mock('@/stores/theme', () => ({ useThemeStore: vi.fn((sel) => typeof sel === 'function' ? sel({ theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }) : { theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, defaultOrOpts?: any) => typeof defaultOrOpts === 'string' ? defaultOrOpts : key, i18n: { language: 'en', changeLanguage: vi.fn() } }), Trans: ({ children }: any) => children }));
vi.mock('react-router-dom', async () => { const actual = await vi.importActual('react-router-dom'); return { ...actual, useNavigate: () => vi.fn(), useParams: () => ({}), useSearchParams: () => [new URLSearchParams(), vi.fn()] }; });
vi.mock('@/components/auth/GoogleSignInButton', () => ({ GoogleSignInButton: () => <div data-testid="google-signin">Google Sign In</div> }));
vi.mock('@/components/charts/TradingChart', () => ({ TradingChart: React.forwardRef((_: any, ref: any) => <div ref={ref} data-testid="trading-chart">Chart</div>) }));
vi.mock('@/components/charts/RSIChart', () => ({ RSIChart: () => <div data-testid="rsi-chart">RSI</div> }));
vi.mock('@/components/charts/ConfluenceHistory', () => ({ ConfluenceHistory: () => <div>Confluence</div> }));
vi.mock('@/components/charts/ConfluenceGauge', () => ({ ConfluenceGauge: () => <div>Gauge</div> }));
vi.mock('@/components/charts/DrawingToolbar', () => ({ DrawingToolbar: () => <div>DrawingToolbar</div> }));
vi.mock('@/components/dashboard/WatchlistStrip', () => ({ WatchlistStrip: () => <div>Watchlist</div> }));
vi.mock('@/components/dashboard/ConfluenceGauge', () => ({ ConfluenceGauge: () => <div>Gauge</div> }));
vi.mock('@/components/dashboard/SignalCard', () => ({ SignalCard: () => <div>Signal</div> }));
vi.mock('@/components/common/ConnectionStatus', () => ({ ConnectionStatus: () => <div>Connected</div>, default: () => <div>Connected</div> }));
vi.mock('react-helmet-async', () => ({ Helmet: ({ children }: any) => null, HelmetProvider: ({ children }: any) => children }));


HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), scale: vi.fn(), createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }), fillRect: vi.fn(), strokeRect: vi.fn(), setLineDash: vi.fn(), fillText: vi.fn(), strokeStyle: '', fillStyle: '', lineWidth: 0, lineCap: '', lineJoin: '', font: '', textAlign: '', textBaseline: '' }) as any;
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) }) as any;
Element.prototype.scrollIntoView = vi.fn();
global.ResizeObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));
global.IntersectionObserver = vi.fn().mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeRender(Page: React.ComponentType) {
  try { return render(<MemoryRouter><Page /></MemoryRouter>); } catch { return null; }
}

async function renderAsync(Page: React.ComponentType) {
  let result: ReturnType<typeof render> | null = null;
  await act(async () => { result = render(<MemoryRouter><Page /></MemoryRouter>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
  return result!;
}

// Pages that need async rendering (have loading states with fetch)
const asyncPages = new Set(['OpenInterest', 'Pricing', 'Profile', 'Referral', 'Screener', 'Signals', 'SocialFeed', 'Tokenomics', 'WalletTracker']);

type TestCase = [string, (r: ReturnType<typeof render>) => void | Promise<void>];

const pageTests: Record<string, TestCase[]> = {
  OpenInterest: [
    ['shows heading', async () => { await waitFor(() => expect(screen.getByText('Open Interest')).toBeDefined()); }],
    ['shows Total Open Interest card', async () => { await waitFor(() => expect(screen.getByText('Total Open Interest')).toBeDefined()); }],
    ['shows 24H OI Change card', async () => { await waitFor(() => expect(screen.getByText('24H OI Change')).toBeDefined()); }],
    ['shows Divergences Detected card', async () => { await waitFor(() => expect(screen.getByText('Divergences Detected')).toBeDefined()); }],
    ['shows Symbol table header', async () => { await waitFor(() => expect(screen.getByText('Symbol')).toBeDefined()); }],
    ['shows empty state', async () => { await waitFor(() => expect(screen.getByText('No open interest data available')).toBeDefined()); }],
  ],
  Options: [
    ['shows heading', () => { expect(screen.getByText('Options Analytics')).toBeDefined(); }],
    ['shows subtitle', () => { expect(screen.getByText('Simulated options chain with Greeks, IV smile, and Max Pain')).toBeDefined(); }],
    ['shows BTC button', () => { expect(screen.getByText('BTC')).toBeDefined(); }],
    ['shows ETH button', () => { expect(screen.getByText('ETH')).toBeDefined(); }],
    ['shows SOL button', () => { expect(screen.getByText('SOL')).toBeDefined(); }],
  ],
  OrderFlow: [
    ['shows heading', () => { expect(screen.getByText('Order Flow')).toBeDefined(); }],
    ['has select dropdown', (r) => { expect(r.container.querySelector('select')).not.toBeNull(); }],
    ['has 10+ symbol options', (r) => { expect(r.container.querySelectorAll('option').length).toBeGreaterThanOrEqual(10); }],
  ],
  PaperTrading: [
    ['shows heading', () => { expect(screen.getByText('Paper Trading')).toBeDefined(); }],
    ['shows subtitle', () => { expect(screen.getByText('Practice trading with virtual $10,000')).toBeDefined(); }],
    ['shows Balance card', () => { expect(screen.getByText('Balance')).toBeDefined(); }],
    ['shows Quick Trade', () => { expect(screen.getByText('Quick Trade')).toBeDefined(); }],
    ['shows Buy button', () => { expect(screen.getByText('Buy')).toBeDefined(); }],
    ['shows Sell button', () => { expect(screen.getByText('Sell')).toBeDefined(); }],
    ['shows No open positions', () => { expect(screen.getByText('No open positions')).toBeDefined(); }],
  ],
  PatternScanner: [
    ['shows heading', () => { expect(screen.getByText('Pattern Scanner')).toBeDefined(); }],
    ['shows Total Patterns', () => { expect(screen.getByText('Total Patterns')).toBeDefined(); }],
    ['shows Bullish', () => { expect(screen.getByText('Bullish')).toBeDefined(); }],
    ['shows Bearish', () => { expect(screen.getByText('Bearish')).toBeDefined(); }],
    ['shows Dominant Signal', () => { expect(screen.getByText('Dominant Signal')).toBeDefined(); }],
    ['has 2+ selectors', (r) => { expect(r.container.querySelectorAll('select').length).toBeGreaterThanOrEqual(2); }],
  ],
  Portfolio: [
    ['shows heading', () => { expect(screen.getByText('Portfolio')).toBeDefined(); }],
    ['shows subtitle', () => { expect(screen.getByText('Track your holdings across exchanges')).toBeDefined(); }],
    ['shows Export CSV', () => { expect(screen.getByText('Export CSV')).toBeDefined(); }],
    ['shows Demo Mode', () => { expect(screen.getByText('Demo Mode')).toBeDefined(); }],
    ['shows Binance', () => { expect(screen.getByText('Binance')).toBeDefined(); }],
    ['shows read-only API note', () => { expect(screen.getByText('Read-only API keys only.')).toBeDefined(); }],
  ],
  Pricing: [
    ['shows heading', async () => { await waitFor(() => expect(screen.getByText('Simple, transparent pricing')).toBeDefined()); }],
    ['shows Monthly toggle', async () => { await waitFor(() => expect(screen.getByText('Monthly')).toBeDefined()); }],
    ['shows Annual toggle', async () => { await waitFor(() => expect(screen.getByText('Annual')).toBeDefined()); }],
    ['shows Quantis brand', async () => { await waitFor(() => expect(screen.getByText('Quantis')).toBeDefined()); }],
    ['shows FAQ section', async () => { await waitFor(() => expect(screen.getByText('Frequently Asked Questions')).toBeDefined()); }],
    ['shows NOWPayments', async () => { await waitFor(() => expect(screen.getByText('NOWPayments')).toBeDefined()); }],
  ],
  Profile: [
    ['shows user email prefix', async () => { await waitFor(() => expect(screen.getByText('test')).toBeDefined()); }],
    ['shows XP progress', async () => { await waitFor(() => expect(screen.getByText('profile.xpProgress')).toBeDefined()); }],
    ['shows totalXP label', async () => { await waitFor(() => expect(screen.getByText('profile.totalXP')).toBeDefined()); }],
    ['shows achievements section', async () => { await waitFor(() => expect(screen.getByText('profile.achievements')).toBeDefined()); }],
    ['shows recent activity', async () => { await waitFor(() => expect(screen.getByText('profile.recentActivity')).toBeDefined()); }],
    ['shows no activity empty state', async () => { await waitFor(() => expect(screen.getByText('profile.noActivity')).toBeDefined()); }],
  ],
  Referral: [
    ['shows heading', async () => { await waitFor(() => expect(screen.getByText('Referral Program')).toBeDefined()); }],
    ['shows Your Referral Link', async () => { await waitFor(() => expect(screen.getByText('Your Referral Link')).toBeDefined()); }],
    ['shows Total Referrals', async () => { await waitFor(() => expect(screen.getByText('Total Referrals')).toBeDefined()); }],
    ['shows Total Earnings', async () => { await waitFor(() => expect(screen.getByText('Total Earnings')).toBeDefined()); }],
    ['shows How It Works', async () => { await waitFor(() => expect(screen.getByText('How It Works')).toBeDefined()); }],
    ['shows Referral History', async () => { await waitFor(() => expect(screen.getByText('Referral History')).toBeDefined()); }],
  ],
  RenkoChart: [
    ['shows heading', () => { expect(screen.getByText('Renko Chart')).toBeDefined(); }],
    ['shows subtitle', () => { expect(screen.getByText('Non-time-based price chart using fixed brick sizes')).toBeDefined(); }],
    ['shows BTC button', () => { expect(screen.getByText('BTC')).toBeDefined(); }],
    ['shows ETH button', () => { expect(screen.getByText('ETH')).toBeDefined(); }],
    ['has div container', (r) => { expect(r.container.querySelector('div')).not.toBeNull(); }],
  ],
  Screener: [
    ['shows heading', async () => { await waitFor(() => expect(screen.getByText('Screener')).toBeDefined()); }],
    ['shows search placeholder', async () => { await waitFor(() => expect(screen.getByPlaceholderText('Search pair...')).toBeDefined()); }],
    ['shows Oversold preset', async () => { await waitFor(() => expect(screen.getByText('Oversold (RSI<30)')).toBeDefined()); }],
    ['shows Volume Surge preset', async () => { await waitFor(() => expect(screen.getByText('Volume Surge')).toBeDefined()); }],
    ['shows No results found', async () => { await waitFor(() => expect(screen.getByText('No results found')).toBeDefined()); }],
  ],
  ScriptEditor: [
    ['shows heading', () => { expect(screen.getByText('Script Editor')).toBeDefined(); }],
    ['shows subtitle', () => { expect(screen.getByText('Write custom indicators with Quantis Script')).toBeDefined(); }],
    ['shows Pro plan badge', () => { expect(screen.getByText('Available on Pro plan')).toBeDefined(); }],
    ['shows Template Library', () => { expect(screen.getByText('Template Library')).toBeDefined(); }],
    ['shows Saved Scripts', () => { expect(screen.getByText('Saved Scripts')).toBeDefined(); }],
    ['shows Run button', () => { expect(screen.getByText('Run')).toBeDefined(); }],
    ['shows Save button', () => { expect(screen.getByText('Save')).toBeDefined(); }],
    ['shows status bar', () => { expect(screen.getByText('Quantis Script v1.0')).toBeDefined(); }],
  ],
  Seasonality: [
    ['shows heading', () => { expect(screen.getByText('Seasonality Analytics')).toBeDefined(); }],
    ['shows subtitle', () => { expect(screen.getByText('Discover time-based performance patterns')).toBeDefined(); }],
    ['has symbol selector', (r) => { expect(r.container.querySelector('select')).not.toBeNull(); }],
    ['shows loading text', () => { expect(screen.getByText('Loading seasonality data...')).toBeDefined(); }],
  ],
  Settings: [
    ['shows heading', () => { expect(screen.getByText('Settings')).toBeDefined(); }],
    ['shows Profile card', () => { expect(screen.getByText('Profile')).toBeDefined(); }],
    ['shows Appearance card', () => { expect(screen.getByText('Appearance')).toBeDefined(); }],
    ['shows Language card', () => { expect(screen.getByText('Language')).toBeDefined(); }],
    ['shows Account card', () => { expect(screen.getByText('Account')).toBeDefined(); }],
    ['shows 2FA card', () => { expect(screen.getByText('Two-Factor Authentication')).toBeDefined(); }],
    ['shows Danger Zone', () => { expect(screen.getByText('Danger Zone')).toBeDefined(); }],
    ['shows Delete Account', () => { expect(screen.getByText('Delete Account')).toBeDefined(); }],
  ],
  Signals: [
    ['shows heading', async () => { await waitFor(() => expect(screen.getByText('Trading Signals')).toBeDefined()); }],
    ['shows Analysis Engine Running', async () => { await waitFor(() => expect(screen.getByText('Analysis Engine Running')).toBeDefined()); }],
    ['shows monitoring description', async () => { await waitFor(() => expect(screen.getByText(/Monitoring 10 pairs every 60 seconds/)).toBeDefined()); }],
    ['shows Trend Following', async () => { await waitFor(() => expect(screen.getByText('Trend Following:')).toBeDefined()); }],
    ['shows Mean Reversion', async () => { await waitFor(() => expect(screen.getByText('Mean Reversion:')).toBeDefined()); }],
  ],
  SocialFeed: [
    ['shows heading', async () => { await waitFor(() => expect(screen.getByText('Social Feed')).toBeDefined()); }],
    ['shows Trending Symbols', async () => { await waitFor(() => expect(screen.getByText('Trending Symbols')).toBeDefined()); }],
    ['shows textarea placeholder', async () => { await waitFor(() => expect(screen.getByPlaceholderText('Share your analysis, trade idea, or thoughts...')).toBeDefined()); }],
    ['shows Post button', async () => { await waitFor(() => expect(screen.getByText('Post')).toBeDefined()); }],
    ['shows empty feed', async () => { await waitFor(() => expect(screen.getByText('No posts yet. Be the first to share!')).toBeDefined()); }],
  ],
  Status: [
    ['shows Quantis Status', () => { expect(screen.getByText('Quantis Status')).toBeDefined(); }],
    ['shows Refresh', () => { expect(screen.getByText('Refresh')).toBeDefined(); }],
    ['shows checking status', () => { expect(screen.getByText('Checking system status...')).toBeDefined(); }],
    ['has header element', (r) => { expect(r.container.querySelector('header')).not.toBeNull(); }],
    ['has main element', (r) => { expect(r.container.querySelector('main')).not.toBeNull(); }],
  ],
  TaxReport: [
    ['shows heading', () => { expect(screen.getByText('Tax Report')).toBeDefined(); }],
    ['shows subtitle', () => { expect(screen.getByText(/Estimated tax summary from paper trades/)).toBeDefined(); }],
    ['shows 2026 year', () => { expect(screen.getByText('2026')).toBeDefined(); }],
    ['shows 2025 year', () => { expect(screen.getByText('2025')).toBeDefined(); }],
    ['shows FIFO', () => { expect(screen.getByText('FIFO')).toBeDefined(); }],
    ['shows Download CSV', () => { expect(screen.getByText('Download CSV')).toBeDefined(); }],
    ['shows Download PDF', () => { expect(screen.getByText('Download PDF')).toBeDefined(); }],
  ],
  Tokenomics: [
    ['shows heading', async () => { await waitFor(() => expect(screen.getByText('Tokenomics Analyzer')).toBeDefined()); }],
    ['shows subtitle', async () => { await waitFor(() => expect(screen.getByText(/Supply metrics, inflation, and tokenomics scores/)).toBeDefined()); }],
    ['shows BTC filter', async () => { await waitFor(() => expect(screen.getByText('BTC')).toBeDefined()); }],
    ['shows ETH filter', async () => { await waitFor(() => expect(screen.getByText('ETH')).toBeDefined()); }],
    ['shows XRP filter', async () => { await waitFor(() => expect(screen.getByText('XRP')).toBeDefined()); }],
  ],
  TokenScanner: [
    ['shows heading', () => { expect(screen.getByText('Token Risk Scanner')).toBeDefined(); }],
    ['shows subtitle', () => { expect(screen.getByText('Analyze any token for risk factors before trading')).toBeDefined(); }],
    ['shows search placeholder', () => { expect(screen.getByPlaceholderText('Enter symbol (e.g. BTCUSDT)')).toBeDefined(); }],
    ['shows Scan button', () => { expect(screen.getByText('Scan')).toBeDefined(); }],
    ['has buttons', (r) => { expect(r.container.querySelectorAll('button').length).toBeGreaterThanOrEqual(1); }],
  ],
  WalletTracker: [
    ['shows heading', async () => { await waitFor(() => expect(screen.getByText('Wallet Tracker')).toBeDefined()); }],
    ['shows Add Wallet', async () => { await waitFor(() => expect(screen.getByText('Add Wallet')).toBeDefined()); }],
    ['shows address placeholder', async () => { await waitFor(() => expect(screen.getByPlaceholderText('Wallet address (0x... / base58...)')).toBeDefined()); }],
    ['shows Track Wallet button', async () => { await waitFor(() => expect(screen.getByText('Track Wallet')).toBeDefined()); }],
    ['shows Tracked Wallets heading', async () => { await waitFor(() => expect(screen.getByText('Tracked Wallets')).toBeDefined()); }],
    ['shows empty wallets message', async () => { await waitFor(() => expect(screen.getByText('No wallets tracked yet. Add your first wallet above.')).toBeDefined()); }],
  ],
  WhaleAlert: [
    ['shows Alert Dashboard', () => { expect(screen.getByText('Alert Dashboard')).toBeDefined(); }],
    ['shows subtitle', () => { expect(screen.getByText('Large volume spike detection across trading pairs')).toBeDefined(); }],
    ['shows Refresh', () => { expect(screen.getByText('Refresh')).toBeDefined(); }],
    ['shows Total Alerts', () => { expect(screen.getByText('Total Alerts')).toBeDefined(); }],
    ['shows Biggest Transaction', () => { expect(screen.getByText('Biggest Transaction')).toBeDefined(); }],
    ['shows Most Active Pair', () => { expect(screen.getByText('Most Active Pair')).toBeDefined(); }],
  ],
  WyckoffPhase: [
    ['shows heading', () => { expect(screen.getByText('Wyckoff Phase')).toBeDefined(); }],
    ['has symbol select', (r) => { expect(r.container.querySelector('select')).not.toBeNull(); }],
    ['has BTCUSDT option', (r) => { const opts = Array.from(r.container.querySelectorAll('option')).map((o) => o.textContent); expect(opts).toContain('BTCUSDT'); }],
    ['has ETHUSDT option', (r) => { const opts = Array.from(r.container.querySelectorAll('option')).map((o) => o.textContent); expect(opts).toContain('ETHUSDT'); }],
    ['shows loading text', () => { expect(screen.getByText('Analyzing Wyckoff structure...')).toBeDefined(); }],
    ['has buttons', (r) => { expect(r.container.querySelectorAll('button').length).toBeGreaterThanOrEqual(1); }],
  ],
};

// ---------------------------------------------------------------------------
// Generate test suites
// ---------------------------------------------------------------------------

const allPages = Object.keys(pageTests);

describe.each(allPages)('%s deep tests', (pageName) => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crash', async () => {
    const mod = await import(`@/pages/${pageName}`);
    const Page = mod.default;
    if (asyncPages.has(pageName)) {
      const result = await renderAsync(Page);
      expect(result?.container).toBeDefined();
    } else {
      const result = safeRender(Page);
      expect(result?.container).toBeDefined();
    }
  });

  const tests = pageTests[pageName] || [];
  for (const [testName, assertFn] of tests) {
    it(testName, async () => {
      const mod = await import(`@/pages/${pageName}`);
      const Page = mod.default;
      if (asyncPages.has(pageName)) {
        const result = await renderAsync(Page);
        await assertFn(result);
      } else {
        const result = safeRender(Page)!;
        await assertFn(result);
      }
    });
  }
});
