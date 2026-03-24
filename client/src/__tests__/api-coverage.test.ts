/**
 * Extended API coverage tests
 *
 * Covers all exported functions from api.ts that are NOT already tested
 * in api.test.ts: googleLogin, getProfile, updateProfile, getPairs,
 * getTicker, getFearGreed, getCorrelation, getPaperLeaderboard,
 * getSignalLeaderboard, getExchangeHealth, getFundingRates, getNarratives,
 * getMarketBreadth, getOpenInterest, getAdminDashboard, getAdminUsers,
 * updateUserTier, getSystemHealth, setup2FA, verify2FA, connectTelegram,
 * disconnectTelegram, getTelegramStatus, sendTelegramTest, getDeFiOverview,
 * getMarketProfile, getConfluenceScore, getAllConfluenceScores,
 * getConfluenceHistory, createAlert, deleteAlert.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Import statically — no resetModules needed since each test resets mockFetch
import * as api from '../services/api';

beforeEach(() => {
  localStorageMock.clear();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Helpers ----

function ok(data: unknown, status = 200) {
  return Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(data),
  });
}

// ────────────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────────────

describe('googleLogin()', () => {
  it('sends credential and stores token', async () => {
    const user = { id: 'g1', email: 'g@g.com', tier: 'free' };
    mockFetch.mockReturnValueOnce(
      ok({ success: true, data: { user, accessToken: 'gtoken', refreshToken: 'grt' } }),
    );

    const result = await api.googleLogin({ credential: 'google-jwt' });
    expect(result.user).toEqual(user);
    expect(result.token).toBe('gtoken');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('quantis_token', 'gtoken');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.credential).toBe('google-jwt');
  });

  it('supports code-based flow', async () => {
    const user = { id: 'g2', email: 'g2@g.com', tier: 'free' };
    mockFetch.mockReturnValueOnce(
      ok({ success: true, data: { user, accessToken: 'tok2', refreshToken: 'rt2' } }),
    );

    const result = await api.googleLogin({ code: 'auth-code' });
    expect(result.token).toBe('tok2');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.code).toBe('auth-code');
  });
});

describe('getProfile()', () => {
  it('fetches /auth/me and returns user data', async () => {
    const user = { id: 'u1', email: 'a@b.com', tier: 'pro' };
    mockFetch.mockReturnValueOnce(ok({ success: true, data: user }));

    const result = await api.getProfile();
    expect(result).toEqual(user);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/auth/me');
  });
});

describe('updateProfile()', () => {
  it('PUTs partial user then re-fetches profile', async () => {
    // PUT /auth/me
    mockFetch.mockReturnValueOnce(ok({ success: true }));
    // GET /auth/me (re-fetch)
    const updated = { id: 'u1', email: 'a@b.com', tier: 'pro', display_name: 'New Name' };
    mockFetch.mockReturnValueOnce(ok({ success: true, data: updated }));

    const result = await api.updateProfile({ display_name: 'New Name' });
    expect(result.display_name).toBe('New Name');
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ────────────────────────────────────────────────────────────────────
// Market
// ────────────────────────────────────────────────────────────────────

describe('getPairs()', () => {
  it('fetches /market/pairs', async () => {
    const pairs = [{ id: 1, symbol: 'BTCUSDT', base_asset: 'BTC', quote_asset: 'USDT', exchange: 'binance', is_active: true }];
    mockFetch.mockReturnValueOnce(ok({ success: true, data: pairs }));

    const result = await api.getPairs();
    expect(result).toEqual(pairs);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/pairs');
  });
});

describe('getTicker()', () => {
  it('fetches single ticker by symbol', async () => {
    const ticker = { symbol: 'BTCUSDT', exchange: 'binance', price: 65000, change24h: 2.1, volume: 1e9, timestamp: Date.now() };
    mockFetch.mockReturnValueOnce(ok({ success: true, data: ticker }));

    const result = await api.getTicker('BTCUSDT');
    expect(result.symbol).toBe('BTCUSDT');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/ticker/BTCUSDT');
  });
});

describe('getFearGreed()', () => {
  it('returns fear/greed data', async () => {
    const data = { score: 72, label: 'Greed', components: { rsi_avg: 60, bullish_pct: 0.65, volume_score: 55, funding_score: 50 }, timestamp: Date.now() };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getFearGreed();
    expect(result.score).toBe(72);
    expect(result.label).toBe('Greed');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/fear-greed');
  });
});

describe('getCorrelation()', () => {
  it('returns correlation matrix', async () => {
    const data = { pairs: ['BTCUSDT', 'ETHUSDT'], matrix: [[1, 0.8], [0.8, 1]] };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getCorrelation();
    expect(result.pairs).toHaveLength(2);
    expect(result.matrix[0][1]).toBe(0.8);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/correlation');
  });
});

describe('getExchangeHealth()', () => {
  it('returns exchange health array', async () => {
    const data = [{ exchange: 'binance', score: 95, label: 'Healthy', metrics: { activePairs: 100, latestUpdate: null, dataFreshness: 1, wsStatus: 'connected' } }];
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getExchangeHealth();
    expect(result[0].exchange).toBe('binance');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/exchanges/health');
  });
});

describe('getFundingRates()', () => {
  it('returns funding rates array', async () => {
    const data = [{ symbol: 'BTCUSDT', exchange: 'binance', rate: 0.01, annualized: 10.95, nextFunding: '2026-01-01T00:00:00Z', prediction: 'stable' }];
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getFundingRates();
    expect(result[0].rate).toBe(0.01);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/funding-rates');
  });
});

describe('getNarratives()', () => {
  it('returns narratives from nested data', async () => {
    const narratives = [{ name: 'DeFi', score: 80, tokens: [], avgChange: 3, avgVolume: 1e6, avgRsi: 55, trend: 'rising' }];
    mockFetch.mockReturnValueOnce(ok({ success: true, data: { narratives } }));

    const result = await api.getNarratives();
    expect(result[0].name).toBe('DeFi');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/narratives');
  });
});

describe('getMarketBreadth()', () => {
  it('returns breadth data', async () => {
    const data = { score: 65, label: 'Bullish', advancing: 80, declining: 20, pctAboveSma: 0.7, avgRsi: 55, newHighs: 10, newLows: 2, breadthLine: 1.5 };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getMarketBreadth();
    expect(result.score).toBe(65);
    expect(result.advancing).toBe(80);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/breadth');
  });
});

describe('getOpenInterest()', () => {
  it('returns open interest array', async () => {
    const data = [{ symbol: 'BTCUSDT', exchange: 'binance', openInterest: 5e9, oiChange24h: 1e8, oiChangePercent: 2, volume: 3e9, oiVolumeRatio: 1.6, priceChange24h: 1.5 }];
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getOpenInterest();
    expect(result[0].openInterest).toBe(5e9);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/open-interest');
  });
});

// ────────────────────────────────────────────────────────────────────
// Leaderboard
// ────────────────────────────────────────────────────────────────────

describe('getPaperLeaderboard()', () => {
  it('returns paper traders', async () => {
    const data = [{ rank: 1, displayName: 'Whale', returnPct: 42.5, totalTrades: 100, winRate: 0.65 }];
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getPaperLeaderboard();
    expect(result[0].rank).toBe(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/leaderboard/paper');
  });
});

describe('getSignalLeaderboard()', () => {
  it('returns strategy performances', async () => {
    const data = [{ strategy: 'RSI Cross', totalSignals: 50, avgConfidence: 75, winRate: 0.6, wins: 30, closed: 50 }];
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getSignalLeaderboard();
    expect(result[0].strategy).toBe('RSI Cross');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/leaderboard/signals');
  });
});

// ────────────────────────────────────────────────────────────────────
// Admin
// ────────────────────────────────────────────────────────────────────

describe('getAdminDashboard()', () => {
  it('returns admin dashboard stats', async () => {
    const data = { totalUsers: 500, usersToday: 10, totalSignals: 2000, activePairs: 50, totalCandles: 1e6, revenue: 5000 };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getAdminDashboard();
    expect(result.totalUsers).toBe(500);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/admin/dashboard');
  });
});

describe('getAdminUsers()', () => {
  it('returns user list', async () => {
    const data = [{ id: 'u1', email: 'a@b.com', tier: 'pro', created_at: '2026-01-01', display_name: null }];
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getAdminUsers();
    expect(result[0].email).toBe('a@b.com');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/admin/users');
  });
});

describe('updateUserTier()', () => {
  it('PUTs tier change', async () => {
    mockFetch.mockReturnValueOnce(ok({ success: true }));

    await api.updateUserTier('u1', 'premium');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/admin/users/u1/tier');
    expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tier).toBe('premium');
  });
});

describe('getSystemHealth()', () => {
  it('returns system health data', async () => {
    const data = { dbStatus: 'ok', redisStatus: 'ok', candlesByExchange: [{ exchange: 'binance', count: '50000' }], latestSignalTime: '2026-01-01T00:00:00Z' };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getSystemHealth();
    expect(result.dbStatus).toBe('ok');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/admin/system');
  });
});

// ────────────────────────────────────────────────────────────────────
// 2FA
// ────────────────────────────────────────────────────────────────────

describe('setup2FA()', () => {
  it('POSTs to /auth/2fa/setup and returns secret + QR', async () => {
    const data = { secret: 'JBSWY3DPEHPK3PXP', qrCodeUrl: 'otpauth://totp/Quantis?secret=JBSWY3DPEHPK3PXP' };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.setup2FA();
    expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(result.qrCodeUrl).toContain('otpauth://');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/auth/2fa/setup');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });
});

describe('verify2FA()', () => {
  it('POSTs code to /auth/2fa/verify', async () => {
    mockFetch.mockReturnValueOnce(ok({ success: true }));

    await api.verify2FA('123456');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/auth/2fa/verify');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.code).toBe('123456');
  });
});

// ────────────────────────────────────────────────────────────────────
// Telegram
// ────────────────────────────────────────────────────────────────────

describe('connectTelegram()', () => {
  it('sends chatId to /telegram/connect', async () => {
    mockFetch.mockReturnValueOnce(ok({ success: true }));

    await api.connectTelegram('12345678');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/telegram/connect');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chatId).toBe('12345678');
  });
});

describe('disconnectTelegram()', () => {
  it('POSTs to /telegram/disconnect', async () => {
    mockFetch.mockReturnValueOnce(ok({ success: true }));

    await api.disconnectTelegram();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/telegram/disconnect');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });
});

describe('getTelegramStatus()', () => {
  it('returns connection status', async () => {
    const data = { connected: true, chatId: '12345678' };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getTelegramStatus();
    expect(result.connected).toBe(true);
    expect(result.chatId).toBe('12345678');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/telegram/status');
  });
});

describe('sendTelegramTest()', () => {
  it('POSTs to /telegram/test', async () => {
    mockFetch.mockReturnValueOnce(ok({ success: true }));

    await api.sendTelegramTest();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/telegram/test');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });
});

// ────────────────────────────────────────────────────────────────────
// DeFi
// ────────────────────────────────────────────────────────────────────

describe('getDeFiOverview()', () => {
  it('returns DeFi overview', async () => {
    const data = { protocols: [{ name: 'Aave', tvl: 1e10, tvlChange24h: 2, chain: 'Ethereum', category: 'Lending', apy: 5, riskRating: 2 }], totalTvl: 5e10, avgApy: 6, protocolCount: 100 };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getDeFiOverview();
    expect(result.protocols[0].name).toBe('Aave');
    expect(result.totalTvl).toBe(5e10);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/defi');
  });
});

// ────────────────────────────────────────────────────────────────────
// Market Profile
// ────────────────────────────────────────────────────────────────────

describe('getMarketProfile()', () => {
  it('fetches profile for a symbol', async () => {
    const data = { symbol: 'BTCUSDT', poc: 64000, vaHigh: 65000, vaLow: 63000, distributionShape: 'normal', volumeProfile: [], totalVolume: 1e9 };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getMarketProfile('BTCUSDT');
    expect(result.poc).toBe(64000);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/profile/BTCUSDT');
  });
});

// ────────────────────────────────────────────────────────────────────
// Confluence
// ────────────────────────────────────────────────────────────────────

describe('getConfluenceScore()', () => {
  it('fetches confluence for a single symbol', async () => {
    const data = { symbol: 'BTCUSDT', score: 72, label: 'buy', risk: 'medium', confidence: 80, components: {}, timestamp: '2026-01-01' };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getConfluenceScore('BTCUSDT');
    expect(result.score).toBe(72);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/analysis/confluence/BTCUSDT');
  });
});

describe('getAllConfluenceScores()', () => {
  it('fetches all confluence scores', async () => {
    const data = [
      { symbol: 'BTCUSDT', score: 72, label: 'buy', risk: 'medium', confidence: 80, components: {}, timestamp: '2026-01-01' },
      { symbol: 'ETHUSDT', score: 55, label: 'neutral', risk: 'low', confidence: 70, components: {}, timestamp: '2026-01-01' },
    ];
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getAllConfluenceScores();
    expect(result).toHaveLength(2);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/analysis/confluence');
  });
});

describe('getConfluenceHistory()', () => {
  it('fetches history with default params', async () => {
    const data = { symbol: 'BTCUSDT', resolution: 'raw', hours: 24, scores: [], prices: [] };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    const result = await api.getConfluenceHistory('BTCUSDT');
    expect(result.symbol).toBe('BTCUSDT');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/analysis/confluence/BTCUSDT/history?hours=24&resolution=raw');
  });

  it('passes custom hours and resolution', async () => {
    const data = { symbol: 'ETHUSDT', resolution: 'hourly', hours: 48, scores: [], prices: [] };
    mockFetch.mockReturnValueOnce(ok({ success: true, data }));

    await api.getConfluenceHistory('ETHUSDT', 48, 'hourly');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/analysis/confluence/ETHUSDT/history?hours=48&resolution=hourly');
  });
});

// ────────────────────────────────────────────────────────────────────
// Alerts (create / delete)
// ────────────────────────────────────────────────────────────────────

describe('createAlert()', () => {
  it('POSTs alert data to /alerts', async () => {
    mockFetch.mockReturnValueOnce(ok({ success: true, data: { id: 'a1' } }));

    await api.createAlert({ name: 'BTC Price', conditions: { price: { gte: 70000 } }, channels: ['email'] });
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/alerts');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.name).toBe('BTC Price');
    expect(body.channels).toEqual(['email']);
  });
});

describe('deleteAlert()', () => {
  it('sends DELETE to /alerts/:id', async () => {
    mockFetch.mockReturnValueOnce(ok({ success: true }));

    await api.deleteAlert('a1');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/alerts/a1');
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });
});
