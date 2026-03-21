/**
 * Pattern detection tests.
 *
 * Candlestick detection (candlestick.ts) relies on `technicalindicators`,
 * which we mock to isolate the detection logic.
 *
 * Support/Resistance detection (chart.ts) is pure math — no mocks needed.
 */

// ---------------------------------------------------------------------------
// Mock technicalindicators so that candlestick.ts compiles without the
// real library's type issues (hammer / invertedhammer are mis-exported).
// ---------------------------------------------------------------------------
const mockBullishEngulfing = jest.fn().mockReturnValue(false);
const mockBearishEngulfing = jest.fn().mockReturnValue(false);
const mockDoji = jest.fn().mockReturnValue(false);
const mockHammer = jest.fn().mockReturnValue(false);
const mockHangingMan = jest.fn().mockReturnValue(false);
const mockShootingStar = jest.fn().mockReturnValue(false);
const mockMorningStar = jest.fn().mockReturnValue(false);
const mockEveningStar = jest.fn().mockReturnValue(false);
const mockInvertedHammer = jest.fn().mockReturnValue(false);

jest.mock('technicalindicators', () => ({
  bullishengulfingpattern: (...args: any[]) => mockBullishEngulfing(...args),
  bearishengulfingpattern: (...args: any[]) => mockBearishEngulfing(...args),
  doji: (...args: any[]) => mockDoji(...args),
  hammer: (...args: any[]) => mockHammer(...args),
  hangingman: (...args: any[]) => mockHangingMan(...args),
  shootingstar: (...args: any[]) => mockShootingStar(...args),
  morningstar: (...args: any[]) => mockMorningStar(...args),
  eveningstar: (...args: any[]) => mockEveningStar(...args),
  invertedhammer: (...args: any[]) => mockInvertedHammer(...args),
}));

import { detectCandlestickPatterns, CandleInput } from '../patterns/candlestick';
import { detectSupportResistance } from '../patterns/chart';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset all pattern mocks to return false by default
  mockBullishEngulfing.mockReturnValue(false);
  mockBearishEngulfing.mockReturnValue(false);
  mockDoji.mockReturnValue(false);
  mockHammer.mockReturnValue(false);
  mockHangingMan.mockReturnValue(false);
  mockShootingStar.mockReturnValue(false);
  mockMorningStar.mockReturnValue(false);
  mockEveningStar.mockReturnValue(false);
  mockInvertedHammer.mockReturnValue(false);
});

// ---------------------------------------------------------------------------
// Candlestick Pattern Detection
// ---------------------------------------------------------------------------
describe('detectCandlestickPatterns', () => {
  it('returns empty array for empty input', () => {
    expect(detectCandlestickPatterns([])).toEqual([]);
  });

  it('detects a Doji when the library reports one', () => {
    mockDoji.mockReturnValue(true);
    const candles: CandleInput[] = [
      { open: 100, high: 105, low: 95, close: 100.1 },
    ];
    const results = detectCandlestickPatterns(candles);
    const dojiResults = results.filter((r) => r.name === 'Doji');
    expect(dojiResults.length).toBeGreaterThanOrEqual(1);
    expect(dojiResults[0].type).toBe('neutral');
  });

  it('detects a Hammer when the library reports one', () => {
    mockHammer.mockReturnValue(true);
    const candles: CandleInput[] = [
      { open: 100, high: 101, low: 90, close: 101 },
    ];
    const results = detectCandlestickPatterns(candles);
    const hammers = results.filter((r) => r.name === 'Hammer');
    expect(hammers.length).toBeGreaterThanOrEqual(1);
    expect(hammers[0].type).toBe('bullish');
    expect(hammers[0].confidence).toBe(0.7);
  });

  it('detects a BullishEngulfing when the library reports one', () => {
    mockBullishEngulfing.mockReturnValue(true);
    const candles: CandleInput[] = [
      { open: 110, high: 112, low: 100, close: 102 },
      { open: 99, high: 115, low: 98, close: 114 },
    ];
    const results = detectCandlestickPatterns(candles);
    const bullish = results.filter((r) => r.name === 'BullishEngulfing');
    expect(bullish.length).toBeGreaterThanOrEqual(1);
    expect(bullish[0].type).toBe('bullish');
    expect(bullish[0].confidence).toBe(0.75);
  });

  it('detects a BearishEngulfing when the library reports one', () => {
    mockBearishEngulfing.mockReturnValue(true);
    const candles: CandleInput[] = [
      { open: 100, high: 112, low: 99, close: 110 },
      { open: 113, high: 114, low: 97, close: 98 },
    ];
    const results = detectCandlestickPatterns(candles);
    const bearish = results.filter((r) => r.name === 'BearishEngulfing');
    expect(bearish.length).toBeGreaterThanOrEqual(1);
    expect(bearish[0].type).toBe('bearish');
  });

  it('detects MorningStar (3-candle bullish pattern)', () => {
    mockMorningStar.mockReturnValue(true);
    const candles: CandleInput[] = [
      { open: 110, high: 112, low: 100, close: 101 },
      { open: 101, high: 102, low: 98, close: 99 },
      { open: 99, high: 112, low: 98, close: 111 },
    ];
    const results = detectCandlestickPatterns(candles);
    const ms = results.filter((r) => r.name === 'MorningStar');
    expect(ms.length).toBeGreaterThanOrEqual(1);
    expect(ms[0].type).toBe('bullish');
    expect(ms[0].confidence).toBe(0.8);
  });

  it('detects EveningStar (3-candle bearish pattern)', () => {
    mockEveningStar.mockReturnValue(true);
    const candles: CandleInput[] = [
      { open: 100, high: 112, low: 99, close: 110 },
      { open: 110, high: 113, low: 109, close: 112 },
      { open: 112, high: 113, low: 100, close: 101 },
    ];
    const results = detectCandlestickPatterns(candles);
    const es = results.filter((r) => r.name === 'EveningStar');
    expect(es.length).toBeGreaterThanOrEqual(1);
    expect(es[0].type).toBe('bearish');
    expect(es[0].confidence).toBe(0.8);
  });

  it('all detected patterns have required fields', () => {
    // Make several detectors return true
    mockDoji.mockReturnValue(true);
    mockBullishEngulfing.mockReturnValue(true);
    const candles: CandleInput[] = [
      { open: 110, high: 112, low: 100, close: 102 },
      { open: 99, high: 115, low: 98, close: 114 },
      { open: 115, high: 120, low: 114, close: 119 },
    ];
    const results = detectCandlestickPatterns(candles);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('type');
      expect(r).toHaveProperty('confidence');
      expect(r).toHaveProperty('index');
      expect(['bullish', 'bearish', 'neutral']).toContain(r.type);
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
      expect(r.index).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles a single candle without error', () => {
    const candles: CandleInput[] = [
      { open: 100, high: 105, low: 95, close: 103 },
    ];
    expect(() => detectCandlestickPatterns(candles)).not.toThrow();
  });

  it('handles candles with equal OHLC (flat candle)', () => {
    const candles: CandleInput[] = [
      { open: 100, high: 100, low: 100, close: 100 },
      { open: 100, high: 100, low: 100, close: 100 },
    ];
    expect(() => detectCandlestickPatterns(candles)).not.toThrow();
  });

  it('returns no patterns when no detector fires', () => {
    // All mocks return false (default)
    const candles: CandleInput[] = [
      { open: 100, high: 105, low: 95, close: 103 },
      { open: 103, high: 108, low: 100, close: 106 },
    ];
    const results = detectCandlestickPatterns(candles);
    expect(results).toEqual([]);
  });

  it('gracefully handles detector throwing an error', () => {
    mockDoji.mockImplementation(() => { throw new Error('detector error'); });
    const candles: CandleInput[] = [
      { open: 100, high: 105, low: 95, close: 103 },
    ];
    // Should not throw — errors are caught internally
    expect(() => detectCandlestickPatterns(candles)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Support & Resistance Detection
// ---------------------------------------------------------------------------
describe('detectSupportResistance', () => {
  it('returns empty arrays for insufficient data (<5 candles)', () => {
    const candles: CandleInput[] = [
      { open: 100, high: 105, low: 95, close: 103 },
      { open: 103, high: 108, low: 100, close: 106 },
    ];
    const result = detectSupportResistance(candles);
    expect(result.supports).toEqual([]);
    expect(result.resistances).toEqual([]);
  });

  it('detects resistance levels at local highs', () => {
    const candles: CandleInput[] = [];
    // Create a pattern where index 5 and 10 are local highs (resistance)
    const highs = [100, 101, 99, 98, 99, 110, 99, 98, 99, 98, 110, 99, 98, 99, 100];
    for (let i = 0; i < highs.length; i++) {
      candles.push({
        open: highs[i] - 2,
        high: highs[i],
        low: highs[i] - 5,
        close: highs[i] - 1,
      });
    }
    const result = detectSupportResistance(candles, 2);
    expect(result.resistances.length).toBeGreaterThanOrEqual(1);
    if (result.resistances.length > 0) {
      expect(result.resistances[0]).toBeCloseTo(110, 0);
    }
  });

  it('detects support levels at local lows', () => {
    const candles: CandleInput[] = [];
    const lows = [100, 99, 101, 102, 101, 90, 101, 102, 101, 102, 90, 101, 102, 101, 100];
    for (let i = 0; i < lows.length; i++) {
      candles.push({
        open: lows[i] + 2,
        high: lows[i] + 5,
        low: lows[i],
        close: lows[i] + 1,
      });
    }
    const result = detectSupportResistance(candles, 2);
    expect(result.supports.length).toBeGreaterThanOrEqual(1);
    if (result.supports.length > 0) {
      expect(result.supports[0]).toBeCloseTo(90, 0);
    }
  });

  it('returns empty when no level has enough touches', () => {
    const candles: CandleInput[] = [];
    for (let i = 0; i < 20; i++) {
      const price = 100 + i * 10;
      candles.push({
        open: price,
        high: price + 2,
        low: price - 2,
        close: price + 1,
      });
    }
    const result = detectSupportResistance(candles, 2);
    expect(result.supports).toEqual([]);
  });

  it('handles flat price data without errors', () => {
    const candles: CandleInput[] = Array(20).fill({
      open: 100,
      high: 100,
      low: 100,
      close: 100,
    });
    expect(() => detectSupportResistance(candles)).not.toThrow();
    const result = detectSupportResistance(candles);
    expect(result.supports).toEqual([]);
    expect(result.resistances).toEqual([]);
  });

  it('with touchCount=1, returns at least as many levels as touchCount=2', () => {
    const candles: CandleInput[] = [];
    const prices = [100, 102, 104, 108, 115, 108, 104, 102, 100, 98, 96];
    for (const p of prices) {
      candles.push({ open: p - 1, high: p + 1, low: p - 2, close: p });
    }
    const oneTouch = detectSupportResistance(candles, 1);
    const twoTouch = detectSupportResistance(candles, 2);
    expect(
      oneTouch.resistances.length + oneTouch.supports.length,
    ).toBeGreaterThanOrEqual(
      twoTouch.resistances.length + twoTouch.supports.length,
    );
  });

  it('exactly 5 candles is the minimum for detection', () => {
    const candles: CandleInput[] = [
      { open: 100, high: 102, low: 98, close: 101 },
      { open: 101, high: 103, low: 99, close: 100 },
      { open: 100, high: 105, low: 97, close: 104 },
      { open: 104, high: 106, low: 102, close: 103 },
      { open: 103, high: 104, low: 101, close: 102 },
    ];
    // Should not throw and should return valid structure
    const result = detectSupportResistance(candles, 1);
    expect(result).toHaveProperty('supports');
    expect(result).toHaveProperty('resistances');
  });
});
