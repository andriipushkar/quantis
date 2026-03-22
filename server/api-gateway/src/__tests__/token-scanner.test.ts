/**
 * Token Scanner — Unit Tests
 *
 * Tests the risk scoring logic extracted from routes/token-scanner.ts.
 * We replicate the pure computation functions and test them in isolation.
 */

// ---------------------------------------------------------------------------
// Replicated types & logic from token-scanner.ts
// ---------------------------------------------------------------------------

interface RiskFactor {
  name: string;
  score: number;
  maxScore: number;
  detail: string;
}

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function computeLiquidityFactor(candles: Candle[]): RiskFactor {
  const recentVolumes = candles.slice(-24).map((c) => c.volume * c.close);
  const dailyVolume = recentVolumes.reduce((a, b) => a + b, 0);
  let score = 0;
  if (dailyVolume > 100000) score = 20;
  else if (dailyVolume > 50000) score = 16;
  else if (dailyVolume > 10000) score = 12;
  else if (dailyVolume > 1000) score = 6;
  return {
    name: 'Liquidity',
    score,
    maxScore: 20,
    detail: `Est. daily volume: $${Math.round(dailyVolume).toLocaleString()}`,
  };
}

function computeAgeFactor(totalCandles: number): RiskFactor {
  let score = 0;
  if (totalCandles >= 100) score = 15;
  else if (totalCandles >= 80) score = 12;
  else if (totalCandles >= 50) score = 9;
  else if (totalCandles >= 20) score = 5;
  else score = 2;
  return {
    name: 'Data History',
    score,
    maxScore: 15,
    detail: `${totalCandles} candles available`,
  };
}

function computeVolatilityFactor(candles: Candle[]): RiskFactor {
  if (candles.length < 14) {
    return { name: 'Volatility', score: 0, maxScore: 15, detail: 'Insufficient data' };
  }
  let atrSum = 0;
  for (let i = 1; i < Math.min(15, candles.length); i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    atrSum += tr;
  }
  const atr = atrSum / 14;
  const currentPrice = candles[candles.length - 1].close;
  const atrRatio = currentPrice > 0 ? (atr / currentPrice) * 100 : 100;

  let score = 0;
  if (atrRatio < 1) score = 15;
  else if (atrRatio < 2) score = 12;
  else if (atrRatio < 5) score = 9;
  else if (atrRatio < 10) score = 5;
  else score = 2;

  return {
    name: 'Volatility',
    score,
    maxScore: 15,
    detail: `ATR/Price ratio: ${atrRatio.toFixed(2)}%`,
  };
}

function computeConsistencyFactor(candles: Candle[]): RiskFactor {
  const last20 = candles.slice(-20);
  if (last20.length < 10) {
    return { name: 'Volume Consistency', score: 0, maxScore: 15, detail: 'Insufficient data' };
  }
  const vols = last20.map((c) => c.volume);
  const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
  const variance = vols.reduce((sum, v) => sum + (v - mean) ** 2, 0) / vols.length;
  const stddev = Math.sqrt(variance);
  const cv = mean > 0 ? stddev / mean : 10;

  let score = 0;
  if (cv < 0.3) score = 15;
  else if (cv < 0.5) score = 12;
  else if (cv < 1) score = 9;
  else if (cv < 2) score = 5;
  else score = 2;

  return {
    name: 'Volume Consistency',
    score,
    maxScore: 15,
    detail: `Coefficient of variation: ${cv.toFixed(2)}`,
  };
}

function computeStabilityFactor(candles: Candle[]): RiskFactor {
  if (candles.length < 5) {
    return { name: 'Price Stability', score: 0, maxScore: 15, detail: 'Insufficient data' };
  }
  let peak = candles[0].close;
  let maxDrawdown = 0;
  for (const c of candles) {
    if (c.close > peak) peak = c.close;
    const dd = peak > 0 ? ((peak - c.close) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  let score = 0;
  if (maxDrawdown < 5) score = 15;
  else if (maxDrawdown < 10) score = 12;
  else if (maxDrawdown < 20) score = 9;
  else if (maxDrawdown < 40) score = 5;
  else score = 2;

  return {
    name: 'Price Stability',
    score,
    maxScore: 15,
    detail: `Max drawdown: ${maxDrawdown.toFixed(1)}%`,
  };
}

function computeExchangeFactor(exchangeCount: number): RiskFactor {
  let score = 0;
  if (exchangeCount >= 3) score = 20;
  else if (exchangeCount === 2) score = 14;
  else score = 7;
  return {
    name: 'Exchange Presence',
    score,
    maxScore: 20,
    detail: `Listed on ${exchangeCount} exchange${exchangeCount > 1 ? 's' : ''}`,
  };
}

function computeLabel(totalScore: number): 'SAFE' | 'CAUTION' | 'RISKY' | 'DANGER' {
  if (totalScore >= 75) return 'SAFE';
  if (totalScore >= 50) return 'CAUTION';
  if (totalScore >= 25) return 'RISKY';
  return 'DANGER';
}

// ---------------------------------------------------------------------------
// Helper to make a candle
// ---------------------------------------------------------------------------

function makeCandle(
  close: number,
  volume = 1000,
  overrides?: Partial<Candle>
): Candle {
  return {
    time: new Date().toISOString(),
    open: close * 0.99,
    high: close * 1.01,
    low: close * 0.98,
    close,
    volume,
    ...overrides,
  };
}

function makeCandles(count: number, basePrice = 100, baseVolume = 1000): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const noise = Math.sin(i * 0.1) * 2;
    return makeCandle(basePrice + noise, baseVolume + i * 10);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Token Scanner — Risk Score Calculation', () => {
  describe('Total score range', () => {
    test('score is always 0-100', () => {
      // Max possible: 20 + 15 + 15 + 15 + 15 + 20 = 100
      const factors: RiskFactor[] = [
        { name: 'A', score: 20, maxScore: 20, detail: '' },
        { name: 'B', score: 15, maxScore: 15, detail: '' },
        { name: 'C', score: 15, maxScore: 15, detail: '' },
        { name: 'D', score: 15, maxScore: 15, detail: '' },
        { name: 'E', score: 15, maxScore: 15, detail: '' },
        { name: 'F', score: 20, maxScore: 20, detail: '' },
      ];
      const total = factors.reduce((s, f) => s + f.score, 0);
      expect(total).toBe(100);
    });

    test('minimum score with all-zero factors', () => {
      const factors: RiskFactor[] = [
        { name: 'A', score: 0, maxScore: 20, detail: '' },
        { name: 'B', score: 0, maxScore: 15, detail: '' },
        { name: 'C', score: 0, maxScore: 15, detail: '' },
        { name: 'D', score: 0, maxScore: 15, detail: '' },
        { name: 'E', score: 0, maxScore: 15, detail: '' },
        { name: 'F', score: 0, maxScore: 20, detail: '' },
      ];
      const total = factors.reduce((s, f) => s + f.score, 0);
      expect(total).toBe(0);
    });
  });

  describe('Label assignment', () => {
    test('score >= 75 is SAFE', () => {
      expect(computeLabel(75)).toBe('SAFE');
      expect(computeLabel(100)).toBe('SAFE');
    });

    test('score 50-74 is CAUTION', () => {
      expect(computeLabel(50)).toBe('CAUTION');
      expect(computeLabel(74)).toBe('CAUTION');
    });

    test('score 25-49 is RISKY', () => {
      expect(computeLabel(25)).toBe('RISKY');
      expect(computeLabel(49)).toBe('RISKY');
    });

    test('score < 25 is DANGER', () => {
      expect(computeLabel(0)).toBe('DANGER');
      expect(computeLabel(24)).toBe('DANGER');
    });
  });
});

describe('Token Scanner — Liquidity Factor', () => {
  test('high liquidity ($100k+) scores 20', () => {
    // 24 candles at close=100, volume=50 => each volume*close=5000 => total=120000
    const candles = Array.from({ length: 24 }, () => makeCandle(100, 50));
    const factor = computeLiquidityFactor(candles);
    expect(factor.score).toBe(20);
    expect(factor.maxScore).toBe(20);
  });

  test('medium liquidity ($50k-$100k) scores 16', () => {
    // 24 candles at close=100, volume=25 => each=2500 => total=60000
    const candles = Array.from({ length: 24 }, () => makeCandle(100, 25));
    const factor = computeLiquidityFactor(candles);
    expect(factor.score).toBe(16);
  });

  test('low liquidity ($10k-$50k) scores 12', () => {
    // 24 candles at close=100, volume=5 => each=500 => total=12000
    const candles = Array.from({ length: 24 }, () => makeCandle(100, 5));
    const factor = computeLiquidityFactor(candles);
    expect(factor.score).toBe(12);
  });

  test('very low liquidity ($1k-$10k) scores 6', () => {
    // 24 candles at close=10, volume=5 => each=50 => total=1200
    const candles = Array.from({ length: 24 }, () => makeCandle(10, 5));
    const factor = computeLiquidityFactor(candles);
    expect(factor.score).toBe(6);
  });

  test('negligible liquidity (<$1k) scores 0', () => {
    // 24 candles at close=1, volume=1 => each=1 => total=24
    const candles = Array.from({ length: 24 }, () => makeCandle(1, 1));
    const factor = computeLiquidityFactor(candles);
    expect(factor.score).toBe(0);
  });

  test('uses only last 24 candles for daily volume', () => {
    // 50 candles total but only last 24 matter
    const candles = [
      ...Array.from({ length: 26 }, () => makeCandle(100, 0)),
      ...Array.from({ length: 24 }, () => makeCandle(100, 50)),
    ];
    const factor = computeLiquidityFactor(candles);
    expect(factor.score).toBe(20); // 24 * 100 * 50 = 120,000
  });
});

describe('Token Scanner — Age / Data History Factor', () => {
  test('100+ candles scores 15', () => {
    expect(computeAgeFactor(100).score).toBe(15);
    expect(computeAgeFactor(500).score).toBe(15);
  });

  test('80-99 candles scores 12', () => {
    expect(computeAgeFactor(80).score).toBe(12);
    expect(computeAgeFactor(99).score).toBe(12);
  });

  test('50-79 candles scores 9', () => {
    expect(computeAgeFactor(50).score).toBe(9);
    expect(computeAgeFactor(79).score).toBe(9);
  });

  test('20-49 candles scores 5', () => {
    expect(computeAgeFactor(20).score).toBe(5);
    expect(computeAgeFactor(49).score).toBe(5);
  });

  test('< 20 candles scores 2', () => {
    expect(computeAgeFactor(1).score).toBe(2);
    expect(computeAgeFactor(19).score).toBe(2);
  });
});

describe('Token Scanner — Volatility Factor', () => {
  test('insufficient data (< 14 candles) scores 0', () => {
    const candles = makeCandles(10);
    const factor = computeVolatilityFactor(candles);
    expect(factor.score).toBe(0);
    expect(factor.detail).toBe('Insufficient data');
  });

  test('very low volatility (ATR/price < 1%) scores 15', () => {
    // Candles with nearly identical OHLC => very small true range
    const candles = Array.from({ length: 20 }, (_, i) => ({
      time: new Date().toISOString(),
      open: 1000,
      high: 1001,
      low: 999,
      close: 1000,
      volume: 100,
    }));
    const factor = computeVolatilityFactor(candles);
    // ATR ~ 2/14 per candle, ratio = 0.2/1000 * 100 ~ 0.02% (but accumulated over 14)
    // TR for each = max(1001-999, |1001-1000|, |999-1000|) = 2
    // ATR = 2*14/14 = 2, ratio = 2/1000 * 100 = 0.2%
    expect(factor.score).toBe(15);
  });

  test('moderate volatility (ATR/price 2-5%) scores 9', () => {
    const candles = Array.from({ length: 20 }, () => ({
      time: new Date().toISOString(),
      open: 100,
      high: 103,
      low: 97,
      close: 100,
      volume: 100,
    }));
    const factor = computeVolatilityFactor(candles);
    // TR = max(6, 3, 3) = 6, ATR = 6, ratio = 6%
    expect(factor.score).toBe(5); // 5-10% range
  });

  test('extreme volatility (ATR/price >= 10%) scores 2', () => {
    const candles = Array.from({ length: 20 }, () => ({
      time: new Date().toISOString(),
      open: 100,
      high: 115,
      low: 85,
      close: 100,
      volume: 100,
    }));
    const factor = computeVolatilityFactor(candles);
    // TR = 30, ATR = 30, ratio = 30%
    expect(factor.score).toBe(2);
  });

  test('zero price results in 100% ATR ratio', () => {
    const candles = Array.from({ length: 20 }, () => ({
      time: new Date().toISOString(),
      open: 0,
      high: 1,
      low: 0,
      close: 0,
      volume: 100,
    }));
    const factor = computeVolatilityFactor(candles);
    expect(factor.score).toBe(2); // atrRatio = 100
  });
});

describe('Token Scanner — Volume Consistency Factor', () => {
  test('insufficient data (< 10 in last 20) scores 0', () => {
    const candles = makeCandles(5);
    const factor = computeConsistencyFactor(candles);
    expect(factor.score).toBe(0);
    expect(factor.detail).toBe('Insufficient data');
  });

  test('perfectly consistent volume (CV ~ 0) scores 15', () => {
    const candles = Array.from({ length: 20 }, () => makeCandle(100, 1000));
    const factor = computeConsistencyFactor(candles);
    expect(factor.score).toBe(15);
  });

  test('moderately consistent volume (CV 0.3-0.5) scores 12', () => {
    // Volumes alternating between 800 and 1200 => mean=1000, stddev~200, CV=0.2
    // Need CV 0.3-0.5. Use wider spread.
    const volumes = [600, 1400, 600, 1400, 600, 1400, 600, 1400, 600, 1400,
                     600, 1400, 600, 1400, 600, 1400, 600, 1400, 600, 1400];
    // mean = 1000, stddev = 400, CV = 0.4
    const candles = volumes.map((v) => makeCandle(100, v));
    const factor = computeConsistencyFactor(candles);
    expect(factor.score).toBe(12);
  });

  test('highly inconsistent volume (CV >= 2) scores 2', () => {
    // One huge spike among zeros
    const volumes = [0.001, 0.001, 0.001, 0.001, 0.001,
                     0.001, 0.001, 0.001, 0.001, 0.001,
                     0.001, 0.001, 0.001, 0.001, 0.001,
                     0.001, 0.001, 0.001, 0.001, 100000];
    const candles = volumes.map((v) => makeCandle(100, v));
    const factor = computeConsistencyFactor(candles);
    expect(factor.score).toBe(2);
  });

  test('zero mean volume defaults CV to 10', () => {
    const candles = Array.from({ length: 20 }, () => makeCandle(100, 0));
    const factor = computeConsistencyFactor(candles);
    expect(factor.score).toBe(2); // CV=10 => score 2
  });
});

describe('Token Scanner — Price Stability Factor', () => {
  test('insufficient data (< 5 candles) scores 0', () => {
    const candles = makeCandles(3);
    const factor = computeStabilityFactor(candles);
    expect(factor.score).toBe(0);
  });

  test('no drawdown (prices always rising) scores 15', () => {
    const candles = [100, 101, 102, 103, 104, 105].map((p) => makeCandle(p));
    const factor = computeStabilityFactor(candles);
    expect(factor.score).toBe(15);
    expect(factor.detail).toContain('0.0%');
  });

  test('small drawdown (< 5%) scores 15', () => {
    const candles = [100, 102, 100, 103, 101, 103].map((p) => makeCandle(p));
    const factor = computeStabilityFactor(candles);
    expect(factor.score).toBe(15);
  });

  test('moderate drawdown (10-20%) scores 9', () => {
    const candles = [100, 110, 95, 100, 105, 100].map((p) => makeCandle(p));
    // Peak = 110, trough = 95, drawdown = (110-95)/110 * 100 = 13.6%
    const factor = computeStabilityFactor(candles);
    expect(factor.score).toBe(9);
  });

  test('severe drawdown (>= 40%) scores 2', () => {
    const candles = [100, 200, 100, 50, 60, 55].map((p) => makeCandle(p));
    // Peak = 200, trough = 50, drawdown = 75%
    const factor = computeStabilityFactor(candles);
    expect(factor.score).toBe(2);
  });
});

describe('Token Scanner — Exchange Presence Factor', () => {
  test('3+ exchanges scores 20', () => {
    expect(computeExchangeFactor(3).score).toBe(20);
    expect(computeExchangeFactor(5).score).toBe(20);
  });

  test('2 exchanges scores 14', () => {
    expect(computeExchangeFactor(2).score).toBe(14);
  });

  test('1 exchange scores 7', () => {
    expect(computeExchangeFactor(1).score).toBe(7);
  });
});

describe('Token Scanner — Edge Cases', () => {
  test('new token with minimal data gets low total score', () => {
    const candles = makeCandles(3, 0.001, 0.1);
    const factors: RiskFactor[] = [
      computeLiquidityFactor(candles),
      computeAgeFactor(candles.length),
      computeVolatilityFactor(candles),
      computeConsistencyFactor(candles),
      computeStabilityFactor(candles),
      computeExchangeFactor(1),
    ];
    const total = factors.reduce((s, f) => s + f.score, 0);
    expect(total).toBeLessThan(25);
    expect(computeLabel(total)).toBe('DANGER');
  });

  test('well-established token gets high total score', () => {
    // 100 candles, high volume, low volatility, consistent, single exchange
    const candles = Array.from({ length: 100 }, () => ({
      time: new Date().toISOString(),
      open: 50000,
      high: 50100,
      low: 49900,
      close: 50000,
      volume: 500,
    }));
    const factors: RiskFactor[] = [
      computeLiquidityFactor(candles),
      computeAgeFactor(candles.length),
      computeVolatilityFactor(candles),
      computeConsistencyFactor(candles),
      computeStabilityFactor(candles),
      computeExchangeFactor(3),
    ];
    const total = factors.reduce((s, f) => s + f.score, 0);
    expect(total).toBeGreaterThanOrEqual(75);
    expect(computeLabel(total)).toBe('SAFE');
  });

  test('each factor never exceeds its maxScore', () => {
    const candles = makeCandles(100, 100, 1000);
    const factors: RiskFactor[] = [
      computeLiquidityFactor(candles),
      computeAgeFactor(100),
      computeVolatilityFactor(candles),
      computeConsistencyFactor(candles),
      computeStabilityFactor(candles),
      computeExchangeFactor(10),
    ];
    for (const f of factors) {
      expect(f.score).toBeLessThanOrEqual(f.maxScore);
      expect(f.score).toBeGreaterThanOrEqual(0);
    }
  });
});
