/**
 * Paper Trading routes — unit tests
 *
 * Tests the business logic inside /routes/paper-trading.ts by mocking
 * Redis (ticker prices), logger, and env. Paper trading uses an in-memory
 * store so no database mocking needed for core logic.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRedisGet = jest.fn();
jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockRedisGet(...args),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../config/database.js', () => ({
  __esModule: true,
  query: jest.fn(),
  default: {},
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
 * The paper-trading code iterates binance, bybit, okx; we return on binance.
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

// Each test suite uses a unique user ID to get a fresh in-memory account.
let userCounter = 0;
function freshUser() {
  userCounter++;
  return { id: `paper-user-${userCounter}`, email: `paper${userCounter}@test.com`, tier: 'trader' };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// =========================================================================
// GET /account — initial state
// =========================================================================
describe('GET /account', () => {
  const handlers = findHandler('get', '/account');

  test('new account starts with $10,000 balance', async () => {
    const user = freshUser();
    mockRedisGet.mockResolvedValue(null);

    const req = authenticatedReq(user);
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
  const accountHandlers = findHandler('get', '/account');

  test('BUY order reduces balance and creates position', async () => {
    const user = freshUser();
    setTickerPrice('BTCUSDT', 50000);

    // Place buy order for $1000
    const req = authenticatedReq(user, {
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
    const user = freshUser();
    setTickerPrice('ETHUSDT', 3000);

    const req = authenticatedReq(user, {
      body: { symbol: 'ethusdt', side: 'buy', quantity: 500 },
    });
    const res = mockRes();

    await runHandlers(orderHandlers, req, res);

    expect(res.body.data.order.symbol).toBe('ETHUSDT');
  });

  test('insufficient balance returns 400', async () => {
    const user = freshUser();
    setTickerPrice('BTCUSDT', 50000);

    const req = authenticatedReq(user, {
      body: { symbol: 'BTCUSDT', side: 'buy', quantity: 15000 }, // more than $10k
    });
    const res = mockRes();

    await runHandlers(orderHandlers, req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/insufficient balance/i);
  });

  test('unknown symbol (no ticker) returns 404', async () => {
    const user = freshUser();
    mockRedisGet.mockResolvedValue(null);

    const req = authenticatedReq(user, {
      body: { symbol: 'FAKECOIN', side: 'buy', quantity: 100 },
    });
    const res = mockRes();

    await runHandlers(orderHandlers, req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/no ticker data/i);
  });

  test('multiple BUY orders accumulate positions and reduce balance', async () => {
    const user = freshUser();
    setTickerPrice('BTCUSDT', 50000);

    // First buy: $2000
    const req1 = authenticatedReq(user, {
      body: { symbol: 'BTCUSDT', side: 'buy', quantity: 2000 },
    });
    const res1 = mockRes();
    await runHandlers(orderHandlers, req1, res1);
    expect(res1.body.data.balance).toBe(8000);

    // Second buy: $3000
    const req2 = authenticatedReq(user, {
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
    const user = freshUser();
    setTickerPrice('BTCUSDT', 50000);

    // Open BUY position
    const buyReq = authenticatedReq(user, {
      body: { symbol: 'BTCUSDT', side: 'buy', quantity: 1000 },
    });
    const buyRes = mockRes();
    await runHandlers(orderHandlers, buyReq, buyRes);
    expect(buyRes.body.data.balance).toBe(9000);

    // Price goes up — now sell
    setTickerPrice('BTCUSDT', 55000);

    const sellReq = authenticatedReq(user, {
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
    const user = freshUser();
    setTickerPrice('BTCUSDT', 50000);

    // Open BUY position for $2000
    const buyReq = authenticatedReq(user, {
      body: { symbol: 'BTCUSDT', side: 'buy', quantity: 2000 },
    });
    const buyRes = mockRes();
    await runHandlers(orderHandlers, buyReq, buyRes);

    // Price drops 10%
    setTickerPrice('BTCUSDT', 45000);

    const sellReq = authenticatedReq(user, {
      body: { symbol: 'BTCUSDT', side: 'sell', quantity: 500 },
    });
    const sellRes = mockRes();
    await runHandlers(orderHandlers, sellReq, sellRes);

    // PnL: (45000 - 50000) * (2000/50000) = -5000 * 0.04 = -200
    expect(sellRes.body.data.closedPnl).toBe(-200);
  });
});

// =========================================================================
// POST /close/:symbol
// =========================================================================
describe('POST /close/:symbol', () => {
  const orderHandlers = findHandler('post', '/order');
  const closeHandlers = findHandler('post', '/close/:symbol');

  test('closes long position with correct PnL', async () => {
    const user = freshUser();
    setTickerPrice('ETHUSDT', 3000);

    // Open BUY position for $600
    const buyReq = authenticatedReq(user, {
      body: { symbol: 'ETHUSDT', side: 'buy', quantity: 600 },
    });
    const buyRes = mockRes();
    await runHandlers(orderHandlers, buyReq, buyRes);
    expect(buyRes.body.data.balance).toBe(9400);

    // Price goes to $3300 (10% up)
    setTickerPrice('ETHUSDT', 3300);

    const closeReq = authenticatedReq(user, {
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
    // PnL: (3300 - 3000) * (600/3000) = 300 * 0.2 = 60
    expect(closeRes.body.data.pnl).toBe(60);
    // Balance: 9400 + 600 (returned amount) + 60 (pnl) = 10060
    expect(closeRes.body.data.balance).toBe(10060);
  });

  test('closes short position with correct PnL', async () => {
    const user = freshUser();
    setTickerPrice('BTCUSDT', 60000);

    // Open SELL (short) position for $1200
    const sellReq = authenticatedReq(user, {
      body: { symbol: 'BTCUSDT', side: 'sell', quantity: 1200 },
    });
    const sellRes = mockRes();
    await runHandlers(orderHandlers, sellReq, sellRes);
    expect(sellRes.body.data.balance).toBe(8800);

    // Price drops to $54000 (10% down — good for shorts)
    setTickerPrice('BTCUSDT', 54000);

    const closeReq = authenticatedReq(user, {
      params: { symbol: 'btcusdt' }, // should uppercase
    });
    const closeRes = mockRes();
    await runHandlers(closeHandlers, closeReq, closeRes);

    expect(closeRes.body.data.side).toBe('sell');
    // PnL: (60000 - 54000) * (1200/60000) = 6000 * 0.02 = 120
    expect(closeRes.body.data.pnl).toBe(120);
    // Balance: 8800 + 1200 + 120 = 10120
    expect(closeRes.body.data.balance).toBe(10120);
  });

  test('closing short with price increase shows loss', async () => {
    const user = freshUser();
    setTickerPrice('ETHUSDT', 2000);

    // Short $1000
    const sellReq = authenticatedReq(user, {
      body: { symbol: 'ETHUSDT', side: 'sell', quantity: 1000 },
    });
    const sellRes = mockRes();
    await runHandlers(orderHandlers, sellReq, sellRes);

    // Price goes UP to $2500 (bad for short)
    setTickerPrice('ETHUSDT', 2500);

    const closeReq = authenticatedReq(user, {
      params: { symbol: 'ETHUSDT' },
    });
    const closeRes = mockRes();
    await runHandlers(closeHandlers, closeReq, closeRes);

    // PnL: (2000 - 2500) * (1000/2000) = -500 * 0.5 = -250
    expect(closeRes.body.data.pnl).toBe(-250);
    // Balance: 9000 + 1000 - 250 = 9750
    expect(closeRes.body.data.balance).toBe(9750);
  });

  test('no open position returns 404', async () => {
    const user = freshUser();

    const closeReq = authenticatedReq(user, {
      params: { symbol: 'BTCUSDT' },
    });
    const closeRes = mockRes();
    await runHandlers(closeHandlers, closeReq, closeRes);

    expect(closeRes.statusCode).toBe(404);
    expect(closeRes.body.error).toMatch(/no open position/i);
  });

  test('no ticker data at close time returns 404', async () => {
    const user = freshUser();
    setTickerPrice('SOLUSDT', 150);

    // Open position
    const buyReq = authenticatedReq(user, {
      body: { symbol: 'SOLUSDT', side: 'buy', quantity: 300 },
    });
    const buyRes = mockRes();
    await runHandlers(orderHandlers, buyReq, buyRes);

    // Ticker goes away
    mockRedisGet.mockResolvedValue(null);

    const closeReq = authenticatedReq(user, {
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
  const orderHandlers = findHandler('post', '/order');
  const positionsHandlers = findHandler('get', '/positions');

  test('empty when no positions opened', async () => {
    const user = freshUser();
    mockRedisGet.mockResolvedValue(null);

    const req = authenticatedReq(user);
    const res = mockRes();
    await runHandlers(positionsHandlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('lists open positions with current PnL', async () => {
    const user = freshUser();
    setTickerPrice('BTCUSDT', 50000);

    // Open a position
    const buyReq = authenticatedReq(user, {
      body: { symbol: 'BTCUSDT', side: 'buy', quantity: 2000 },
    });
    const buyRes = mockRes();
    await runHandlers(orderHandlers, buyReq, buyRes);

    // Price moves up
    setTickerPrice('BTCUSDT', 52000);

    const posReq = authenticatedReq(user);
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
    // PnL: (52000 - 50000) * (2000/50000) = 2000 * 0.04 = 80
    expect(pos.pnl).toBe(80);
    // PnL %: 80 / 2000 * 100 = 4%
    expect(pos.pnlPct).toBe(4);
  });

  test('shows negative PnL for losing position', async () => {
    const user = freshUser();
    setTickerPrice('ETHUSDT', 4000);

    const buyReq = authenticatedReq(user, {
      body: { symbol: 'ETHUSDT', side: 'buy', quantity: 1000 },
    });
    const buyRes = mockRes();
    await runHandlers(orderHandlers, buyReq, buyRes);

    // Price drops 25%
    setTickerPrice('ETHUSDT', 3000);

    const posReq = authenticatedReq(user);
    const posRes = mockRes();
    await runHandlers(positionsHandlers, posReq, posRes);

    const pos = posRes.body.data[0];
    // PnL: (3000 - 4000) * (1000/4000) = -1000 * 0.25 = -250
    expect(pos.pnl).toBe(-250);
    expect(pos.pnlPct).toBe(-25);
  });
});

// =========================================================================
// GET /history
// =========================================================================
describe('GET /history', () => {
  const orderHandlers = findHandler('post', '/order');
  const closeHandlers = findHandler('post', '/close/:symbol');
  const historyHandlers = findHandler('get', '/history');

  test('empty when no trades closed', async () => {
    const user = freshUser();

    const req = authenticatedReq(user);
    const res = mockRes();
    await runHandlers(historyHandlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('records trade after position is closed', async () => {
    const user = freshUser();
    setTickerPrice('BTCUSDT', 40000);

    // Open
    const buyReq = authenticatedReq(user, {
      body: { symbol: 'BTCUSDT', side: 'buy', quantity: 800 },
    });
    await runHandlers(orderHandlers, buyReq, mockRes());

    // Close at higher price
    setTickerPrice('BTCUSDT', 44000);
    const closeReq = authenticatedReq(user, { params: { symbol: 'BTCUSDT' } });
    await runHandlers(closeHandlers, closeReq, mockRes());

    // Check history
    const histReq = authenticatedReq(user);
    const histRes = mockRes();
    await runHandlers(historyHandlers, histReq, histRes);

    expect(histRes.body.data).toHaveLength(1);
    const trade = histRes.body.data[0];
    expect(trade.symbol).toBe('BTCUSDT');
    expect(trade.side).toBe('buy');
    expect(trade.entryPrice).toBe(40000);
    expect(trade.exitPrice).toBe(44000);
    // PnL: (44000 - 40000) * (800/40000) = 4000 * 0.02 = 80
    expect(trade.pnl).toBe(80);
    expect(trade.closedAt).toBeDefined();
    expect(trade.openedAt).toBeDefined();
  });

  test('history is returned in reverse chronological order', async () => {
    const user = freshUser();

    // Trade 1
    setTickerPrice('BTCUSDT', 50000);
    await runHandlers(
      orderHandlers,
      authenticatedReq(user, { body: { symbol: 'BTCUSDT', side: 'buy', quantity: 500 } }),
      mockRes(),
    );
    setTickerPrice('BTCUSDT', 51000);
    await runHandlers(
      closeHandlers,
      authenticatedReq(user, { params: { symbol: 'BTCUSDT' } }),
      mockRes(),
    );

    // Trade 2
    setTickerPrice('ETHUSDT', 3000);
    await runHandlers(
      orderHandlers,
      authenticatedReq(user, { body: { symbol: 'ETHUSDT', side: 'buy', quantity: 500 } }),
      mockRes(),
    );
    setTickerPrice('ETHUSDT', 3100);
    await runHandlers(
      closeHandlers,
      authenticatedReq(user, { params: { symbol: 'ETHUSDT' } }),
      mockRes(),
    );

    const histReq = authenticatedReq(user);
    const histRes = mockRes();
    await runHandlers(historyHandlers, histReq, histRes);

    expect(histRes.body.data).toHaveLength(2);
    // Most recent trade (ETHUSDT) should be first
    expect(histRes.body.data[0].symbol).toBe('ETHUSDT');
    expect(histRes.body.data[1].symbol).toBe('BTCUSDT');
  });
});

// =========================================================================
// GET /account — with positions (unrealized + realized PnL)
// =========================================================================
describe('GET /account — with open positions', () => {
  const orderHandlers = findHandler('post', '/order');
  const closeHandlers = findHandler('post', '/close/:symbol');
  const accountHandlers = findHandler('get', '/account');

  test('equity reflects unrealized PnL from open positions', async () => {
    const user = freshUser();
    setTickerPrice('BTCUSDT', 50000);

    // Buy $5000 worth
    await runHandlers(
      orderHandlers,
      authenticatedReq(user, { body: { symbol: 'BTCUSDT', side: 'buy', quantity: 5000 } }),
      mockRes(),
    );

    // Price up 10%
    setTickerPrice('BTCUSDT', 55000);

    const accReq = authenticatedReq(user);
    const accRes = mockRes();
    await runHandlers(accountHandlers, accReq, accRes);

    expect(accRes.body.data.balance).toBe(5000);
    // Unrealized: (55000 - 50000) * (5000/50000) = 5000 * 0.1 = 500
    expect(accRes.body.data.unrealizedPnl).toBe(500);
    // Equity: 5000 + 500 = 5500
    expect(accRes.body.data.equity).toBe(5500);
    expect(accRes.body.data.positionsCount).toBe(1);
  });

  test('realized PnL accumulates from closed trades', async () => {
    const user = freshUser();

    // Trade 1: Buy at 50000, close at 55000 with $1000 — PnL = +100
    setTickerPrice('BTCUSDT', 50000);
    await runHandlers(
      orderHandlers,
      authenticatedReq(user, { body: { symbol: 'BTCUSDT', side: 'buy', quantity: 1000 } }),
      mockRes(),
    );
    setTickerPrice('BTCUSDT', 55000);
    await runHandlers(
      closeHandlers,
      authenticatedReq(user, { params: { symbol: 'BTCUSDT' } }),
      mockRes(),
    );

    // Trade 2: Buy at 3000, close at 2700 with $600 — PnL = -60
    setTickerPrice('ETHUSDT', 3000);
    await runHandlers(
      orderHandlers,
      authenticatedReq(user, { body: { symbol: 'ETHUSDT', side: 'buy', quantity: 600 } }),
      mockRes(),
    );
    setTickerPrice('ETHUSDT', 2700);
    await runHandlers(
      closeHandlers,
      authenticatedReq(user, { params: { symbol: 'ETHUSDT' } }),
      mockRes(),
    );

    // No open positions, so make Redis return null
    mockRedisGet.mockResolvedValue(null);

    const accReq = authenticatedReq(user);
    const accRes = mockRes();
    await runHandlers(accountHandlers, accReq, accRes);

    // Realized PnL: 100 + (-60) = 40
    expect(accRes.body.data.realizedPnl).toBe(40);
    expect(accRes.body.data.unrealizedPnl).toBe(0);
    expect(accRes.body.data.positionsCount).toBe(0);
    // Balance should be 10000 + 100 - 60 = 10040
    expect(accRes.body.data.balance).toBe(10040);
  });
});

// =========================================================================
// PnL calculation accuracy
// =========================================================================
describe('PnL calculation accuracy', () => {
  const orderHandlers = findHandler('post', '/order');
  const closeHandlers = findHandler('post', '/close/:symbol');

  test('long position: exact PnL = (exit - entry) * quantity', async () => {
    const user = freshUser();
    const entryPrice = 42567.89;
    const exitPrice = 43210.55;
    const usdAmount = 2500;
    const quantity = usdAmount / entryPrice;
    const expectedPnl = Math.round((exitPrice - entryPrice) * quantity * 100) / 100;

    setTickerPrice('BTCUSDT', entryPrice);
    await runHandlers(
      orderHandlers,
      authenticatedReq(user, { body: { symbol: 'BTCUSDT', side: 'buy', quantity: usdAmount } }),
      mockRes(),
    );

    setTickerPrice('BTCUSDT', exitPrice);
    const closeRes = mockRes();
    await runHandlers(
      closeHandlers,
      authenticatedReq(user, { params: { symbol: 'BTCUSDT' } }),
      closeRes,
    );

    expect(closeRes.body.data.pnl).toBe(expectedPnl);
  });

  test('short position: exact PnL = (entry - exit) * quantity', async () => {
    const user = freshUser();
    const entryPrice = 2345.67;
    const exitPrice = 2100.00;
    const usdAmount = 1500;
    const quantity = usdAmount / entryPrice;
    const expectedPnl = Math.round((entryPrice - exitPrice) * quantity * 100) / 100;

    setTickerPrice('ETHUSDT', entryPrice);
    await runHandlers(
      orderHandlers,
      authenticatedReq(user, { body: { symbol: 'ETHUSDT', side: 'sell', quantity: usdAmount } }),
      mockRes(),
    );

    setTickerPrice('ETHUSDT', exitPrice);
    const closeRes = mockRes();
    await runHandlers(
      closeHandlers,
      authenticatedReq(user, { params: { symbol: 'ETHUSDT' } }),
      closeRes,
    );

    expect(closeRes.body.data.pnl).toBe(expectedPnl);
  });

  test('break-even trade returns PnL of 0', async () => {
    const user = freshUser();
    setTickerPrice('BTCUSDT', 50000);

    await runHandlers(
      orderHandlers,
      authenticatedReq(user, { body: { symbol: 'BTCUSDT', side: 'buy', quantity: 1000 } }),
      mockRes(),
    );

    // Close at same price
    const closeRes = mockRes();
    await runHandlers(
      closeHandlers,
      authenticatedReq(user, { params: { symbol: 'BTCUSDT' } }),
      closeRes,
    );

    expect(closeRes.body.data.pnl).toBe(0);
    expect(closeRes.body.data.balance).toBe(10000);
  });
});
