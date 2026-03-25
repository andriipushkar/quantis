/**
 * Admin routes — unit tests
 *
 * Tests the business logic inside /routes/admin.ts by mocking the database,
 * Redis, logger, env, and auth middleware so we never touch real infrastructure.
 */

// ---------------------------------------------------------------------------
// 1. Mocks — must be declared BEFORE the module under test is imported
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();
jest.mock('../config/database.js', () => ({
  __esModule: true,
  query: (...args: any[]) => mockQuery(...args),
  default: {},
}));

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisSadd = jest.fn();
const mockRedisSrem = jest.fn();
const mockRedisSismember = jest.fn();
const mockRedisHgetall = jest.fn();
const mockRedisPing = jest.fn().mockResolvedValue('PONG');
const mockRedisDisconnect = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    sadd: mockRedisSadd,
    srem: mockRedisSrem,
    sismember: mockRedisSismember,
    hgetall: mockRedisHgetall,
    ping: mockRedisPing,
    disconnect: mockRedisDisconnect,
  }));
});

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
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    APP_URL: 'http://localhost:5173',
    ADMIN_EMAILS: ['admin@example.com'],
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    REDIS_DB: 0,
  },
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------

import adminRouter from '../routes/admin.js';

// ---------------------------------------------------------------------------
// 3. Helpers — mock Express request / response
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

// ---------------------------------------------------------------------------
// Router handler extraction
// ---------------------------------------------------------------------------

/**
 * Find a route handler stack from the Express router.
 * The admin router uses router.use(authenticate) and router.use(requireAdmin)
 * as middleware layers, so we need to extract only the route-level handlers
 * and skip the router-level middleware (we pre-populate req.user instead).
 */
function findHandler(method: string, path: string): Function[] {
  const layers = (adminRouter as any).stack as any[];
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

/**
 * Run through a chain of Express handlers (middleware + final).
 */
async function runHandlers(handlers: Function[], req: any, res: MockResponse) {
  const next = (err?: any) => {
    if (err) throw err;
  };
  for (const handler of handlers) {
    if (res.body !== null) break;
    await handler(req, res, next);
  }
}

// Admin user — email must match ADMIN_EMAILS in the mocked env
const ADMIN_USER = { id: 'admin-001', email: 'admin@example.com', tier: 'institutional' };

function adminReq(overrides: Record<string, any> = {}): any {
  return mockReq({
    user: ADMIN_USER,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// 1. GET /dashboard
// ===========================================================================
describe('GET /dashboard', () => {
  const handlers = findHandler('get', '/dashboard');

  test('returns all stat fields including real revenue', async () => {
    // The handler fires 10 parallel queries via Promise.all
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '150' }] })     // total users
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })       // users today
      .mockResolvedValueOnce({ rows: [{ count: '320' }] })     // signals
      .mockResolvedValueOnce({ rows: [{ count: '40' }] })      // active pairs
      .mockResolvedValueOnce({ rows: [{ count: '100000' }] })  // candles
      .mockResolvedValueOnce({ rows: [{ total: '250.50' }] })  // revenue today
      .mockResolvedValueOnce({ rows: [{ total: '1200.00' }] }) // revenue week
      .mockResolvedValueOnce({ rows: [{ total: '5000.00' }] }) // revenue month
      .mockResolvedValueOnce({ rows: [{ total: '25000.00' }] })// total revenue
      .mockResolvedValueOnce({ rows: [{ total: '5000.00' }] });// MRR

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.totalUsers).toBe(150);
    expect(data.usersToday).toBe(5);
    expect(data.totalSignals).toBe(320);
    expect(data.activePairs).toBe(40);
    expect(data.totalCandles).toBe(100000);
    expect(data.revenue.today).toBe(250.50);
    expect(data.revenue.week).toBe(1200.00);
    expect(data.revenue.month).toBe(5000.00);
    expect(data.revenue.total).toBe(25000.00);
    expect(data.revenue.mrr).toBe(5000.00);
    expect(data.revenue.arr).toBe(60000.00);
  });

  test('handles missing tables gracefully via .catch() defaults', async () => {
    // First two queries (users) succeed, rest reject (missing tables)
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })   // total users
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })    // users today
      .mockRejectedValueOnce(new Error('signals not found'))
      .mockRejectedValueOnce(new Error('trading_pairs not found'))
      .mockRejectedValueOnce(new Error('candles not found'))
      .mockRejectedValueOnce(new Error('payments not found'))
      .mockRejectedValueOnce(new Error('payments not found'))
      .mockRejectedValueOnce(new Error('payments not found'))
      .mockRejectedValueOnce(new Error('payments not found'))
      .mockRejectedValueOnce(new Error('payments not found'));

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalUsers).toBe(10);
    expect(res.body.data.totalSignals).toBe(0);
    expect(res.body.data.activePairs).toBe(0);
    expect(res.body.data.totalCandles).toBe(0);
  });

  test('revenue defaults to 0 when no payments', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })    // total users
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // users today
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // signals
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // active pairs
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // candles
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })    // revenue today
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })    // revenue week
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })    // revenue month
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })    // total revenue
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });   // MRR

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.revenue.today).toBe(0);
    expect(res.body.data.revenue.week).toBe(0);
    expect(res.body.data.revenue.month).toBe(0);
    expect(res.body.data.revenue.total).toBe(0);
    expect(res.body.data.revenue.mrr).toBe(0);
    expect(res.body.data.revenue.arr).toBe(0);
  });
});

// ===========================================================================
// 2. GET /users
// ===========================================================================
describe('GET /users', () => {
  const handlers = findHandler('get', '/users');

  test('returns paginated results with total/page/totalPages', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '45' }] })  // COUNT
      .mockResolvedValueOnce({
        rows: [
          { id: 'u-1', email: 'a@test.com', tier: 'starter', display_name: 'A' },
          { id: 'u-2', email: 'b@test.com', tier: 'trader', display_name: 'B' },
        ],
      });

    const req = adminReq({ query: { page: '1', limit: '20' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(45);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.totalPages).toBe(3); // ceil(45/20)
    expect(res.body.data.users).toHaveLength(2);
  });

  test('search by email filters correctly', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'u-3', email: 'alice@test.com', tier: 'pro', display_name: 'Alice' }],
      });

    const req = adminReq({ query: { search: 'alice' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    // Verify the search parameter was passed to the query
    expect(mockQuery.mock.calls[0][1]).toEqual(['%alice%']);
  });

  test('filter by tier works', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '10' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'u-4', email: 'pro@test.com', tier: 'pro', display_name: 'Pro User' }],
      });

    const req = adminReq({ query: { tier: 'pro' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    // Verify the tier parameter was passed to the query
    expect(mockQuery.mock.calls[0][1]).toEqual(['pro']);
  });

  test('sort and order work', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '5' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'u-5', email: 'z@test.com', tier: 'starter', display_name: 'Z' }],
      });

    const req = adminReq({ query: { sort: 'email', order: 'asc' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    // Verify the ORDER BY clause contains the correct column and direction
    const dataQuery = mockQuery.mock.calls[1][0] as string;
    expect(dataQuery).toContain('u.email');
    expect(dataQuery).toContain('ASC');
  });

  test('empty result returns empty array', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const req = adminReq({ query: {} });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.users).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.totalPages).toBe(0);
  });
});

// ===========================================================================
// 3. GET /users/:id
// ===========================================================================
describe('GET /users/:id', () => {
  const handlers = findHandler('get', '/users/:id');

  test('returns full user detail with subscriptions, payments, alerts count', async () => {
    // User + profile
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'u-10', email: 'detail@test.com', tier: 'trader', language: 'en',
        is_2fa_enabled: false, created_at: '2024-01-01', updated_at: '2024-06-01',
        display_name: 'Detail User', timezone: 'UTC', experience_level: 'intermediate',
        ui_mode: 'standard', balance_usdt: '1000.00', referral_code: 'REF123',
      }],
    });
    // Redis ban check
    mockRedisSismember.mockResolvedValueOnce(0);
    // Subscriptions
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 's-1', tier: 'trader', starts_at: '2024-01-01', expires_at: '2024-12-31', status: 'active', auto_renew: true, created_at: '2024-01-01' }],
    });
    // Payments
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'p-1', amount_usd: '29.99', crypto_currency: 'BTC', crypto_amount: '0.001', tx_hash: 'abc', status: 'confirmed', created_at: '2024-01-01' }],
    });
    // Alerts count
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });
    // Paper accounts
    mockQuery.mockResolvedValueOnce({
      rows: [{ balance: '10000', equity: '10500', realized_pnl: '500' }],
    });
    // Paper trades count
    mockQuery.mockResolvedValueOnce({ rows: [{ total_trades: '23' }] });

    const req = adminReq({ params: { id: 'u-10' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('detail@test.com');
    expect(res.body.data.user.isBanned).toBe(false);
    expect(res.body.data.subscriptions).toHaveLength(1);
    expect(res.body.data.payments).toHaveLength(1);
    expect(res.body.data.alertsCount).toBe(5);
    expect(res.body.data.paperTrading.account).toBeDefined();
    expect(res.body.data.paperTrading.totalTrades).toBe(23);
  });

  test('returns 404 for non-existent user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = adminReq({ params: { id: 'u-nonexistent' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/user not found/i);
  });

  test('handles missing paper_accounts gracefully', async () => {
    // User found
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'u-11', email: 'nopaperuser@test.com', tier: 'starter', language: 'en',
        is_2fa_enabled: false, created_at: '2024-01-01', updated_at: '2024-01-01',
        display_name: null, timezone: null, experience_level: null,
        ui_mode: null, balance_usdt: null, referral_code: null,
      }],
    });
    // Redis ban check
    mockRedisSismember.mockResolvedValueOnce(0);
    // Subscriptions — table missing
    mockQuery.mockRejectedValueOnce(new Error('subscriptions table not found'));
    // Payments — table missing
    mockQuery.mockRejectedValueOnce(new Error('payments table not found'));
    // Alerts — table missing
    mockQuery.mockRejectedValueOnce(new Error('alerts table not found'));
    // Paper accounts — table missing
    mockQuery.mockRejectedValueOnce(new Error('paper_accounts table not found'));

    const req = adminReq({ params: { id: 'u-11' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.email).toBe('nopaperuser@test.com');
    expect(res.body.data.subscriptions).toEqual([]);
    expect(res.body.data.payments).toEqual([]);
    expect(res.body.data.alertsCount).toBe(0);
    expect(res.body.data.paperTrading.account).toBeNull();
    expect(res.body.data.paperTrading.totalTrades).toBe(0);
  });
});

// ===========================================================================
// 4. PUT /users/:id/tier
// ===========================================================================
describe('PUT /users/:id/tier', () => {
  const handlers = findHandler('put', '/users/:id/tier');

  test('successfully updates tier', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-20', email: 'upgrade@test.com', tier: 'pro' }],
    });

    const req = adminReq({ params: { id: 'u-20' }, body: { tier: 'pro' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tier).toBe('pro');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET tier'),
      ['pro', 'u-20']
    );
  });

  test('rejects invalid tier', async () => {
    const req = adminReq({ params: { id: 'u-20' }, body: { tier: 'super_mega' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/invalid tier/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('returns 404 for missing user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = adminReq({ params: { id: 'u-ghost' }, body: { tier: 'trader' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/user not found/i);
  });
});

// ===========================================================================
// 5. PUT /users/:id/ban
// ===========================================================================
describe('PUT /users/:id/ban', () => {
  const handlers = findHandler('put', '/users/:id/ban');

  test('bans user (adds to Redis set, downgrades tier)', async () => {
    // Lookup user
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-30', email: 'baduser@test.com', tier: 'pro' }],
    });
    // UPDATE tier to starter
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockRedisSadd.mockResolvedValueOnce(1);

    const req = adminReq({ params: { id: 'u-30' }, body: { action: 'ban' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe('ban');
    expect(res.body.data.tier).toBe('starter');
    expect(mockRedisSadd).toHaveBeenCalledWith('banned_emails', 'baduser@test.com');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET tier'),
      ['starter', 'u-30']
    );
    expect(mockRedisDisconnect).toHaveBeenCalled();
  });

  test('unbans user (removes from Redis set)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-30', email: 'baduser@test.com', tier: 'starter' }],
    });
    mockRedisSrem.mockResolvedValueOnce(1);

    const req = adminReq({ params: { id: 'u-30' }, body: { action: 'unban' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe('unban');
    expect(mockRedisSrem).toHaveBeenCalledWith('banned_emails', 'baduser@test.com');
    // No tier update for unban
    expect(mockQuery).toHaveBeenCalledTimes(1); // only the SELECT
    expect(mockRedisDisconnect).toHaveBeenCalled();
  });

  test('rejects invalid action', async () => {
    const req = adminReq({ params: { id: 'u-30' }, body: { action: 'suspend' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/invalid action/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 6. DELETE /users/:id
// ===========================================================================
describe('DELETE /users/:id', () => {
  const handlers = findHandler('delete', '/users/:id');

  test('soft deletes user (changes email, returns success)', async () => {
    // User exists
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-40', email: 'todelete@test.com' }],
    });
    // UPDATE soft delete
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = adminReq({ params: { id: 'u-40' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe('u-40');
    expect(res.body.data.message).toMatch(/soft-deleted/i);

    // Verify the UPDATE changed email to a deleted_* pattern
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE users');
    expect(updateCall[1][0]).toMatch(/^deleted_.*@quantis\.io$/);
  });

  test('returns 404 for missing user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = adminReq({ params: { id: 'u-ghost' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/user not found/i);
  });
});

// ===========================================================================
// 7. GET /revenue
// ===========================================================================
describe('GET /revenue', () => {
  const handlers = findHandler('get', '/revenue');

  test('returns MRR, ARR, growth, daily breakdown', async () => {
    // The handler fires 4 parallel queries via Promise.all
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '5000.00' }] })   // MRR (last 30d)
      .mockResolvedValueOnce({ rows: [{ total: '4000.00' }] })   // prev MRR (30-60d)
      .mockResolvedValueOnce({
        rows: [
          { day: '2024-06-01', total: '100.00' },
          { day: '2024-06-02', total: '200.00' },
        ],
      }) // daily breakdown
      .mockResolvedValueOnce({ rows: [{ total: '25000.00' }] }); // all-time total

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.mrr).toBe(5000);
    expect(data.arr).toBe(60000);
    expect(data.totalRevenue).toBe(25000);
    // Growth: (5000 - 4000) / 4000 * 100 = 25%
    expect(data.growthPct).toBe(25);
    expect(data.daily).toHaveLength(2);
    expect(data.daily[0].total).toBe(100);
    expect(data.daily[1].total).toBe(200);
  });

  test('handles no payments (all zeros)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.mrr).toBe(0);
    expect(res.body.data.arr).toBe(0);
    expect(res.body.data.totalRevenue).toBe(0);
    expect(res.body.data.growthPct).toBe(0);
    expect(res.body.data.daily).toEqual([]);
  });
});

// ===========================================================================
// 8. GET /revenue/payments
// ===========================================================================
describe('GET /revenue/payments', () => {
  const handlers = findHandler('get', '/revenue/payments');

  test('returns paginated payments with user email', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '50' }] })  // COUNT
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'pay-1', user_id: 'u-1', subscription_id: 's-1', amount_usd: '29.99',
            crypto_currency: 'BTC', crypto_amount: '0.001', tx_hash: 'txabc',
            gateway_payment_id: 'gw-1', status: 'confirmed', created_at: '2024-06-01',
            email: 'payer@test.com',
          },
        ],
      });

    const req = adminReq({ query: { page: '1', limit: '10' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payments).toHaveLength(1);
    expect(res.body.data.payments[0].email).toBe('payer@test.com');
    expect(res.body.data.total).toBe(50);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.totalPages).toBe(5); // ceil(50/10)
  });

  test('filters by status', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '3' }] })
      .mockResolvedValueOnce({
        rows: [
          { id: 'pay-2', status: 'pending', email: 'pending@test.com' },
        ],
      });

    const req = adminReq({ query: { status: 'pending' } });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    // Verify the status filter was applied
    expect(mockQuery.mock.calls[0][1]).toEqual(['pending']);
    expect(res.body.data.payments[0].status).toBe('pending');
  });

  test('empty payments returns empty array', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const req = adminReq({ query: {} });
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.payments).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.totalPages).toBe(0);
  });
});

// ===========================================================================
// 9. GET /revenue/subscriptions
// ===========================================================================
describe('GET /revenue/subscriptions', () => {
  const handlers = findHandler('get', '/revenue/subscriptions');

  test('returns status counts, churn rate, expiring list', async () => {
    // The handler fires 3 parallel queries, the third being a Promise.all of 2
    mockQuery
      // Status counts
      .mockResolvedValueOnce({
        rows: [
          { status: 'active', count: '80' },
          { status: 'cancelled', count: '15' },
          { status: 'expired', count: '5' },
        ],
      })
      // Expiring soon
      .mockResolvedValueOnce({
        rows: [
          { id: 's-10', user_id: 'u-1', tier: 'trader', starts_at: '2024-01-01', expires_at: '2024-06-07', auto_renew: false, email: 'expiring@test.com' },
        ],
      })
      // Cancelled in last 30d
      .mockResolvedValueOnce({ rows: [{ cancelled: '5' }] })
      // Active at start
      .mockResolvedValueOnce({ rows: [{ active_start: '100' }] });

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.statusCounts.active).toBe(80);
    expect(data.statusCounts.cancelled).toBe(15);
    expect(data.statusCounts.expired).toBe(5);
    expect(data.expiringSoon).toHaveLength(1);
    expect(data.expiringSoon[0].email).toBe('expiring@test.com');
    // Churn rate: 5 / 100 * 100 = 5%
    expect(data.churnRate).toBe(5);
  });

  test('handles no subscriptions', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })        // no status counts
      .mockResolvedValueOnce({ rows: [] })         // no expiring soon
      .mockResolvedValueOnce({ rows: [{ cancelled: '0' }] })
      .mockResolvedValueOnce({ rows: [{ active_start: '0' }] });

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.statusCounts).toEqual({});
    expect(res.body.data.expiringSoon).toEqual([]);
    expect(res.body.data.churnRate).toBe(0);
  });
});

// ===========================================================================
// 10. GET /analytics/user-growth
// ===========================================================================
describe('GET /analytics/user-growth', () => {
  const handlers = findHandler('get', '/analytics/user-growth');

  test('returns daily registrations for last 90 days', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { day: '2024-04-01', registrations: '3' },
          { day: '2024-04-02', registrations: '7' },
          { day: '2024-04-03', registrations: '2' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: '500' }] });

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.daily).toHaveLength(3);
    expect(res.body.data.daily[0].registrations).toBe(3);
    expect(res.body.data.daily[1].registrations).toBe(7);
    expect(res.body.data.totalUsers).toBe(500);
  });

  test('handles empty users table', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.daily).toEqual([]);
    expect(res.body.data.totalUsers).toBe(0);
  });
});

// ===========================================================================
// 11. GET /analytics/tier-distribution
// ===========================================================================
describe('GET /analytics/tier-distribution', () => {
  const handlers = findHandler('get', '/analytics/tier-distribution');

  test('returns counts per tier', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { tier: 'starter', count: '100' },
        { tier: 'trader', count: '30' },
        { tier: 'pro', count: '15' },
        { tier: 'institutional', count: '5' },
      ],
    });

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.distribution).toHaveLength(4);
    expect(res.body.data.distribution[0]).toEqual({ tier: 'starter', count: 100 });
    expect(res.body.data.distribution[1]).toEqual({ tier: 'trader', count: 30 });
  });

  test('includes total', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { tier: 'starter', count: '50' },
        { tier: 'trader', count: '25' },
      ],
    });

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.total).toBe(75);
  });
});

// ===========================================================================
// 12. GET /analytics/collector-status
// ===========================================================================
describe('GET /analytics/collector-status', () => {
  const handlers = findHandler('get', '/analytics/collector-status');

  test('returns per-exchange stats from Redis', async () => {
    mockRedisHgetall.mockResolvedValueOnce({
      'binance:BTCUSDT': JSON.stringify({ exchange: 'binance', timestamp: Date.now() - 1000 }),
      'binance:ETHUSDT': JSON.stringify({ exchange: 'binance', timestamp: Date.now() - 2000 }),
      'kraken:BTCUSD': JSON.stringify({ exchange: 'kraken', timestamp: Date.now() - 5000 }),
    });
    // DB exchange stats
    mockQuery.mockResolvedValueOnce({
      rows: [
        { exchange: 'binance', active_pairs: '50' },
        { exchange: 'kraken', active_pairs: '30' },
      ],
    });

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.collectors.length).toBeGreaterThanOrEqual(2);
    // Check binance entry exists
    const binance = data.collectors.find((c: any) => c.exchange === 'binance');
    expect(binance).toBeDefined();
    expect(binance.pairs).toBe(2);
    expect(binance.lastUpdate).toBeDefined();
    expect(binance.lagMs).toBeGreaterThan(0);
    // Check kraken entry
    const kraken = data.collectors.find((c: any) => c.exchange === 'kraken');
    expect(kraken).toBeDefined();
    expect(kraken.pairs).toBe(1);
    // DB stats
    expect(data.dbExchangeStats).toHaveLength(2);
    expect(data.dbExchangeStats[0]).toEqual({ exchange: 'binance', activePairs: 50 });
    expect(mockRedisDisconnect).toHaveBeenCalled();
  });

  test('handles empty Redis hash', async () => {
    mockRedisHgetall.mockResolvedValueOnce({});
    // DB exchange stats — also empty
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.collectors).toEqual([]);
    expect(res.body.data.dbExchangeStats).toEqual([]);
    expect(mockRedisDisconnect).toHaveBeenCalled();
  });
});

// ===========================================================================
// 13. GET /system
// ===========================================================================
describe('GET /system', () => {
  const handlers = findHandler('get', '/system');

  test('returns DB and Redis status', async () => {
    // DB check: SELECT 1
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    // Redis ping — handled by the mock constructor
    mockRedisPing.mockResolvedValueOnce('PONG');
    // Candles by exchange
    mockQuery.mockResolvedValueOnce({
      rows: [
        { exchange: 'binance', count: '50000' },
        { exchange: 'kraken', count: '30000' },
      ],
    });
    // Latest signal time
    mockQuery.mockResolvedValueOnce({
      rows: [{ created_at: '2024-06-01T12:00:00Z' }],
    });

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dbStatus).toBe('ok');
    expect(res.body.data.redisStatus).toBe('ok');
    expect(res.body.data.candlesByExchange).toHaveLength(2);
    expect(res.body.data.latestSignalTime).toBe('2024-06-01T12:00:00Z');
    expect(mockRedisDisconnect).toHaveBeenCalled();
  });

  test('handles Redis failure gracefully', async () => {
    // DB check succeeds
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    // Redis ping fails
    mockRedisPing.mockRejectedValueOnce(new Error('Connection refused'));
    // Candles — table missing
    mockQuery.mockRejectedValueOnce(new Error('candles table not found'));
    // Signals — table missing
    mockQuery.mockRejectedValueOnce(new Error('signals table not found'));

    const req = adminReq();
    const res = mockRes();
    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.dbStatus).toBe('ok');
    expect(res.body.data.redisStatus).toBe('error');
    expect(res.body.data.candlesByExchange).toEqual([]);
    expect(res.body.data.latestSignalTime).toBeNull();
  });
});
