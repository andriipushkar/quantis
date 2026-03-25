/**
 * Paper Trading routes — unit tests
 *
 * Tests the business logic inside /routes/paper-trading.ts by mocking
 * the database query function, Redis (ticker prices), logger, and env.
 * The route now uses PostgreSQL for persistence via query().
 */

 

// ---------------------------------------------------------------------------
// Mocks — must be declared BEFORE the module under test is imported
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();
const mockRedisGet = jest.fn();

jest.mock('../config/database.js', () => ({
  __esModule: true,
  query: (...args: any[]) => mockQuery(...args),
  default: {},
}));

jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockRedisGet(...args),
    set: jest.fn(),
    del: jest.fn(),
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
import paperTradingRouter from '../routes/paper-trading.js';

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
  const layers = (paperTradingRouter as any).stack as any[];
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

/**
 * Helper to set up Redis to return a specific price for a symbol.
 */
function setTickerPrice(symbol: string, price: number) {
  mockRedisGet.mockImplementation((key: string) => {
    if (key === `ticker:binance:${symbol}`) {
      return JSON.stringify({ price });
    }
    return null;
  });
}

/**
 * Set up multiple ticker prices.
 */
function setTickerPrices(prices: Record<string, number>) {
  mockRedisGet.mockImplementation((key: string) => {
    for (const [symbol, price] of Object.entries(prices)) {
      if (key === `ticker:binance:${symbol}`) {
        return JSON.stringify({ price });
      }
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// DB helper: build a mock paper account row
// ---------------------------------------------------------------------------
function makeAccount(userId: string, balance: number, realizedPnl = 0) {
  return {
    user_id: userId,
    balance,
    equity: balance,
    realized_pnl: realizedPnl,
  };
}

// ---------------------------------------------------------------------------
// DB helper: build a mock paper position row
// ---------------------------------------------------------------------------
let posIdCounter = 0;
function makePosition(
  userId: string,
  symbol: string,
  side: 'long' | 'short',
  quantity: number,
  entryPrice: number,
) {
  posIdCounter++;
  return {
    id: `pos-${posIdCounter}`,
    user_id: userId,
    symbol,
    side,
    quantity,
    entry_price: entryPrice,
    current_price: entryPrice,
    opened_at: new Date('2025-01-15T10:00:00Z'),
  };
}

const TEST_USER = { id: 'paper-user-1', email: 'paper@test.com', tier: 'trader' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  posIdCounter = 0;
});

// =========================================================================
// GET /account — initial state
// =========================================================================
describe('GET /account', () => {
  const handlers = findHandler('get', '/account');

  test('new account starts with $10,000 balance', async () => {
    mockRedisGet.mockResolvedValue(null);
    // getOrCreateAccount: no existing row, then insert
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT paper_accounts
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 10000)] }) // INSERT
      .mockResolvedValueOnce({ rows: [] }); // SELECT paper_positions

    const req = authenticatedReq(TEST_USER);
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.balance).toBe(10000);
    expect(res.body.data.equity).toBe(10000);
    expect(res.body.data.unrealizedPnl).toBe(0);
    expect(res.body.data.realizedPnl).toBe(0);
    expect(res.body.data.positionsCount).toBe(0);
  });
});

// =========================================================================
// POST /order — BUY
// =========================================================================
describe('POST /order — BUY', () => {
  const orderHandlers = findHandler('post', '/order');

  test('BUY order reduces balance and creates position', async () => {
    setTickerPrice('BTCUSDT', 50000);
    mockQuery
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 10000)] }) // getOrCreateAccount
      .mockResolvedValueOnce({ rows: [] }) // SELECT paper_positions (no existing)
      .mockResolvedValueOnce({ rows: [] }) // UPDATE paper_accounts
      .mockResolvedValueOnce({ rows: [] }); // INSERT paper_positions

    const req = authenticatedReq(TEST_USER, {
      body: { symbol: 'BTCUSDT', side: 'buy', quantity: 1000 },
    });
    const res = mockRes();
    await runHandlers(orderHandlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe('opened');
    expect(res.body.data.order.symbol).toBe('BTCUSDT');
    expect(res.body.data.order.side).toBe('buy');
    expect(res.body.data.order.entryPrice).toBe(50000);
    expect(res.body.data.order.quantity).toBe(1000 / 50000); // 0.02 BTC
    expect(res.body.data.order.amount).toBe(1000);
    expect(res.body.data.balance).toBe(9000); // 10000 - 1000
  });

  test('symbol is uppercased', async () => {
    setTickerPrice('ETHUSDT', 3000);
    mockQuery
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 10000)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const req = authenticatedReq(TEST_USER, {
      body: { symbol: 'ethusdt', side: 'buy', quantity: 500 },
    });
    const res = mockRes();
    await runHandlers(orderHandlers, req, res);

    expect(res.body.data.order.symbol).toBe('ETHUSDT');
  });

  test('insufficient balance returns 400', async () => {
    setTickerPrice('BTCUSDT', 50000);
    mockQuery
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 10000)] });

    const req = authenticatedReq(TEST_USER, {
      body: { symbol: 'BTCUSDT', side: 'buy', quantity: 15000 },
    });
    const res = mockRes();
    await runHandlers(orderHandlers, req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/insufficient balance/i);
  });

  test('unknown symbol (no ticker) returns 404', async () => {
    mockRedisGet.mockResolvedValue(null);

    const req = authenticatedReq(TEST_USER, {
      body: { symbol: 'FAKECOIN', side: 'buy', quantity: 100 },
    });
    const res = mockRes();
    await runHandlers(orderHandlers, req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/no ticker data/i);
  });

  test('multiple BUY orders accumulate and reduce balance', async () => {
    setTickerPrice('BTCUSDT', 50000);

    // First buy: $2000
    mockQuery
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 10000)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const req1 = authenticatedReq(TEST_USER, {
      body: { symbol: 'BTCUSDT', side: 'buy', quantity: 2000 },
    });
    const res1 = mockRes();
    await runHandlers(orderHandlers, req1, res1);
    expect(res1.body.data.balance).toBe(8000);

    // Second buy: $3000 (balance is now 8000)
    mockQuery
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 8000)] })
      .mockResolvedValueOnce({ rows: [makePosition(TEST_USER.id, 'BTCUSDT', 'long', 0.04, 50000)] }) // existing same direction
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const req2 = authenticatedReq(TEST_USER, {
      body: { symbol: 'BTCUSDT', side: 'buy', quantity: 3000 },
    });
    const res2 = mockRes();
    await runHandlers(orderHandlers, req2, res2);
    expect(res2.body.data.balance).toBe(5000);
  });
});

// =========================================================================
// POST /order — SELL (closing opposite position)
// =========================================================================
describe('POST /order — SELL closes opposite position', () => {
  const orderHandlers = findHandler('post', '/order');

  test('SELL on existing BUY position closes it and opens new SELL', async () => {
    // Open BUY position: balance 10000, buy $1000 at 50000 => balance 9000, qty 0.02
    setTickerPrice('BTCUSDT', 55000); // price went up

    mockQuery
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 9000)] }) // getOrCreateAccount
      .mockResolvedValueOnce({ rows: [makePosition(TEST_USER.id, 'BTCUSDT', 'long', 0.02, 50000)] }) // existing position
      .mockResolvedValueOnce({ rows: [] }) // INSERT paper_trades
      .mockResolvedValueOnce({ rows: [] }) // DELETE paper_positions
      .mockResolvedValueOnce({ rows: [] }) // UPDATE paper_accounts
      .mockResolvedValueOnce({ rows: [] }); // INSERT new paper_positions

    const sellReq = authenticatedReq(TEST_USER, {
      body: { symbol: 'BTCUSDT', side: 'sell', quantity: 500 },
    });
    const sellRes = mockRes();
    await runHandlers(orderHandlers, sellReq, sellRes);

    expect(sellRes.body.data.action).toBe('closed_and_opened');
    // PnL from closing the buy: (55000 - 50000) * 0.02 = 100
    expect(sellRes.body.data.closedPnl).toBe(100);
    // Balance after closing: 9000 + 1000 (original amount) + 100 (pnl) = 10100
    // Then deduct the new SELL order of $500: 10100 - 500 = 9600
    expect(sellRes.body.data.balance).toBe(9600);
  });

  test('SELL on existing BUY with price drop shows negative PnL', async () => {
    setTickerPrice('BTCUSDT', 45000); // price dropped

    // BUY position: $2000 at 50000 => qty = 0.04
    mockQuery
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 8000)] })
      .mockResolvedValueOnce({ rows: [makePosition(TEST_USER.id, 'BTCUSDT', 'long', 0.04, 50000)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const sellReq = authenticatedReq(TEST_USER, {
      body: { symbol: 'BTCUSDT', side: 'sell', quantity: 500 },
    });
    const sellRes = mockRes();
    await runHandlers(orderHandlers, sellReq, sellRes);

    // PnL: (45000 - 50000) * 0.04 = -200
    expect(sellRes.body.data.closedPnl).toBe(-200);
  });
});

// =========================================================================
// POST /close/:symbol
// =========================================================================
describe('POST /close/:symbol', () => {
  const closeHandlers = findHandler('post', '/close/:symbol');

  test('closes long position with correct PnL', async () => {
    // Position: BUY $600 of ETHUSDT at 3000 => qty = 0.2
    // Close at 3300 (10% up)
    setTickerPrice('ETHUSDT', 3300);

    mockQuery
      .mockResolvedValueOnce({ rows: [makePosition(TEST_USER.id, 'ETHUSDT', 'long', 0.2, 3000)] }) // SELECT position
      .mockResolvedValueOnce({ rows: [] }) // INSERT paper_trades
      .mockResolvedValueOnce({ rows: [] }) // DELETE position
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 9400)] }) // getOrCreateAccount
      .mockResolvedValueOnce({ rows: [] }); // UPDATE account

    const closeReq = authenticatedReq(TEST_USER, {
      params: { symbol: 'ETHUSDT' },
    });
    const closeRes = mockRes();
    await runHandlers(closeHandlers, closeReq, closeRes);

    expect(closeRes.statusCode).toBe(200);
    expect(closeRes.body.success).toBe(true);
    expect(closeRes.body.data.symbol).toBe('ETHUSDT');
    expect(closeRes.body.data.side).toBe('buy');
    expect(closeRes.body.data.entryPrice).toBe(3000);
    expect(closeRes.body.data.exitPrice).toBe(3300);
    // PnL: (3300 - 3000) * 0.2 = 60
    expect(closeRes.body.data.pnl).toBe(60);
    // Balance: 9400 + 600 (returned amount) + 60 (pnl) = 10060
    expect(closeRes.body.data.balance).toBe(10060);
  });

  test('closes short position with correct PnL', async () => {
    // Position: SELL (short) $1200 of BTCUSDT at 60000 => qty = 0.02
    // Close at 54000 (10% down, good for shorts)
    setTickerPrice('BTCUSDT', 54000);

    mockQuery
      .mockResolvedValueOnce({ rows: [makePosition(TEST_USER.id, 'BTCUSDT', 'short', 0.02, 60000)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 8800)] })
      .mockResolvedValueOnce({ rows: [] });

    const closeReq = authenticatedReq(TEST_USER, {
      params: { symbol: 'btcusdt' }, // should uppercase
    });
    const closeRes = mockRes();
    await runHandlers(closeHandlers, closeReq, closeRes);

    expect(closeRes.body.data.side).toBe('sell');
    // PnL: (60000 - 54000) * 0.02 = 120
    expect(closeRes.body.data.pnl).toBe(120);
    // Balance: 8800 + 1200 + 120 = 10120
    expect(closeRes.body.data.balance).toBe(10120);
  });

  test('closing short with price increase shows loss', async () => {
    // Short $1000 of ETHUSDT at 2000 => qty = 0.5
    // Price goes UP to 2500 (bad for short)
    setTickerPrice('ETHUSDT', 2500);

    mockQuery
      .mockResolvedValueOnce({ rows: [makePosition(TEST_USER.id, 'ETHUSDT', 'short', 0.5, 2000)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 9000)] })
      .mockResolvedValueOnce({ rows: [] });

    const closeReq = authenticatedReq(TEST_USER, {
      params: { symbol: 'ETHUSDT' },
    });
    const closeRes = mockRes();
    await runHandlers(closeHandlers, closeReq, closeRes);

    // PnL: (2000 - 2500) * 0.5 = -250
    expect(closeRes.body.data.pnl).toBe(-250);
    // Balance: 9000 + 1000 - 250 = 9750
    expect(closeRes.body.data.balance).toBe(9750);
  });

  test('no open position returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no position found

    const closeReq = authenticatedReq(TEST_USER, {
      params: { symbol: 'BTCUSDT' },
    });
    const closeRes = mockRes();
    await runHandlers(closeHandlers, closeReq, closeRes);

    expect(closeRes.statusCode).toBe(404);
    expect(closeRes.body.error).toMatch(/no open position/i);
  });

  test('no ticker data at close time returns 404', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makePosition(TEST_USER.id, 'SOLUSDT', 'long', 2, 150)],
    });

    // Ticker gone
    mockRedisGet.mockResolvedValue(null);

    const closeReq = authenticatedReq(TEST_USER, {
      params: { symbol: 'SOLUSDT' },
    });
    const closeRes = mockRes();
    await runHandlers(closeHandlers, closeReq, closeRes);

    expect(closeRes.statusCode).toBe(404);
    expect(closeRes.body.error).toMatch(/no ticker data/i);
  });
});

// =========================================================================
// GET /positions
// =========================================================================
describe('GET /positions', () => {
  const positionsHandlers = findHandler('get', '/positions');

  test('empty when no positions opened', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockQuery.mockResolvedValueOnce({ rows: [] }); // SELECT paper_positions

    const req = authenticatedReq(TEST_USER);
    const res = mockRes();
    await runHandlers(positionsHandlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('lists open positions with current PnL', async () => {
    setTickerPrice('BTCUSDT', 52000);
    // Position: BUY $2000 at 50000 => qty = 0.04
    mockQuery.mockResolvedValueOnce({
      rows: [makePosition(TEST_USER.id, 'BTCUSDT', 'long', 0.04, 50000)],
    });

    const posReq = authenticatedReq(TEST_USER);
    const posRes = mockRes();
    await runHandlers(positionsHandlers, posReq, posRes);

    expect(posRes.statusCode).toBe(200);
    expect(posRes.body.data).toHaveLength(1);

    const pos = posRes.body.data[0];
    expect(pos.symbol).toBe('BTCUSDT');
    expect(pos.side).toBe('buy');
    expect(pos.entryPrice).toBe(50000);
    expect(pos.currentPrice).toBe(52000);
    expect(pos.amount).toBe(2000);
    // PnL: (52000 - 50000) * 0.04 = 80
    expect(pos.pnl).toBe(80);
    // PnL %: 80 / 2000 * 100 = 4%
    expect(pos.pnlPct).toBe(4);
  });

  test('shows negative PnL for losing position', async () => {
    setTickerPrice('ETHUSDT', 3000);
    // Position: BUY $1000 at 4000 => qty = 0.25
    mockQuery.mockResolvedValueOnce({
      rows: [makePosition(TEST_USER.id, 'ETHUSDT', 'long', 0.25, 4000)],
    });

    const posReq = authenticatedReq(TEST_USER);
    const posRes = mockRes();
    await runHandlers(positionsHandlers, posReq, posRes);

    const pos = posRes.body.data[0];
    // PnL: (3000 - 4000) * 0.25 = -250
    expect(pos.pnl).toBe(-250);
    expect(pos.pnlPct).toBe(-25);
  });
});

// =========================================================================
// GET /history
// =========================================================================
describe('GET /history', () => {
  const historyHandlers = findHandler('get', '/history');

  test('empty when no trades closed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = authenticatedReq(TEST_USER);
    const res = mockRes();
    await runHandlers(historyHandlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('records trade after position is closed', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          symbol: 'BTCUSDT',
          side: 'long',
          quantity: 0.02,
          entry_price: 40000,
          exit_price: 44000,
          pnl: 80,
          opened_at: new Date('2025-01-15T10:00:00Z'),
          closed_at: new Date('2025-01-15T12:00:00Z'),
        },
      ],
    });

    const histReq = authenticatedReq(TEST_USER);
    const histRes = mockRes();
    await runHandlers(historyHandlers, histReq, histRes);

    expect(histRes.body.data).toHaveLength(1);
    const trade = histRes.body.data[0];
    expect(trade.symbol).toBe('BTCUSDT');
    expect(trade.side).toBe('buy');
    expect(trade.entryPrice).toBe(40000);
    expect(trade.exitPrice).toBe(44000);
    expect(trade.pnl).toBe(80);
    expect(trade.closedAt).toBeDefined();
    expect(trade.openedAt).toBeDefined();
  });

  test('history is returned in reverse chronological order', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          symbol: 'ETHUSDT',
          side: 'long',
          quantity: 0.167,
          entry_price: 3000,
          exit_price: 3100,
          pnl: 16.7,
          opened_at: new Date('2025-01-15T14:00:00Z'),
          closed_at: new Date('2025-01-15T16:00:00Z'),
        },
        {
          symbol: 'BTCUSDT',
          side: 'long',
          quantity: 0.01,
          entry_price: 50000,
          exit_price: 51000,
          pnl: 10,
          opened_at: new Date('2025-01-15T10:00:00Z'),
          closed_at: new Date('2025-01-15T12:00:00Z'),
        },
      ],
    });

    const histReq = authenticatedReq(TEST_USER);
    const histRes = mockRes();
    await runHandlers(historyHandlers, histReq, histRes);

    expect(histRes.body.data).toHaveLength(2);
    // Most recent trade (ETHUSDT) should be first (DB returns ORDER BY closed_at DESC)
    expect(histRes.body.data[0].symbol).toBe('ETHUSDT');
    expect(histRes.body.data[1].symbol).toBe('BTCUSDT');
  });
});

// =========================================================================
// GET /account — with positions (unrealized + realized PnL)
// =========================================================================
describe('GET /account — with open positions', () => {
  const accountHandlers = findHandler('get', '/account');

  test('equity reflects unrealized PnL from open positions', async () => {
    setTickerPrice('BTCUSDT', 55000);

    // Account balance is 5000 (spent 5000 on position)
    mockQuery
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 5000)] }) // getOrCreateAccount
      .mockResolvedValueOnce({
        rows: [makePosition(TEST_USER.id, 'BTCUSDT', 'long', 0.1, 50000)], // 0.1 BTC at 50000 = $5000
      }); // SELECT paper_positions

    const accReq = authenticatedReq(TEST_USER);
    const accRes = mockRes();
    await runHandlers(accountHandlers, accReq, accRes);

    expect(accRes.body.data.balance).toBe(5000);
    // Unrealized: (55000 - 50000) * 0.1 = 500
    expect(accRes.body.data.unrealizedPnl).toBe(500);
    // Equity: 5000 + 500 = 5500
    expect(accRes.body.data.equity).toBe(5500);
    expect(accRes.body.data.positionsCount).toBe(1);
  });

  test('realized PnL accumulates from closed trades', async () => {
    mockRedisGet.mockResolvedValue(null);

    // Account has accumulated realized PnL of 40 (100 from trade1 + -60 from trade2)
    // Balance = 10040 (10000 + 100 - 60)
    mockQuery
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 10040, 40)] })
      .mockResolvedValueOnce({ rows: [] }); // no open positions

    const accReq = authenticatedReq(TEST_USER);
    const accRes = mockRes();
    await runHandlers(accountHandlers, accReq, accRes);

    expect(accRes.body.data.realizedPnl).toBe(40);
    expect(accRes.body.data.unrealizedPnl).toBe(0);
    expect(accRes.body.data.positionsCount).toBe(0);
    expect(accRes.body.data.balance).toBe(10040);
  });
});

// =========================================================================
// PnL calculation accuracy
// =========================================================================
describe('PnL calculation accuracy', () => {
  const closeHandlers = findHandler('post', '/close/:symbol');

  test('long position: exact PnL = (exit - entry) * quantity', async () => {
    const entryPrice = 42567.89;
    const exitPrice = 43210.55;
    const usdAmount = 2500;
    const quantity = usdAmount / entryPrice;
    const expectedPnl = Math.round((exitPrice - entryPrice) * quantity * 100) / 100;

    setTickerPrice('BTCUSDT', exitPrice);

    mockQuery
      .mockResolvedValueOnce({ rows: [makePosition(TEST_USER.id, 'BTCUSDT', 'long', quantity, entryPrice)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 10000 - usdAmount)] })
      .mockResolvedValueOnce({ rows: [] });

    const closeRes = mockRes();
    await runHandlers(
      closeHandlers,
      authenticatedReq(TEST_USER, { params: { symbol: 'BTCUSDT' } }),
      closeRes,
    );

    expect(closeRes.body.data.pnl).toBe(expectedPnl);
  });

  test('short position: exact PnL = (entry - exit) * quantity', async () => {
    const entryPrice = 2345.67;
    const exitPrice = 2100.00;
    const usdAmount = 1500;
    const quantity = usdAmount / entryPrice;
    const expectedPnl = Math.round((entryPrice - exitPrice) * quantity * 100) / 100;

    setTickerPrice('ETHUSDT', exitPrice);

    mockQuery
      .mockResolvedValueOnce({ rows: [makePosition(TEST_USER.id, 'ETHUSDT', 'short', quantity, entryPrice)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 10000 - usdAmount)] })
      .mockResolvedValueOnce({ rows: [] });

    const closeRes = mockRes();
    await runHandlers(
      closeHandlers,
      authenticatedReq(TEST_USER, { params: { symbol: 'ETHUSDT' } }),
      closeRes,
    );

    expect(closeRes.body.data.pnl).toBe(expectedPnl);
  });

  test('break-even trade returns PnL of 0', async () => {
    setTickerPrice('BTCUSDT', 50000);

    mockQuery
      .mockResolvedValueOnce({ rows: [makePosition(TEST_USER.id, 'BTCUSDT', 'long', 0.02, 50000)] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeAccount(TEST_USER.id, 9000)] })
      .mockResolvedValueOnce({ rows: [] });

    const closeRes = mockRes();
    await runHandlers(
      closeHandlers,
      authenticatedReq(TEST_USER, { params: { symbol: 'BTCUSDT' } }),
      closeRes,
    );

    expect(closeRes.body.data.pnl).toBe(0);
    expect(closeRes.body.data.balance).toBe(10000);
  });
});
