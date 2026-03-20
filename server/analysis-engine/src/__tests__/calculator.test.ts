import { IndicatorCalculator } from '../indicators/calculator';

const calc = new IndicatorCalculator();

// ---------------------------------------------------------------------------
// Test data — 20 synthetic close prices loosely modelled on a crypto swing
// ---------------------------------------------------------------------------
const closes20 = [
  44100, 44250, 44050, 43900, 44300, 44600, 44550, 44400, 44700, 44900,
  45100, 45000, 44800, 44650, 44700, 44850, 45000, 45200, 45400, 45350,
];

const highs20 = closes20.map((c) => c + 150);
const lows20 = closes20.map((c) => c - 150);

// ---------------------------------------------------------------------------
// RSI
// ---------------------------------------------------------------------------
describe('RSI', () => {
  it('returns values for sufficient data (period 14)', () => {
    const result = calc.calculateRSI(closes20, 14);
    // With 20 data points and period 14 we need at least 15 values,
    // so we should get some RSI output.
    expect(result.length).toBeGreaterThan(0);
  });

  it('RSI values are between 0 and 100', () => {
    const result = calc.calculateRSI(closes20, 14);
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('returns empty array when data is insufficient', () => {
    const shortData = [100, 200, 300];
    expect(calc.calculateRSI(shortData, 14)).toEqual([]);
  });

  it('produces known approximate value for trending-up data', () => {
    // Monotonically increasing — RSI should be high (close to 100)
    const up = Array.from({ length: 30 }, (_, i) => 100 + i * 10);
    const result = calc.calculateRSI(up, 14);
    const last = result[result.length - 1];
    expect(last).toBeGreaterThan(90);
  });

  it('produces known approximate value for trending-down data', () => {
    const down = Array.from({ length: 30 }, (_, i) => 1000 - i * 10);
    const result = calc.calculateRSI(down, 14);
    const last = result[result.length - 1];
    expect(last).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// EMA
// ---------------------------------------------------------------------------
describe('EMA', () => {
  it('calculates EMA with period 9 on 20 data points', () => {
    const result = calc.calculateEMA(closes20, 9);
    expect(result.length).toBeGreaterThan(0);
    // EMA length should be values.length - period + 1
    expect(result.length).toBe(closes20.length - 9 + 1);
  });

  it('returns empty array when data is shorter than period', () => {
    expect(calc.calculateEMA([100, 200], 9)).toEqual([]);
  });

  it('EMA of constant values equals that constant', () => {
    const flat = Array(20).fill(500);
    const result = calc.calculateEMA(flat, 9);
    result.forEach((v) => {
      expect(v).toBeCloseTo(500, 5);
    });
  });
});

// ---------------------------------------------------------------------------
// SMA
// ---------------------------------------------------------------------------
describe('SMA', () => {
  it('SMA with period 20 matches manual calculation', () => {
    const result = calc.calculateSMA(closes20, 20);
    // With exactly 20 data points and period 20 we get one value
    expect(result.length).toBe(1);

    const manualAvg = closes20.reduce((a, b) => a + b, 0) / 20;
    expect(result[0]).toBeCloseTo(manualAvg, 2);
  });

  it('SMA with period 5 produces correct number of values', () => {
    const result = calc.calculateSMA(closes20, 5);
    expect(result.length).toBe(closes20.length - 5 + 1);
  });

  it('returns empty array when data is shorter than period', () => {
    expect(calc.calculateSMA([100], 5)).toEqual([]);
  });

  it('first SMA value equals average of first N elements', () => {
    const result = calc.calculateSMA(closes20, 5);
    const firstFiveAvg = closes20.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    expect(result[0]).toBeCloseTo(firstFiveAvg, 2);
  });
});

// ---------------------------------------------------------------------------
// ATR
// ---------------------------------------------------------------------------
describe('ATR', () => {
  it('returns values for valid OHLC data', () => {
    const result = calc.calculateATR(highs20, lows20, closes20, 14);
    expect(result.length).toBeGreaterThan(0);
  });

  it('ATR values are positive', () => {
    const result = calc.calculateATR(highs20, lows20, closes20, 14);
    result.forEach((v) => {
      expect(v).toBeGreaterThan(0);
    });
  });

  it('returns empty when data is insufficient', () => {
    expect(calc.calculateATR([100], [90], [95], 14)).toEqual([]);
  });

  it('ATR of constant-range candles approximates the range', () => {
    // All candles have the same high-low spread of 300
    const h = Array(30).fill(1300);
    const l = Array(30).fill(1000);
    const c = Array(30).fill(1150);
    const result = calc.calculateATR(h, l, c, 14);
    // True range for constant candles = high - low = 300
    result.forEach((v) => {
      expect(v).toBeCloseTo(300, 0);
    });
  });
});

// ---------------------------------------------------------------------------
// MACD
// ---------------------------------------------------------------------------
describe('MACD', () => {
  it('returns empty arrays for insufficient data', () => {
    const shortData = Array(20).fill(100);
    const result = calc.calculateMACD(shortData);
    expect(result.macd).toEqual([]);
  });

  it('returns MACD, signal, and histogram arrays for sufficient data', () => {
    const longData = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const result = calc.calculateMACD(longData);
    expect(result.macd.length).toBeGreaterThan(0);
    expect(result.signal.length).toBeGreaterThan(0);
    expect(result.histogram.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Bollinger Bands
// ---------------------------------------------------------------------------
describe('Bollinger Bands', () => {
  it('upper > middle > lower for all indices', () => {
    const data = Array.from({ length: 30 }, (_, i) => 100 + Math.random() * 20);
    const result = calc.calculateBollingerBands(data, 20, 2);
    for (let i = 0; i < result.middle.length; i++) {
      expect(result.upper[i]).toBeGreaterThanOrEqual(result.middle[i]);
      expect(result.middle[i]).toBeGreaterThanOrEqual(result.lower[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// VWAP
// ---------------------------------------------------------------------------
describe('VWAP', () => {
  it('returns same length as input', () => {
    const volumes = Array(20).fill(1000);
    const result = calc.calculateVWAP(highs20, lows20, closes20, volumes);
    expect(result.length).toBe(20);
  });

  it('returns empty for empty input', () => {
    expect(calc.calculateVWAP([], [], [], [])).toEqual([]);
  });
});
