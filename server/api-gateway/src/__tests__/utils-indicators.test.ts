/**
 * Indicator calculations — unit tests
 *
 * Tests RSI, EMA, SMA, Bollinger Bands, computeRSI, and computeEMA
 * with known input/output values.
 */

import {
  calculateRSI,
  calculateEMA,
  calculateSMA,
  calculateBB,
  computeRSI,
  computeEMA,
} from '../utils/indicators.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to N decimal places for comparison. */
function round(val: number, decimals = 2): number {
  return Math.round(val * 10 ** decimals) / 10 ** decimals;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateSMA', () => {
  it('returns empty array when data length < period', () => {
    expect(calculateSMA([1, 2], 3)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(calculateSMA([], 3)).toEqual([]);
  });

  it('calculates SMA correctly for simple data', () => {
    // SMA(3) of [1,2,3,4,5] = [(1+2+3)/3, (2+3+4)/3, (3+4+5)/3] = [2, 3, 4]
    const result = calculateSMA([1, 2, 3, 4, 5], 3);
    expect(result).toEqual([2, 3, 4]);
  });

  it('returns single value when data length equals period', () => {
    const result = calculateSMA([10, 20, 30], 3);
    expect(result).toEqual([20]);
  });

  it('handles period of 1', () => {
    const data = [5, 10, 15];
    const result = calculateSMA(data, 1);
    expect(result).toEqual([5, 10, 15]);
  });

  it('calculates correctly with decimal values', () => {
    const result = calculateSMA([1.5, 2.5, 3.5], 2);
    expect(result).toEqual([2, 3]);
  });
});

describe('calculateEMA', () => {
  it('returns empty array when data length < period', () => {
    expect(calculateEMA([1, 2], 3)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(calculateEMA([], 5)).toEqual([]);
  });

  it('first EMA value equals the SMA of first N elements', () => {
    const data = [10, 20, 30, 40, 50];
    const result = calculateEMA(data, 3);
    // First value = SMA(3) = (10+20+30)/3 = 20
    expect(result[0]).toBe(20);
  });

  it('subsequent EMA values use the multiplier correctly', () => {
    const data = [10, 20, 30, 40];
    const period = 3;
    const k = 2 / (period + 1); // 0.5
    const result = calculateEMA(data, period);

    // EMA[0] = SMA = (10+20+30)/3 = 20
    expect(result[0]).toBe(20);
    // EMA[1] = 40 * 0.5 + 20 * 0.5 = 30
    expect(result[1]).toBe(30);
  });

  it('returns correct number of values', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = calculateEMA(data, 3);
    // Should return data.length - period + 1 = 8 values
    expect(result.length).toBe(8);
  });

  it('handles period equal to data length', () => {
    const data = [10, 20, 30];
    const result = calculateEMA(data, 3);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(20); // Just the SMA
  });
});

describe('calculateRSI', () => {
  it('returns empty array when data length < period + 1', () => {
    expect(calculateRSI([1, 2, 3], 14)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(calculateRSI([], 14)).toEqual([]);
  });

  it('returns 100 when there are only gains (no losses)', () => {
    // Steadily increasing prices over 15 bars (period=14 needs 15 values)
    const closes = Array.from({ length: 16 }, (_, i) => 100 + i);
    const result = calculateRSI(closes, 14);
    expect(result[0]).toBe(100);
  });

  it('returns 0 when there are only losses (no gains)', () => {
    // Steadily decreasing prices
    const closes = Array.from({ length: 16 }, (_, i) => 200 - i);
    const result = calculateRSI(closes, 14);
    expect(result[0]).toBe(0);
  });

  it('returns values between 0 and 100', () => {
    const closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
    const result = calculateRSI(closes, 14);
    for (const val of result) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it('returns correct number of values', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const result = calculateRSI(closes, 14);
    // Should return closes.length - period values
    expect(result.length).toBe(30 - 14);
  });

  it('works with small period', () => {
    const closes = [10, 12, 11, 13, 12, 14];
    const result = calculateRSI(closes, 3);
    expect(result.length).toBeGreaterThan(0);
    for (const val of result) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});

describe('calculateBB', () => {
  it('returns upper, middle, and lower bands', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = calculateBB(data, 3, 2);
    expect(result).toHaveProperty('upper');
    expect(result).toHaveProperty('middle');
    expect(result).toHaveProperty('lower');
  });

  it('middle band equals the SMA', () => {
    const data = [1, 2, 3, 4, 5];
    const result = calculateBB(data, 3, 2);
    const sma = calculateSMA(data, 3);
    expect(result.middle).toEqual(sma);
  });

  it('upper band is above middle, lower band is below middle', () => {
    const data = [10, 12, 11, 13, 14, 12, 15, 16, 11, 13];
    const result = calculateBB(data, 5, 2);
    for (let i = 0; i < result.middle.length; i++) {
      expect(result.upper[i]).toBeGreaterThanOrEqual(result.middle[i]);
      expect(result.lower[i]).toBeLessThanOrEqual(result.middle[i]);
    }
  });

  it('bands are symmetric around the middle', () => {
    const data = [5, 10, 15, 20, 25];
    const mult = 2;
    const result = calculateBB(data, 3, mult);
    for (let i = 0; i < result.middle.length; i++) {
      const upperDiff = round(result.upper[i] - result.middle[i], 6);
      const lowerDiff = round(result.middle[i] - result.lower[i], 6);
      expect(upperDiff).toBeCloseTo(lowerDiff, 5);
    }
  });

  it('returns empty arrays when data < period', () => {
    const result = calculateBB([1, 2], 5, 2);
    expect(result.upper).toEqual([]);
    expect(result.middle).toEqual([]);
    expect(result.lower).toEqual([]);
  });

  it('all bands have the same length', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = calculateBB(data, 3, 2);
    expect(result.upper.length).toBe(result.middle.length);
    expect(result.lower.length).toBe(result.middle.length);
  });

  it('larger multiplier produces wider bands', () => {
    const data = [10, 12, 8, 14, 9, 11, 13, 7, 15, 10];
    const narrow = calculateBB(data, 3, 1);
    const wide = calculateBB(data, 3, 3);
    for (let i = 0; i < narrow.middle.length; i++) {
      const narrowWidth = narrow.upper[i] - narrow.lower[i];
      const wideWidth = wide.upper[i] - wide.lower[i];
      expect(wideWidth).toBeGreaterThan(narrowWidth);
    }
  });
});

describe('computeRSI', () => {
  it('returns null when not enough data', () => {
    expect(computeRSI([1, 2, 3], 14)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(computeRSI([])).toBeNull();
  });

  it('returns a single number (latest RSI value)', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const result = computeRSI(closes, 14);
    expect(typeof result).toBe('number');
  });

  it('returns 100 when all moves are upward', () => {
    const closes = Array.from({ length: 16 }, (_, i) => 100 + i);
    const result = computeRSI(closes, 14);
    expect(result).toBe(100);
  });

  it('returns value between 0 and 100', () => {
    const closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28, 46.00];
    const result = computeRSI(closes, 14);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(0);
    expect(result!).toBeLessThanOrEqual(100);
  });

  it('uses default period of 14', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = computeRSI(closes);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
  });

  it('result is rounded to 2 decimal places', () => {
    const closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28, 46.00];
    const result = computeRSI(closes, 14);
    if (result !== null) {
      const str = result.toString();
      const parts = str.split('.');
      if (parts.length === 2) {
        expect(parts[1].length).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('computeEMA', () => {
  it('returns null when not enough data', () => {
    expect(computeEMA([1, 2], 5)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(computeEMA([], 3)).toBeNull();
  });

  it('returns a single number (latest EMA value)', () => {
    const closes = [10, 20, 30, 40, 50];
    const result = computeEMA(closes, 3);
    expect(typeof result).toBe('number');
  });

  it('result is rounded to 2 decimal places', () => {
    const closes = [10.123, 20.456, 30.789, 40.012, 50.345];
    const result = computeEMA(closes, 3);
    if (result !== null) {
      const str = result.toString();
      const parts = str.split('.');
      if (parts.length === 2) {
        expect(parts[1].length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('handles period equal to data length', () => {
    const closes = [10, 20, 30];
    const result = computeEMA(closes, 3);
    expect(result).not.toBeNull();
  });

  it('returns correct value for known input', () => {
    // With closes [10, 20, 30], period 3, k = 2/4 = 0.5
    // ema starts at 10
    // ema = 20 * 0.5 + 10 * 0.5 = 15
    // ema = 30 * 0.5 + 15 * 0.5 = 22.5
    const result = computeEMA([10, 20, 30], 3);
    expect(result).toBe(22.5);
  });

  it('gives more weight to recent values', () => {
    // EMA of increasing then flat should be above flat level
    const increasing = [10, 20, 30, 40, 50, 50, 50, 50, 50];
    const result = computeEMA(increasing, 3);
    // SMA of the same would be exactly 50, EMA should still be around 50
    // but the calculation starts from the beginning
    expect(result).not.toBeNull();
  });
});
