/**
 * Morning Brief (Copilot) — Unit Tests
 *
 * Tests the GET /morning-brief endpoint from routes/copilot.ts:
 * market context gathering, gainers/losers, Redis caching,
 * rate limiting, mock brief generation, and Claude API integration.
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared BEFORE the module under test is imported
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisSetex = jest.fn();
const mockRedisIncr = jest.fn();
const mockRedisExpire = jest.fn();
const mockGetAllTickers = jest.fn();
const mockGetTickerBySymbol = jest.fn();
const mockFetch = jest.fn();

jest.mock('../config/database.js', () => ({
  __esModule: true,
  query: (...args: any[]) => mockQuery(...args),
  default: {},
}));

jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockRedisGet(...args),
    set: (...args: any[]) => mockRedisSet(...args),
    setex: (...args: any[]) => mockRedisSetex(...args),
    del: jest.fn(),
    incr: (...args: any[]) => mockRedisIncr(...args),
    expire: (...args: any[]) => mockRedisExpire(...args),
  },
}));

jest.mock('../config/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../config/env.js', () => ({
  __esModule: true,
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    BCRYPT_ROUNDS: 4,
    isProduction: false,
    ANTHROPIC_API_KEY: '', // Empty by default — tests control this
    ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
    COPILOT_MAX_TOKENS: 1024,
  },
}));

jest.mock('../utils/ticker-cache.js', () => ({
  __esModule: true,
  getAllTickers: (...args: any[]) => mockGetAllTickers(...args),
  getTickerBySymbol: (...args: any[]) => mockGetTickerBySymbol(...args),
  getAllTickersAsObject: jest.fn(),
}));

jest.mock('../utils/indicators.js', () => ({
  __esModule: true,
  computeRSI: jest.fn().mockReturnValue(50),
  computeEMA: jest.fn().mockReturnValue(100),
}));

jest.mock('../validators/index.js', () => ({
  __esModule: true,
  validateBody: () => (_req: any, _res: any, next: any) => next(),
  copilotSchema: {},
}));

// Mock @quantis/shared CircuitBreaker
jest.mock('@quantis/shared', () => ({
  __esModule: true,
  CircuitBreaker: class MockCircuitBreaker {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    async call<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
      try {
        return await fn();
      } catch {
        if (fallback) return fallback();
        throw new Error('Circuit breaker open');
      }
    }
  },
}));

// Mock global fetch
const originalFetch = global.fetch;
beforeAll(() => {
  global.fetch = mockFetch as any;
});
afterAll(() => {
  global.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import copilotRouter from '../routes/copilot.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockResponse {
  statusCode: number;
  body: any;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
}

function mockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

function mockReq(overrides: Record<string, any> = {}): any {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    user: undefined,
    ...overrides,
  };
}

function findHandler(method: string, path: string): Function[] {
  const layers = (copilotRouter as any).stack as any[];
  for (const layer of layers) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method.toLowerCase()]
    ) {
      return layer.route.stack.map((s: any) => s.handle);
    }
  }
  throw new Error(`Handler not found: ${method} ${path}`);
}

async function runHandlers(handlers: Function[], req: any, res: MockResponse) {
  for (const handler of handlers) {
    if (res.body !== null) break;
    await handler(req, res, (err?: any) => {
      if (err) throw err;
    });
  }
}

function authenticatedReq(
  user: { id: string; email: string; tier: string },
  overrides: Record<string, any> = {},
) {
  const token = jwt.sign(user, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  return mockReq({
    headers: { authorization: `Bearer ${token}` },
    user,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Ticker helpers
// ---------------------------------------------------------------------------

function buildTickerMap(entries: Array<{ symbol: string; exchange: string; price: number; change24h: number; volume?: number }>) {
  const map = new Map<string, any>();
  for (const entry of entries) {
    const key = `${entry.exchange.toLowerCase()}:${entry.symbol}`;
    map.set(key, {
      symbol: entry.symbol,
      exchange: entry.exchange,
      price: entry.price,
      change24h: entry.change24h,
      volume: entry.volume ?? 100000,
      timestamp: Date.now(),
    });
  }
  return map;
}

function setupDefaultTickers() {
  const tickers = buildTickerMap([
    { symbol: 'BTCUSDT', exchange: 'binance', price: 65000, change24h: 2.5 },
    { symbol: 'ETHUSDT', exchange: 'binance', price: 3500, change24h: -1.2 },
    { symbol: 'SOLUSDT', exchange: 'binance', price: 150, change24h: 5.0 },
    { symbol: 'BNBUSDT', exchange: 'binance', price: 600, change24h: -3.0 },
    { symbol: 'XRPUSDT', exchange: 'binance', price: 0.55, change24h: 1.0 },
  ]);
  mockGetAllTickers.mockResolvedValue(tickers);

  mockGetTickerBySymbol.mockImplementation((symbol: string) => {
    for (const [, entry] of tickers) {
      if (entry.symbol === symbol) return entry;
    }
    return null;
  });
}

// ===========================================================================
// Tests
// ===========================================================================

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue('OK');
  mockRedisSetex.mockResolvedValue('OK');
  mockRedisIncr.mockResolvedValue(1); // First request allowed
  mockRedisExpire.mockResolvedValue(1);
  mockQuery.mockResolvedValue({ rows: [] });
});

describe('Morning Brief', () => {
  const handlers = findHandler('get', '/morning-brief');

  test('generates brief with market context', async () => {
    setupDefaultTickers();

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.brief).toBeDefined();
    expect(typeof res.body.data.brief).toBe('string');
    expect(res.body.data.brief.length).toBeGreaterThan(0);
    expect(res.body.data.generatedAt).toBeDefined();
    expect(res.body.data.context).toBeDefined();
  });

  test('includes top gainers and losers', async () => {
    setupDefaultTickers();

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    const ctx = res.body.data.context;
    expect(ctx.gainers).toBeDefined();
    expect(ctx.losers).toBeDefined();
    expect(Array.isArray(ctx.gainers)).toBe(true);
    expect(Array.isArray(ctx.losers)).toBe(true);
    expect(ctx.gainers.length).toBeGreaterThan(0);
    expect(ctx.losers.length).toBeGreaterThan(0);

    // Top gainer should be SOLUSDT (+5.0%)
    expect(ctx.gainers[0].symbol).toBe('binance:SOLUSDT');
    // Top loser should be BNBUSDT (-3.0%)
    expect(ctx.losers[0].change24h).toBeLessThan(0);
  });

  test('uses Redis cache when available', async () => {
    const cachedResponse = {
      success: true,
      data: {
        brief: 'Cached morning brief content...',
        generatedAt: '2026-01-15T08:00:00Z',
        context: {
          gainers: [],
          losers: [],
          sentiment: { score: 50, label: 'Neutral' },
          btcPrice: { price: 65000, change24h: 2.5 },
          ethPrice: { price: 3500, change24h: -1.2 },
        },
      },
    };

    // Rate limit passes
    mockRedisIncr.mockResolvedValue(1);

    // Cache hit on the user-specific cache key
    mockRedisGet.mockImplementation((key: string) => {
      if (key.startsWith('copilot:morning-brief:user-')) {
        return JSON.stringify(cachedResponse);
      }
      return null;
    });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.brief).toBe('Cached morning brief content...');
    // getAllTickers should NOT be called when cache is hit
    expect(mockGetAllTickers).not.toHaveBeenCalled();
  });

  test('rate limits to 1 per hour per user', async () => {
    setupDefaultTickers();

    // First request: count = 1, allowed
    mockRedisIncr.mockResolvedValueOnce(1);
    const req1 = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res1 = mockRes();
    await runHandlers(handlers, req1, res1);
    expect(res1.body.success).toBe(true);

    // Second request: count = 2, rejected
    mockRedisIncr.mockResolvedValueOnce(2);
    mockRedisGet.mockResolvedValue(null);
    const req2 = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res2 = mockRes();
    await runHandlers(handlers, req2, res2);
    expect(res2.statusCode).toBe(429);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error).toContain('Rate limit');
  });

  test('generates mock brief when no API key', async () => {
    setupDefaultTickers();

    // env.ANTHROPIC_API_KEY is '' (falsy) by default in our mock
    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.brief).toBeDefined();
    // Mock brief should contain market overview content
    expect(res.body.data.brief).toContain('Market Overview');
    // fetch should NOT be called for Claude API
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('handles Claude API failure gracefully', async () => {
    setupDefaultTickers();

    // Enable API key temporarily
    const envModule = require('../config/env.js');
    const originalKey = envModule.env.ANTHROPIC_API_KEY;
    envModule.env.ANTHROPIC_API_KEY = 'test-api-key';

    // Claude API fails
    mockFetch.mockRejectedValueOnce(new Error('Claude API timeout'));

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    // Should still succeed with fallback mock brief
    expect(res.body.success).toBe(true);
    expect(res.body.data.brief).toBeDefined();
    expect(res.body.data.brief).toContain('Market Overview');

    // Restore
    envModule.env.ANTHROPIC_API_KEY = originalKey;
  });

  test('includes BTC and ETH prices in context', async () => {
    setupDefaultTickers();

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    const ctx = res.body.data.context;
    expect(ctx.btcPrice).toBeDefined();
    expect(ctx.ethPrice).toBeDefined();
    expect(ctx.btcPrice.price).toBe(65000);
    expect(ctx.ethPrice.price).toBe(3500);
  });

  test('includes sentiment score in context', async () => {
    setupDefaultTickers();

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    const ctx = res.body.data.context;
    expect(ctx.sentiment).toBeDefined();
    expect(ctx.sentiment.score).toBeGreaterThanOrEqual(0);
    expect(ctx.sentiment.score).toBeLessThanOrEqual(100);
    expect(ctx.sentiment.label).toBeDefined();
  });

  test('caches result in Redis for 30 minutes', async () => {
    setupDefaultTickers();

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    expect(mockRedisSetex).toHaveBeenCalledWith(
      expect.stringContaining('copilot:morning-brief:'),
      1800, // 30 minutes
      expect.any(String)
    );
  });

  test('includes latest signals from database', async () => {
    setupDefaultTickers();
    mockQuery.mockResolvedValue({
      rows: [
        {
          type: 'buy',
          strategy: 'macd_crossover',
          strength: 'strong',
          confidence: 85,
          reasoning: 'MACD bullish crossover',
          symbol: 'BTCUSDT',
        },
      ],
    });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    // The brief should mention the signal (mock brief includes it)
    expect(res.body.data.brief).toContain('BUY');
  });

  test('handles empty tickers gracefully', async () => {
    mockGetAllTickers.mockResolvedValue(new Map());
    mockGetTickerBySymbol.mockResolvedValue(null);

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.brief).toBeDefined();
  });

  test('handles database error in morning brief gracefully', async () => {
    setupDefaultTickers();
    mockQuery.mockRejectedValue(new Error('Database connection failed'));

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Failed to generate morning brief');
  });
});
