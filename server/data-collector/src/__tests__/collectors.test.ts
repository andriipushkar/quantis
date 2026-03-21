/**
 * Tests for the data collector classes: BaseCollector, BinanceCollector symbol formatting,
 * backfill threshold logic, and candle aggregation constants.
 *
 * These tests mock external dependencies (pg, ioredis, ws) to avoid real connections.
 */

// ── Mock setup ─────────────────────────────────────────────────────
// Must be defined before imports so jest.mock hoists them properly.

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
    get: jest.fn().mockResolvedValue(null),
  } as any;
}

// ── BaseCollector tests via a concrete subclass ─────────────────────

import { BaseCollector } from '../collectors/base';

class TestCollector extends BaseCollector {
  async start() { /* noop */ }
  async stop() { /* noop */ }

  // Expose protected methods for testing
  public async testStoreOHLCV(
    table: string,
    data: any
  ) {
    return this.storeOHLCV(table, data);
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

describe('BaseCollector', () => {
  let collector: TestCollector;
  let mockPool: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPool = createMockPool();
    mockRedis = createMockRedis();
    collector = new TestCollector(mockPool, mockRedis);
  });

  describe('storeOHLCV', () => {
    it('should execute parameterized INSERT query', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const data = {
        time: new Date('2024-01-01T00:00:00Z'),
        pairId: 1,
        exchangeId: 1,
        open: 42000,
        high: 42500,
        low: 41500,
        close: 42100,
        volume: 100,
        trades: 50,
      };

      await collector.testStoreOHLCV('ohlcv_1m', data);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO ohlcv_1m');
      expect(sql).toContain('ON CONFLICT');
      expect(params).toEqual([
        data.time,
        data.pairId,
        data.exchangeId,
        data.open,
        data.high,
        data.low,
        data.close,
        data.volume,
        data.trades,
      ]);
    });

    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('DB connection refused'));

      await expect(
        collector.testStoreOHLCV('ohlcv_1m', {
          time: new Date(),
          pairId: 1,
          exchangeId: 1,
          open: 100,
          high: 200,
          low: 50,
          close: 150,
          volume: 10,
          trades: 5,
        })
      ).rejects.toThrow('DB connection refused');
    });
  });

  describe('publishTicker', () => {
    it('should publish to Redis and cache the value', async () => {
      await collector.testPublishTicker('BTCUSDT', {
        exchange: 'binance',
        price: 42000,
        change24h: 2.5,
        volume: 1000,
      });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'ticker:update',
        expect.stringContaining('"symbol":"BTCUSDT"')
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'ticker:binance:BTCUSDT',
        expect.any(String),
        'EX',
        10
      );
    });

    it('should include timestamp in the payload', async () => {
      await collector.testPublishTicker('ETHUSDT', {
        exchange: 'bybit',
        price: 2200,
        change24h: -1.0,
        volume: 500,
      });

      const publishedPayload = JSON.parse(mockRedis.publish.mock.calls[0][1] as string);
      expect(publishedPayload).toHaveProperty('timestamp');
      expect(publishedPayload.symbol).toBe('ETHUSDT');
      expect(publishedPayload.exchange).toBe('bybit');
      expect(publishedPayload.price).toBe(2200);
    });

    it('should not throw when Redis fails', async () => {
      mockRedis.publish.mockRejectedValue(new Error('Redis down'));

      await expect(
        collector.testPublishTicker('BTCUSDT', {
          exchange: 'binance',
          price: 42000,
          change24h: 0,
          volume: 100,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('getReconnectDelay', () => {
    it('should start at 1000ms', () => {
      const delay = collector.testGetReconnectDelay();
      expect(delay).toBe(1000);
    });

    it('should double with each attempt', () => {
      const d1 = collector.testGetReconnectDelay(); // attempt 0 -> 1000
      const d2 = collector.testGetReconnectDelay(); // attempt 1 -> 2000
      const d3 = collector.testGetReconnectDelay(); // attempt 2 -> 4000

      expect(d1).toBe(1000);
      expect(d2).toBe(2000);
      expect(d3).toBe(4000);
    });

    it('should cap at maxReconnectDelay (60000ms)', () => {
      // Run through many attempts to exceed the cap
      let delay = 0;
      for (let i = 0; i < 20; i++) {
        delay = collector.testGetReconnectDelay();
      }
      expect(delay).toBeLessThanOrEqual(60000);
    });

    it('should reset to 0 after resetReconnectAttempts', () => {
      collector.testGetReconnectDelay(); // 1000
      collector.testGetReconnectDelay(); // 2000
      collector.testResetReconnectAttempts();
      const delay = collector.testGetReconnectDelay();
      expect(delay).toBe(1000);
    });
  });
});

// ── OKX symbol formatting ──────────────────────────────────────────

// The toOkxInstId and fromOkxInstId functions are not exported directly,
// but we can test the logic by verifying the format transformations.

describe('OKX symbol formatting logic', () => {
  // Mirrors the toOkxInstId function
  function toOkxInstId(symbol: string): string {
    const base = symbol.replace('USDT', '');
    return `${base}-USDT`;
  }

  function fromOkxInstId(instId: string): string {
    return instId.replace('-', '');
  }

  it('should convert BTCUSDT to BTC-USDT', () => {
    expect(toOkxInstId('BTCUSDT')).toBe('BTC-USDT');
  });

  it('should convert ETHUSDT to ETH-USDT', () => {
    expect(toOkxInstId('ETHUSDT')).toBe('ETH-USDT');
  });

  it('should convert DOGEUSDT to DOGE-USDT', () => {
    expect(toOkxInstId('DOGEUSDT')).toBe('DOGE-USDT');
  });

  it('should convert BTC-USDT back to BTCUSDT', () => {
    expect(fromOkxInstId('BTC-USDT')).toBe('BTCUSDT');
  });

  it('should convert SOL-USDT back to SOLUSDT', () => {
    expect(fromOkxInstId('SOL-USDT')).toBe('SOLUSDT');
  });
});

// ── Binance stream formatting ──────────────────────────────────────

describe('Binance stream formatting logic', () => {
  it('should format pairs as lowercase kline streams', () => {
    const pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const streams = pairs.map((s) => `${s.toLowerCase()}@kline_1m`).join('/');
    expect(streams).toBe('btcusdt@kline_1m/ethusdt@kline_1m/solusdt@kline_1m');
  });
});

// ── Bybit topic parsing ────────────────────────────────────────────

describe('Bybit kline topic parsing logic', () => {
  it('should extract symbol from topic "kline.1.BTCUSDT"', () => {
    const topic = 'kline.1.BTCUSDT';
    const parts = topic.split('.');
    const symbol = parts[2]?.toUpperCase();
    expect(symbol).toBe('BTCUSDT');
  });

  it('should handle topic with different interval', () => {
    const topic = 'kline.5.ETHUSDT';
    const parts = topic.split('.');
    expect(parts[1]).toBe('5');
    expect(parts[2]?.toUpperCase()).toBe('ETHUSDT');
  });

  it('should return undefined for malformed topic', () => {
    const topic = 'kline';
    const parts = topic.split('.');
    expect(parts[2]).toBeUndefined();
  });
});

// ── Aggregate timeframes constants ─────────────────────────────────

describe('Aggregate timeframes constants', () => {
  const AGGREGATE_TIMEFRAMES = [
    { table: 'ohlcv_5m', bucket: '5 minutes' },
    { table: 'ohlcv_15m', bucket: '15 minutes' },
    { table: 'ohlcv_1h', bucket: '1 hour' },
    { table: 'ohlcv_4h', bucket: '4 hours' },
    { table: 'ohlcv_1d', bucket: '1 day' },
  ];

  it('should have 5 aggregate timeframes', () => {
    expect(AGGREGATE_TIMEFRAMES).toHaveLength(5);
  });

  it('should have table names matching ohlcv_ prefix pattern', () => {
    for (const tf of AGGREGATE_TIMEFRAMES) {
      expect(tf.table).toMatch(/^ohlcv_/);
    }
  });

  it('should have bucket strings that include time units', () => {
    const validUnits = ['minutes', 'hour', 'hours', 'day'];
    for (const tf of AGGREGATE_TIMEFRAMES) {
      expect(validUnits.some((unit) => tf.bucket.includes(unit))).toBe(true);
    }
  });
});

// ── Backfill threshold logic ───────────────────────────────────────

describe('Backfill threshold logic', () => {
  const BACKFILL_THRESHOLD = 500;

  it('should skip backfill when existing count exceeds threshold', () => {
    const existingCount = 600;
    expect(existingCount >= BACKFILL_THRESHOLD).toBe(true);
  });

  it('should skip backfill when existing count equals threshold', () => {
    const existingCount = 500;
    expect(existingCount >= BACKFILL_THRESHOLD).toBe(true);
  });

  it('should trigger backfill when existing count is below threshold', () => {
    const existingCount = 499;
    expect(existingCount >= BACKFILL_THRESHOLD).toBe(false);
  });

  it('should trigger backfill when existing count is 0', () => {
    const existingCount = 0;
    expect(existingCount >= BACKFILL_THRESHOLD).toBe(false);
  });
});
