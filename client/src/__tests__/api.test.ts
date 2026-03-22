/**
 * API service tests
 *
 * Tests for request(), auth functions, market endpoints, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock localStorage before importing the module
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

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Dynamic import so localStorage mock is in place first
let api: typeof import('@/services/api');

beforeEach(async () => {
  vi.resetModules();
  localStorageMock.clear();
  mockFetch.mockReset();
  api = await import('@/services/api');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Helpers ----

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function errorResponse(status: number, error?: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: error || `HTTP ${status}` }),
  });
}

// ---- Tests ----

describe('request() — core fetch wrapper', () => {
  it('adds Authorization header when token exists', async () => {
    localStorageMock.setItem('quantis_token', 'test-jwt');
    // Re-import to pick up token
    api = await import('@/services/api');

    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: [] }));
    await api.getTickers();

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/v1/market/ticker');
    expect(callArgs[1].headers.Authorization).toBe('Bearer test-jwt');
  });

  it('omits Authorization header when no token exists', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: [] }));
    await api.getTickers();

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBeUndefined();
  });

  it('handles 401 by attempting token refresh', async () => {
    localStorageMock.setItem('quantis_token', 'old-token');
    api = await import('@/services/api');

    // First call returns 401
    mockFetch.mockReturnValueOnce(errorResponse(401));
    // Refresh call succeeds
    mockFetch.mockReturnValueOnce(jsonResponse({ data: { accessToken: 'new-token' } }));
    // Retry with new token succeeds
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: { id: '1' } }));

    const result = await api.getProfile();
    expect(result).toEqual({ id: '1' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    // Verify refresh endpoint was called
    expect(mockFetch.mock.calls[1][0]).toBe('/api/v1/auth/refresh');
  });

  it('throws "Session expired" when refresh fails', async () => {
    localStorageMock.setItem('quantis_token', 'old-token');
    api = await import('@/services/api');

    mockFetch.mockReturnValueOnce(errorResponse(401));
    mockFetch.mockReturnValueOnce(errorResponse(403, 'Forbidden'));

    await expect(api.getProfile()).rejects.toThrow('Session expired');
    // Token should be cleared
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('quantis_token');
  });

  it('throws with error message from server JSON', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(400, 'Invalid input'));
    await expect(api.getTickers()).rejects.toThrow('Invalid input');
  });

  it('throws with HTTP status when no error message in response', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );
    await expect(api.getTickers()).rejects.toThrow('HTTP 500');
  });

  it('handles non-JSON response body gracefully', async () => {
    // Use 400 (non-retryable) so the request fails immediately
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: () => Promise.reject(new Error('not json')),
      })
    );
    await expect(api.getTickers()).rejects.toThrow('HTTP 400');
  });
});

describe('login()', () => {
  it('sends credentials and stores token on success', async () => {
    const mockUser = { id: 'u1', email: 'a@b.com', tier: 'free' };
    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: true, data: { user: mockUser, accessToken: 'jwt123', refreshToken: 'rt' } })
    );

    const result = await api.login({ email: 'a@b.com', password: 'pass' });

    expect(result.user).toEqual(mockUser);
    expect(result.token).toBe('jwt123');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('quantis_token', 'jwt123');
    // Verify POST body
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.email).toBe('a@b.com');
    expect(body.password).toBe('pass');
  });

  it('throws on login failure', async () => {
    mockFetch.mockReturnValueOnce(errorResponse(401, 'Invalid credentials'));
    await expect(api.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow('Invalid credentials');
  });
});

describe('register()', () => {
  it('sends registration data and stores token', async () => {
    const mockUser = { id: 'u2', email: 'new@b.com', tier: 'free' };
    mockFetch.mockReturnValueOnce(
      jsonResponse({ success: true, data: { user: mockUser, accessToken: 'jwt456', refreshToken: 'rt2' } })
    );

    const result = await api.register({ email: 'new@b.com', password: 'pass123' });
    expect(result.user).toEqual(mockUser);
    expect(result.token).toBe('jwt456');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('quantis_token', 'jwt456');
  });
});

describe('logout()', () => {
  it('clears token even if server call fails', async () => {
    localStorageMock.setItem('quantis_token', 'some-token');
    api = await import('@/services/api');

    mockFetch.mockReturnValueOnce(errorResponse(500, 'server error'));
    await api.logout();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('quantis_token');
  });
});

describe('getTickers()', () => {
  it('fetches from /market/ticker and returns data map', async () => {
    const data = { BTCUSDT: { symbol: 'BTCUSDT', price: 50000 } };
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data }));

    const result = await api.getTickers();
    expect(result).toEqual(data);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/ticker');
  });
});

describe('getScreener()', () => {
  it('constructs URL without params', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: [] }));
    await api.getScreener();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/screener');
  });

  it('appends query params when provided', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: [] }));
    await api.getScreener({ exchange: 'binance', sort: 'volume' });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('exchange=binance');
    expect(url).toContain('sort=volume');
  });
});

describe('getSignals()', () => {
  it('returns rows from nested data structure', async () => {
    const signals = [{ id: 's1', pair: 'BTCUSDT', type: 'buy' }];
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: { rows: signals } }));

    const result = await api.getSignals();
    expect(result).toEqual(signals);
  });

  it('returns empty array when data.rows is missing', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: {} }));
    const result = await api.getSignals();
    expect(result).toEqual([]);
  });
});

describe('getMarketRegime()', () => {
  it('returns regime data with score fields', async () => {
    const regime = {
      regime: 'trending',
      confidence: 85,
      description: 'Strong trend',
      recommended: ['trend-following'],
      avoid: ['mean-reversion'],
      indicators: { adx: 30, rsi: 60, bbWidth: 0.05, atr: 500 },
      regimeScore: 72,
      regimeLabel: 'Strong Trend',
      direction: 'bullish',
      components: { adx: 30, adxScore: 80, hurst: 0.7, hurstScore: 70, choppiness: 40, choppinessScore: 60, efficiencyRatio: 0.5, erScore: 50 },
    };
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: regime }));

    const result = await api.getMarketRegime();
    expect(result.regimeScore).toBe(72);
    expect(result.regimeLabel).toBe('Strong Trend');
    expect(result.direction).toBe('bullish');
    expect(result.components?.adxScore).toBe(80);
  });
});

describe('getRegimeScores()', () => {
  it('returns array of RegimeScoreItem', async () => {
    const items = [
      { symbol: 'BTCUSDT', exchange: 'binance', score: 75, label: 'Trending', direction: 'bullish', confidence: 80, description: 'test', components: {}, strategies: { recommended: [], avoid: [] }, price: 50000, change24h: 2.5 },
      { symbol: 'ETHUSDT', exchange: 'binance', score: 45, label: 'Choppy', direction: 'neutral', confidence: 60, description: 'test2', components: {}, strategies: { recommended: [], avoid: [] }, price: 3000, change24h: -1.2 },
    ];
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: items }));

    const result = await api.getRegimeScores();
    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('BTCUSDT');
    expect(result[1].score).toBe(45);
  });
});

describe('getOHLCV()', () => {
  it('constructs URL with symbol, timeframe, and limit', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: [] }));
    await api.getOHLCV('BTCUSDT', '4h', 100);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/ohlcv/BTCUSDT?timeframe=4h&limit=100');
  });

  it('uses defaults for timeframe and limit', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: [] }));
    await api.getOHLCV('ETHUSDT');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/v1/market/ohlcv/ETHUSDT?timeframe=1m&limit=500');
  });
});

describe('getAlerts()', () => {
  it('returns alerts array', async () => {
    const alerts = [{ id: 'a1', name: 'Price Alert', is_active: true }];
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: alerts }));
    const result = await api.getAlerts();
    expect(result).toEqual(alerts);
  });

  it('returns empty array when data is null', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ success: true, data: null }));
    const result = await api.getAlerts();
    expect(result).toEqual([]);
  });
});

describe('token management exports', () => {
  it('setToken / getToken / clearToken work correctly', async () => {
    api.setToken('abc');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('quantis_token', 'abc');

    localStorageMock.getItem.mockReturnValueOnce('abc');
    expect(api.getToken()).toBe('abc');

    api.clearToken();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('quantis_token');
  });
});
