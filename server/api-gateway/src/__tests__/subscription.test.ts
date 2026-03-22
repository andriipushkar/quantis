/**
 * Subscription routes — unit tests
 *
 * Tests the business logic inside /routes/subscription.ts by mocking
 * the database, logger, and env. No real infrastructure needed.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();
jest.mock('../config/database.js', () => ({
  __esModule: true,
  query: (...args: any[]) => mockQuery(...args),
  default: {},
}));

jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
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
import subscriptionRouter from '../routes/subscription.js';

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
  const layers = (subscriptionRouter as any).stack as any[];
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

function makeAccessToken(user: { id: string; email: string; tier: string }) {
  return jwt.sign(user, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

function authenticatedReq(
  user: { id: string; email: string; tier: string },
  overrides: Record<string, any> = {},
) {
  const token = makeAccessToken(user);
  return mockReq({
    headers: { authorization: `Bearer ${token}` },
    user,
    ...overrides,
  });
}

const TEST_USER = { id: 'u-sub-001', email: 'subscriber@example.com', tier: 'starter' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// =========================================================================
// GET /pricing
// =========================================================================
describe('GET /pricing', () => {
  const handlers = findHandler('get', '/pricing');

  test('returns all 4 pricing tiers', async () => {
    const req = mockReq();
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.tiers).toBeDefined();
    expect(res.body.tiers).toHaveLength(4);
  });

  test('tiers include starter, trader, pro, institutional', async () => {
    const req = mockReq();
    const res = mockRes();

    await runHandlers(handlers, req, res);

    const tierIds = res.body.tiers.map((t: any) => t.id);
    expect(tierIds).toEqual(['starter', 'trader', 'pro', 'institutional']);
  });

  test('starter tier is free', async () => {
    const req = mockReq();
    const res = mockRes();

    await runHandlers(handlers, req, res);

    const starter = res.body.tiers.find((t: any) => t.id === 'starter');
    expect(starter.price).toBe(0);
    expect(starter.annualPrice).toBe(0);
  });

  test('trader tier costs $29/month', async () => {
    const req = mockReq();
    const res = mockRes();

    await runHandlers(handlers, req, res);

    const trader = res.body.tiers.find((t: any) => t.id === 'trader');
    expect(trader.price).toBe(29);
    expect(trader.annualPrice).toBe(278);
    expect(trader.currency).toBe('USD');
  });

  test('pro tier costs $79/month and is marked popular', async () => {
    const req = mockReq();
    const res = mockRes();

    await runHandlers(handlers, req, res);

    const pro = res.body.tiers.find((t: any) => t.id === 'pro');
    expect(pro.price).toBe(79);
    expect(pro.annualPrice).toBe(758);
    expect(pro.popular).toBe(true);
  });

  test('institutional tier costs $249/month', async () => {
    const req = mockReq();
    const res = mockRes();

    await runHandlers(handlers, req, res);

    const inst = res.body.tiers.find((t: any) => t.id === 'institutional');
    expect(inst.price).toBe(249);
    expect(inst.annualPrice).toBe(2390);
  });

  test('all tiers have features array', async () => {
    const req = mockReq();
    const res = mockRes();

    await runHandlers(handlers, req, res);

    for (const tier of res.body.tiers) {
      expect(Array.isArray(tier.features)).toBe(true);
      expect(tier.features.length).toBeGreaterThan(0);
    }
  });

  test('annual prices are discounted vs 12x monthly', async () => {
    const req = mockReq();
    const res = mockRes();

    await runHandlers(handlers, req, res);

    for (const tier of res.body.tiers) {
      if (tier.price > 0) {
        const yearlyFull = tier.price * 12;
        expect(tier.annualPrice).toBeLessThan(yearlyFull);
      }
    }
  });
});

// =========================================================================
// GET / — current subscription
// =========================================================================
describe('GET / (current subscription)', () => {
  const handlers = findHandler('get', '/');

  test('returns starter tier when no active subscription', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ tier: 'starter' }] }) // user tier
      .mockResolvedValueOnce({ rows: [] }); // no active subscription

    const req = authenticatedReq(TEST_USER);
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.tier).toBe('starter');
    expect(res.body.expiresAt).toBeNull();
    expect(res.body.autoRenew).toBe(false);
  });

  test('returns active subscription details', async () => {
    const expiresAt = '2025-06-01T00:00:00Z';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ tier: 'pro' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'sub-1',
            tier: 'pro',
            status: 'active',
            started_at: '2025-05-01',
            expires_at: expiresAt,
            auto_renew: true,
          },
        ],
      });

    const req = authenticatedReq({ ...TEST_USER, tier: 'pro' });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.tier).toBe('pro');
    expect(res.body.expiresAt).toBe(expiresAt);
    expect(res.body.autoRenew).toBe(true);
  });

  test('user with tier but no active subscription returns that tier', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ tier: 'trader' }] })
      .mockResolvedValueOnce({ rows: [] });

    const req = authenticatedReq({ ...TEST_USER, tier: 'trader' });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.tier).toBe('trader');
  });
});

// =========================================================================
// POST /checkout — create payment invoice
// =========================================================================
describe('POST /checkout', () => {
  const handlers = findHandler('post', '/checkout');

  test('creates monthly invoice for trader tier', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT payment_invoices

    const req = authenticatedReq(TEST_USER, {
      body: { tier: 'trader', period: 'monthly' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.tier).toBe('trader');
    expect(res.body.period).toBe('monthly');
    expect(res.body.amount).toBe(29);
    expect(res.body.status).toBe('pending');
    expect(res.body.invoiceId).toBeDefined();
  });

  test('creates yearly invoice with annual price', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = authenticatedReq(TEST_USER, {
      body: { tier: 'pro', period: 'yearly' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.amount).toBe(758); // pro annual price
  });

  test('defaults to monthly period', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = authenticatedReq(TEST_USER, {
      body: { tier: 'institutional' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.period).toBe('monthly');
    expect(res.body.amount).toBe(249);
  });

  test('invalid tier returns 400', async () => {
    const req = authenticatedReq(TEST_USER, {
      body: { tier: 'diamond' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/invalid tier/i);
  });

  test('starter tier is not valid for checkout', async () => {
    const req = authenticatedReq(TEST_USER, {
      body: { tier: 'starter' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
  });

  test('invalid period returns 400', async () => {
    const req = authenticatedReq(TEST_USER, {
      body: { tier: 'trader', period: 'biweekly' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/invalid period/i);
  });

  test('missing tier returns 400', async () => {
    const req = authenticatedReq(TEST_USER, {
      body: { period: 'monthly' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// POST /webhook — IPN callback
// =========================================================================
describe('POST /webhook', () => {
  const handlers = findHandler('post', '/webhook');

  test('confirmed payment activates subscription and updates tier', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE payment_invoices status
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u-sub-001', tier: 'pro', period: 'monthly' }],
      }) // SELECT invoice
      .mockResolvedValueOnce({ rows: [] }) // INSERT subscription
      .mockResolvedValueOnce({ rows: [] }); // UPDATE users SET tier

    const req = mockReq({
      body: { invoice_id: 'inv_123', payment_status: 'confirmed' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');

    // Verify subscription was created
    const insertSubCall = mockQuery.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO subscriptions'),
    );
    expect(insertSubCall).toBeDefined();
    expect(insertSubCall![1][1]).toBe('pro'); // tier

    // Verify user tier was updated
    const updateUserCall = mockQuery.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('UPDATE users SET tier'),
    );
    expect(updateUserCall).toBeDefined();
    expect(updateUserCall![1][0]).toBe('pro');
  });

  test('finished payment also activates subscription', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u-sub-002', tier: 'trader', period: 'yearly' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      body: { invoice_id: 'inv_456', payment_status: 'finished' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);

    // Verify yearly interval was used
    const insertSubCall = mockQuery.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO subscriptions'),
    );
    expect(insertSubCall![1][2]).toBe('1 year');
  });

  test('pending payment updates status but does not activate', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE invoice status only

    const req = mockReq({
      body: { invoice_id: 'inv_789', payment_status: 'waiting' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    // Only one query: the status update, no subscription creation
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  test('missing invoice_id returns 400', async () => {
    const req = mockReq({
      body: { payment_status: 'confirmed' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/missing required/i);
  });

  test('missing payment_status returns 400', async () => {
    const req = mockReq({
      body: { invoice_id: 'inv_000' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// GET /history — payment history
// =========================================================================
describe('GET /history', () => {
  const handlers = findHandler('get', '/history');

  test('returns payment history for authenticated user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          invoice_id: 'inv_a',
          tier: 'pro',
          period: 'monthly',
          status: 'confirmed',
          amount_usd: 79,
          created_at: '2025-01-15',
          updated_at: '2025-01-15',
        },
        {
          id: 2,
          invoice_id: 'inv_b',
          tier: 'trader',
          period: 'monthly',
          status: 'pending',
          amount_usd: 29,
          created_at: '2025-02-15',
          updated_at: '2025-02-15',
        },
      ],
    });

    const req = authenticatedReq(TEST_USER);
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.payments).toHaveLength(2);
    expect(res.body.payments[0].tier).toBe('pro');
  });

  test('returns empty array when no payments', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = authenticatedReq(TEST_USER);
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.payments).toEqual([]);
  });
});
