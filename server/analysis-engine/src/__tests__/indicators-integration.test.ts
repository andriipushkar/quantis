/**
 * Integration tests for the indicators module (src/indicators/index.ts).
 *
 * Mocks database and Redis dependencies so tests run without external services.
 */

// ---------------------------------------------------------------------------
// Mock: database
// ---------------------------------------------------------------------------
const mockQuery = jest.fn();
jest.mock('../config/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

// ---------------------------------------------------------------------------
// Mock: Redis
// ---------------------------------------------------------------------------
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
jest.mock('../config/redis', () => ({
  publisherClient: {
    get: (...args: any[]) => mockRedisGet(...args),
    set: (...args: any[]) => mockRedisSet(...args),
  },
}));

// ---------------------------------------------------------------------------
// Mock: logger (suppress output during tests)
// ---------------------------------------------------------------------------
jest.mock('../config/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { calculateAllIndicators, getIndicatorsForPair } from '../indicators/index';

// ---------------------------------------------------------------------------
// Fake OHLCV data generator
// ---------------------------------------------------------------------------
function generateOHLCVRows(count: number) {
  const rows = [];
  const baseTime = new Date('2024-01-01T00:00:00Z');
  for (let i = 0; i < count; i++) {
    const close = 44000 + i * 50 + Math.sin(i / 5) * 200;
    rows.push({
      time: new Date(baseTime.getTime() + i * 3600000).toISOString(),
      open: (close - 20).toString(),
      high: (close + 100).toString(),
      low: (close - 100).toString(),
      close: close.toString(),
      volume: (1000 + i * 10).toString(),
    });
  }
  // Database returns rows in DESC order (query has ORDER BY time DESC)
  return rows.reverse();
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// calculateAllIndicators
// ---------------------------------------------------------------------------
describe('calculateAllIndicators', () => {
  it('returns indicator results with proper structure for valid data', async () => {
    const rows = generateOHLCVRows(100);
    mockQuery
      .mockResolvedValueOnce({ rows }) // fetchOHLCV
      .mockResolvedValueOnce({ rows: [] }); // INSERT INTO indicators
    mockRedisSet.mockResolvedValue('OK');

    const result = await calculateAllIndicators(1, '1h');

    expect(result).not.toBeNull();
    expect(result!.pairId).toBe(1);
    expect(result!.timeframe).toBe('1h');
    expect(result!.timestamp).toBeDefined();
    expect(Array.isArray(result!.sma20)).toBe(true);
    expect(Array.isArray(result!.sma50)).toBe(true);
    expect(Array.isArray(result!.ema9)).toBe(true);
    expect(Array.isArray(result!.ema21)).toBe(true);
    expect(Array.isArray(result!.rsi14)).toBe(true);
    expect(result!.macd).toHaveProperty('macd');
    expect(result!.macd).toHaveProperty('signal');
    expect(result!.macd).toHaveProperty('histogram');
    expect(result!.bollingerBands).toHaveProperty('upper');
    expect(result!.bollingerBands).toHaveProperty('middle');
    expect(result!.bollingerBands).toHaveProperty('lower');
    expect(Array.isArray(result!.atr14)).toBe(true);
    expect(result!.stochastic).toHaveProperty('k');
    expect(result!.stochastic).toHaveProperty('d');
    expect(Array.isArray(result!.obv)).toBe(true);
    expect(Array.isArray(result!.vwap)).toBe(true);
  });

  it('caches results in Redis after calculation', async () => {
    const rows = generateOHLCVRows(100);
    mockQuery
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: [] });
    mockRedisSet.mockResolvedValue('OK');

    await calculateAllIndicators(1, '1h');

    expect(mockRedisSet).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).toHaveBeenCalledWith(
      'indicators:1:1h',
      expect.any(String),
      'EX',
      60,
    );
  });

  it('stores results in the database', async () => {
    const rows = generateOHLCVRows(100);
    mockQuery
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: [] });
    mockRedisSet.mockResolvedValue('OK');

    await calculateAllIndicators(1, '1h');

    // Second query call is the INSERT/UPSERT
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO indicators');
    expect(insertCall[1][0]).toBe(1); // pairId
    expect(insertCall[1][1]).toBe('1h'); // timeframe
  });

  it('returns null for insufficient data (< 2 candles)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { time: '2024-01-01', open: '100', high: '101', low: '99', close: '100', volume: '1000' },
      ],
    });

    const result = await calculateAllIndicators(1, '1h');
    expect(result).toBeNull();
  });

  it('returns null and logs error on database failure', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await calculateAllIndicators(1, '1h');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getIndicatorsForPair
// ---------------------------------------------------------------------------
describe('getIndicatorsForPair', () => {
  const fakeCachedResult = {
    pairId: 1,
    timeframe: '1h',
    timestamp: '2024-01-01T00:00:00Z',
    sma20: [100, 101],
    sma50: [99, 100],
    ema9: [102, 103],
    ema21: [101, 102],
    rsi14: [55, 60],
    macd: { macd: [0.5], signal: [0.3], histogram: [0.2] },
    bollingerBands: { upper: [110], middle: [100], lower: [90] },
    atr14: [5, 6],
    stochastic: { k: [70], d: [65] },
    obv: [10000],
    vwap: [100.5],
  };

  it('returns cached data from Redis on cache hit', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(fakeCachedResult));

    const result = await getIndicatorsForPair(1, '1h', []);
    expect(result).not.toBeNull();
    expect(result!.pairId).toBe(1);
    // Should not call the database at all
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('recalculates on cache miss (Redis returns null)', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    const rows = generateOHLCVRows(100);
    mockQuery
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: [] });
    mockRedisSet.mockResolvedValue('OK');

    const result = await getIndicatorsForPair(1, '1h', []);
    expect(result).not.toBeNull();
    // Should have called the database to fetch OHLCV
    expect(mockQuery).toHaveBeenCalled();
  });

  it('filters to only requested indicators', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(fakeCachedResult));

    const result = await getIndicatorsForPair(1, '1h', ['rsi14', 'macd']);
    expect(result).not.toBeNull();
    expect(result!.rsi14).toEqual(fakeCachedResult.rsi14);
    expect(result!.macd).toEqual(fakeCachedResult.macd);
    // Non-requested indicators should not be present
    expect(result!.sma20).toBeUndefined();
    expect(result!.sma50).toBeUndefined();
    expect(result!.obv).toBeUndefined();
  });

  it('supports alias "rsi" for rsi14', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(fakeCachedResult));

    const result = await getIndicatorsForPair(1, '1h', ['rsi']);
    expect(result!.rsi14).toEqual(fakeCachedResult.rsi14);
  });

  it('supports alias "bb" for bollingerBands', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(fakeCachedResult));

    const result = await getIndicatorsForPair(1, '1h', ['bb']);
    expect(result!.bollingerBands).toEqual(fakeCachedResult.bollingerBands);
  });

  it('supports alias "stoch" for stochastic', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(fakeCachedResult));

    const result = await getIndicatorsForPair(1, '1h', ['stoch']);
    expect(result!.stochastic).toEqual(fakeCachedResult.stochastic);
  });

  it('supports alias "atr" for atr14', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(fakeCachedResult));

    const result = await getIndicatorsForPair(1, '1h', ['atr']);
    expect(result!.atr14).toEqual(fakeCachedResult.atr14);
  });

  it('returns all indicators when empty array is passed', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(fakeCachedResult));

    const result = await getIndicatorsForPair(1, '1h', []);
    expect(result!.sma20).toBeDefined();
    expect(result!.rsi14).toBeDefined();
    expect(result!.macd).toBeDefined();
  });

  it('supports "obv" filter', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(fakeCachedResult));

    const result = await getIndicatorsForPair(1, '1h', ['obv']);
    expect(result!.obv).toEqual(fakeCachedResult.obv);
    expect(result!.sma20).toBeUndefined();
  });

  it('supports "vwap" filter', async () => {
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(fakeCachedResult));

    const result = await getIndicatorsForPair(1, '1h', ['vwap']);
    expect(result!.vwap).toEqual(fakeCachedResult.vwap);
    expect(result!.sma20).toBeUndefined();
  });

  it('returns null on error', async () => {
    mockRedisGet.mockRejectedValueOnce(new Error('Redis down'));

    const result = await getIndicatorsForPair(1, '1h', []);
    expect(result).toBeNull();
  });
});
