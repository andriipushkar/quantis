/**
 * Auth routes — unit tests
 *
 * Tests the business logic inside /routes/auth.ts by mocking the database,
 * Redis, logger, env, and bcrypt so we never touch real infrastructure.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// 1. Mocks — must be declared BEFORE the module under test is imported
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();
jest.mock('../config/database.js', () => ({
  __esModule: true,
  query: (...args: any[]) => mockQuery(...args),
  default: {}, // pool stub
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

// Provide deterministic env values so JWT signing/verifying works
jest.mock('../config/env.js', () => ({
  __esModule: true,
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    BCRYPT_ROUNDS: 4, // fast for tests
    isProduction: false,
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    APP_URL: 'http://localhost:5173',
  },
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

// We can't easily call router endpoints without Express wiring, so we import
// the router and mount it on a tiny Express app. We build lightweight helpers
// that simulate req/res directly.

// ---------------------------------------------------------------------------
// 3. Helpers — mock Express request / response
// ---------------------------------------------------------------------------

interface MockResponse {
  statusCode: number;
  body: any;
  cookies: Record<string, { value: any; options: any }>;
  clearedCookies: string[];
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  cookie(name: string, value: any, options?: any): MockResponse;
  clearCookie(name: string): MockResponse;
}

function mockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    cookies: {},
    clearedCookies: [],
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
    cookie(name: string, value: any, options?: any) {
      res.cookies[name] = { value, options };
      return res;
    },
    clearCookie(name: string) {
      res.clearedCookies.push(name);
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
// Since auth.ts exports a Router we need to extract the handler stacks.
// We'll mount the router and use a helper that walks Express layers.
// Alternatively, we import the default export and use Express internals.
// ---------------------------------------------------------------------------

import authRouter from '../routes/auth.js';

/**
 * Find a route handler stack from the Express router.
 * Returns the array of middleware + final handler for a given method + path.
 */
function findHandler(method: string, path: string): Function[] {
  const layers = (authRouter as any).stack as any[];
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
 * Calls next() automatically when a handler invokes it.
 */
async function runHandlers(handlers: Function[], req: any, res: MockResponse) {
  let idx = 0;
  const next = (err?: any) => {
    if (err) throw err;
  };
  for (const handler of handlers) {
    // If a handler already sent a response (set body), stop.
    if (res.body !== null) break;
    await handler(req, res, next);
  }
}

// Helper to generate a valid access token for authenticated routes
function makeAccessToken(user: { id: string; email: string; tier: string }) {
  return jwt.sign(user, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

// Helper to generate a valid refresh token
function makeRefreshToken(user: { id: string; email: string; tier: string }) {
  return jwt.sign(user, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

// The authenticate middleware is embedded in some routes. For routes that use
// it, we need to pass a valid Bearer token in req.headers.authorization and
// let the real authenticate middleware decode it. We can pre-set req.user for
// authenticated routes that run after authenticate.
function authenticatedReq(
  user: { id: string; email: string; tier: string },
  overrides: Record<string, any> = {},
) {
  const token = makeAccessToken(user);
  return mockReq({
    headers: { authorization: `Bearer ${token}` },
    user, // pre-populated for handlers that follow authenticate
    ...overrides,
  });
}

const TEST_USER = { id: 'u-1234-abcd', email: 'test@example.com', tier: 'starter' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// =========================================================================
// Registration
// =========================================================================
describe('POST /register', () => {
  const handlers = findHandler('post', '/register');

  test('valid input creates user and returns 201 with tokens', async () => {
    // No existing user
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT id FROM users WHERE email
      .mockResolvedValueOnce({
        rows: [{ id: 'u-1234-abcd', email: 'new@example.com', tier: 'starter' }],
      }) // INSERT INTO users
      .mockResolvedValueOnce({ rows: [] }); // INSERT INTO user_profiles

    const req = mockReq({
      body: { email: 'new@example.com', password: 'StrongP@ss1' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('new@example.com');
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.cookies.refreshToken).toBeDefined();

    // Verify the password was hashed (first INSERT call, second arg)
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO users');
    expect(insertCall[1][0]).toBe('new@example.com');
    // The hash should NOT be the plain password
    expect(insertCall[1][1]).not.toBe('StrongP@ss1');
  });

  test('duplicate email returns 409', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

    const req = mockReq({
      body: { email: 'taken@example.com', password: 'StrongP@ss1' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  test('weak password (too short) returns 400', async () => {
    const req = mockReq({
      body: { email: 'new@example.com', password: '123' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/validation/i);
  });

  test('password missing uppercase returns 400', async () => {
    const req = mockReq({
      body: { email: 'new@example.com', password: 'alllowercase1' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
  });

  test('password missing number returns 400', async () => {
    const req = mockReq({
      body: { email: 'new@example.com', password: 'NoNumberHere' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
  });

  test('invalid email returns 400', async () => {
    const req = mockReq({
      body: { email: 'not-an-email', password: 'StrongP@ss1' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// Login
// =========================================================================
describe('POST /login', () => {
  const handlers = findHandler('post', '/login');

  test('valid credentials return tokens', async () => {
    const hash = await bcrypt.hash('CorrectPass1', 4);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-1', email: 'user@example.com', password_hash: hash, tier: 'trader' }],
    });

    const req = mockReq({
      body: { email: 'user@example.com', password: 'CorrectPass1' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.tier).toBe('trader');

    // Verify access token decodes correctly
    const decoded = jwt.verify(res.body.data.accessToken, env.JWT_ACCESS_SECRET) as any;
    expect(decoded.email).toBe('user@example.com');
  });

  test('wrong password returns 401', async () => {
    const hash = await bcrypt.hash('CorrectPass1', 4);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-1', email: 'user@example.com', password_hash: hash, tier: 'starter' }],
    });

    const req = mockReq({
      body: { email: 'user@example.com', password: 'WrongPass123' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('non-existent email returns 401', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      body: { email: 'nobody@example.com', password: 'SomePass1' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('OAuth-only user (no password_hash) returns 401 with Google message', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-2', email: 'oauth@example.com', password_hash: null, tier: 'starter' }],
    });

    const req = mockReq({
      body: { email: 'oauth@example.com', password: 'AnyPass123' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/google/i);
  });

  test('missing password in body returns 400', async () => {
    const req = mockReq({
      body: { email: 'user@example.com' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// Token refresh
// =========================================================================
describe('POST /refresh', () => {
  const handlers = findHandler('post', '/refresh');

  test('valid refresh token returns new tokens', async () => {
    const refreshToken = makeRefreshToken(TEST_USER);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: TEST_USER.id, email: TEST_USER.email, tier: TEST_USER.tier }],
    });

    const req = mockReq({
      body: { refreshToken },
      cookies: {},
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // Both old and new tokens should be valid JWTs
    const decoded = jwt.verify(res.body.data.refreshToken, env.JWT_REFRESH_SECRET) as any;
    expect(decoded.id).toBe(TEST_USER.id);
  });

  test('refresh token from cookie also works', async () => {
    const refreshToken = makeRefreshToken(TEST_USER);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: TEST_USER.id, email: TEST_USER.email, tier: TEST_USER.tier }],
    });

    const req = mockReq({
      cookies: { refreshToken },
      body: {},
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('invalid refresh token returns 401', async () => {
    const req = mockReq({
      body: { refreshToken: 'garbage.invalid.token' },
      cookies: {},
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid refresh token/i);
  });

  test('missing refresh token returns 401', async () => {
    const req = mockReq({ body: {}, cookies: {} });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/refresh token required/i);
  });

  test('refresh with deleted user returns 401', async () => {
    const refreshToken = makeRefreshToken(TEST_USER);
    mockQuery.mockResolvedValueOnce({ rows: [] }); // user not found

    const req = mockReq({
      body: { refreshToken },
      cookies: {},
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/user not found/i);
  });
});

// =========================================================================
// Google OAuth
// =========================================================================
describe('POST /google', () => {
  const handlers = findHandler('post', '/google');

  // We need to mock global fetch for Google token verification
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('valid credential creates new user', async () => {
    // Mock fetch for Google tokeninfo
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'google-123',
        email: 'googleuser@gmail.com',
        email_verified: 'true',
        name: 'Google User',
        picture: 'https://example.com/pic.jpg',
        aud: 'test-google-client-id',
      }),
    }) as any;

    // No user by google_id
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // No user by email
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // INSERT new user
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-new-google', email: 'googleuser@gmail.com', tier: 'starter' }],
    });
    // INSERT profile
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      body: { credential: 'valid-google-id-token' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('googleuser@gmail.com');
    expect(res.body.data.accessToken).toBeDefined();
  });

  test('valid credential links to existing email account', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'google-456',
        email: 'existing@example.com',
        email_verified: 'true',
        name: 'Existing User',
        aud: 'test-google-client-id',
      }),
    }) as any;

    // No user by google_id
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // User found by email
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'u-existing', email: 'existing@example.com', tier: 'trader' }],
    });
    // UPDATE to link google_id
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = mockReq({
      body: { credential: 'valid-token-for-existing' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.id).toBe('u-existing');
    expect(res.body.data.user.tier).toBe('trader');
  });

  test('invalid credential returns 401', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
    }) as any;

    const req = mockReq({
      body: { credential: 'bad-token' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid google credential/i);
  });

  test('audience mismatch returns 401', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'google-789',
        email: 'user@gmail.com',
        email_verified: 'true',
        aud: 'wrong-client-id', // does not match our GOOGLE_CLIENT_ID
      }),
    }) as any;

    const req = mockReq({
      body: { credential: 'token-wrong-aud' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(401);
  });

  test('missing credential and code returns 400', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/credential or authorization code required/i);
  });
});

// =========================================================================
// Change password
// =========================================================================
describe('POST /change-password', () => {
  const handlers = findHandler('post', '/change-password');

  test('valid old password changes password successfully', async () => {
    const oldHash = await bcrypt.hash('OldPass123', 4);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: oldHash }] }) // SELECT password_hash
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const req = authenticatedReq(TEST_USER, {
      body: { oldPassword: 'OldPass123', newPassword: 'NewPass456' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/changed/i);

    // Verify the UPDATE was called with a hashed password
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE users SET password_hash');
    expect(updateCall[1][0]).not.toBe('NewPass456'); // should be hashed
  });

  test('wrong old password returns 401', async () => {
    const oldHash = await bcrypt.hash('RealOldPass1', 4);
    mockQuery.mockResolvedValueOnce({ rows: [{ password_hash: oldHash }] });

    const req = authenticatedReq(TEST_USER, {
      body: { oldPassword: 'WrongOldPass1', newPassword: 'NewPass456' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/current password is incorrect/i);
  });

  test('OAuth user (no password_hash) returns 400', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ password_hash: null }] });

    const req = authenticatedReq(TEST_USER, {
      body: { oldPassword: 'AnyPass123', newPassword: 'NewPass456' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/google/i);
  });

  test('weak new password returns 400', async () => {
    const req = authenticatedReq(TEST_USER, {
      body: { oldPassword: 'OldPass123', newPassword: 'short' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
  });
});

// =========================================================================
// GET /me
// =========================================================================
describe('GET /me', () => {
  const handlers = findHandler('get', '/me');

  test('returns user profile data', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: TEST_USER.id,
          email: TEST_USER.email,
          tier: 'starter',
          language: 'en',
          created_at: '2024-01-01',
          display_name: 'Test User',
          timezone: 'UTC',
          experience_level: 'beginner',
          ui_mode: 'standard',
          referral_code: 'U1234',
        },
      ],
    });

    const req = authenticatedReq(TEST_USER);
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(TEST_USER.email);
    expect(res.body.data.display_name).toBe('Test User');
    expect(res.body.data.referral_code).toBe('U1234');
  });

  test('user not found returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const req = authenticatedReq(TEST_USER);
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(404);
  });
});

// =========================================================================
// PUT /me
// =========================================================================
describe('PUT /me', () => {
  const handlers = findHandler('put', '/me');

  test('updates display name and timezone', async () => {
    mockQuery.mockResolvedValue({ rows: [] }); // UPDATE user_profiles

    const req = authenticatedReq(TEST_USER, {
      body: { displayName: 'New Name', timezone: 'America/New_York' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/updated/i);
  });

  test('updates language (triggers user table update too)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = authenticatedReq(TEST_USER, {
      body: { language: 'es' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(200);
    // Should have called UPDATE users for language
    const langCall = mockQuery.mock.calls.find(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('UPDATE users SET language'),
    );
    expect(langCall).toBeDefined();
    expect(langCall![1][0]).toBe('es');
  });

  test('invalid language returns 400', async () => {
    const req = authenticatedReq(TEST_USER, {
      body: { language: 'xx' },
    });
    const res = mockRes();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(400);
  });
});
