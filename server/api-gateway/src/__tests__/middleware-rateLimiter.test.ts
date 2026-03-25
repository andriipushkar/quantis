/**
 * Rate limiter middleware — unit tests
 *
 * Tests tier-based rate limiting with mocked Redis.
 */

 

// ---------------------------------------------------------------------------
// 1. Mocks
// ---------------------------------------------------------------------------

const mockPipeline = {
  zremrangebyscore: jest.fn().mockReturnThis(),
  zadd: jest.fn().mockReturnThis(),
  zcard: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

const mockRedis = {
  pipeline: jest.fn(() => mockPipeline),
  zrange: jest.fn(),
};

jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: mockRedis,
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

import { Response, NextFunction } from 'express';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------

function mockReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  } as AuthenticatedRequest;
}

function mockRes(): { res: Response; statusCode: number; body: any; headers: Record<string, string> } {
  const state = { statusCode: 200, body: null as any, headers: {} as Record<string, string> };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(data: any) {
      state.body = data;
      return res;
    },
    set(key: string, value: string) {
      state.headers[key] = value;
      return res;
    },
  } as unknown as Response;
  return {
    res,
    get statusCode() { return state.statusCode; },
    get body() { return state.body; },
    get headers() { return state.headers; },
  };
}

/**
 * Set up pipeline.exec to return a given request count.
 */
function setupPipelineCount(count: number) {
  mockPipeline.exec.mockResolvedValue([
    [null, 0],       // zremrangebyscore
    [null, 1],       // zadd
    [null, count],   // zcard
    [null, 1],       // expire
  ]);
}

// ---------------------------------------------------------------------------
// 4. Tests
// ---------------------------------------------------------------------------

describe('rateLimiter middleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.pipeline.mockReturnValue(mockPipeline);
  });

  // ── Happy path ──────────────────────────────────────────────────────

  test('anonymous user: 1st request → passes', async () => {
    setupPipelineCount(1);
    const req = mockReq();
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(r.headers['X-RateLimit-Limit']).toBe('30');
    expect(r.headers['X-RateLimit-Remaining']).toBe('29');
  });

  test('anonymous user: 30th request → passes (at limit)', async () => {
    setupPipelineCount(30);
    const req = mockReq();
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(r.headers['X-RateLimit-Remaining']).toBe('0');
  });

  test('anonymous user: 31st request → 429', async () => {
    setupPipelineCount(31);
    mockRedis.zrange.mockResolvedValue(['ts1', String(Date.now() - 55000)]);
    const req = mockReq();
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(r.statusCode).toBe(429);
    expect(r.body.error).toBe('Too many requests');
    expect(r.body.limit).toBe(30);
    expect(r.headers['Retry-After']).toBeDefined();
    expect(next).not.toHaveBeenCalled();
  });

  // ── Tier-based limits ───────────────────────────────────────────────

  test('starter user: 60 requests → passes', async () => {
    setupPipelineCount(60);
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'starter' } });
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(next).toHaveBeenCalled();
    expect(r.headers['X-RateLimit-Limit']).toBe('60');
  });

  test('starter user: 61 requests → 429', async () => {
    setupPipelineCount(61);
    mockRedis.zrange.mockResolvedValue(['ts1', String(Date.now() - 50000)]);
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'starter' } });
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(r.statusCode).toBe(429);
  });

  test('trader user: 300 requests → passes', async () => {
    setupPipelineCount(300);
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'trader' } });
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(next).toHaveBeenCalled();
    expect(r.headers['X-RateLimit-Limit']).toBe('300');
  });

  test('pro user: 1000 requests → passes', async () => {
    setupPipelineCount(1000);
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'pro' } });
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(next).toHaveBeenCalled();
    expect(r.headers['X-RateLimit-Limit']).toBe('1000');
  });

  test('institutional user → unlimited, skips Redis entirely', async () => {
    const req = mockReq({ user: { id: 'u1', email: 'a@b.com', tier: 'institutional' } });
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(next).toHaveBeenCalled();
    expect(mockRedis.pipeline).not.toHaveBeenCalled();
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  test('pipeline.exec returns null → passes (fail open)', async () => {
    mockPipeline.exec.mockResolvedValue(null);
    const req = mockReq();
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(next).toHaveBeenCalled();
  });

  test('Redis error → fails open, calls next()', async () => {
    mockPipeline.exec.mockRejectedValue(new Error('Redis connection refused'));
    const req = mockReq();
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(next).toHaveBeenCalled();
  });

  test('no req.user and no req.ip → uses "unknown" as key', async () => {
    setupPipelineCount(1);
    const req = mockReq({ ip: undefined } as any);
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(next).toHaveBeenCalled();
    // Verify the pipeline was called (key will contain "unknown")
    expect(mockRedis.pipeline).toHaveBeenCalled();
  });

  test('Retry-After header is at least 1 second', async () => {
    setupPipelineCount(31);
    // Return a timestamp that would compute negative retry — but code clamps to 1
    mockRedis.zrange.mockResolvedValue(['ts1', '0']);
    const req = mockReq();
    const r = mockRes();

    await rateLimiter(req, r.res, next);

    expect(r.statusCode).toBe(429);
    const retryAfter = parseInt(r.headers['Retry-After'], 10);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });
});
