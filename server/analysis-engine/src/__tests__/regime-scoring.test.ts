import {
  calculateADX,
  calculateHurstExponent,
  calculateChoppinessIndex,
  calculateEfficiencyRatio,
  calculateRegimeScore,
  ADXResult,
  RegimeScore,
} from '../regime/scoring';

// ---------------------------------------------------------------------------
// Helper: generate synthetic price data
// ---------------------------------------------------------------------------

/** Creates a steadily rising price series (strong uptrend). */
function generateUptrend(length: number, start = 100, step = 2): number[] {
  return Array.from({ length }, (_, i) => start + i * step);
}

/** Creates a steadily falling price series (strong downtrend). */
function generateDowntrend(length: number, start = 200, step = 2): number[] {
  return Array.from({ length }, (_, i) => start - i * step);
}

/** Creates a flat / sideways price series with small noise. */
function generateFlat(length: number, center = 100): number[] {
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    result.push(center + (i % 2 === 0 ? 0.5 : -0.5));
  }
  return result;
}

/** Creates a zigzag series that oscillates up and down. */
function generateZigzag(length: number, center = 100, amplitude = 10): number[] {
  return Array.from({ length }, (_, i) =>
    i % 2 === 0 ? center + amplitude : center - amplitude,
  );
}

/** Derives highs and lows from closes with a fixed spread. */
function deriveHLC(closes: number[], spread = 2) {
  return {
    highs: closes.map((c) => c + spread),
    lows: closes.map((c) => c - spread),
    closes,
  };
}

// ---------------------------------------------------------------------------
// calculateADX
// ---------------------------------------------------------------------------
describe('calculateADX', () => {
  it('returns high ADX (>25) for a strong uptrend', () => {
    const closes = generateUptrend(60);
    const { highs, lows } = deriveHLC(closes, 1);
    const result = calculateADX(highs, lows, closes);
    expect(result.adx).toBeGreaterThan(25);
  });

  it('returns low ADX (<25) for flat data', () => {
    const closes = generateFlat(60);
    const { highs, lows } = deriveHLC(closes, 0.5);
    const result = calculateADX(highs, lows, closes);
    expect(result.adx).toBeLessThan(25);
  });

  it('returns default result { adx: 20, plusDI: 0, minusDI: 0 } for insufficient data', () => {
    const closes = [100, 101, 102, 103, 104];
    const { highs, lows } = deriveHLC(closes);
    const result = calculateADX(highs, lows, closes);
    expect(result).toEqual({ adx: 20, plusDI: 0, minusDI: 0 });
  });

  it('+DI > -DI for an uptrend', () => {
    const closes = generateUptrend(60);
    const { highs, lows } = deriveHLC(closes, 1);
    const result = calculateADX(highs, lows, closes);
    expect(result.plusDI).toBeGreaterThan(result.minusDI);
  });

  it('-DI > +DI for a downtrend', () => {
    const closes = generateDowntrend(60);
    const { highs, lows } = deriveHLC(closes, 1);
    const result = calculateADX(highs, lows, closes);
    expect(result.minusDI).toBeGreaterThan(result.plusDI);
  });

  it('ADX is a non-negative number', () => {
    const closes = generateUptrend(60);
    const { highs, lows } = deriveHLC(closes, 1);
    const result = calculateADX(highs, lows, closes);
    expect(result.adx).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// calculateHurstExponent
// ---------------------------------------------------------------------------
describe('calculateHurstExponent', () => {
  it('returns >0.5 for trending data', () => {
    const closes = generateUptrend(256, 100, 1);
    const hurst = calculateHurstExponent(closes);
    expect(hurst).toBeGreaterThan(0.5);
  });

  it('returns approximately 0.5 for random-walk-like data', () => {
    // Pseudo-random but deterministic series
    const closes: number[] = [100];
    let seed = 42;
    for (let i = 1; i < 256; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const change = ((seed % 200) - 100) / 100; // -1..1
      closes.push(Math.max(1, closes[i - 1] + change));
    }
    const hurst = calculateHurstExponent(closes);
    // Should be roughly around 0.5 (within a tolerance)
    expect(hurst).toBeGreaterThanOrEqual(0.3);
    expect(hurst).toBeLessThanOrEqual(0.7);
  });

  it('returns <0.5 for mean-reverting data', () => {
    // Alternating up/down — strong mean reversion
    const closes: number[] = [];
    for (let i = 0; i < 256; i++) {
      closes.push(100 + (i % 2 === 0 ? 5 : -5));
    }
    const hurst = calculateHurstExponent(closes);
    expect(hurst).toBeLessThan(0.5);
  });

  it('returns 0.5 for insufficient data (< 32 points)', () => {
    const closes = [100, 101, 102, 103, 104];
    expect(calculateHurstExponent(closes)).toBe(0.5);
  });

  it('returns 0.5 for empty array', () => {
    expect(calculateHurstExponent([])).toBe(0.5);
  });

  it('result is clamped between 0 and 1', () => {
    const closes = generateUptrend(256);
    const hurst = calculateHurstExponent(closes);
    expect(hurst).toBeGreaterThanOrEqual(0);
    expect(hurst).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// calculateChoppinessIndex
// ---------------------------------------------------------------------------
describe('calculateChoppinessIndex', () => {
  it('returns low CI (<50) for a strongly trending market', () => {
    const closes = generateUptrend(30, 100, 5);
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 1);
    const ci = calculateChoppinessIndex(highs, lows, closes);
    expect(ci).toBeLessThan(50);
  });

  it('returns high CI (>50) for a choppy market', () => {
    const closes = generateZigzag(30, 100, 5);
    const highs = closes.map((c) => c + 6);
    const lows = closes.map((c) => c - 6);
    const ci = calculateChoppinessIndex(highs, lows, closes);
    expect(ci).toBeGreaterThan(50);
  });

  it('returns 50 for insufficient data', () => {
    const ci = calculateChoppinessIndex([100, 101], [99, 100], [99.5, 100.5]);
    expect(ci).toBe(50);
  });

  it('CI is clamped between 0 and 100', () => {
    const closes = generateUptrend(30);
    const { highs, lows } = deriveHLC(closes, 1);
    const ci = calculateChoppinessIndex(highs, lows, closes);
    expect(ci).toBeGreaterThanOrEqual(0);
    expect(ci).toBeLessThanOrEqual(100);
  });

  it('returns 50 when range is zero (all same highs and lows)', () => {
    const closes = Array(20).fill(100);
    const highs = Array(20).fill(100);
    const lows = Array(20).fill(100);
    const ci = calculateChoppinessIndex(highs, lows, closes);
    expect(ci).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// calculateEfficiencyRatio
// ---------------------------------------------------------------------------
describe('calculateEfficiencyRatio', () => {
  it('returns ~1.0 for a straight line (perfect trend)', () => {
    const closes = generateUptrend(20, 100, 1);
    const er = calculateEfficiencyRatio(closes);
    expect(er).toBeGreaterThan(0.95);
    expect(er).toBeLessThanOrEqual(1.0);
  });

  it('returns close to 0 for a zigzag (no net direction)', () => {
    const closes = generateZigzag(20, 100, 5);
    const er = calculateEfficiencyRatio(closes);
    expect(er).toBeLessThan(0.15);
  });

  it('returns 0.5 for insufficient data', () => {
    const er = calculateEfficiencyRatio([100, 101], 10);
    expect(er).toBe(0.5);
  });

  it('returns 0 when all prices are the same (zero volatility)', () => {
    const closes = Array(20).fill(100);
    const er = calculateEfficiencyRatio(closes);
    expect(er).toBe(0);
  });

  it('ER is between 0 and 1', () => {
    const closes = generateUptrend(50);
    const er = calculateEfficiencyRatio(closes);
    expect(er).toBeGreaterThanOrEqual(0);
    expect(er).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// calculateRegimeScore — integration
// ---------------------------------------------------------------------------
describe('calculateRegimeScore', () => {
  it('score is in range 1-100', () => {
    const closes = generateUptrend(60);
    const { highs, lows } = deriveHLC(closes);
    const result = calculateRegimeScore(highs, lows, closes);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns a valid label for trending data', () => {
    const closes = generateUptrend(60);
    const { highs, lows } = deriveHLC(closes);
    const result = calculateRegimeScore(highs, lows, closes);
    const validLabels = ['strong_trend', 'trending', 'transitional', 'choppy', 'mean_reversion'];
    expect(validLabels).toContain(result.label);
  });

  it('detects bullish direction for an uptrend', () => {
    const closes = generateUptrend(60, 100, 3);
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 1);
    const result = calculateRegimeScore(highs, lows, closes);
    expect(result.direction).toBe('bullish');
  });

  it('detects bearish direction for a downtrend', () => {
    const closes = generateDowntrend(60, 300, 3);
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 1);
    const result = calculateRegimeScore(highs, lows, closes);
    expect(result.direction).toBe('bearish');
  });

  it('strategy recommendations are populated', () => {
    const closes = generateUptrend(60);
    const { highs, lows } = deriveHLC(closes);
    const result = calculateRegimeScore(highs, lows, closes);
    expect(result.strategies.recommended.length).toBeGreaterThan(0);
    expect(result.strategies.avoid.length).toBeGreaterThan(0);
  });

  it('confidence is in range 20-95', () => {
    const closes = generateUptrend(60);
    const { highs, lows } = deriveHLC(closes);
    const result = calculateRegimeScore(highs, lows, closes);
    expect(result.confidence).toBeGreaterThanOrEqual(20);
    expect(result.confidence).toBeLessThanOrEqual(95);
  });

  it('components are populated with numeric values', () => {
    const closes = generateUptrend(60);
    const { highs, lows } = deriveHLC(closes);
    const result = calculateRegimeScore(highs, lows, closes);
    expect(typeof result.components.adx).toBe('number');
    expect(typeof result.components.hurst).toBe('number');
    expect(typeof result.components.choppiness).toBe('number');
    expect(typeof result.components.efficiencyRatio).toBe('number');
  });

  it('flat data produces a lower score than trending data', () => {
    const trendCloses = generateUptrend(60, 100, 3);
    const trendHLC = deriveHLC(trendCloses, 1);
    const trendResult = calculateRegimeScore(trendHLC.highs, trendHLC.lows, trendHLC.closes);

    const flatCloses = generateFlat(60, 100);
    const flatHLC = deriveHLC(flatCloses, 0.5);
    const flatResult = calculateRegimeScore(flatHLC.highs, flatHLC.lows, flatHLC.closes);

    expect(trendResult.score).toBeGreaterThan(flatResult.score);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('calculateADX with empty arrays returns default', () => {
    expect(calculateADX([], [], [])).toEqual({ adx: 20, plusDI: 0, minusDI: 0 });
  });

  it('calculateADX with single element returns default', () => {
    expect(calculateADX([100], [99], [99.5])).toEqual({ adx: 20, plusDI: 0, minusDI: 0 });
  });

  it('calculateEfficiencyRatio with single element returns 0.5', () => {
    expect(calculateEfficiencyRatio([100])).toBe(0.5);
  });

  it('calculateRegimeScore with very short data still returns valid result', () => {
    const result = calculateRegimeScore([100, 101, 102], [99, 100, 101], [99.5, 100.5, 101.5]);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.strategies.recommended.length).toBeGreaterThan(0);
  });

  it('calculateHurstExponent with all same values returns 0.5', () => {
    const closes = Array(64).fill(100);
    // All same values means log returns are 0, std is 0, so subseries skipped
    expect(calculateHurstExponent(closes)).toBe(0.5);
  });
});
