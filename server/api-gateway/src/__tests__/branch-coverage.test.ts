/**
 * Branch coverage tests for api-gateway
 *
 * Targets uncovered branches in:
 *   - validators/index.ts (validateBody, validateQuery, validateParams — invalid input paths)
 *   - middleware/auth.ts (catch block lines 42-43, generic error)
 *   - middleware/socketRateLimiter.ts (canSubscribe, releaseSubscriptions)
 */

 

// ── Mocks — must come before imports ────────────────────────────────

jest.mock('../config/env.js', () => ({
  __esModule: true,
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    REDIS_DB: 0,
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

jest.mock('../config/database.js', () => ({
  __esModule: true,
  query: jest.fn(),
  default: { query: jest.fn() },
}));

jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: {
    incr: jest.fn(),
    expire: jest.fn(),
    decr: jest.fn(),
    del: jest.fn(),
    pipeline: jest.fn(() => ({
      zremrangebyscore: jest.fn(),
      zadd: jest.fn(),
      zcard: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn().mockResolvedValue([[null, 0], [null, 0], [null, 1], [null, 1]]),
    })),
  },
}));

// ── Imports ─────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, requireTier, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../validators/index.js';
import { z } from 'zod';

// ── Helpers ─────────────────────────────────────────────────────────

const SECRET = 'test-access-secret-that-is-long-enough';

function mockReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { headers: {}, ...overrides } as AuthenticatedRequest;
}

function createMockRes() {
  const state = { statusCode: 200, body: null as any };
  const res = {
    status(code: number) { state.statusCode = code; return res; },
    json(data: any) { state.body = data; return res; },
  } as unknown as Response;
  return { res, state };
}

// =====================================================================
// Validator branch coverage
// =====================================================================

describe('validators/index — branch coverage', () => {
  const schema = z.object({ name: z.string().min(1) });

  describe('validateBody', () => {
    it('should return 400 with details when body is invalid', () => {
      const middleware = validateBody(schema);
      const req = { body: { name: '' } } as Request;
      const { res, state } = createMockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(state.statusCode).toBe(400);
      expect(state.body.success).toBe(false);
      expect(state.body.error).toBe('Validation failed');
      expect(state.body.details).toBeInstanceOf(Array);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next and set parsed data on success', () => {
      const middleware = validateBody(schema);
      const req = { body: { name: 'Alice' } } as Request;
      const { res } = createMockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({ name: 'Alice' });
    });
  });

  describe('validateQuery', () => {
    const qSchema = z.object({ page: z.coerce.number().int().min(1) });

    it('should return 400 when query is invalid', () => {
      const middleware = validateQuery(qSchema);
      const req = { query: { page: 'abc' } } as any;
      const { res, state } = createMockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(state.statusCode).toBe(400);
      expect(state.body.success).toBe(false);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass and set parsed query on success', () => {
      const middleware = validateQuery(qSchema);
      const req = { query: { page: '3' } } as any;
      const { res } = createMockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.query).toEqual({ page: 3 });
    });
  });

  describe('validateParams', () => {
    const pSchema = z.object({ id: z.string().uuid() });

    it('should return 400 when params are invalid', () => {
      const middleware = validateParams(pSchema);
      const req = { params: { id: 'not-a-uuid' } } as any;
      const { res, state } = createMockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(state.statusCode).toBe(400);
      expect(state.body.error).toBe('Validation failed');
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass when params are valid', () => {
      const middleware = validateParams(pSchema);
      const req = { params: { id: '550e8400-e29b-41d4-a716-446655440000' } } as any;
      const { res } = createMockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

// =====================================================================
// authenticate() — generic error catch block (lines 42-43)
// =====================================================================

describe('authenticate — generic error branch', () => {
  it('should return 500 when jwt.verify throws a non-JWT error', () => {
    const req = mockReq({
      headers: { authorization: 'Bearer some-token' },
    });
    const { res, state } = createMockRes();
    const next = jest.fn();

    // Force jwt.verify to throw a plain error (not TokenExpiredError, not JsonWebTokenError)
    jest.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new TypeError('unexpected internal error');
    });

    authenticate(req, res, next);

    expect(state.statusCode).toBe(500);
    expect(state.body.error).toBe('Internal server error');
    expect(next).not.toHaveBeenCalled();

    (jwt.verify as any).mockRestore();
  });
});

// =====================================================================
// requireTier — edge: unknown tier string maps to level 0
// =====================================================================

describe('requireTier — unknown tiers', () => {
  it('should reject when user has an unrecognized tier and required tier is known', () => {
    const middleware = requireTier('trader');
    const req = mockReq() as AuthenticatedRequest;
    req.user = { id: '1', email: 'a@b.com', tier: 'banana' };
    const { res, state } = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(state.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow when required tier is also unrecognized (both level 0)', () => {
    const middleware = requireTier('unknown_tier');
    const req = mockReq() as AuthenticatedRequest;
    req.user = { id: '1', email: 'a@b.com', tier: 'banana' };
    const { res } = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

// =====================================================================
// socketRateLimiter — canSubscribe and releaseSubscriptions branches
// =====================================================================

describe('socketRateLimiter — canSubscribe / releaseSubscriptions', () => {
  let canSubscribe: typeof import('../middleware/socketRateLimiter.js')['canSubscribe'];
  let releaseSubscriptions: typeof import('../middleware/socketRateLimiter.js')['releaseSubscriptions'];

  beforeAll(async () => {
    const mod = await import('../middleware/socketRateLimiter.js');
    canSubscribe = mod.canSubscribe;
    releaseSubscriptions = mod.releaseSubscriptions;
  });

  function mockSocket(overrides: Record<string, any> = {}): any {
    return {
      id: 'sock-1',
      data: { tier: 'anonymous' },
      handshake: { headers: {}, address: '127.0.0.1' },
      ...overrides,
    };
  }

  it('canSubscribe returns true for institutional (limit -1)', () => {
    const socket = mockSocket({ data: { tier: 'institutional' } });
    expect(canSubscribe(socket)).toBe(true);
  });

  it('canSubscribe returns false when subscription limit reached', () => {
    const socket = mockSocket({ id: 'sock-limit-test' });
    // Anonymous tier has maxSubscriptions = 10, requesting 11 should fail
    expect(canSubscribe(socket, 11)).toBe(false);
  });

  it('releaseSubscriptions handles socket not in the map', () => {
    const socket = mockSocket({ id: 'sock-never-seen' });
    expect(() => releaseSubscriptions(socket, 5)).not.toThrow();
  });
});
