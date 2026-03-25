/**
 * Portfolio Analytics Route — Unit Tests
 *
 * Tests business logic for portfolio performance metrics calculation
 * from routes/portfolio-analytics.ts: win rate, profit factor,
 * Sharpe ratio, max drawdown, equity curve, monthly returns,
 * best/worst trade identification.
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared BEFORE the module under test is imported
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();

jest.mock('../config/database.js', () => ({
  __esModule: true,
  query: (...args: any[]) => mockQuery(...args),
  default: {},
}));

jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    setex: jest.fn(),
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
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import portfolioRouter from '../routes/portfolio-analytics.js';

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
  const layers = (portfolioRouter as any).stack as any[];
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
// Trade data helpers
// ---------------------------------------------------------------------------

interface TradeDef {
  symbol: string;
  side: string;
  entry_price: string;
  exit_price: string;
  quantity: string;
  pnl: string;
  pnl_pct: string;
  closed_at: string;
}

function makeTrade(
  symbol: string,
  pnl: number,
  pnlPct: number,
  closedAt: string,
  side = 'long',
): TradeDef {
  const entry = 100;
  const exit = entry + pnl;
  return {
    symbol,
    side,
    entry_price: String(entry),
    exit_price: String(exit),
    quantity: '1',
    pnl: String(pnl),
    pnl_pct: String(pnlPct),
    closed_at: closedAt,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Portfolio Analytics', () => {
  // The router uses `router.use(authenticate)` at the top level,
  // so we must find the handler on '/analytics' path.
  const handlers = findHandler('get', '/analytics');

  test('returns zero metrics when no trades', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.totalTrades).toBe(0);
    expect(data.winRate).toBe(0);
    expect(data.profitFactor).toBe(0);
    expect(data.sharpeRatio).toBe(0);
    expect(data.maxDrawdown).toBe(0);
    expect(data.maxDrawdownPct).toBe(0);
    expect(data.totalPnl).toBe(0);
    expect(data.avgWin).toBe(0);
    expect(data.avgLoss).toBe(0);
    expect(data.bestTrade).toBeNull();
    expect(data.worstTrade).toBeNull();
    expect(data.equityCurve).toEqual([]);
    expect(data.monthlyReturns).toEqual([]);
  });

  test('calculates win rate correctly', async () => {
    const trades = [
      makeTrade('BTCUSDT', 500, 5, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', -200, -2, '2026-01-16T10:00:00Z'),
      makeTrade('SOLUSDT', 300, 3, '2026-01-17T10:00:00Z'),
      makeTrade('BNBUSDT', 100, 1, '2026-01-18T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    // 3 wins out of 4 trades = 75%
    expect(res.body.data.winRate).toBe(75);
    expect(res.body.data.totalTrades).toBe(4);
  });

  test('calculates profit factor correctly', async () => {
    const trades = [
      makeTrade('BTCUSDT', 500, 5, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', -200, -2, '2026-01-16T10:00:00Z'),
      makeTrade('SOLUSDT', 300, 3, '2026-01-17T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    // Profit factor = gross_wins / gross_losses = 800 / 200 = 4.0
    expect(res.body.data.profitFactor).toBe(4);
  });

  test('calculates Sharpe ratio', async () => {
    const trades = [
      makeTrade('BTCUSDT', 500, 5, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', -200, -2, '2026-01-16T10:00:00Z'),
      makeTrade('SOLUSDT', 300, 3, '2026-01-17T10:00:00Z'),
      makeTrade('BNBUSDT', -100, -1, '2026-01-18T10:00:00Z'),
      makeTrade('XRPUSDT', 400, 4, '2026-01-19T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    // Sharpe ratio should be a number (positive for net positive returns)
    expect(typeof res.body.data.sharpeRatio).toBe('number');
    expect(res.body.data.sharpeRatio).not.toBe(0);
  });

  test('calculates max drawdown', async () => {
    const trades = [
      makeTrade('BTCUSDT', 1000, 10, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', -500, -5, '2026-01-16T10:00:00Z'),
      makeTrade('SOLUSDT', -300, -3, '2026-01-17T10:00:00Z'),
      makeTrade('BNBUSDT', 200, 2, '2026-01-18T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    // Starting equity: 10000
    // After trade 1: 11000 (peak)
    // After trade 2: 10500 (dd=500)
    // After trade 3: 10200 (dd=800)
    // After trade 4: 10400 (dd=600 from peak 11000)
    // Max drawdown = 800
    expect(res.body.data.maxDrawdown).toBe(800);
    // Max drawdown % = (800/11000)*100 = 7.27%
    expect(res.body.data.maxDrawdownPct).toBeCloseTo(7.27, 1);
  });

  test('generates equity curve from trades', async () => {
    const trades = [
      makeTrade('BTCUSDT', 500, 5, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', -200, -2, '2026-01-16T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    const curve = res.body.data.equityCurve;
    expect(curve).toHaveLength(2);
    expect(curve[0].equity).toBe(10500);
    expect(curve[0].date).toBe('2026-01-15');
    expect(curve[1].equity).toBe(10300);
    expect(curve[1].date).toBe('2026-01-16');
  });

  test('generates monthly returns', async () => {
    const trades = [
      makeTrade('BTCUSDT', 500, 5, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', -200, -2, '2026-01-20T10:00:00Z'),
      makeTrade('SOLUSDT', 300, 3, '2026-02-10T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    const monthly = res.body.data.monthlyReturns;
    expect(monthly.length).toBe(2);

    const jan = monthly.find((m: any) => m.month === '2026-01');
    const feb = monthly.find((m: any) => m.month === '2026-02');
    expect(jan).toBeDefined();
    expect(jan.pnl).toBe(300); // 500 + (-200)
    expect(feb).toBeDefined();
    expect(feb.pnl).toBe(300);
  });

  test('identifies best and worst trades', async () => {
    const trades = [
      makeTrade('BTCUSDT', 1000, 10, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', -500, -5, '2026-01-16T10:00:00Z'),
      makeTrade('SOLUSDT', 200, 2, '2026-01-17T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.data.bestTrade).toEqual({
      symbol: 'BTCUSDT',
      pnl: 1000,
      pnl_pct: 10,
    });
    expect(res.body.data.worstTrade).toEqual({
      symbol: 'ETHUSDT',
      pnl: -500,
      pnl_pct: -5,
    });
  });

  test('handles single trade', async () => {
    const trades = [
      makeTrade('BTCUSDT', 250, 2.5, '2026-01-15T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.totalTrades).toBe(1);
    expect(res.body.data.winRate).toBe(100);
    expect(res.body.data.totalPnl).toBe(250);
    expect(res.body.data.equityCurve).toHaveLength(1);
    expect(res.body.data.bestTrade.symbol).toBe('BTCUSDT');
    expect(res.body.data.worstTrade.symbol).toBe('BTCUSDT');
    // Sharpe with single trade — stdReturn of a single return is 0
    expect(res.body.data.sharpeRatio).toBe(0);
  });

  test('handles all winning trades', async () => {
    const trades = [
      makeTrade('BTCUSDT', 500, 5, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', 300, 3, '2026-01-16T10:00:00Z'),
      makeTrade('SOLUSDT', 100, 1, '2026-01-17T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.data.winRate).toBe(100);
    // profitFactor = Infinity when no losses, but rounded
    // In the code: avgLoss > 0 ? wins/losses : wins.length > 0 ? Infinity : 0
    expect(res.body.data.profitFactor).toBe(Infinity);
    expect(res.body.data.totalPnl).toBe(900);
    expect(res.body.data.avgLoss).toBe(0);
    expect(res.body.data.maxDrawdown).toBe(0);
  });

  test('handles all losing trades', async () => {
    const trades = [
      makeTrade('BTCUSDT', -500, -5, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', -300, -3, '2026-01-16T10:00:00Z'),
      makeTrade('SOLUSDT', -100, -1, '2026-01-17T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.data.winRate).toBe(0);
    expect(res.body.data.profitFactor).toBe(0);
    expect(res.body.data.totalPnl).toBe(-900);
    expect(res.body.data.avgWin).toBe(0);
    expect(res.body.data.maxDrawdown).toBe(900);
  });

  test('total PnL is sum of all trade PnLs', async () => {
    const trades = [
      makeTrade('BTCUSDT', 500, 5, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', -200, -2, '2026-01-16T10:00:00Z'),
      makeTrade('SOLUSDT', 300, 3, '2026-01-17T10:00:00Z'),
      makeTrade('BNBUSDT', -50, -0.5, '2026-01-18T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.body.data.totalPnl).toBe(550);
  });

  test('avgWin and avgLoss are correctly computed', async () => {
    const trades = [
      makeTrade('BTCUSDT', 600, 6, '2026-01-15T10:00:00Z'),
      makeTrade('ETHUSDT', -400, -4, '2026-01-16T10:00:00Z'),
      makeTrade('SOLUSDT', 200, 2, '2026-01-17T10:00:00Z'),
      makeTrade('BNBUSDT', -100, -1, '2026-01-18T10:00:00Z'),
    ];
    mockQuery.mockResolvedValue({ rows: trades });

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    // avgWin = (600 + 200) / 2 = 400
    expect(res.body.data.avgWin).toBe(400);
    // avgLoss = abs((-400 + -100) / 2) = 250
    expect(res.body.data.avgLoss).toBe(250);
  });

  test('handles database error gracefully', async () => {
    mockQuery.mockRejectedValue(new Error('Database connection failed'));

    const req = authenticatedReq({ id: 'user-1', email: 'test@test.com', tier: 'pro' });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Failed to compute analytics');
  });
});
