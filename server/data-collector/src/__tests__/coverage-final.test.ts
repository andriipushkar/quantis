/**
 * Final coverage tests for data-collector
 *
 * Targets uncovered lines in:
 *   - collectors/base.ts lines 70-80: storeOHLCV with meta (Redis publish path),
 *     storeOHLCV error path (catch block lines 82-86),
 *     storeOHLCV without meta (skips publish)
 */

// ── Mock setup ─────────────────────────────────────────────────────

jest.mock('ws');
jest.mock('pg', () => ({ Pool: jest.fn() }));
jest.mock('ioredis', () => jest.fn());
jest.mock('../config/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  __esModule: true,
}));

// ── Helpers ────────────────────────────────────────────────────────

function createMockPool() {
  return {
    query: jest.fn(),
  } as any;
}

function createMockRedis() {
  return {
    publish: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    hset: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
  } as any;
}

// ── BaseCollector tests via a concrete subclass ─────────────────────

import { BaseCollector } from '../collectors/base';

class TestCollector extends BaseCollector {
  async start() { /* noop */ }
  async stop() { /* noop */ }

  public async testStoreOHLCV(
    table: string,
    data: any,
    meta?: { symbol: string; timeframe: string }
  ) {
    return this.storeOHLCV(table, data, meta);
  }

  public async testPublishTicker(
    symbol: string,
    data: any
  ) {
    return this.publishTicker(symbol, data);
  }

  public testGetReconnectDelay() {
    return this.getReconnectDelay();
  }

  public testResetReconnectAttempts() {
    return this.resetReconnectAttempts();
  }
}

describe('BaseCollector — extended coverage', () => {
  let collector: TestCollector;
  let mockPool: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPool = createMockPool();
    mockRedis = createMockRedis();
    collector = new TestCollector(mockPool, mockRedis);
  });

  const ohlcvData = {
    time: new Date('2025-01-01T00:00:00Z'),
    pairId: 1,
    exchangeId: 1,
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1000,
    trades: 50,
  };

  // ── storeOHLCV with meta — covers lines 69-81 (Redis publish) ─────

  it('storeOHLCV publishes to Redis when meta is provided', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await collector.testStoreOHLCV('ohlcv_1m', ohlcvData, {
      symbol: 'BTCUSDT',
      timeframe: '1m',
    });

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    expect(mockRedis.publish).toHaveBeenCalledWith(
      'ohlcv:update',
      expect.stringContaining('BTCUSDT')
    );
  });

  it('storeOHLCV does not publish when meta is undefined', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await collector.testStoreOHLCV('ohlcv_1m', ohlcvData);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    expect(mockRedis.publish).not.toHaveBeenCalled();
  });

  it('storeOHLCV does not publish when meta has no symbol', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await collector.testStoreOHLCV('ohlcv_1m', ohlcvData, {
      symbol: '',
      timeframe: '1m',
    });

    expect(mockRedis.publish).not.toHaveBeenCalled();
  });

  it('storeOHLCV does not publish when meta has no timeframe', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await collector.testStoreOHLCV('ohlcv_1m', ohlcvData, {
      symbol: 'BTCUSDT',
      timeframe: '',
    });

    expect(mockRedis.publish).not.toHaveBeenCalled();
  });

  // ── storeOHLCV DB error — covers catch block lines 82-86 ──────────

  it('storeOHLCV throws on DB error and logs it', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('DB insert failed'));

    await expect(
      collector.testStoreOHLCV('ohlcv_1m', ohlcvData, {
        symbol: 'BTCUSDT',
        timeframe: '1m',
      })
    ).rejects.toThrow('DB insert failed');
  });

  it('storeOHLCV handles non-Error thrown objects', async () => {
    mockPool.query.mockRejectedValueOnce('string error');

    await expect(
      collector.testStoreOHLCV('ohlcv_1m', ohlcvData)
    ).rejects.toBe('string error');
  });

  // ── storeOHLCV Redis publish failure is swallowed ──────────────────

  it('storeOHLCV swallows Redis publish error', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    mockRedis.publish.mockRejectedValueOnce(new Error('Redis down'));

    // Should NOT throw, even though publish fails
    await collector.testStoreOHLCV('ohlcv_1m', ohlcvData, {
      symbol: 'BTCUSDT',
      timeframe: '1m',
    });

    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // ── publishTicker error path — covers lines 116-119 ───────────────

  it('publishTicker handles Redis error gracefully', async () => {
    mockRedis.publish.mockRejectedValueOnce(new Error('Redis down'));
    mockRedis.set.mockRejectedValueOnce(new Error('Redis down'));
    mockRedis.hset.mockRejectedValueOnce(new Error('Redis down'));

    // Should not throw
    await collector.testPublishTicker('ETHUSDT', {
      exchange: 'binance',
      price: 3000,
      change24h: 2.5,
      volume: 500000,
    });
  });

  // ── Reconnect delay — covers exponential backoff ───────────────────

  it('getReconnectDelay increases exponentially', () => {
    const delay1 = collector.testGetReconnectDelay(); // attempt 0: 1000
    const delay2 = collector.testGetReconnectDelay(); // attempt 1: 2000
    const delay3 = collector.testGetReconnectDelay(); // attempt 2: 4000

    expect(delay1).toBe(1000);
    expect(delay2).toBe(2000);
    expect(delay3).toBe(4000);
  });

  it('getReconnectDelay is capped at maxReconnectDelay', () => {
    // Run many attempts to reach the cap
    for (let i = 0; i < 20; i++) {
      collector.testGetReconnectDelay();
    }
    const delay = collector.testGetReconnectDelay();
    expect(delay).toBeLessThanOrEqual(60000);
  });

  it('resetReconnectAttempts resets the counter', () => {
    collector.testGetReconnectDelay(); // attempt 0
    collector.testGetReconnectDelay(); // attempt 1
    collector.testResetReconnectAttempts();
    const delay = collector.testGetReconnectDelay(); // back to attempt 0
    expect(delay).toBe(1000);
  });

  // ── publishTicker normal flow ──────────────────────────────────────

  it('publishTicker calls redis.publish, redis.set, and redis.hset', async () => {
    await collector.testPublishTicker('BTCUSDT', {
      exchange: 'binance',
      price: 97000,
      change24h: 1.5,
      volume: 1000000,
    });

    expect(mockRedis.publish).toHaveBeenCalledWith('ticker:update', expect.any(String));
    expect(mockRedis.set).toHaveBeenCalledWith(
      'ticker:binance:BTCUSDT',
      expect.any(String),
      'EX',
      10
    );
    expect(mockRedis.hset).toHaveBeenCalledWith(
      'ticker:snapshot',
      'binance:BTCUSDT',
      expect.any(String)
    );
  });
});
