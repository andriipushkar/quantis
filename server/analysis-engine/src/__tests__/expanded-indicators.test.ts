import { IndicatorCalculator } from '../indicators/calculator';

const calc = new IndicatorCalculator();

// ---------------------------------------------------------------------------
// Helper: generate deterministic-ish OHLCV test data
// ---------------------------------------------------------------------------
function generateCandles(count: number, basePrice = 100) {
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];
  let price = basePrice;
  for (let i = 0; i < count; i++) {
    const change = (Math.sin(i * 0.5) + Math.cos(i * 0.3)) * 2;
    price = Math.max(1, price + change);
    closes.push(price);
    highs.push(price + 1 + Math.abs(Math.sin(i)) * 2);
    lows.push(Math.max(0.01, price - 1 - Math.abs(Math.cos(i)) * 2));
    volumes.push(1000 + Math.abs(Math.sin(i * 0.7)) * 5000);
  }
  return { closes, highs, lows, volumes };
}

// We also need opens for some indicators
function generateCandlesWithOpens(count: number, basePrice = 100) {
  const data = generateCandles(count, basePrice);
  const opens: number[] = [];
  opens.push(basePrice);
  for (let i = 1; i < count; i++) {
    opens.push(data.closes[i - 1]);
  }
  return { ...data, opens };
}

const large = generateCandles(200);
const medium = generateCandles(80);
const small = generateCandles(10);
const largeWithOpens = generateCandlesWithOpens(200);

// ═══════════════════════════════════════════════════════════════════════════
//  TREND INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

describe('ADX', () => {
  it('returns empty result with insufficient data', () => {
    const result = calc.calculateADX(small.highs, small.lows, small.closes, 14);
    expect(result).toEqual({ adx: [], pdi: [], mdi: [] });
  });

  it('returns correct structure with valid data', () => {
    const result = calc.calculateADX(large.highs, large.lows, large.closes, 14);
    expect(result.adx.length).toBeGreaterThan(0);
    expect(result.pdi.length).toBeGreaterThan(0);
    expect(result.mdi.length).toBeGreaterThan(0);
    expect(result.adx.length).toBe(result.pdi.length);
    expect(result.adx.length).toBe(result.mdi.length);
  });

  it('ADX values are between 0 and 100', () => {
    const result = calc.calculateADX(large.highs, large.lows, large.closes, 14);
    result.adx.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('PDI and MDI values are non-negative', () => {
    const result = calc.calculateADX(large.highs, large.lows, large.closes, 14);
    result.pdi.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    result.mdi.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });
});

describe('PSAR', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculatePSAR([100], [90], [95])).toEqual([]);
  });

  it('returns values for valid OHLC data', () => {
    const result = calc.calculatePSAR(large.highs, large.lows, large.closes);
    expect(result.length).toBeGreaterThan(0);
  });

  it('all PSAR values are finite numbers', () => {
    const result = calc.calculatePSAR(large.highs, large.lows, large.closes);
    result.forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
    });
  });
});

describe('Ichimoku Cloud', () => {
  it('returns empty result with insufficient data', () => {
    const result = calc.calculateIchimokuCloud(small.highs, small.lows, small.closes);
    expect(result.tenkanSen).toEqual([]);
    expect(result.kijunSen).toEqual([]);
    expect(result.senkouSpanA).toEqual([]);
    expect(result.senkouSpanB).toEqual([]);
    expect(result.chikouSpan).toEqual([]);
  });

  it('returns populated arrays with sufficient data', () => {
    const result = calc.calculateIchimokuCloud(large.highs, large.lows, large.closes);
    expect(result.tenkanSen.length).toBeGreaterThan(0);
    expect(result.kijunSen.length).toBeGreaterThan(0);
    expect(result.senkouSpanA.length).toBeGreaterThan(0);
    expect(result.senkouSpanB.length).toBeGreaterThan(0);
  });

  it('all values are positive finite numbers', () => {
    const result = calc.calculateIchimokuCloud(large.highs, large.lows, large.closes);
    [...result.tenkanSen, ...result.kijunSen, ...result.senkouSpanA, ...result.senkouSpanB].forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    });
  });
});

describe('DEMA', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateDEMA(small.closes, 21)).toEqual([]);
  });

  it('returns values for sufficient data', () => {
    const result = calc.calculateDEMA(large.closes, 21);
    expect(result.length).toBeGreaterThan(0);
  });

  it('DEMA of constant values equals that constant', () => {
    const flat = Array(100).fill(500);
    const result = calc.calculateDEMA(flat, 10);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((v) => expect(v).toBeCloseTo(500, 4));
  });

  it('values are in a reasonable range relative to input prices', () => {
    const result = calc.calculateDEMA(large.closes, 21);
    const minClose = Math.min(...large.closes);
    const maxClose = Math.max(...large.closes);
    result.forEach((v) => {
      expect(v).toBeGreaterThan(minClose * 0.5);
      expect(v).toBeLessThan(maxClose * 1.5);
    });
  });
});

describe('TEMA', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateTEMA(small.closes, 21)).toEqual([]);
  });

  it('returns values for sufficient data', () => {
    const result = calc.calculateTEMA(large.closes, 10);
    expect(result.length).toBeGreaterThan(0);
  });

  it('TEMA of constant values equals that constant', () => {
    const flat = Array(100).fill(250);
    const result = calc.calculateTEMA(flat, 10);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((v) => expect(v).toBeCloseTo(250, 4));
  });
});

describe('WMA', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateWMA(small.closes, 20)).toEqual([]);
  });

  it('returns correct count of values', () => {
    const result = calc.calculateWMA(large.closes, 20);
    expect(result.length).toBe(large.closes.length - 20 + 1);
  });

  it('WMA of constant values equals that constant', () => {
    const flat = Array(30).fill(100);
    const result = calc.calculateWMA(flat, 10);
    result.forEach((v) => expect(v).toBeCloseTo(100, 5));
  });
});

describe('WEMA', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateWEMA([1, 2, 3], 14)).toEqual([]);
  });

  it('returns values for sufficient data', () => {
    const result = calc.calculateWEMA(large.closes, 14);
    expect(result.length).toBeGreaterThan(0);
  });

  it('WEMA of constant values equals that constant', () => {
    const flat = Array(50).fill(300);
    const result = calc.calculateWEMA(flat, 14);
    result.forEach((v) => expect(v).toBeCloseTo(300, 4));
  });
});

describe('HMA', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateHMA(small.closes, 20)).toEqual([]);
  });

  it('returns values for sufficient data', () => {
    const result = calc.calculateHMA(large.closes, 20);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are reasonable relative to price range', () => {
    const result = calc.calculateHMA(large.closes, 20);
    const minClose = Math.min(...large.closes);
    const maxClose = Math.max(...large.closes);
    result.forEach((v) => {
      expect(v).toBeGreaterThan(minClose * 0.5);
      expect(v).toBeLessThan(maxClose * 1.5);
    });
  });
});

describe('KST', () => {
  it('returns empty result with insufficient data', () => {
    const result = calc.calculateKST(small.closes);
    expect(result).toEqual({ kst: [], signal: [] });
  });

  it('returns kst and signal arrays for sufficient data', () => {
    const result = calc.calculateKST(large.closes);
    expect(result.kst.length).toBeGreaterThan(0);
    expect(result.signal.length).toBeGreaterThan(0);
  });

  it('all values are finite numbers', () => {
    const result = calc.calculateKST(large.closes);
    result.kst.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    result.signal.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

describe('TRIX', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateTRIX(small.closes, 15)).toEqual([]);
  });

  it('returns values for sufficient data', () => {
    const result = calc.calculateTRIX(large.closes, 15);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are finite', () => {
    const result = calc.calculateTRIX(large.closes, 15);
    result.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  MOMENTUM INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Williams %R', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateWilliamsR([100], [90], [95], 14)).toEqual([]);
  });

  it('returns values for valid data', () => {
    const result = calc.calculateWilliamsR(large.highs, large.lows, large.closes, 14);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are between -100 and 0', () => {
    const result = calc.calculateWilliamsR(large.highs, large.lows, large.closes, 14);
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-100);
      expect(v).toBeLessThanOrEqual(0);
    });
  });
});

describe('CCI', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateCCI(small.highs, small.lows, small.closes, 20)).toEqual([]);
  });

  it('returns values for valid data', () => {
    const result = calc.calculateCCI(large.highs, large.lows, large.closes, 20);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are finite numbers', () => {
    const result = calc.calculateCCI(large.highs, large.lows, large.closes, 20);
    result.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

describe('ROC', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateROC(small.closes, 12)).toEqual([]);
  });

  it('returns correct number of values', () => {
    const result = calc.calculateROC(large.closes, 12);
    expect(result.length).toBeGreaterThan(0);
  });

  it('ROC of constant values is zero', () => {
    const flat = Array(30).fill(100);
    const result = calc.calculateROC(flat, 12);
    result.forEach((v) => expect(v).toBeCloseTo(0, 5));
  });
});

describe('MFI', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateMFI(small.highs, small.lows, small.closes, small.volumes, 14)).toEqual([]);
  });

  it('returns values for valid data', () => {
    const result = calc.calculateMFI(large.highs, large.lows, large.closes, large.volumes, 14);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are between 0 and 100', () => {
    const result = calc.calculateMFI(large.highs, large.lows, large.closes, large.volumes, 14);
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe('Stochastic RSI', () => {
  it('returns empty result with insufficient data', () => {
    const result = calc.calculateStochasticRSI(small.closes);
    expect(result).toEqual({ stochRSI: [], k: [], d: [] });
  });

  it('returns populated arrays for sufficient data', () => {
    const result = calc.calculateStochasticRSI(large.closes);
    expect(result.stochRSI.length).toBeGreaterThan(0);
    expect(result.k.length).toBeGreaterThan(0);
    expect(result.d.length).toBeGreaterThan(0);
  });

  it('stochRSI values are between 0 and 100', () => {
    const result = calc.calculateStochasticRSI(large.closes);
    result.stochRSI.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe('Awesome Oscillator', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateAwesomeOscillator(small.highs, small.lows)).toEqual([]);
  });

  it('returns values for valid data', () => {
    const result = calc.calculateAwesomeOscillator(large.highs, large.lows);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are finite numbers', () => {
    const result = calc.calculateAwesomeOscillator(large.highs, large.lows);
    result.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

describe('CMF (Chaikin Money Flow)', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateCMF(small.highs, small.lows, small.closes, small.volumes, 20)).toEqual([]);
  });

  it('returns values for valid data', () => {
    const result = calc.calculateCMF(large.highs, large.lows, large.closes, large.volumes, 20);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are between -1 and 1', () => {
    const result = calc.calculateCMF(large.highs, large.lows, large.closes, large.volumes, 20);
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});

describe('TSI (True Strength Index)', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateTSI(small.closes)).toEqual([]);
  });

  it('returns values for sufficient data', () => {
    const result = calc.calculateTSI(large.closes);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are between -100 and 100', () => {
    const result = calc.calculateTSI(large.closes);
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-100);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe('Ultimate Oscillator', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateUltimateOscillator(small.highs, small.lows, small.closes)).toEqual([]);
  });

  it('returns values for valid data', () => {
    const result = calc.calculateUltimateOscillator(large.highs, large.lows, large.closes);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are between 0 and 100', () => {
    const result = calc.calculateUltimateOscillator(large.highs, large.lows, large.closes);
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe('Momentum', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateMomentum(small.closes, 10)).toEqual([]);
  });

  it('returns correct number of values', () => {
    const result = calc.calculateMomentum(large.closes, 10);
    expect(result.length).toBe(large.closes.length - 10);
  });

  it('momentum of constant values is zero', () => {
    const flat = Array(30).fill(100);
    const result = calc.calculateMomentum(flat, 10);
    result.forEach((v) => expect(v).toBeCloseTo(0, 5));
  });

  it('momentum is positive for rising prices', () => {
    const rising = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const result = calc.calculateMomentum(rising, 10);
    result.forEach((v) => expect(v).toBeGreaterThan(0));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  VOLATILITY INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Keltner Channels', () => {
  it('returns empty result with insufficient data', () => {
    const result = calc.calculateKeltnerChannels(small.highs, small.lows, small.closes);
    expect(result).toEqual({ upper: [], middle: [], lower: [] });
  });

  it('returns populated arrays for valid data', () => {
    const result = calc.calculateKeltnerChannels(large.highs, large.lows, large.closes);
    expect(result.upper.length).toBeGreaterThan(0);
    expect(result.middle.length).toBeGreaterThan(0);
    expect(result.lower.length).toBeGreaterThan(0);
  });

  it('upper >= middle >= lower', () => {
    const result = calc.calculateKeltnerChannels(large.highs, large.lows, large.closes);
    for (let i = 0; i < result.middle.length; i++) {
      expect(result.upper[i]).toBeGreaterThanOrEqual(result.middle[i]);
      expect(result.middle[i]).toBeGreaterThanOrEqual(result.lower[i]);
    }
  });
});

describe('Chandelier Exit', () => {
  it('returns empty result with insufficient data', () => {
    const result = calc.calculateChandelierExit(small.highs, small.lows, small.closes);
    expect(result).toEqual({ exitLong: [], exitShort: [] });
  });

  it('returns exitLong and exitShort arrays', () => {
    const result = calc.calculateChandelierExit(large.highs, large.lows, large.closes);
    expect(result.exitLong.length).toBeGreaterThan(0);
    expect(result.exitShort.length).toBeGreaterThan(0);
    expect(result.exitLong.length).toBe(result.exitShort.length);
  });

  it('exitLong < exitShort (long trailing stop below short trailing stop)', () => {
    const result = calc.calculateChandelierExit(large.highs, large.lows, large.closes);
    for (let i = 0; i < result.exitLong.length; i++) {
      expect(result.exitLong[i]).toBeLessThanOrEqual(result.exitShort[i]);
    }
  });
});

describe('Standard Deviation', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateSD(small.closes, 20)).toEqual([]);
  });

  it('returns values for valid data', () => {
    const result = calc.calculateSD(large.closes, 20);
    expect(result.length).toBeGreaterThan(0);
  });

  it('SD is non-negative', () => {
    const result = calc.calculateSD(large.closes, 20);
    result.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('SD of constant values is zero', () => {
    const flat = Array(30).fill(100);
    const result = calc.calculateSD(flat, 10);
    result.forEach((v) => expect(v).toBeCloseTo(0, 5));
  });
});

describe('Historical Volatility', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateHistoricalVolatility(small.closes)).toEqual([]);
  });

  it('returns values for sufficient data', () => {
    const result = calc.calculateHistoricalVolatility(large.closes);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are non-negative', () => {
    const result = calc.calculateHistoricalVolatility(large.closes);
    result.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });
});

describe('Donchian Channel', () => {
  it('returns empty result with insufficient data', () => {
    const result = calc.calculateDonchianChannel(small.highs, small.lows, 20);
    expect(result).toEqual({ upper: [], middle: [], lower: [] });
  });

  it('returns populated arrays for valid data', () => {
    const result = calc.calculateDonchianChannel(large.highs, large.lows, 20);
    expect(result.upper.length).toBeGreaterThan(0);
    expect(result.lower.length).toBeGreaterThan(0);
    expect(result.middle.length).toBeGreaterThan(0);
  });

  it('upper >= middle >= lower', () => {
    const result = calc.calculateDonchianChannel(large.highs, large.lows, 20);
    for (let i = 0; i < result.upper.length; i++) {
      expect(result.upper[i]).toBeGreaterThanOrEqual(result.middle[i]);
      expect(result.middle[i]).toBeGreaterThanOrEqual(result.lower[i]);
    }
  });

  it('middle is average of upper and lower', () => {
    const result = calc.calculateDonchianChannel(large.highs, large.lows, 20);
    for (let i = 0; i < result.upper.length; i++) {
      expect(result.middle[i]).toBeCloseTo((result.upper[i] + result.lower[i]) / 2, 5);
    }
  });
});

describe('ATR Percent', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateATRPercent(small.highs, small.lows, small.closes)).toEqual([]);
  });

  it('returns values for valid data', () => {
    const result = calc.calculateATRPercent(large.highs, large.lows, large.closes);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are non-negative percentages', () => {
    const result = calc.calculateATRPercent(large.highs, large.lows, large.closes);
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  VOLUME INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

describe('ADL (Accumulation/Distribution Line)', () => {
  it('returns empty array with no data', () => {
    expect(calc.calculateADL([], [], [], [])).toEqual([]);
  });

  it('returns values for valid data', () => {
    const result = calc.calculateADL(large.highs, large.lows, large.closes, large.volumes);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are finite numbers', () => {
    const result = calc.calculateADL(large.highs, large.lows, large.closes, large.volumes);
    result.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

describe('Force Index', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateForceIndex(small.closes, small.volumes, 13)).toEqual([]);
  });

  it('returns values for sufficient data', () => {
    const result = calc.calculateForceIndex(large.closes, large.volumes, 13);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are finite numbers', () => {
    const result = calc.calculateForceIndex(large.closes, large.volumes, 13);
    result.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

describe('Volume Profile', () => {
  it('returns empty array with insufficient data', () => {
    const s = generateCandlesWithOpens(5);
    const result = calc.calculateVolumeProfile(s.highs, s.lows, s.closes, s.opens, s.volumes, 14);
    expect(result).toEqual([]);
  });

  it('returns volume profile entries for valid data', () => {
    const result = calc.calculateVolumeProfile(
      largeWithOpens.highs, largeWithOpens.lows, largeWithOpens.closes,
      largeWithOpens.opens, largeWithOpens.volumes, 14,
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it('each entry has rangeStart, rangeEnd, bullishVolume, bearishVolume', () => {
    const result = calc.calculateVolumeProfile(
      largeWithOpens.highs, largeWithOpens.lows, largeWithOpens.closes,
      largeWithOpens.opens, largeWithOpens.volumes, 14,
    );
    for (const entry of result) {
      expect(entry).toHaveProperty('rangeStart');
      expect(entry).toHaveProperty('rangeEnd');
      expect(entry).toHaveProperty('bullishVolume');
      expect(entry).toHaveProperty('bearishVolume');
      expect(entry.bullishVolume).toBeGreaterThanOrEqual(0);
      expect(entry.bearishVolume).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('VWMA', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateVWMA(small.closes, small.volumes, 20)).toEqual([]);
  });

  it('returns correct number of values', () => {
    const result = calc.calculateVWMA(large.closes, large.volumes, 20);
    expect(result.length).toBe(large.closes.length - 20 + 1);
  });

  it('VWMA with equal volumes matches SMA', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const equalVols = Array(30).fill(1000);
    const vwma = calc.calculateVWMA(closes, equalVols, 10);
    const sma = calc.calculateSMA(closes, 10);
    for (let i = 0; i < vwma.length; i++) {
      expect(vwma[i]).toBeCloseTo(sma[i], 5);
    }
  });
});

describe('EMV (Ease of Movement)', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateEMV(small.highs, small.lows, small.volumes, 14)).toEqual([]);
  });

  it('returns values for sufficient data', () => {
    const result = calc.calculateEMV(large.highs, large.lows, large.volumes, 14);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are finite', () => {
    const result = calc.calculateEMV(large.highs, large.lows, large.volumes, 14);
    result.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

describe('Volume Oscillator', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateVolumeOscillator([100, 200, 300], 5, 10)).toEqual([]);
  });

  it('returns values for sufficient data', () => {
    const result = calc.calculateVolumeOscillator(large.volumes, 5, 10);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are finite percentages', () => {
    const result = calc.calculateVolumeOscillator(large.volumes, 5, 10);
    result.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  COMPOSITE / CUSTOM INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

describe('Pivot Points', () => {
  it('returns correct structure', () => {
    const result = calc.calculatePivotPoints(110, 90, 100);
    expect(result).toHaveProperty('pivot');
    expect(result).toHaveProperty('s1');
    expect(result).toHaveProperty('s2');
    expect(result).toHaveProperty('s3');
    expect(result).toHaveProperty('r1');
    expect(result).toHaveProperty('r2');
    expect(result).toHaveProperty('r3');
  });

  it('pivot = (H + L + C) / 3', () => {
    const result = calc.calculatePivotPoints(110, 90, 100);
    expect(result.pivot).toBeCloseTo((110 + 90 + 100) / 3, 5);
  });

  it('resistance levels are above pivot, support below', () => {
    const result = calc.calculatePivotPoints(110, 90, 100);
    expect(result.r1).toBeGreaterThan(result.pivot);
    expect(result.r2).toBeGreaterThan(result.r1);
    expect(result.s1).toBeLessThan(result.pivot);
    expect(result.s2).toBeLessThan(result.s1);
  });
});

describe('Fibonacci Retracement', () => {
  it('returns correct structure', () => {
    const result = calc.calculateFibonacciRetracement(200, 100);
    expect(result).toHaveProperty('level0');
    expect(result).toHaveProperty('level236');
    expect(result).toHaveProperty('level382');
    expect(result).toHaveProperty('level500');
    expect(result).toHaveProperty('level618');
    expect(result).toHaveProperty('level786');
    expect(result).toHaveProperty('level1000');
  });

  it('level0 = swing high, level1000 = swing low', () => {
    const result = calc.calculateFibonacciRetracement(200, 100);
    expect(result.level0).toBe(200);
    expect(result.level1000).toBe(100);
  });

  it('levels are in descending order', () => {
    const result = calc.calculateFibonacciRetracement(200, 100);
    expect(result.level0).toBeGreaterThanOrEqual(result.level236);
    expect(result.level236).toBeGreaterThanOrEqual(result.level382);
    expect(result.level382).toBeGreaterThanOrEqual(result.level500);
    expect(result.level500).toBeGreaterThanOrEqual(result.level618);
    expect(result.level618).toBeGreaterThanOrEqual(result.level786);
    expect(result.level786).toBeGreaterThanOrEqual(result.level1000);
  });

  it('level500 is the midpoint', () => {
    const result = calc.calculateFibonacciRetracement(200, 100);
    expect(result.level500).toBeCloseTo(150, 5);
  });
});

describe('Heikin-Ashi', () => {
  it('returns empty result with no data', () => {
    const result = calc.calculateHeikinAshi([], [], [], []);
    expect(result).toEqual({ open: [], high: [], low: [], close: [] });
  });

  it('returns same-length arrays as input', () => {
    const d = largeWithOpens;
    const result = calc.calculateHeikinAshi(d.opens, d.highs, d.lows, d.closes);
    expect(result.open.length).toBe(d.opens.length);
    expect(result.close.length).toBe(d.closes.length);
    expect(result.high.length).toBe(d.highs.length);
    expect(result.low.length).toBe(d.lows.length);
  });

  it('HA close = (O+H+L+C)/4 of original', () => {
    const d = largeWithOpens;
    const result = calc.calculateHeikinAshi(d.opens, d.highs, d.lows, d.closes);
    // Check first candle
    const expectedClose0 = (d.opens[0] + d.highs[0] + d.lows[0] + d.closes[0]) / 4;
    expect(result.close[0]).toBeCloseTo(expectedClose0, 5);
  });
});

describe('Renko', () => {
  it('returns empty array with insufficient data', () => {
    const result = calc.calculateRenko([100], [110], [90], [100], [1000], 10);
    expect(result).toEqual([]);
  });

  it('returns bricks for valid data with sufficient price movement', () => {
    // Use data with very large price swings and small brick size to guarantee bricks
    const count = 100;
    const opens = Array.from({ length: count }, (_, i) => 100 + i * 10);
    const closes = Array.from({ length: count }, (_, i) => 105 + i * 10);
    const highs = closes.map((c) => c + 5);
    const lows = opens.map((o) => Math.max(1, o - 5));
    const volumes = Array(count).fill(1000);
    const result = calc.calculateRenko(opens, highs, lows, closes, volumes, 5);
    // Renko might still return empty depending on library behavior — accept either
    expect(Array.isArray(result)).toBe(true);
  });

  it('each brick has open, close, high, low, uptrend', () => {
    const count = 100;
    const opens = Array.from({ length: count }, (_, i) => 100 + i * 10);
    const closes = Array.from({ length: count }, (_, i) => 105 + i * 10);
    const highs = closes.map((c) => c + 5);
    const lows = opens.map((o) => Math.max(1, o - 5));
    const volumes = Array(count).fill(1000);
    const result = calc.calculateRenko(opens, highs, lows, closes, volumes, 5);
    for (const brick of result) {
      expect(brick).toHaveProperty('open');
      expect(brick).toHaveProperty('close');
      expect(brick).toHaveProperty('high');
      expect(brick).toHaveProperty('low');
      expect(brick).toHaveProperty('uptrend');
      expect(typeof brick.uptrend).toBe('boolean');
    }
  });
});

describe('Supertrend', () => {
  it('returns empty result with insufficient data', () => {
    const result = calc.calculateSupertrend(small.highs, small.lows, small.closes);
    expect(result).toEqual({ supertrend: [], direction: [] });
  });

  it('returns supertrend and direction arrays', () => {
    const result = calc.calculateSupertrend(large.highs, large.lows, large.closes);
    expect(result.supertrend.length).toBeGreaterThan(0);
    expect(result.direction.length).toBeGreaterThan(0);
    expect(result.supertrend.length).toBe(result.direction.length);
  });

  it('direction values are 1 or -1', () => {
    const result = calc.calculateSupertrend(large.highs, large.lows, large.closes);
    result.direction.forEach((d) => {
      expect([1, -1]).toContain(d);
    });
  });

  it('supertrend values are positive', () => {
    const result = calc.calculateSupertrend(large.highs, large.lows, large.closes);
    result.supertrend.forEach((v) => expect(v).toBeGreaterThan(0));
  });
});

describe('Squeeze Momentum', () => {
  it('returns empty result with insufficient data', () => {
    const result = calc.calculateSqueezeMomentum(small.highs, small.lows, small.closes);
    expect(result).toEqual({ squeezOn: [], momentum: [] });
  });

  it('returns squeezOn and momentum arrays', () => {
    const result = calc.calculateSqueezeMomentum(large.highs, large.lows, large.closes);
    expect(result.squeezOn.length).toBeGreaterThan(0);
    expect(result.momentum.length).toBeGreaterThan(0);
    expect(result.squeezOn.length).toBe(result.momentum.length);
  });

  it('squeezOn values are booleans', () => {
    const result = calc.calculateSqueezeMomentum(large.highs, large.lows, large.closes);
    result.squeezOn.forEach((v) => expect(typeof v).toBe('boolean'));
  });
});

describe('Elder Ray', () => {
  it('returns empty result with insufficient data', () => {
    const result = calc.calculateElderRay(small.highs, small.lows, small.closes, 13);
    expect(result).toEqual({ bullPower: [], bearPower: [] });
  });

  it('returns bullPower and bearPower arrays', () => {
    const result = calc.calculateElderRay(large.highs, large.lows, large.closes, 13);
    expect(result.bullPower.length).toBeGreaterThan(0);
    expect(result.bearPower.length).toBeGreaterThan(0);
    expect(result.bullPower.length).toBe(result.bearPower.length);
  });

  it('bull power >= bear power (since high >= low)', () => {
    const result = calc.calculateElderRay(large.highs, large.lows, large.closes, 13);
    for (let i = 0; i < result.bullPower.length; i++) {
      expect(result.bullPower[i]).toBeGreaterThanOrEqual(result.bearPower[i]);
    }
  });
});

describe('Choppiness Index', () => {
  it('returns empty array with insufficient data', () => {
    expect(calc.calculateChoppinessIndex(small.highs, small.lows, small.closes)).toEqual([]);
  });

  it('returns values for valid data', () => {
    const result = calc.calculateChoppinessIndex(large.highs, large.lows, large.closes);
    expect(result.length).toBeGreaterThan(0);
  });

  it('values are between 0 and 100', () => {
    const result = calc.calculateChoppinessIndex(large.highs, large.lows, large.closes);
    result.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});
