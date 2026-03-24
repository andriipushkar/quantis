/**
 * Auth middleware — unit tests
 *
 * Tests authenticate() and requireTier() directly with mock req/res objects.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// 1. Mocks
// ---------------------------------------------------------------------------

jest.mock('../config/env.js', () => ({
  __esModule: true,
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough',
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

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------

import jwt from 'jsonwebtoken';
import { authenticate, requireTier, AuthenticatedRequest } from '../middleware/auth.js';
import { Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------

const SECRET = 'test-access-secret-that-is-long-enough';

function signToken(payload: Record<string, unknown>, options?: jwt.SignOptions): string {
  return jwt.sign(payload, SECRET, { expiresIn: '15m', ...options });
}

function mockReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    headers: {},
    ...overrides,
  } as AuthenticatedRequest;
}

function mockRes(): { res: Response; statusCode: number; body: any } {
  const state = { statusCode: 200, body: null as any };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(data: any) {
      state.body = data;
      return res;
    },
  } as unknown as Response;
  return { res, ...state, get statusCode() { return state.statusCode; }, get body() { return state.body; } };
}

// ---------------------------------------------------------------------------
// 4. Tests — authenticate()
// ---------------------------------------------------------------------------

describe('authenticate middleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('valid JWT → sets req.user and calls next()', () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', tier: 'pro' });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } as any });
    const { res } = mockRes();

    authenticate(req, res, next);

    expect(req.user).toEqual({ id: 'u1', email: 'a@b.com', tier: 'pro' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('missing Authorization header → 401', () => {
    const req = mockReq();
    const r = mockRes();

    authenticate(req, r.res, next);

    expect(r.statusCode).toBe(401);
    expect(r.body).toEqual({ error: 'Missing or invalid authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  test('Authorization without "Bearer " prefix → 401', () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', tier: 'starter' });
    const req = mockReq({ headers: { authorization: `Basic ${token}` } as any });
    const r = mockRes();

    authenticate(req, r.res, next);

    expect(r.statusCode).toBe(401);
    expect(r.body.error).toBe('Missing or invalid authorization header');
  });

  test('expired token → 401 "Token expired"', () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', tier: 'pro' }, { expiresIn: '-1s' });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } as any });
    const r = mockRes();

    authenticate(req, r.res, next);

    expect(r.statusCode).toBe(401);
    expect(r.body.error).toBe('Token expired');
  });

  test('corrupted token → 401 "Invalid token"', () => {
    const req = mockReq({ headers: { authorization: 'Bearer not.a.valid.token' } as any });
    const r = mockRes();

    authenticate(req, r.res, next);

    expect(r.statusCode).toBe(401);
    expect(r.body.error).toBe('Invalid token');
  });

  test('token signed with wrong secret → 401 "Invalid token"', () => {
    const token = jwt.sign({ id: 'u1', email: 'a@b.com', tier: 'pro' }, 'wrong-secret');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } as any });
    const r = mockRes();

    authenticate(req, r.res, next);

    expect(r.statusCode).toBe(401);
    expect(r.body.error).toBe('Invalid token');
  });

  test('only extracts id, email, tier from decoded payload', () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', tier: 'trader', extra: 'ignored' });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } as any });
    const { res } = mockRes();

    authenticate(req, res, next);

    expect(req.user).toEqual({ id: 'u1', email: 'a@b.com', tier: 'trader' });
    expect((req.user as any).extra).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Tests — requireTier()
// ---------------------------------------------------------------------------

describe('requireTier middleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('unauthenticated request → 401', () => {
    const middleware = requireTier('pro');
    const req = mockReq(); // no user
    const r = mockRes();

    middleware(req, r.res, next);

    expect(r.statusCode).toBe(401);
    expect(r.body.error).toBe('Authentication required');
  });

  test('starter user requesting pro → 403', () => {
    const middleware = requireTier('pro');
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'starter' } });
    const r = mockRes();

    middleware(req, r.res, next);

    expect(r.statusCode).toBe(403);
    expect(r.body.error).toBe('Insufficient subscription tier');
    expect(r.body.required).toBe('pro');
    expect(r.body.current).toBe('starter');
  });

  test('pro user requesting pro → next()', () => {
    const middleware = requireTier('pro');
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'pro' } });
    const { res } = mockRes();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('institutional user requesting pro → next() (higher tier)', () => {
    const middleware = requireTier('pro');
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'institutional' } });
    const { res } = mockRes();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('trader user requesting starter → next() (higher tier)', () => {
    const middleware = requireTier('starter');
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'trader' } });
    const { res } = mockRes();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('unknown tier name in user → treated as level 0 → 403', () => {
    const middleware = requireTier('starter');
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'free' } });
    const r = mockRes();

    middleware(req, r.res, next);

    expect(r.statusCode).toBe(403);
  });

  test('unknown minTier → treated as level 0 → allows any authenticated user', () => {
    const middleware = requireTier('unknown');
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'starter' } });
    const { res } = mockRes();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
