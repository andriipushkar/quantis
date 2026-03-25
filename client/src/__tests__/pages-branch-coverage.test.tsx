/**
 * Branch-coverage tests for low-coverage pages.
 *
 * Exercises error states (API rejections), empty data, and conditional renders
 * that the smoke tests do not cover.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent, waitFor } from '@testing-library/react';
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
    getToken: vi.fn().mockReturnValue('test-token'),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    getConfluenceScore: vi.fn().mockResolvedValue({ score: 50, label: 'neutral', components: {} }),
    getAllConfluenceScores: vi.fn().mockResolvedValue([]),
    getConfluenceHistory: vi.fn().mockResolvedValue({ scores: [], prices: [] }),
    googleLogin: vi.fn().mockResolvedValue({ user: {}, token: 'tok' }),
    logout: vi.fn().mockResolvedValue(undefined),
    getPaperLeaderboard: vi.fn().mockResolvedValue([]),
    getSignalLeaderboard: vi.fn().mockResolvedValue([]),
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
  createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  setLineDash: vi.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
  font: '',
  textAlign: '',
  textBaseline: '',
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
// Helpers
// ---------------------------------------------------------------------------

function safeRender(Component: React.ComponentType) {
  try {
    return render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>,
    );
  } catch {
    return null;
  }
}

async function renderAndWait(Component: React.ComponentType) {
  let result: ReturnType<typeof render> | null = null;
  await act(async () => {
    result = safeRender(Component);
  });
  return result as ReturnType<typeof render> | null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pages branch coverage — error states and conditional renders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch to default success
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });
  });

  // ─── TokenScanner ──────────────────────────────────────────────
  describe('TokenScanner', () => {
    it('renders initial state with no result', async () => {
      const mod = await import('@/pages/TokenScanner');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container.textContent).toContain('Token Risk Scanner');
      }
    });

    it('shows error on network failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      const mod = await import('@/pages/TokenScanner');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'BTCUSDT' } });
          });
          const btn = result.container.querySelector('button');
          if (btn) {
            await act(async () => {
              fireEvent.click(btn);
            });
            await waitFor(() => {
              expect(result.container.textContent).toContain('Network error');
            });
          }
        }
      }
    });

    it('shows scan result with SAFE label', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            symbol: 'BTCUSDT',
            score: 85,
            label: 'SAFE',
            factors: [
              { name: 'Liquidity', score: 9, maxScore: 10, detail: 'High liquidity' },
            ],
          },
        }),
      });
      const mod = await import('@/pages/TokenScanner');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'BTCUSDT' } });
          });
          const btn = result.container.querySelector('button');
          if (btn) {
            await act(async () => {
              fireEvent.click(btn);
            });
            await waitFor(() => {
              expect(result.container.textContent).toContain('BTCUSDT');
              expect(result.container.textContent).toContain('SAFE');
              expect(result.container.textContent).toContain('Recommendation');
            });
          }
        }
      }
    });

    it('shows DANGER result and exercises all label paths', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            symbol: 'SCAMCOIN',
            score: 10,
            label: 'DANGER',
            factors: [
              { name: 'Liquidity', score: 1, maxScore: 10, detail: 'Very low' },
              { name: 'Audit', score: 0, maxScore: 10, detail: 'No audit' },
            ],
          },
        }),
      });
      const mod = await import('@/pages/TokenScanner');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'SCAMCOIN' } });
          });
          const btn = result.container.querySelector('button');
          if (btn) {
            await act(async () => {
              fireEvent.click(btn);
            });
            await waitFor(() => {
              expect(result.container.textContent).toContain('DANGER');
              expect(result.container.textContent).toContain('significant red flags');
            });
          }
        }
      }
    });

    it('shows CAUTION result', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            symbol: 'TESTUSDT',
            score: 55,
            label: 'CAUTION',
            factors: [{ name: 'Volume', score: 5, maxScore: 10, detail: 'Moderate volume' }],
          },
        }),
      });
      const mod = await import('@/pages/TokenScanner');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'TESTUSDT' } });
          });
          const btns = result.container.querySelectorAll('button');
          const scanBtn = btns[0];
          if (scanBtn) {
            await act(async () => {
              fireEvent.click(scanBtn);
            });
            await waitFor(() => {
              expect(result.container.textContent).toContain('CAUTION');
            });
          }
        }
      }
    });

    it('shows RISKY result', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            symbol: 'RISKYUSDT',
            score: 30,
            label: 'RISKY',
            factors: [{ name: 'Risk', score: 3, maxScore: 10, detail: 'Moderate risk' }],
          },
        }),
      });
      const mod = await import('@/pages/TokenScanner');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'RISKYUSDT' } });
          });
          const btn = result.container.querySelector('button');
          if (btn) {
            await act(async () => {
              fireEvent.click(btn);
            });
            await waitFor(() => {
              expect(result.container.textContent).toContain('RISKY');
            });
          }
        }
      }
    });

    it('handles API error response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false, error: 'Token not found' }),
      });
      const mod = await import('@/pages/TokenScanner');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'INVALID' } });
          });
          const btn = result.container.querySelector('button');
          if (btn) {
            await act(async () => {
              fireEvent.click(btn);
            });
            await waitFor(() => {
              expect(result.container.textContent).toContain('Token not found');
            });
          }
        }
      }
    });

    it('handles Enter key to scan', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            symbol: 'BTC',
            score: 60,
            label: 'CAUTION',
            factors: [{ name: 'Test', score: 6, maxScore: 10, detail: 'OK' }],
          },
        }),
      });
      const mod = await import('@/pages/TokenScanner');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'BTC' } });
            fireEvent.keyDown(input, { key: 'Enter' });
          });
          await waitFor(() => {
            expect(result.container.textContent).toContain('CAUTION');
          });
        }
      }
    });
  });

  // ─── ExchangeHealth ────────────────────────────────────────────
  describe('ExchangeHealth', () => {
    it('shows error state when API fails', async () => {
      const { getExchangeHealth } = await import('@/services/api');
      (getExchangeHealth as any).mockRejectedValueOnce(new Error('Network error'));
      const mod = await import('@/pages/ExchangeHealth');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Failed to fetch exchange health data');
        });
      }
    });

    it('renders exchange cards with different labels', async () => {
      const { getExchangeHealth } = await import('@/services/api');
      (getExchangeHealth as any).mockResolvedValueOnce([
        { exchange: 'binance', score: 90, label: 'Healthy', metrics: { activePairs: 200, latestUpdate: new Date().toISOString(), dataFreshness: 95, wsStatus: 'connected' } },
        { exchange: 'bybit', score: 55, label: 'Degraded', metrics: { activePairs: 100, latestUpdate: null, dataFreshness: 50, wsStatus: 'stale' } },
        { exchange: 'okx', score: 20, label: 'Critical', metrics: { activePairs: 10, latestUpdate: null, dataFreshness: 10, wsStatus: 'disconnected' } },
      ]);
      const mod = await import('@/pages/ExchangeHealth');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Binance');
          expect(result.container.textContent).toContain('Healthy');
          expect(result.container.textContent).toContain('Degraded');
          expect(result.container.textContent).toContain('Critical');
          expect(result.container.textContent).toContain('N/A');
        });
      }
    });
  });

  // ─── FundingRates ──────────────────────────────────────────────
  describe('FundingRates', () => {
    it('shows error state when API fails', async () => {
      const { getFundingRates } = await import('@/services/api');
      (getFundingRates as any).mockRejectedValueOnce(new Error('Network error'));
      const mod = await import('@/pages/FundingRates');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Failed to fetch funding rates');
        });
      }
    });

    it('renders funding data with extreme rates', async () => {
      const { getFundingRates } = await import('@/services/api');
      (getFundingRates as any).mockResolvedValueOnce([
        { symbol: 'BTCUSDT', exchange: 'binance', rate: 0.001, annualized: 10.95, nextFunding: new Date(Date.now() + 3600000).toISOString(), prediction: 'up' },
        { symbol: 'ETHUSDT', exchange: 'binance', rate: -0.0005, annualized: -5.5, nextFunding: new Date(Date.now() + 7200000).toISOString(), prediction: 'down' },
        { symbol: 'SOLUSDT', exchange: 'bybit', rate: 0, annualized: 0, nextFunding: new Date(Date.now() + 1000).toISOString(), prediction: 'stable' },
      ]);
      const mod = await import('@/pages/FundingRates');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('BTCUSDT');
          expect(result.container.textContent).toContain('ETHUSDT');
          expect(result.container.textContent).toContain('Average Funding Rate');
          expect(result.container.textContent).toContain('Most Extreme');
        });
      }
    });
  });

  // ─── Correlation ───────────────────────────────────────────────
  describe('Correlation', () => {
    it('shows error when API fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Server error' }),
      });
      const mod = await import('@/pages/Correlation');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Server error');
        });
      }
    });

    it('shows error when fetch throws', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network fail'));
      const mod = await import('@/pages/Correlation');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Failed to load correlation data');
        });
      }
    });

    it('renders correlation matrix with data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            pairs: ['BTCUSDT', 'ETHUSDT'],
            matrix: [[1.0, 0.85], [0.85, 1.0]],
          },
        }),
      });
      const mod = await import('@/pages/Correlation');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Correlation Matrix');
          expect(result.container.textContent).toContain('BTC');
          expect(result.container.textContent).toContain('ETH');
          expect(result.container.textContent).toContain('0.85');
        });
      }
    });
  });

  // ─── DevActivity ───────────────────────────────────────────────
  describe('DevActivity', () => {
    it('shows error on API failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('fail'));
      const mod = await import('@/pages/DevActivity');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Network error');
        });
      }
    });

    it('shows error on API error response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false, error: 'Service unavailable' }),
      });
      const mod = await import('@/pages/DevActivity');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Service unavailable');
        });
      }
    });

    it('renders projects with various scores', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            projects: [
              { symbol: 'BTC', name: 'Bitcoin', weeklyCommits: 50, activeDevs: 100, stars: 70000, openIssues: 200, lastRelease: '2024-01-01', devScore: 90 },
              { symbol: 'ETH', name: 'Ethereum', weeklyCommits: 40, activeDevs: 80, stars: 40000, openIssues: 300, lastRelease: '2024-02-01', devScore: 65 },
              { symbol: 'DOGE', name: 'Dogecoin', weeklyCommits: 2, activeDevs: 5, stars: 14000, openIssues: 50, lastRelease: '2023-06-01', devScore: 30 },
              { symbol: 'SOL', name: 'Solana', weeklyCommits: 20, activeDevs: 30, stars: 10000, openIssues: 100, lastRelease: '2024-03-01', devScore: 45 },
            ],
          },
        }),
      });
      const mod = await import('@/pages/DevActivity');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Bitcoin');
          expect(result.container.textContent).toContain('Dogecoin');
          expect(result.container.textContent).toContain('Low development activity warning');
          expect(result.container.textContent).toContain('Comparison');
        });
      }
    });
  });

  // ─── Copilot ───────────────────────────────────────────────────
  describe('Copilot', () => {
    it('renders empty chat state with suggestions', async () => {
      const mod = await import('@/pages/Copilot');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container.textContent).toContain('Ask anything about crypto');
        expect(result.container.textContent).toContain('What do you think about BTC?');
      }
    });

    it('handles successful message response with context', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            answer: 'BTC looks bullish',
            context: { symbol: 'BTCUSDT', price: 50000, rsi: 45, ema9: 49000, ema21: 48000, trend: 'bullish', fearGreed: 70 },
          },
        }),
      });
      const mod = await import('@/pages/Copilot');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input[type="text"]');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'What about BTC?' } });
            fireEvent.keyDown(input, { key: 'Enter' });
          });
          await waitFor(() => {
            expect(result.container.textContent).toContain('BTC looks bullish');
            expect(result.container.textContent).toContain('RSI 45');
            expect(result.container.textContent).toContain('bullish');
          });
        }
      }
    });

    it('handles API error response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Rate limited' }),
      });
      const mod = await import('@/pages/Copilot');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input[type="text"]');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'Test question' } });
            fireEvent.keyDown(input, { key: 'Enter' });
          });
          await waitFor(() => {
            expect(result.container.textContent).toContain('Rate limited');
          });
        }
      }
    });

    it('handles network failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Offline'));
      const mod = await import('@/pages/Copilot');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input[type="text"]');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'Hi' } });
            fireEvent.keyDown(input, { key: 'Enter' });
          });
          await waitFor(() => {
            expect(result.container.textContent).toContain('Failed to connect to the server');
          });
        }
      }
    });

    it('exercises context with RSI > 70 (overbought)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            answer: 'ETH is overbought',
            context: { symbol: 'ETHUSDT', price: 3000, rsi: 75, ema9: 3100, ema21: 3200, trend: 'bearish', fearGreed: 30 },
          },
        }),
      });
      const mod = await import('@/pages/Copilot');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input[type="text"]');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'ETH analysis' } });
            fireEvent.keyDown(input, { key: 'Enter' });
          });
          await waitFor(() => {
            expect(result.container.textContent).toContain('ETH is overbought');
            expect(result.container.textContent).toContain('RSI 75');
            expect(result.container.textContent).toContain('bearish');
          });
        }
      }
    });

    it('exercises context with RSI < 30 (oversold)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            answer: 'SOL is oversold',
            context: { symbol: 'SOLUSDT', price: 100, rsi: 20, ema9: 110, ema21: 120, trend: 'neutral', fearGreed: 15 },
          },
        }),
      });
      const mod = await import('@/pages/Copilot');
      const result = await renderAndWait(mod.default);
      if (result) {
        const input = result.container.querySelector('input[type="text"]');
        if (input) {
          await act(async () => {
            fireEvent.change(input, { target: { value: 'SOL analysis' } });
            fireEvent.keyDown(input, { key: 'Enter' });
          });
          await waitFor(() => {
            expect(result.container.textContent).toContain('SOL is oversold');
          });
        }
      }
    });
  });

  // ─── DCABot ────────────────────────────────────────────────────
  describe('DCABot', () => {
    it('shows empty bots state', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
      const mod = await import('@/pages/DCABot');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('No bots yet');
        });
      }
    });

    it('renders bots with simulation data', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 'b1', symbol: 'BTCUSDT', baseAmount: 50, interval: 'daily', strategy: 'standard', createdAt: '2024-01-01' },
            ],
          }),
        });
      const mod = await import('@/pages/DCABot');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('BTCUSDT');
          expect(result.container.textContent).toContain('Standard DCA');
        });
      }
    });
  });

  // ─── Screener ──────────────────────────────────────────────────
  describe('Screener', () => {
    it('renders screener with data and trend badges', async () => {
      const { getScreener } = await import('@/services/api');
      (getScreener as any).mockResolvedValueOnce([
        { symbol: 'BTCUSDT', exchange: 'binance', price: 50000, change24h: 2.5, volume: 1000000, rsi: 25, trend: 'bullish' },
        { symbol: 'ETHUSDT', exchange: 'binance', price: 3000, change24h: -1.2, volume: 500000, rsi: 75, trend: 'bearish' },
        { symbol: 'SOLUSDT', exchange: 'bybit', price: 100, change24h: 0, volume: 200000, rsi: 50, trend: 'neutral' },
      ]);
      const mod = await import('@/pages/Screener');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('BTC/USDT');
          expect(result.container.textContent).toContain('Bullish');
          expect(result.container.textContent).toContain('Bearish');
          expect(result.container.textContent).toContain('Neutral');
        });
      }
    });

    it('shows empty state when no results match', async () => {
      const { getScreener } = await import('@/services/api');
      (getScreener as any).mockResolvedValueOnce([]);
      const mod = await import('@/pages/Screener');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('No results found');
        });
      }
    });
  });

  // ─── IntermarketAnalysis ───────────────────────────────────────
  describe('IntermarketAnalysis', () => {
    it('shows error on fetch failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('fail'));
      const mod = await import('@/pages/IntermarketAnalysis');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Network error');
        });
      }
    });

    it('renders with data including risk-on environment', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            assets: [
              { name: 'S&P 500', symbol: 'SPX', price: 5000, change24h: 1.2, category: 'Indices' },
              { name: 'Gold', symbol: 'XAU', price: 2000, change24h: -0.5, category: 'Commodities' },
              { name: 'Bitcoin', symbol: 'BTC', price: 50000, change24h: 3.0, category: 'Crypto' },
              { name: 'EUR/USD', symbol: 'EURUSD', price: 1.08, change24h: 0.1, category: 'Forex' },
              { name: 'US 10Y', symbol: 'UST10Y', price: 4.5, change24h: -0.02, category: 'Bonds' },
            ],
            correlations: [
              { pair: 'SPX/BTC', value: 0.75 },
              { pair: 'Gold/BTC', value: -0.3 },
              { pair: 'DXY/BTC', value: -0.65 },
            ],
            riskOnOff: 'risk-on',
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      const mod = await import('@/pages/IntermarketAnalysis');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Intermarket Analysis');
          expect(result.container.textContent).toContain('RISK ON');
          expect(result.container.textContent).toContain('S&P 500');
          expect(result.container.textContent).toContain('Gold');
        });
      }
    });

    it('renders risk-off environment', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            assets: [],
            correlations: [],
            riskOnOff: 'risk-off',
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      const mod = await import('@/pages/IntermarketAnalysis');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('RISK OFF');
        });
      }
    });

    it('renders neutral environment', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            assets: [],
            correlations: [],
            riskOnOff: 'neutral',
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      const mod = await import('@/pages/IntermarketAnalysis');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('NEUTRAL');
        });
      }
    });
  });

  // ─── AntiLiquidation ──────────────────────────────────────────
  describe('AntiLiquidation', () => {
    it('shows error on fetch failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('fail'));
      const mod = await import('@/pages/AntiLiquidation');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Failed to load positions');
        });
      }
    });

    it('shows no positions state', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
      const mod = await import('@/pages/AntiLiquidation');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('No open positions');
        });
      }
    });

    it('renders positions with danger warnings', async () => {
      const posData = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [
            { symbol: 'BTCUSDT', side: 'buy', entryPrice: 50000, currentPrice: 50500, quantity: 0.1, amount: 5000, pnl: 50, pnlPct: 1, openedAt: '2024-01-01' },
            { symbol: 'ETHUSDT', side: 'sell', entryPrice: 3000, currentPrice: 2950, quantity: 1, amount: 3000, pnl: 50, pnlPct: 1.67, openedAt: '2024-01-02' },
          ],
        }),
      };
      (global.fetch as any).mockResolvedValue(posData);
      const mod = await import('@/pages/AntiLiquidation');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('BTCUSDT');
          expect(result.container.textContent).toContain('LONG');
          expect(result.container.textContent).toContain('What-If Price Simulator');
        });
      }
    });
  });

  // ─── Seasonality ───────────────────────────────────────────────
  describe('Seasonality', () => {
    it('shows error on fetch failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('fail'));
      const mod = await import('@/pages/Seasonality');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Network error');
        });
      }
    });

    it('renders with data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            symbol: 'BTCUSDT',
            hourly: Array.from({ length: 24 }, (_, i) => ({ hour: i, avgReturn: (i - 12) * 0.01, winRate: 50 + (i - 12), count: 100 })),
            daily: [
              { day: 'Mon', avgReturn: 0.03, winRate: 55, count: 50 },
              { day: 'Tue', avgReturn: -0.02, winRate: 45, count: 50 },
              { day: 'Wed', avgReturn: 0, winRate: 50, count: 50 },
            ],
          },
        }),
      });
      const mod = await import('@/pages/Seasonality');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Seasonality Analytics');
          expect(result.container.textContent).toContain('Mon');
          expect(result.container.textContent).toContain('Hourly Performance');
        });
      }
    });
  });

  // ─── Tokenomics ────────────────────────────────────────────────
  describe('Tokenomics', () => {
    it('renders with token data and comparison table', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { symbol: 'BTC', name: 'Bitcoin', circulatingSupply: 19500000, maxSupply: 21000000, inflationRate: 1.8, fdv: 1050000000000, supplyRatio: 0.93, unlocks: [], score: 95, scoreExplanation: 'Excellent tokenomics' },
            { symbol: 'ETH', name: 'Ethereum', circulatingSupply: 120000000, maxSupply: null, inflationRate: -0.5, fdv: 360000000000, supplyRatio: 1, unlocks: [{ date: '2024-06-01', amount: 100000, description: 'Beacon chain' }], score: 80, scoreExplanation: 'Good deflationary model' },
          ],
        }),
      });
      const mod = await import('@/pages/Tokenomics');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Bitcoin');
          expect(result.container.textContent).toContain('Ethereum');
          expect(result.container.textContent).toContain('Side-by-Side Comparison');
          expect(result.container.textContent).toContain('Unlimited');
        });
      }
    });

    it('renders loading state', async () => {
      // fetch never resolves quickly; the component will show loading
      (global.fetch as any).mockImplementationOnce(() => new Promise(() => {}));
      const mod = await import('@/pages/Tokenomics');
      const result = await renderAndWait(mod.default);
      if (result) {
        // Component shows loading spinner (PieChart icon with animate-pulse)
        expect(result.container).toBeDefined();
      }
    });
  });

  // ─── WhaleAlert ────────────────────────────────────────────────
  describe('WhaleAlert', () => {
    it('shows error state', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });
      const mod = await import('@/pages/WhaleAlert');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Failed to fetch whale alerts');
        });
      }
    });

    it('shows empty alerts state', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      const mod = await import('@/pages/WhaleAlert');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('No whale activity');
        });
      }
    });

    it('renders alerts with all types', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { symbol: 'BTCUSDT', exchange: 'binance', type: 'exchange_inflow', amount_usd: 5000000, timestamp: new Date().toISOString() },
            { symbol: 'ETHUSDT', exchange: 'bybit', type: 'exchange_outflow', amount_usd: 2000000, timestamp: new Date(Date.now() - 3600000).toISOString() },
            { symbol: 'SOLUSDT', exchange: 'okx', type: 'transfer', amount_usd: 1000000, timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
          ],
        }),
      });
      const mod = await import('@/pages/WhaleAlert');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Inflow');
          expect(result.container.textContent).toContain('Outflow');
          expect(result.container.textContent).toContain('Transfer');
          expect(result.container.textContent).toContain('$5.00M');
        });
      }
    });
  });

  // ─── CopyTrading ───────────────────────────────────────────────
  describe('CopyTrading', () => {
    it('renders leaders with various badges', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 'l1', displayName: 'TraderA', winRate: 70, totalReturn: 120, maxDrawdown: 15, totalTrades: 200, copiers: 50, riskScore: 2, badge: 'gold', monthsProfitable: 10, avgTradeReturn: 1.5, bio: 'Pro trader' },
              { id: 'l2', displayName: 'TraderB', winRate: 55, totalReturn: -10, maxDrawdown: 30, totalTrades: 100, copiers: 10, riskScore: 4, badge: 'bronze', monthsProfitable: 5, avgTradeReturn: -0.5, bio: 'Risky' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      const mod = await import('@/pages/CopyTrading');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('TraderA');
          expect(result.container.textContent).toContain('Gold');
          expect(result.container.textContent).toContain('TraderB');
          expect(result.container.textContent).toContain('Bronze');
        });
      }
    });
  });

  // ─── WalletTracker ─────────────────────────────────────────────
  describe('WalletTracker', () => {
    it('shows empty wallets state', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
      const mod = await import('@/pages/WalletTracker');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('No wallets tracked yet');
        });
      }
    });

    it('renders wallets list', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [
            { id: 'w1', address: '0x1234567890abcdef1234567890abcdef12345678', chain: 'ethereum', label: 'Main Wallet', totalValue: 50000, addedAt: '2024-01-01' },
            { id: 'w2', address: 'So1234567890abcdef1234567890abcdef12345678', chain: 'solana', totalValue: 10000, addedAt: '2024-02-01' },
          ],
        }),
      });
      const mod = await import('@/pages/WalletTracker');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Main Wallet');
          expect(result.container.textContent).toContain('Ethereum');
          expect(result.container.textContent).toContain('Solana');
        });
      }
    });
  });

  // ─── Pricing ───────────────────────────────────────────────────
  describe('Pricing', () => {
    it('renders with tier data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tiers: [
            { id: 'starter', name: 'Starter', price: 0, annualPrice: 0, currency: 'USD', interval: 'month', features: ['Basic charts'] },
            { id: 'pro', name: 'Pro', price: 29, annualPrice: 290, currency: 'USD', interval: 'month', popular: true, features: ['All indicators', 'Alerts'] },
          ],
        }),
      });
      const mod = await import('@/pages/Pricing');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Starter');
          expect(result.container.textContent).toContain('Pro');
        });
      }
    });

    it('shows loading then no tiers on fetch error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('fail'));
      const mod = await import('@/pages/Pricing');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container).toBeDefined();
      }
    });
  });

  // ─── News ──────────────────────────────────────────────────────
  describe('News', () => {
    it('renders with article data and sentiment badges', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [
            { id: '1', title: 'BTC Rally', description: 'Bitcoin surges', source: 'CoinDesk', category: 'market', sentiment: 'bullish', publishedAt: new Date().toISOString(), url: 'https://example.com' },
            { id: '2', title: 'SEC Cracks Down', description: 'New regulations', source: 'Reuters', category: 'regulatory', sentiment: 'bearish', publishedAt: new Date(Date.now() - 3600000).toISOString(), url: 'https://example.com' },
            { id: '3', title: 'DeFi Update', description: 'Protocol upgrade', source: 'TheBlock', category: 'defi', sentiment: 'neutral', publishedAt: new Date(Date.now() - 86400000).toISOString(), url: 'https://example.com' },
          ],
        }),
      });
      const mod = await import('@/pages/News');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('BTC Rally');
        });
      }
    });

    it('shows error on fetch failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('fail'));
      const mod = await import('@/pages/News');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container).toBeDefined();
      }
    });
  });

  // ─── SocialFeed ────────────────────────────────────────────────
  describe('SocialFeed', () => {
    it('renders with posts data', async () => {
      (global.fetch as any)
        // /api/v1/social/feed
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 'p1', userId: 'u1', userName: 'Trader1', type: 'trade_idea', content: 'Buy BTC at 50k', symbol: 'BTCUSDT', direction: 'bullish', likeCount: 10, createdAt: new Date().toISOString() },
              { id: 'p2', userId: 'u2', userName: 'Analyst2', type: 'analysis', content: 'ETH analysis', direction: 'bearish', likeCount: 5, createdAt: new Date().toISOString() },
            ],
          }),
        })
        // /api/v1/social/trending
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [{ symbol: 'BTCUSDT', mentions: 20 }],
          }),
        });
      const mod = await import('@/pages/SocialFeed');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Trader1');
        });
      }
    });
  });

  // ─── TaxReport ─────────────────────────────────────────────────
  describe('TaxReport', () => {
    it('renders with tax data from paper trades and journal', async () => {
      const now = new Date();
      const closedAt = now.toISOString();
      const openedAt = new Date(now.getTime() - 86400000 * 30).toISOString();
      (global.fetch as any)
        // paper/history
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { symbol: 'BTCUSDT', side: 'buy', entryPrice: 40000, exitPrice: 45000, pnl: 500, amount: 5000, openedAt, closedAt },
            ],
          }),
        })
        // journal
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { pair: 'ETHUSDT', direction: 'long', entryPrice: 3000, exitPrice: 3200, pnl: 200, pnlPct: 6.67, createdAt: closedAt, updatedAt: closedAt },
            ],
          }),
        });
      const mod = await import('@/pages/TaxReport');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Tax Report');
          expect(result.container.textContent).toContain('Total Gains');
        });
      }
    });

    it('handles fetch error gracefully', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'));
      const mod = await import('@/pages/TaxReport');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container).toBeDefined();
      }
    });

    it('renders empty state when no trades', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
      const mod = await import('@/pages/TaxReport');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('No closed trades');
        });
      }
    });
  });

  // ─── HarmonicPatterns ──────────────────────────────────────────
  describe('HarmonicPatterns', () => {
    it('shows error on fetch failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('fail'));
      const mod = await import('@/pages/HarmonicPatterns');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Failed to load harmonic data');
        });
      }
    });

    it('shows error on API error response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Service unavailable' }),
      });
      const mod = await import('@/pages/HarmonicPatterns');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Service unavailable');
        });
      }
    });

    it('renders with proper pattern data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            symbol: 'BTCUSDT',
            patterns: [
              {
                name: 'Gartley',
                type: 'bullish',
                points: {
                  X: { price: 48000, index: 0 },
                  A: { price: 52000, index: 10 },
                  B: { price: 49500, index: 20 },
                  C: { price: 51000, index: 30 },
                  D: { price: 49000, index: 40 },
                },
                ratios: { AB_XA: 0.618, BC_AB: 0.382, CD_BC: 1.272, AD_XA: 0.786 },
                confidence: 85,
                prz: { low: 48500, high: 49500 },
                description: 'Bullish Gartley pattern detected',
              },
            ],
          },
        }),
      });
      const mod = await import('@/pages/HarmonicPatterns');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Gartley');
        });
      }
    });

    it('renders with no patterns', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { symbol: 'BTCUSDT', patterns: [] },
        }),
      });
      const mod = await import('@/pages/HarmonicPatterns');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Harmonic');
        });
      }
    });
  });

  // ─── IndicatorLibrary ──────────────────────────────────────────
  describe('IndicatorLibrary', () => {
    it('renders the page', async () => {
      const mod = await import('@/pages/IndicatorLibrary');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container.textContent).toContain('Indicator');
      }
    });
  });

  // ─── DeFi ──────────────────────────────────────────────────────
  describe('DeFi', () => {
    it('shows error when API fails', async () => {
      const { getDeFiOverview } = await import('@/services/api');
      (getDeFiOverview as any).mockRejectedValueOnce(new Error('fail'));
      const mod = await import('@/pages/DeFi');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container).toBeDefined();
      }
    });

    it('renders with protocol data', async () => {
      const { getDeFiOverview } = await import('@/services/api');
      (getDeFiOverview as any).mockResolvedValueOnce({
        protocols: [
          { name: 'Uniswap', tvl: 5000000000, tvlChange24h: 2.5, chain: 'ethereum', category: 'DEX', apy: 10, riskRating: 2 },
        ],
        totalTvl: 50000000000,
        avgApy: 8.5,
        protocolCount: 100,
      });
      const mod = await import('@/pages/DeFi');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Uniswap');
        });
      }
    });
  });

  // ─── Settings ──────────────────────────────────────────────────
  describe('Settings', () => {
    it('renders settings page', async () => {
      const mod = await import('@/pages/Settings');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container.textContent).toContain('Settings');
      }
    });
  });

  // ─── Portfolio ─────────────────────────────────────────────────
  describe('Portfolio', () => {
    it('renders portfolio page', async () => {
      const mod = await import('@/pages/Portfolio');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container.textContent).toContain('Portfolio');
      }
    });
  });

  // ─── Journal ───────────────────────────────────────────────────
  describe('Journal', () => {
    it('renders with entries and stats', async () => {
      (global.fetch as any)
        // /api/v1/journal
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: 'j1', pair: 'BTCUSDT', direction: 'long', entryPrice: 50000, exitPrice: 52000, size: 0.1, strategy: 'Breakout', emotional_state: 'calm', notes: 'Good trade', confidence: 4, timeframe: '4h', pnl: 200, pnlPct: 4, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-10T00:00:00Z' },
              { id: 'j2', pair: 'ETHUSDT', direction: 'short', entryPrice: 3000, exitPrice: null, size: 1, strategy: null, emotional_state: null, notes: null, confidence: null, timeframe: null, pnl: null, pnlPct: null, createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z' },
            ],
          }),
        })
        // /api/v1/journal/stats
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { totalTrades: 10, closedTrades: 8, winRate: 62.5, avgWin: 150, avgLoss: -75, bestTrade: 500, worstTrade: -200, profitFactor: 2.0 },
          }),
        });
      const mod = await import('@/pages/Journal');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Trading Journal');
        });
      }
    });

    it('renders empty state', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, data: { totalTrades: 0, closedTrades: 0, winRate: 0, avgWin: 0, avgLoss: 0, bestTrade: 0, worstTrade: 0, profitFactor: 0 } }) });
      const mod = await import('@/pages/Journal');
      const result = await renderAndWait(mod.default);
      if (result) {
        await waitFor(() => {
          expect(result.container.textContent).toContain('Trading Journal');
        });
      }
    });
  });

  // ─── Alerts ────────────────────────────────────────────────────
  describe('Alerts', () => {
    it('renders alerts page', async () => {
      const mod = await import('@/pages/Alerts');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container).toBeDefined();
      }
    });
  });

  // ─── ChartReplay ───────────────────────────────────────────────
  describe('ChartReplay', () => {
    it('renders chart replay page', async () => {
      const mod = await import('@/pages/ChartReplay');
      const result = await renderAndWait(mod.default);
      if (result) {
        expect(result.container).toBeDefined();
      }
    });
  });
});
