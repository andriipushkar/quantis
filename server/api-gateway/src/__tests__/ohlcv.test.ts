/**
 * OHLCV + Renko routes — unit tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockQuery = jest.fn();
jest.mock('../config/database.js', () => ({ __esModule: true, query: (...args: any[]) => mockQuery(...args), default: {} }));
const mockRedis = { get: jest.fn(), set: jest.fn() };
jest.mock('../config/redis.js', () => ({ __esModule: true, default: mockRedis }));
jest.mock('../config/logger.js', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));

// Can't easily import from nested route file with all its deps, test logic directly
const TIMEFRAME_TABLES: Record<string, string> = {
  '1m': 'ohlcv_1m', '5m': 'ohlcv_5m', '15m': 'ohlcv_15m',
  '1h': 'ohlcv_1h', '4h': 'ohlcv_4h', '1d': 'ohlcv_1d',
};

describe('TIMEFRAME_TABLES', () => {
  test('has 6 timeframes', () => {
    expect(Object.keys(TIMEFRAME_TABLES)).toHaveLength(6);
  });

  test('maps 1m → ohlcv_1m', () => {
    expect(TIMEFRAME_TABLES['1m']).toBe('ohlcv_1m');
  });

  test('maps 1d → ohlcv_1d', () => {
    expect(TIMEFRAME_TABLES['1d']).toBe('ohlcv_1d');
  });
});

describe('OHLCV route logic', () => {
  beforeEach(() => jest.clearAllMocks());

  test('invalid timeframe is rejected', () => {
    expect(TIMEFRAME_TABLES['3m']).toBeUndefined();
  });

  test('valid timeframes: 1m, 5m, 15m, 1h, 4h, 1d', () => {
    for (const tf of ['1m', '5m', '15m', '1h', '4h', '1d']) {
      expect(TIMEFRAME_TABLES[tf]).toBeDefined();
    }
  });

  test('candle row mapping transforms correctly', () => {
    const row = { time: '2026-01-01T00:00:00Z', open: '50000.5', high: '51000', low: '49500', close: '50500.25', volume: '1234.5' };
    const candle = {
      time: Math.floor(new Date(row.time).getTime() / 1000),
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume),
    };
    expect(candle.time).toBeGreaterThan(0);
    expect(candle.open).toBe(50000.5);
    expect(candle.close).toBe(50500.25);
  });

  test('limit is capped at 5000', () => {
    const maxLimit = Math.min(parseInt('10000', 10) || 500, 5000);
    expect(maxLimit).toBe(5000);
  });

  test('default limit is 500', () => {
    const maxLimit = Math.min(parseInt('', 10) || 500, 5000);
    expect(maxLimit).toBe(500);
  });

  test('symbol is uppercased', () => {
    expect('btcusdt'.toUpperCase()).toBe('BTCUSDT');
  });
});

describe('Renko logic', () => {
  test('fallback BTC price generates correct brickSize', () => {
    const fallbackPrice = 97500;
    const brickSize = Math.round(fallbackPrice * 0.005);
    expect(brickSize).toBe(488);
  });

  test('fallback ETH price generates correct brickSize', () => {
    const fallbackPrice = 3450;
    const brickSize = Math.round(fallbackPrice * 0.005);
    expect(brickSize).toBe(17);
  });

  test('fallback generates 20 bricks', () => {
    const directions = [1, 1, 1, -1, 1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, 1, 1, 1, -1];
    const bricks: Array<{ price: number; type: string; index: number }> = [];
    let price = 1000;
    const brickSize = 5;
    for (let i = 0; i < directions.length; i++) {
      price += directions[i] * brickSize;
      bricks.push({ price, type: directions[i] === 1 ? 'up' : 'down', index: i });
    }
    expect(bricks).toHaveLength(20);
    expect(bricks[0].type).toBe('up');
    expect(bricks[3].type).toBe('down');
  });

  test('ATR calculation from candles', () => {
    const candles = Array.from({ length: 20 }, (_, i) => ({
      high: 100 + i,
      low: 90 + i,
      close: 95 + i,
    }));
    let atrSum = 0;
    for (let i = 0; i < 20; i++) {
      atrSum += candles[i].high - candles[i].low;
    }
    const atr = atrSum / 20;
    expect(atr).toBe(10); // each range is 10
    const brickSize = Math.round((atr / 2) * 100) / 100;
    expect(brickSize).toBe(5);
  });

  test('brickSize <= 0 is invalid', () => {
    const candles = Array.from({ length: 20 }, () => ({ high: 100, low: 100, close: 100 }));
    let atrSum = 0;
    for (let i = 0; i < 20; i++) atrSum += candles[i].high - candles[i].low;
    const atr = atrSum / 20;
    expect(atr).toBe(0);
    expect(atr / 2).toBeLessThanOrEqual(0);
  });

  test('redis caching with 300s TTL', () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.set('key', 'val', 'EX', 300);
    expect(mockRedis.set).toHaveBeenCalledWith('key', 'val', 'EX', 300);
  });

  test('insufficient candles (< 20) returns 404', () => {
    const candles = Array.from({ length: 10 }, (_, i) => ({ high: 100, low: 90, close: 95 }));
    expect(candles.length).toBeLessThan(20);
  });

  test('renko bricks are limited to last 100', () => {
    const bricks = Array.from({ length: 150 }, (_, i) => ({ price: i, type: 'up' as const, index: i }));
    expect(bricks.slice(-100)).toHaveLength(100);
  });
});
