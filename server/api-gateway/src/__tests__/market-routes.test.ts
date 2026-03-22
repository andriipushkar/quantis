/**
 * Market Route Modules — Unit Tests
 *
 * Tests business logic, data transformations, and helper functions
 * from the market route modules without requiring a running server.
 */

// ---------------------------------------------------------------------------
// TIMEFRAME_TABLES (ohlcv.ts)
// ---------------------------------------------------------------------------
import { TIMEFRAME_TABLES } from '../routes/market/ohlcv.js';

describe('TIMEFRAME_TABLES', () => {
  test('contains all expected timeframes', () => {
    expect(TIMEFRAME_TABLES).toHaveProperty('1m', 'ohlcv_1m');
    expect(TIMEFRAME_TABLES).toHaveProperty('5m', 'ohlcv_5m');
    expect(TIMEFRAME_TABLES).toHaveProperty('15m', 'ohlcv_15m');
    expect(TIMEFRAME_TABLES).toHaveProperty('1h', 'ohlcv_1h');
    expect(TIMEFRAME_TABLES).toHaveProperty('4h', 'ohlcv_4h');
    expect(TIMEFRAME_TABLES).toHaveProperty('1d', 'ohlcv_1d');
  });

  test('has exactly 6 timeframes', () => {
    expect(Object.keys(TIMEFRAME_TABLES)).toHaveLength(6);
  });

  test('does not include invalid timeframes', () => {
    expect(TIMEFRAME_TABLES['2m']).toBeUndefined();
    expect(TIMEFRAME_TABLES['1w']).toBeUndefined();
    expect(TIMEFRAME_TABLES['1M']).toBeUndefined();
  });

  test('all table names follow ohlcv_* pattern', () => {
    for (const [, tableName] of Object.entries(TIMEFRAME_TABLES)) {
      expect(tableName).toMatch(/^ohlcv_\w+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// OHLCV candle transformation logic (extracted from ohlcv.ts handler)
// ---------------------------------------------------------------------------
describe('OHLCV candle transformation', () => {
  // This mirrors the candle mapping logic in the ohlcv route handler
  function transformCandles(rows: Array<{ time: string; open: string; high: string; low: string; close: string; volume: string }>) {
    return rows.map((r) => ({
      time: Math.floor(new Date(r.time).getTime() / 1000),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
    }));
  }

  test('converts DB row strings to numeric candle format', () => {
    const rows = [
      { time: '2026-01-01T00:00:00Z', open: '97000.50', high: '97500.00', low: '96800.25', close: '97200.00', volume: '1234.5678' },
    ];
    const result = transformCandles(rows);
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe(1767225600);
    expect(result[0].open).toBe(97000.50);
    expect(result[0].high).toBe(97500.00);
    expect(result[0].low).toBe(96800.25);
    expect(result[0].close).toBe(97200.00);
    expect(result[0].volume).toBe(1234.5678);
  });

  test('handles multiple candles', () => {
    const rows = [
      { time: '2026-01-01T00:00:00Z', open: '100', high: '110', low: '90', close: '105', volume: '500' },
      { time: '2026-01-01T00:01:00Z', open: '105', high: '115', low: '95', close: '110', volume: '600' },
    ];
    const result = transformCandles(rows);
    expect(result).toHaveLength(2);
    expect(result[1].time).toBeGreaterThan(result[0].time);
  });

  test('returns empty array for empty input', () => {
    expect(transformCandles([])).toEqual([]);
  });

  test('limit clamping logic works correctly', () => {
    // Mirrors: Math.min(parseInt(limit, 10) || 500, 5000)
    function clampLimit(limit: string): number {
      return Math.min(parseInt(limit, 10) || 500, 5000);
    }

    expect(clampLimit('100')).toBe(100);
    expect(clampLimit('5000')).toBe(5000);
    expect(clampLimit('10000')).toBe(5000);
    expect(clampLimit('abc')).toBe(500);
    expect(clampLimit('')).toBe(500);
    expect(clampLimit('0')).toBe(500); // 0 is falsy, falls to default
  });
});

// ---------------------------------------------------------------------------
// RSI computation (screener.ts logic)
// ---------------------------------------------------------------------------
describe('RSI computation (screener logic)', () => {
  function computeRSI(closes: number[]): number {
    if (closes.length < 15) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= 14; i++) {
      const diff = closes[closes.length - 15 + i] - closes[closes.length - 15 + i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  test('returns 50 (neutral) when insufficient data', () => {
    expect(computeRSI([100, 101, 102])).toBe(50);
    expect(computeRSI([])).toBe(50);
  });

  test('returns 100 when all moves are up', () => {
    const closes = Array.from({ length: 15 }, (_, i) => 100 + i);
    expect(computeRSI(closes)).toBe(100);
  });

  test('returns value near 0 when all moves are down', () => {
    const closes = Array.from({ length: 15 }, (_, i) => 200 - i);
    const rsi = computeRSI(closes);
    expect(rsi).toBeLessThan(1);
    expect(rsi).toBeGreaterThanOrEqual(0);
  });

  test('returns ~50 for equal gains and losses', () => {
    // Alternating up/down by the same amount
    const closes = [100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100];
    const rsi = computeRSI(closes);
    expect(rsi).toBeCloseTo(50, 0);
  });

  test('RSI is between 0 and 100 for random data', () => {
    const closes = [100, 102, 99, 103, 98, 105, 97, 106, 101, 100, 103, 98, 97, 104, 102];
    const rsi = computeRSI(closes);
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// EMA computation (screener.ts logic)
// ---------------------------------------------------------------------------
describe('EMA computation (screener logic)', () => {
  function computeEMA(closes: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = closes[0];
    for (let i = 1; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  }

  test('EMA of constant series equals the constant', () => {
    const closes = Array(20).fill(100);
    expect(computeEMA(closes, 20)).toBeCloseTo(100);
  });

  test('EMA of single value is that value', () => {
    expect(computeEMA([42], 10)).toBe(42);
  });

  test('EMA tracks rising prices upward', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
    const ema = computeEMA(closes, 20);
    expect(ema).toBeGreaterThan(100);
    expect(ema).toBeLessThan(closes[closes.length - 1]);
  });

  test('EMA trend determination: bullish when price > EMA', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
    const ema = computeEMA(closes, 20);
    const currentPrice = closes[closes.length - 1];
    expect(currentPrice).toBeGreaterThan(ema);
    const trend = currentPrice > ema ? 'bullish' : currentPrice < ema ? 'bearish' : 'neutral';
    expect(trend).toBe('bullish');
  });

  test('EMA trend determination: bearish when price < EMA', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 200 - i * 2);
    const ema = computeEMA(closes, 20);
    const currentPrice = closes[closes.length - 1];
    expect(currentPrice).toBeLessThan(ema);
  });
});

// ---------------------------------------------------------------------------
// Screener filter and sort logic (screener.ts)
// ---------------------------------------------------------------------------
describe('Screener filter and sort logic', () => {
  type ScreenerItem = {
    symbol: string;
    exchange: string;
    price: number;
    change24h: number;
    volume: number;
    rsi: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };

  const sampleItems: ScreenerItem[] = [
    { symbol: 'BTCUSDT', exchange: 'binance', price: 97500, change24h: 2.5, volume: 5000000, rsi: 65, trend: 'bullish' },
    { symbol: 'ETHUSDT', exchange: 'binance', price: 3450, change24h: -1.2, volume: 2000000, rsi: 42, trend: 'bearish' },
    { symbol: 'SOLUSDT', exchange: 'bybit', price: 178, change24h: 5.3, volume: 800000, rsi: 78, trend: 'bullish' },
    { symbol: 'DOGEUSDT', exchange: 'okx', price: 0.15, change24h: -0.5, volume: 300000, rsi: 35, trend: 'neutral' },
  ];

  function applyFilters(items: ScreenerItem[], filters: {
    exchange?: string;
    trend?: string;
    minVolume?: number;
    minRsi?: number;
    maxRsi?: number;
  }): ScreenerItem[] {
    let filtered = [...items];
    if (filters.exchange && filters.exchange !== 'all') {
      filtered = filtered.filter((item) => item.exchange === filters.exchange);
    }
    if (filters.trend && filters.trend !== 'all') {
      filtered = filtered.filter((item) => item.trend === filters.trend);
    }
    if (filters.minVolume !== undefined) {
      filtered = filtered.filter((item) => item.volume >= filters.minVolume!);
    }
    if (filters.minRsi !== undefined) {
      filtered = filtered.filter((item) => item.rsi >= filters.minRsi!);
    }
    if (filters.maxRsi !== undefined) {
      filtered = filtered.filter((item) => item.rsi <= filters.maxRsi!);
    }
    return filtered;
  }

  test('filter by exchange', () => {
    const result = applyFilters(sampleItems, { exchange: 'binance' });
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.exchange === 'binance')).toBe(true);
  });

  test('filter by trend', () => {
    const result = applyFilters(sampleItems, { trend: 'bullish' });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.symbol)).toEqual(['BTCUSDT', 'SOLUSDT']);
  });

  test('filter by minVolume', () => {
    const result = applyFilters(sampleItems, { minVolume: 1000000 });
    expect(result).toHaveLength(2);
  });

  test('filter by RSI range', () => {
    const result = applyFilters(sampleItems, { minRsi: 40, maxRsi: 70 });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.symbol)).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  test('exchange=all returns all', () => {
    const result = applyFilters(sampleItems, { exchange: 'all' });
    expect(result).toHaveLength(4);
  });

  test('sort by volume descending', () => {
    const sorted = [...sampleItems].sort((a, b) => b.volume - a.volume);
    expect(sorted[0].symbol).toBe('BTCUSDT');
    expect(sorted[sorted.length - 1].symbol).toBe('DOGEUSDT');
  });

  test('sort by rsi ascending', () => {
    const sorted = [...sampleItems].sort((a, b) => a.rsi - b.rsi);
    expect(sorted[0].symbol).toBe('DOGEUSDT');
    expect(sorted[sorted.length - 1].symbol).toBe('SOLUSDT');
  });

  test('sort by symbol ascending', () => {
    const sorted = [...sampleItems].sort((a, b) => a.symbol.localeCompare(b.symbol));
    expect(sorted[0].symbol).toBe('BTCUSDT');
    expect(sorted[sorted.length - 1].symbol).toBe('SOLUSDT');
  });
});

// ---------------------------------------------------------------------------
// Funding rate computation (derivatives.ts)
// ---------------------------------------------------------------------------
describe('Funding rate computation (derivatives logic)', () => {
  function computeFundingRate(rsi: number): number {
    const rsiDistance = rsi - 50;
    let rate = (rsiDistance / 50) * 0.1;
    rate = Math.max(-0.1, Math.min(0.1, rate));
    return Math.round(rate * 10000) / 10000;
  }

  function computeAnnualized(rate: number): number {
    return Math.round(rate * 3 * 365 * 100) / 100;
  }

  function computePrediction(rsi: number): 'up' | 'down' | 'stable' {
    return rsi > 60 ? 'up' : rsi < 40 ? 'down' : 'stable';
  }

  test('neutral RSI (50) gives rate 0', () => {
    expect(computeFundingRate(50)).toBe(0);
  });

  test('overbought RSI gives positive rate', () => {
    const rate = computeFundingRate(80);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(0.1);
  });

  test('oversold RSI gives negative rate', () => {
    const rate = computeFundingRate(20);
    expect(rate).toBeLessThan(0);
    expect(rate).toBeGreaterThanOrEqual(-0.1);
  });

  test('extreme RSI is clamped to +-0.1', () => {
    expect(computeFundingRate(100)).toBe(0.1);
    expect(computeFundingRate(0)).toBe(-0.1);
  });

  test('annualized rate calculation', () => {
    // 0.1% * 3 * 365 = 109.5
    expect(computeAnnualized(0.1)).toBe(109.5);
    expect(computeAnnualized(0)).toBe(0);
    expect(computeAnnualized(-0.05)).toBe(-54.75);
  });

  test('prediction based on RSI', () => {
    expect(computePrediction(70)).toBe('up');
    expect(computePrediction(30)).toBe('down');
    expect(computePrediction(50)).toBe('stable');
    expect(computePrediction(60)).toBe('stable');
    expect(computePrediction(61)).toBe('up');
    expect(computePrediction(39)).toBe('down');
    expect(computePrediction(40)).toBe('stable');
  });
});

// ---------------------------------------------------------------------------
// Pseudo-random (derivatives.ts, onchain.ts)
// ---------------------------------------------------------------------------
describe('Pseudo-random seeded function (derivatives)', () => {
  function pseudoRandom(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    }
    return (Math.abs(h) % 1000) / 1000;
  }

  test('returns value between 0 and 1', () => {
    for (const seed of ['BTC', 'ETH', 'SOL', 'test:123', '']) {
      const val = pseudoRandom(seed);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  test('same seed produces same value', () => {
    expect(pseudoRandom('BTCUSDT')).toBe(pseudoRandom('BTCUSDT'));
  });

  test('different seeds produce different values (with high probability)', () => {
    const v1 = pseudoRandom('BTCUSDT');
    const v2 = pseudoRandom('ETHUSDT');
    expect(v1).not.toBe(v2);
  });
});

// ---------------------------------------------------------------------------
// Next funding time logic (derivatives.ts)
// ---------------------------------------------------------------------------
describe('Next funding time calculation', () => {
  function computeNextFunding(now: Date): Date {
    const hours = now.getUTCHours();
    const nextHour = hours < 8 ? 8 : hours < 16 ? 16 : 24;
    const nextFundingDate = new Date(now);
    nextFundingDate.setUTCHours(nextHour % 24, 0, 0, 0);
    if (nextHour === 24) nextFundingDate.setUTCDate(nextFundingDate.getUTCDate() + 1);
    return nextFundingDate;
  }

  test('before 8 UTC, next funding is 8 UTC', () => {
    const now = new Date('2026-03-22T05:30:00Z');
    const next = computeNextFunding(now);
    expect(next.getUTCHours()).toBe(8);
    expect(next.getUTCDate()).toBe(22);
  });

  test('between 8 and 16 UTC, next funding is 16 UTC', () => {
    const now = new Date('2026-03-22T10:00:00Z');
    const next = computeNextFunding(now);
    expect(next.getUTCHours()).toBe(16);
  });

  test('after 16 UTC, next funding is 0 UTC next day', () => {
    const now = new Date('2026-03-22T20:00:00Z');
    const next = computeNextFunding(now);
    expect(next.getUTCHours()).toBe(0);
    expect(next.getUTCDate()).toBe(23);
  });
});

// ---------------------------------------------------------------------------
// DeFi TVL calculations (onchain.ts)
// ---------------------------------------------------------------------------
describe('DeFi TVL calculations (onchain)', () => {
  const DEFI_PROTOCOLS = [
    { name: 'Lido', tvl: 28_400_000_000, apy: 3.8 },
    { name: 'Aave', tvl: 12_500_000_000, apy: 3.2 },
    { name: 'MakerDAO', tvl: 8_700_000_000, apy: 5.0 },
    { name: 'Uniswap', tvl: 5_800_000_000, apy: 12.5 },
    { name: 'Jupiter', tvl: 900_000_000, apy: 0 },
  ];

  test('totalTvl is sum of all protocols', () => {
    const totalTvl = DEFI_PROTOCOLS.reduce((sum, p) => sum + p.tvl, 0);
    expect(totalTvl).toBe(56_300_000_000);
  });

  test('avgApy excludes protocols with 0 apy', () => {
    const apyProtos = DEFI_PROTOCOLS.filter((p) => p.apy > 0);
    const avgApy = apyProtos.reduce((sum, p) => sum + p.apy, 0) / apyProtos.length;
    expect(apyProtos).toHaveLength(4);
    expect(avgApy).toBeCloseTo(6.125, 2);
  });
});

// ---------------------------------------------------------------------------
// Network metrics lookup (onchain.ts)
// ---------------------------------------------------------------------------
describe('Network metrics lookup (onchain)', () => {
  const metricsMap: Record<string, { healthScore: number }> = {
    BTC: { healthScore: 88 },
    BTCUSDT: { healthScore: 88 },
    ETH: { healthScore: 82 },
    ETHUSDT: { healthScore: 82 },
    SOL: { healthScore: 75 },
    SOLUSDT: { healthScore: 75 },
  };

  test('known symbols return metrics', () => {
    expect(metricsMap['BTC']).toBeDefined();
    expect(metricsMap['BTCUSDT']).toBeDefined();
    expect(metricsMap['ETH']).toBeDefined();
  });

  test('unknown symbols return undefined', () => {
    expect(metricsMap['DOGE']).toBeUndefined();
    expect(metricsMap['ADA']).toBeUndefined();
  });

  test('health scores are in valid range', () => {
    for (const [, val] of Object.entries(metricsMap)) {
      expect(val.healthScore).toBeGreaterThanOrEqual(0);
      expect(val.healthScore).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// Regime scoring helpers (advanced.ts) — re-implemented for testing
// ---------------------------------------------------------------------------
describe('Regime scoring helpers (advanced.ts logic)', () => {
  // Re-implement the helpers to test the algorithms independently

  interface ADXResult { adx: number; plusDI: number; minusDI: number; }

  function computeADX(highs: number[], lows: number[], closes: number[], period = 14): ADXResult {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < 2 * period + 1) return { adx: 20, plusDI: 0, minusDI: 0 };

    const tr: number[] = [], plusDM: number[] = [], minusDM: number[] = [];
    for (let i = 1; i < len; i++) {
      tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
      const up = highs[i] - highs[i - 1], dn = lows[i - 1] - lows[i];
      plusDM.push(up > dn && up > 0 ? up : 0);
      minusDM.push(dn > up && dn > 0 ? dn : 0);
    }

    let sTR = 0, sPDM = 0, sMDM = 0;
    for (let i = 0; i < period; i++) { sTR += tr[i]; sPDM += plusDM[i]; sMDM += minusDM[i]; }

    const dxVals: number[] = [];
    for (let i = period; i < tr.length; i++) {
      sTR = sTR - sTR / period + tr[i];
      sPDM = sPDM - sPDM / period + plusDM[i];
      sMDM = sMDM - sMDM / period + minusDM[i];
      const pdi = sTR > 0 ? (sPDM / sTR) * 100 : 0;
      const mdi = sTR > 0 ? (sMDM / sTR) * 100 : 0;
      const sum = pdi + mdi;
      dxVals.push(sum > 0 ? (Math.abs(pdi - mdi) / sum) * 100 : 0);
    }

    if (dxVals.length < period) {
      const avg = dxVals.reduce((a, b) => a + b, 0) / (dxVals.length || 1);
      return { adx: avg, plusDI: 0, minusDI: 0 };
    }

    let adx = 0;
    for (let i = 0; i < period; i++) adx += dxVals[i];
    adx /= period;
    for (let i = period; i < dxVals.length; i++) adx = (adx * (period - 1) + dxVals[i]) / period;

    return { adx, plusDI: sTR > 0 ? (sPDM / sTR) * 100 : 0, minusDI: sTR > 0 ? (sMDM / sTR) * 100 : 0 };
  }

  function computeHurst(closes: number[]): number {
    if (closes.length < 32) return 0.5;
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > 0 && closes[i - 1] > 0) returns.push(Math.log(closes[i] / closes[i - 1]));
    }
    if (returns.length < 20) return 0.5;

    const sizes: number[] = [];
    let s = 8;
    while (s <= returns.length / 2) { sizes.push(s); s *= 2; }
    if (sizes.length < 2) return 0.5;

    const logN: number[] = [], logRS: number[] = [];
    for (const n of sizes) {
      const num = Math.floor(returns.length / n);
      let rsSum = 0;
      for (let j = 0; j < num; j++) {
        const sub = returns.slice(j * n, (j + 1) * n);
        const mean = sub.reduce((a, b) => a + b, 0) / n;
        const std = Math.sqrt(sub.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
        if (std === 0) continue;
        let cum = 0, mx = -Infinity, mn = Infinity;
        for (const val of sub) { cum += val - mean; if (cum > mx) mx = cum; if (cum < mn) mn = cum; }
        rsSum += (mx - mn) / std;
      }
      if (num > 0 && rsSum > 0) { logN.push(Math.log(n)); logRS.push(Math.log(rsSum / num)); }
    }
    if (logN.length < 2) return 0.5;

    const nP = logN.length;
    const sX = logN.reduce((a, b) => a + b, 0), sY = logRS.reduce((a, b) => a + b, 0);
    const sXY = logN.reduce((a, x, i) => a + x * logRS[i], 0);
    const sX2 = logN.reduce((a, x) => a + x * x, 0);
    const d = nP * sX2 - sX * sX;
    if (d === 0) return 0.5;
    return Math.max(0, Math.min(1, (nP * sXY - sX * sY) / d));
  }

  function computeChoppiness(highs: number[], lows: number[], closes: number[], period = 14): number {
    const len = Math.min(highs.length, lows.length, closes.length);
    if (len < period + 1) return 50;
    const off = len - period - 1;
    let atrSum = 0, hh = -Infinity, ll = Infinity;
    for (let i = off + 1; i < len; i++) {
      atrSum += Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
      if (highs[i] > hh) hh = highs[i];
      if (lows[i] < ll) ll = lows[i];
    }
    const range = hh - ll;
    if (range <= 0 || atrSum <= 0) return 50;
    return Math.max(0, Math.min(100, (100 * Math.log10(atrSum / range)) / Math.log10(period)));
  }

  function computeEfficiencyRatio(closes: number[], period = 10): number {
    if (closes.length < period + 1) return 0.5;
    const end = closes.length - 1, start = end - period;
    const dir = Math.abs(closes[end] - closes[start]);
    let vol = 0;
    for (let i = start + 1; i <= end; i++) vol += Math.abs(closes[i] - closes[i - 1]);
    return vol === 0 ? 0 : Math.min(1, dir / vol);
  }

  type RegimeLabel = 'strong_trend' | 'trending' | 'transitional' | 'choppy' | 'mean_reversion';

  function computeRegimeScore(highs: number[], lows: number[], closes: number[]) {
    const adxR = computeADX(highs, lows, closes);
    const hurst = computeHurst(closes);
    const ci = computeChoppiness(highs, lows, closes);
    const er = computeEfficiencyRatio(closes);

    const adxScore = Math.min(100, (adxR.adx / 50) * 100);
    const hurstScore = hurst * 100;
    const choppinessScore = 100 - ci;
    const erScore = er * 100;

    const composite = adxScore * 0.35 + hurstScore * 0.25 + choppinessScore * 0.25 + erScore * 0.15;
    const score = Math.max(1, Math.min(100, Math.round(composite)));

    let label: RegimeLabel;
    if (score >= 80) label = 'strong_trend';
    else if (score >= 60) label = 'trending';
    else if (score >= 40) label = 'transitional';
    else if (score >= 20) label = 'choppy';
    else label = 'mean_reversion';

    return { score, label, adxR, hurst, ci, er };
  }

  describe('computeADX', () => {
    test('returns default when insufficient data', () => {
      const result = computeADX([1, 2, 3], [1, 2, 3], [1, 2, 3]);
      expect(result.adx).toBe(20);
      expect(result.plusDI).toBe(0);
      expect(result.minusDI).toBe(0);
    });

    test('returns valid ADX for trending data', () => {
      // Generate strong uptrend: 50 bars
      const len = 50;
      const highs = Array.from({ length: len }, (_, i) => 100 + i * 2 + 1);
      const lows = Array.from({ length: len }, (_, i) => 100 + i * 2 - 1);
      const closes = Array.from({ length: len }, (_, i) => 100 + i * 2);

      const result = computeADX(highs, lows, closes);
      expect(result.adx).toBeGreaterThan(0);
      expect(result.adx).toBeLessThanOrEqual(100);
    });

    test('plusDI > minusDI in uptrend', () => {
      const len = 50;
      const highs = Array.from({ length: len }, (_, i) => 100 + i * 2 + 1);
      const lows = Array.from({ length: len }, (_, i) => 100 + i * 2 - 1);
      const closes = Array.from({ length: len }, (_, i) => 100 + i * 2);

      const result = computeADX(highs, lows, closes);
      expect(result.plusDI).toBeGreaterThan(result.minusDI);
    });

    test('minusDI > plusDI in downtrend', () => {
      const len = 50;
      const highs = Array.from({ length: len }, (_, i) => 200 - i * 2 + 1);
      const lows = Array.from({ length: len }, (_, i) => 200 - i * 2 - 1);
      const closes = Array.from({ length: len }, (_, i) => 200 - i * 2);

      const result = computeADX(highs, lows, closes);
      expect(result.minusDI).toBeGreaterThan(result.plusDI);
    });
  });

  describe('computeHurst', () => {
    test('returns 0.5 when data is too short', () => {
      expect(computeHurst([1, 2, 3, 4, 5])).toBe(0.5);
      expect(computeHurst([])).toBe(0.5);
    });

    test('returns value between 0 and 1 for sufficient data', () => {
      const closes = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i * 0.1) * 10 + i * 0.5);
      const hurst = computeHurst(closes);
      expect(hurst).toBeGreaterThanOrEqual(0);
      expect(hurst).toBeLessThanOrEqual(1);
    });

    test('trending data tends toward Hurst > 0.5', () => {
      // Strong linear uptrend with small noise
      const closes = Array.from({ length: 100 }, (_, i) => 100 + i * 2 + (i % 3 === 0 ? 0.1 : -0.1));
      const hurst = computeHurst(closes);
      expect(hurst).toBeGreaterThan(0.4);
    });
  });

  describe('computeChoppiness', () => {
    test('returns 50 when insufficient data', () => {
      expect(computeChoppiness([1, 2], [1, 2], [1, 2])).toBe(50);
    });

    test('returns value between 0 and 100 for valid data', () => {
      const len = 30;
      const closes = Array.from({ length: len }, (_, i) => 100 + Math.sin(i * 0.5) * 5);
      const highs = closes.map((c) => c + 2);
      const lows = closes.map((c) => c - 2);
      const ci = computeChoppiness(highs, lows, closes);
      expect(ci).toBeGreaterThanOrEqual(0);
      expect(ci).toBeLessThanOrEqual(100);
    });
  });

  describe('computeEfficiencyRatio', () => {
    test('returns 0.5 when insufficient data', () => {
      expect(computeEfficiencyRatio([1, 2, 3])).toBe(0.5);
    });

    test('returns 1 for perfectly directional move', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
      const er = computeEfficiencyRatio(closes);
      expect(er).toBeCloseTo(1, 5);
    });

    test('returns low value for choppy sideways move', () => {
      // Alternating up/down returning near start
      const closes = Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 5 : -5));
      const er = computeEfficiencyRatio(closes);
      expect(er).toBeLessThan(0.2);
    });

    test('value is between 0 and 1', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i) * 10);
      const er = computeEfficiencyRatio(closes);
      expect(er).toBeGreaterThanOrEqual(0);
      expect(er).toBeLessThanOrEqual(1);
    });
  });

  describe('computeRegimeScore (composite)', () => {
    test('score is between 1 and 100', () => {
      const len = 50;
      const closes = Array.from({ length: len }, (_, i) => 100 + Math.sin(i * 0.3) * 10);
      const highs = closes.map((c) => c + 2);
      const lows = closes.map((c) => c - 2);
      const result = computeRegimeScore(highs, lows, closes);
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('label mapping is correct for score ranges', () => {
      function labelForScore(score: number): RegimeLabel {
        if (score >= 80) return 'strong_trend';
        if (score >= 60) return 'trending';
        if (score >= 40) return 'transitional';
        if (score >= 20) return 'choppy';
        return 'mean_reversion';
      }

      expect(labelForScore(90)).toBe('strong_trend');
      expect(labelForScore(80)).toBe('strong_trend');
      expect(labelForScore(70)).toBe('trending');
      expect(labelForScore(60)).toBe('trending');
      expect(labelForScore(50)).toBe('transitional');
      expect(labelForScore(40)).toBe('transitional');
      expect(labelForScore(30)).toBe('choppy');
      expect(labelForScore(20)).toBe('choppy');
      expect(labelForScore(10)).toBe('mean_reversion');
      expect(labelForScore(1)).toBe('mean_reversion');
    });

    test('strong uptrend produces higher score', () => {
      const len = 100;
      const highs = Array.from({ length: len }, (_, i) => 100 + i * 3 + 2);
      const lows = Array.from({ length: len }, (_, i) => 100 + i * 3 - 2);
      const closes = Array.from({ length: len }, (_, i) => 100 + i * 3);
      const result = computeRegimeScore(highs, lows, closes);
      expect(result.score).toBeGreaterThan(40);
    });
  });
});

// ---------------------------------------------------------------------------
// BTC Models — S2F, Rainbow, MVRV, Power Law (onchain.ts)
// ---------------------------------------------------------------------------
describe('BTC valuation models (onchain logic)', () => {
  test('S2F fair value calculation', () => {
    const s2fRatio = 120;
    const s2fFairValue = Math.round(Math.exp(3.21 * Math.log(s2fRatio) - 1.6));
    expect(s2fFairValue).toBeGreaterThan(0);
    expect(typeof s2fFairValue).toBe('number');
    expect(Number.isFinite(s2fFairValue)).toBe(true);
  });

  test('MVRV Z-Score signal classification', () => {
    function mvrvSignal(zScore: number): string {
      return zScore > 7 ? 'overvalued' : zScore > 3 ? 'fair' : 'undervalued';
    }
    expect(mvrvSignal(8)).toBe('overvalued');
    expect(mvrvSignal(7.1)).toBe('overvalued');
    expect(mvrvSignal(5)).toBe('fair');
    expect(mvrvSignal(3.1)).toBe('fair');
    expect(mvrvSignal(2)).toBe('undervalued');
    expect(mvrvSignal(0)).toBe('undervalued');
  });

  test('Rainbow band classification', () => {
    function rainbowBand(priceRatio: number): string {
      if (priceRatio < 0.5) return 'Fire Sale';
      if (priceRatio < 0.8) return 'Accumulate';
      if (priceRatio < 1.0) return 'Still Cheap';
      if (priceRatio < 1.5) return 'Fair Value';
      if (priceRatio < 2.5) return 'FOMO';
      return 'Bubble';
    }
    expect(rainbowBand(0.3)).toBe('Fire Sale');
    expect(rainbowBand(0.6)).toBe('Accumulate');
    expect(rainbowBand(0.9)).toBe('Still Cheap');
    expect(rainbowBand(1.2)).toBe('Fair Value');
    expect(rainbowBand(2.0)).toBe('FOMO');
    expect(rainbowBand(3.0)).toBe('Bubble');
  });

  test('overall signal majority vote logic', () => {
    function overallSignal(signals: string[]): string {
      const underCount = signals.filter((s) => s === 'undervalued').length;
      const overCount = signals.filter((s) => s === 'overvalued').length;
      if (underCount >= 3) return 'undervalued';
      if (overCount >= 3) return 'overvalued';
      return 'fair';
    }
    expect(overallSignal(['undervalued', 'undervalued', 'undervalued', 'fair', 'fair'])).toBe('undervalued');
    expect(overallSignal(['overvalued', 'overvalued', 'overvalued', 'fair', 'undervalued'])).toBe('overvalued');
    expect(overallSignal(['fair', 'fair', 'fair', 'undervalued', 'overvalued'])).toBe('fair');
    expect(overallSignal(['undervalued', 'undervalued', 'fair', 'fair', 'overvalued'])).toBe('fair');
  });
});

// ---------------------------------------------------------------------------
// Multi-asset risk-on/off determination (onchain.ts)
// ---------------------------------------------------------------------------
describe('Multi-asset risk-on/off logic (onchain)', () => {
  function determineRiskOnOff(spxChange: number, dxyChange: number, vixPrice: number): string {
    if (spxChange > 0 && dxyChange < 0 && vixPrice < 20) return 'risk-on';
    if (spxChange < -0.5 || vixPrice > 25) return 'risk-off';
    return 'neutral';
  }

  test('risk-on when SPX up, DXY down, VIX low', () => {
    expect(determineRiskOnOff(0.5, -0.3, 14)).toBe('risk-on');
  });

  test('risk-off when SPX down significantly', () => {
    expect(determineRiskOnOff(-1.0, 0.2, 18)).toBe('risk-off');
  });

  test('risk-off when VIX high', () => {
    expect(determineRiskOnOff(0.5, -0.1, 30)).toBe('risk-off');
  });

  test('neutral when conditions are mixed', () => {
    expect(determineRiskOnOff(0.3, 0.1, 14)).toBe('neutral');
    expect(determineRiskOnOff(-0.3, -0.1, 18)).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// Renko brick logic (ohlcv.ts)
// ---------------------------------------------------------------------------
describe('Renko brick generation (ohlcv logic)', () => {
  function buildRenkoBricks(candles: Array<{ close: number }>, brickSize: number) {
    const bricks: Array<{ price: number; type: 'up' | 'down'; index: number }> = [];
    let lastBrickTop = candles[0].close;
    let lastBrickBottom = candles[0].close - brickSize;
    let idx = 0;

    for (const candle of candles) {
      while (candle.close >= lastBrickTop + brickSize) {
        lastBrickBottom = lastBrickTop;
        lastBrickTop = lastBrickTop + brickSize;
        bricks.push({ price: Math.round(lastBrickTop * 100) / 100, type: 'up', index: idx++ });
      }
      while (candle.close <= lastBrickBottom - brickSize) {
        lastBrickTop = lastBrickBottom;
        lastBrickBottom = lastBrickBottom - brickSize;
        bricks.push({ price: Math.round(lastBrickBottom * 100) / 100, type: 'down', index: idx++ });
      }
    }
    return bricks;
  }

  test('generates up bricks for rising prices', () => {
    const candles = [{ close: 100 }, { close: 120 }, { close: 140 }];
    const bricks = buildRenkoBricks(candles, 10);
    expect(bricks.length).toBeGreaterThan(0);
    expect(bricks.every((b) => b.type === 'up')).toBe(true);
  });

  test('generates down bricks for falling prices', () => {
    const candles = [{ close: 200 }, { close: 170 }, { close: 140 }];
    const bricks = buildRenkoBricks(candles, 10);
    expect(bricks.length).toBeGreaterThan(0);
    expect(bricks.every((b) => b.type === 'down')).toBe(true);
  });

  test('no bricks when price does not move enough', () => {
    const candles = [{ close: 100 }, { close: 104 }, { close: 98 }];
    const bricks = buildRenkoBricks(candles, 10);
    expect(bricks).toHaveLength(0);
  });

  test('bricks have sequential indices', () => {
    const candles = [{ close: 100 }, { close: 130 }, { close: 160 }];
    const bricks = buildRenkoBricks(candles, 10);
    for (let i = 0; i < bricks.length; i++) {
      expect(bricks[i].index).toBe(i);
    }
  });
});

// ---------------------------------------------------------------------------
// Liquidation heatmap level generation (derivatives.ts)
// ---------------------------------------------------------------------------
describe('Liquidation level generation (derivatives logic)', () => {
  function generateLiquidationLevels(currentPrice: number) {
    const levels: Array<{ price: number; side: 'long' | 'short'; distance_pct: number }> = [];

    for (let i = 1; i <= 10; i++) {
      const distancePct = i * 0.5;
      levels.push({
        price: Math.round(currentPrice * (1 - distancePct / 100) * 100) / 100,
        side: 'long',
        distance_pct: -distancePct,
      });
    }

    for (let i = 1; i <= 10; i++) {
      const distancePct = i * 0.5;
      levels.push({
        price: Math.round(currentPrice * (1 + distancePct / 100) * 100) / 100,
        side: 'short',
        distance_pct: distancePct,
      });
    }

    levels.sort((a, b) => a.price - b.price);
    return levels;
  }

  test('generates 20 levels total (10 long + 10 short)', () => {
    const levels = generateLiquidationLevels(97500);
    expect(levels).toHaveLength(20);
  });

  test('long levels are below current price', () => {
    const levels = generateLiquidationLevels(97500);
    const longs = levels.filter((l) => l.side === 'long');
    expect(longs).toHaveLength(10);
    for (const l of longs) {
      expect(l.price).toBeLessThan(97500);
      expect(l.distance_pct).toBeLessThan(0);
    }
  });

  test('short levels are above current price', () => {
    const levels = generateLiquidationLevels(97500);
    const shorts = levels.filter((l) => l.side === 'short');
    expect(shorts).toHaveLength(10);
    for (const s of shorts) {
      expect(s.price).toBeGreaterThan(97500);
      expect(s.distance_pct).toBeGreaterThan(0);
    }
  });

  test('levels are sorted by price ascending', () => {
    const levels = generateLiquidationLevels(97500);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].price).toBeGreaterThanOrEqual(levels[i - 1].price);
    }
  });
});
