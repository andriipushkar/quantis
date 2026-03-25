/**
 * Socket rate limiter — unit tests
 *
 * Tests applySocketRateLimiting, canSubscribe, releaseSubscriptions
 * with mocked Redis and Socket.IO.
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
  incr: jest.fn(),
  decr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  pipeline: jest.fn(() => mockPipeline),
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

import { applySocketRateLimiting, canSubscribe, releaseSubscriptions } from '../middleware/socketRateLimiter.js';

// ---------------------------------------------------------------------------
// 3. Socket.IO mock helpers
// ---------------------------------------------------------------------------

function createMockSocket(overrides: Record<string, any> = {}): any {
  const eventHandlers: Record<string, Function[]> = {};
  const middlewares: Function[] = [];

  return {
    id: overrides.id ?? 'socket-1',
    data: overrides.data ?? {},
    handshake: {
      headers: overrides.headers ?? {},
      address: overrides.address ?? '10.0.0.1',
    },
    on(event: string, handler: Function) {
      if (!eventHandlers[event]) eventHandlers[event] = [];
      eventHandlers[event].push(handler);
    },
    use(fn: Function) {
      middlewares.push(fn);
    },
    // Test helpers
    _emit(event: string, ...args: any[]) {
      eventHandlers[event]?.forEach(h => h(...args));
    },
    _middlewares: middlewares,
    _handlers: eventHandlers,
  };
}

function createMockIO(): any {
  const connectionHandlers: Function[] = [];
  const middlewares: Function[] = [];

  return {
    use(fn: Function) {
      middlewares.push(fn);
    },
    on(event: string, handler: Function) {
      if (event === 'connection') connectionHandlers.push(handler);
    },
    // Test helpers
    _simulateConnection(socket: any): void {
      connectionHandlers.forEach(h => h(socket));
    },
    _runMiddleware(socket: any): Promise<Error | undefined> {
      return new Promise((resolve) => {
        if (middlewares.length === 0) return resolve(undefined);
        middlewares[0](socket, (err?: Error) => resolve(err));
      });
    },
    _middlewares: middlewares,
  };
}

// ---------------------------------------------------------------------------
// 4. Tests
// ---------------------------------------------------------------------------

describe('applySocketRateLimiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.decr.mockResolvedValue(0);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.del.mockResolvedValue(1);
  });

  test('registers connection middleware and connection handler', () => {
    const io = createMockIO();
    applySocketRateLimiting(io);
    expect(io._middlewares.length).toBe(1);
  });

  test('anonymous socket within IP limit → allowed', async () => {
    mockRedis.incr.mockResolvedValue(1); // 1st connection
    const io = createMockIO();
    applySocketRateLimiting(io);

    const socket = createMockSocket();
    const err = await io._runMiddleware(socket);
    expect(err).toBeUndefined();
  });

  test('anonymous socket exceeding IP limit (4th connection) → rejected', async () => {
    mockRedis.incr.mockResolvedValue(4); // 4th connection, limit is 3
    const io = createMockIO();
    applySocketRateLimiting(io);

    const socket = createMockSocket();
    const err = await io._runMiddleware(socket);
    expect(err).toBeDefined();
    expect(err!.message).toContain('Too many connections');
    // Redis.decr was called to rollback
    expect(mockRedis.decr).toHaveBeenCalled();
  });

  test('institutional socket → unlimited connections', async () => {
    mockRedis.incr.mockResolvedValue(100);
    const io = createMockIO();
    applySocketRateLimiting(io);

    const socket = createMockSocket({ data: { tier: 'institutional' } });
    const err = await io._runMiddleware(socket);
    expect(err).toBeUndefined();
    // incr should NOT be called because limit is -1
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  test('Redis error on connection check → fails open', async () => {
    mockRedis.incr.mockRejectedValue(new Error('Redis down'));
    const io = createMockIO();
    applySocketRateLimiting(io);

    const socket = createMockSocket();
    const err = await io._runMiddleware(socket);
    expect(err).toBeUndefined(); // should still allow
  });

  test('disconnect cleans up connection count', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.decr.mockResolvedValue(0);
    const io = createMockIO();
    applySocketRateLimiting(io);

    const socket = createMockSocket();
    io._simulateConnection(socket);

    // Trigger disconnect
    await socket._emit('disconnect');

    expect(mockRedis.decr).toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalled();
  });

  test('uses x-forwarded-for header for IP extraction', async () => {
    mockRedis.incr.mockResolvedValue(1);
    const io = createMockIO();
    applySocketRateLimiting(io);

    const socket = createMockSocket({
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      address: '10.0.0.1',
    });
    await io._runMiddleware(socket);

    // The key should use the first IP from x-forwarded-for
    expect(mockRedis.incr).toHaveBeenCalledWith('ws:conn:1.2.3.4');
  });
});

// ---------------------------------------------------------------------------
// canSubscribe / releaseSubscriptions
// ---------------------------------------------------------------------------

describe('canSubscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('anonymous socket within subscription limit → true', () => {
    // Need to set up the internal map by simulating a connection
    const io = createMockIO();
    applySocketRateLimiting(io);
    const socket = createMockSocket({ id: 'sub-test-1' });
    io._simulateConnection(socket);

    const result = canSubscribe(socket, 1);
    expect(result).toBe(true);
  });

  test('anonymous socket exceeding max subscriptions (11th) → false', () => {
    const io = createMockIO();
    applySocketRateLimiting(io);
    const socket = createMockSocket({ id: 'sub-test-2' });
    io._simulateConnection(socket);

    // Fill up to 10 (anonymous limit)
    for (let i = 0; i < 10; i++) {
      expect(canSubscribe(socket, 1)).toBe(true);
    }

    // 11th should fail
    expect(canSubscribe(socket, 1)).toBe(false);
  });

  test('institutional socket → unlimited subscriptions', () => {
    const io = createMockIO();
    applySocketRateLimiting(io);
    const socket = createMockSocket({ id: 'sub-test-3', data: { tier: 'institutional' } });
    io._simulateConnection(socket);

    // Should always return true
    expect(canSubscribe(socket, 1000)).toBe(true);
  });

  test('pro socket has higher limit than starter', () => {
    const io = createMockIO();
    applySocketRateLimiting(io);

    const starterSocket = createMockSocket({ id: 'starter-1', data: { tier: 'starter' } });
    const proSocket = createMockSocket({ id: 'pro-1', data: { tier: 'pro' } });
    io._simulateConnection(starterSocket);
    io._simulateConnection(proSocket);

    // Starter limit is 20, pro limit is 500
    expect(canSubscribe(starterSocket, 20)).toBe(true);
    expect(canSubscribe(starterSocket, 1)).toBe(false); // 21st

    expect(canSubscribe(proSocket, 500)).toBe(true);
    expect(canSubscribe(proSocket, 1)).toBe(false); // 501st
  });
});

describe('releaseSubscriptions', () => {
  test('decrements subscription count', () => {
    const io = createMockIO();
    applySocketRateLimiting(io);
    const socket = createMockSocket({ id: 'release-test-1' });
    io._simulateConnection(socket);

    // Add 5 subscriptions
    canSubscribe(socket, 5);

    // Release 2
    releaseSubscriptions(socket, 2);

    // Should be able to add 7 more (10 - 5 + 2 = 7)
    expect(canSubscribe(socket, 7)).toBe(true);
    expect(canSubscribe(socket, 1)).toBe(false); // 11th total
  });

  test('does not go below 0', () => {
    const io = createMockIO();
    applySocketRateLimiting(io);
    const socket = createMockSocket({ id: 'release-test-2' });
    io._simulateConnection(socket);

    // Release more than subscribed
    releaseSubscriptions(socket, 100);

    // Should still be able to subscribe up to limit
    expect(canSubscribe(socket, 10)).toBe(true);
  });
});
