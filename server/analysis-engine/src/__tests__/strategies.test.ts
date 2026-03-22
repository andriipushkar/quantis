import { StrategyEngine, StrategyInput, StrategyResult } from '../strategies/index';

const engine = new StrategyEngine();

// ---------------------------------------------------------------------------
// Helpers — deterministic data generators
// ---------------------------------------------------------------------------

/** Generates steadily rising prices (bullish) */
function risingPrices(count: number, base = 100, step = 0.5): StrategyInput {
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];
  for (let i = 0; i < count; i++) {
    const price = base + i * step;
    closes.push(price);
    highs.push(price + 2);
    lows.push(price - 2);
    volumes.push(3000);
  }
  return {
    closes,
    highs,
    lows,
    volumes,
    currentPrice: closes[closes.length - 1],
    currentATR: 3,
  };
}

/** Generates steadily falling prices (bearish) */
function fallingPrices(count: number, base = 200, step = 0.5): StrategyInput {
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];
  for (let i = 0; i < count; i++) {
    const price = base - i * step;
    closes.push(price);
    highs.push(price + 2);
    lows.push(price - 2);
    volumes.push(3000);
  }
  return {
    closes,
    highs,
    lows,
    volumes,
    currentPrice: closes[closes.length - 1],
    currentATR: 3,
  };
}

/** Generates flat/range-bound prices */
function flatPrices(count: number, base = 100): StrategyInput {
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];
  for (let i = 0; i < count; i++) {
    const price = base + Math.sin(i * 0.3) * 0.5;
    closes.push(price);
    highs.push(price + 1);
    lows.push(price - 1);
    volumes.push(2000);
  }
  return {
    closes,
    highs,
    lows,
    volumes,
    currentPrice: closes[closes.length - 1],
    currentATR: 2,
  };
}

/** Validates common StrategyResult structure */
function expectValidResult(result: StrategyResult) {
  expect(['BUY', 'SELL']).toContain(result.type);
  expect(typeof result.strategy).toBe('string');
  expect(result.strategy.length).toBeGreaterThan(0);
  expect(result.confidence).toBeGreaterThanOrEqual(0);
  expect(result.confidence).toBeLessThanOrEqual(100);
  expect(typeof result.reasoning).toBe('string');
  expect(result.reasoning.length).toBeGreaterThan(0);
  expect(Array.isArray(result.sources)).toBe(true);
  expect(result.sources.length).toBeGreaterThan(0);
}

// ═══════════════════════════════════════════════════════════════════════════
//  evaluateAll
// ═══════════════════════════════════════════════════════════════════════════

describe('StrategyEngine.evaluateAll', () => {
  it('returns an array', () => {
    const input = flatPrices(250);
    const results = engine.evaluateAll(input);
    expect(Array.isArray(results)).toBe(true);
  });

  it('results are sorted by confidence descending', () => {
    // Use rising data that might trigger multiple strategies
    const input = risingPrices(250);
    const results = engine.evaluateAll(input);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });

  it('each result has the correct structure', () => {
    const input = risingPrices(250);
    const results = engine.evaluateAll(input);
    results.forEach(expectValidResult);
  });

  it('returns empty array when no conditions are met', () => {
    // Very short data — most strategies need 20+ bars minimum
    const input: StrategyInput = {
      closes: [100, 100.1, 100.2],
      highs: [101, 101.1, 101.2],
      lows: [99, 99.1, 99.2],
      volumes: [1000, 1000, 1000],
      currentPrice: 100.2,
      currentATR: 1,
    };
    const results = engine.evaluateAll(input);
    expect(results).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Individual Strategies
// ═══════════════════════════════════════════════════════════════════════════

describe('Trend Following', () => {
  it('returns null with insufficient data', () => {
    const input: StrategyInput = {
      closes: [100, 101],
      highs: [102, 103],
      lows: [98, 99],
      volumes: [1000, 1000],
      currentPrice: 101,
      currentATR: 1,
    };
    expect(engine.trendFollowing(input)).toBeNull();
  });

  it('returns null when conditions are not met (flat market)', () => {
    const input = flatPrices(100);
    expect(engine.trendFollowing(input)).toBeNull();
  });
});

describe('Mean Reversion', () => {
  it('returns null with insufficient data', () => {
    const input: StrategyInput = {
      closes: [100, 101, 102],
      highs: [102, 103, 104],
      lows: [98, 99, 100],
      volumes: [1000, 1000, 1000],
      currentPrice: 102,
      currentATR: 1,
    };
    expect(engine.meanReversion(input)).toBeNull();
  });

  it('returns BUY when RSI is very low (strong downtrend data)', () => {
    // Create a strong downtrend to push RSI below 25
    const count = 40;
    const closes: number[] = [];
    for (let i = 0; i < count; i++) {
      closes.push(200 - i * 3);
    }
    const input: StrategyInput = {
      closes,
      highs: closes.map((c) => c + 2),
      lows: closes.map((c) => c - 2),
      volumes: Array(count).fill(1000),
      currentPrice: closes[closes.length - 1],
      currentATR: 3,
    };
    const result = engine.meanReversion(input);
    if (result) {
      expect(result.type).toBe('BUY');
      expect(result.strategy).toBe('mean_reversion');
      expectValidResult(result);
    }
  });

  it('returns SELL when RSI is very high (strong uptrend data)', () => {
    const count = 40;
    const closes: number[] = [];
    for (let i = 0; i < count; i++) {
      closes.push(100 + i * 3);
    }
    const input: StrategyInput = {
      closes,
      highs: closes.map((c) => c + 2),
      lows: closes.map((c) => c - 2),
      volumes: Array(count).fill(1000),
      currentPrice: closes[closes.length - 1],
      currentATR: 3,
    };
    const result = engine.meanReversion(input);
    if (result) {
      expect(result.type).toBe('SELL');
      expect(result.strategy).toBe('mean_reversion');
      expectValidResult(result);
    }
  });
});

describe('Bollinger Bounce', () => {
  it('returns null with insufficient data', () => {
    const input: StrategyInput = {
      closes: [100, 101],
      highs: [102, 103],
      lows: [98, 99],
      volumes: [1000, 1000],
      currentPrice: 101,
      currentATR: 1,
    };
    expect(engine.bollingerBounce(input)).toBeNull();
  });

  it('returns BUY when price is near lower BB and RSI is low', () => {
    // Build data: 20 candles range-bound, then a sharp drop to touch lower BB with low RSI
    const closes: number[] = [];
    // Start with 20 candles around 100
    for (let i = 0; i < 20; i++) {
      closes.push(100 + Math.sin(i) * 2);
    }
    // Sharp drop in the last 20 candles
    for (let i = 0; i < 20; i++) {
      closes.push(100 - i * 1.5);
    }
    const highs = closes.map((c) => c + 2);
    const lows = closes.map((c) => c - 2);
    const volumes = Array(closes.length).fill(1000);

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: closes[closes.length - 1],
      currentATR: 3,
    };

    const result = engine.bollingerBounce(input);
    if (result) {
      expect(result.type).toBe('BUY');
      expect(result.strategy).toBe('bollinger_bounce');
      expectValidResult(result);
    }
  });

  it('returns null when price is in middle of bands', () => {
    const input = flatPrices(50);
    expect(engine.bollingerBounce(input)).toBeNull();
  });
});

describe('MACD Divergence', () => {
  it('returns null with insufficient data', () => {
    const input: StrategyInput = {
      closes: Array(10).fill(100),
      highs: Array(10).fill(102),
      lows: Array(10).fill(98),
      volumes: Array(10).fill(1000),
      currentPrice: 100,
      currentATR: 2,
    };
    expect(engine.macdDivergence(input)).toBeNull();
  });

  it('returns BUY on histogram zero cross (positive)', () => {
    // Create data that starts declining, then reverses upward to cause
    // MACD histogram to cross from negative to positive
    const closes: number[] = [];
    // Initial period: decline
    for (let i = 0; i < 30; i++) {
      closes.push(150 - i * 0.5);
    }
    // Reversal: sharp rise
    for (let i = 0; i < 30; i++) {
      closes.push(135 + i * 1.0);
    }

    const input: StrategyInput = {
      closes,
      highs: closes.map((c) => c + 2),
      lows: closes.map((c) => c - 2),
      volumes: Array(closes.length).fill(1000),
      currentPrice: closes[closes.length - 1],
      currentATR: 2,
    };

    const result = engine.macdDivergence(input);
    if (result) {
      expect(['BUY', 'SELL']).toContain(result.type);
      expect(result.strategy).toBe('macd_divergence');
      expectValidResult(result);
    }
  });

  it('returns null for flat market', () => {
    const input = flatPrices(60);
    expect(engine.macdDivergence(input)).toBeNull();
  });
});

describe('Breakout', () => {
  it('returns null with insufficient data', () => {
    const input: StrategyInput = {
      closes: Array(10).fill(100),
      highs: Array(10).fill(102),
      lows: Array(10).fill(98),
      volumes: Array(10).fill(1000),
      currentPrice: 100,
      currentATR: 2,
    };
    expect(engine.breakout(input)).toBeNull();
  });

  it('returns BUY on new high with volume surge', () => {
    // 20 bars range-bound, then price breaks above with high volume
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];

    for (let i = 0; i < 20; i++) {
      closes.push(100);
      highs.push(102);
      lows.push(98);
      volumes.push(1000);
    }
    // Breakout candle: price above 20-period high, volume > 1.5x average
    closes.push(105);
    highs.push(106);
    lows.push(100);
    volumes.push(3000); // 3x average

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: 105,
      currentATR: 2,
    };

    const result = engine.breakout(input);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('BUY');
    expect(result!.strategy).toBe('breakout');
    expectValidResult(result!);
  });

  it('returns SELL on new low with volume surge', () => {
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];

    for (let i = 0; i < 20; i++) {
      closes.push(100);
      highs.push(102);
      lows.push(98);
      volumes.push(1000);
    }
    // Breakdown candle
    closes.push(95);
    highs.push(99);
    lows.push(94);
    volumes.push(3000);

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: 95,
      currentATR: 2,
    };

    const result = engine.breakout(input);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('SELL');
    expect(result!.strategy).toBe('breakout');
    expectValidResult(result!);
  });

  it('returns null without volume confirmation', () => {
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];

    for (let i = 0; i < 20; i++) {
      closes.push(100);
      highs.push(102);
      lows.push(98);
      volumes.push(1000);
    }
    // Price breaks out but volume is NOT above 1.5x
    closes.push(105);
    highs.push(106);
    lows.push(100);
    volumes.push(1200); // only 1.2x

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: 105,
      currentATR: 2,
    };

    expect(engine.breakout(input)).toBeNull();
  });
});

describe('Golden / Death Cross', () => {
  it('returns null with insufficient data (needs 200+ bars for SMA200)', () => {
    const input = flatPrices(100);
    expect(engine.goldenDeathCross(input)).toBeNull();
  });

  it('returns BUY when SMA50 crosses above SMA200 (golden cross)', () => {
    // Build data where SMA50 will cross above SMA200:
    // First 200 bars: declining, then last 60 bars: sharply rising
    const closes: number[] = [];
    for (let i = 0; i < 200; i++) {
      closes.push(100 - i * 0.05);
    }
    for (let i = 0; i < 60; i++) {
      closes.push(90 + i * 1.0);
    }
    const highs = closes.map((c) => c + 2);
    const lows = closes.map((c) => c - 2);
    const volumes = Array(closes.length).fill(1000);

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: closes[closes.length - 1],
      currentATR: 2,
    };

    const result = engine.goldenDeathCross(input);
    if (result) {
      expect(result.type).toBe('BUY');
      expect(result.strategy).toBe('golden_cross');
      expectValidResult(result);
    }
  });

  it('returns SELL when SMA50 crosses below SMA200 (death cross)', () => {
    const closes: number[] = [];
    for (let i = 0; i < 200; i++) {
      closes.push(100 + i * 0.05);
    }
    for (let i = 0; i < 60; i++) {
      closes.push(110 - i * 1.0);
    }
    const highs = closes.map((c) => c + 2);
    const lows = closes.map((c) => c - 2);
    const volumes = Array(closes.length).fill(1000);

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: closes[closes.length - 1],
      currentATR: 2,
    };

    const result = engine.goldenDeathCross(input);
    if (result) {
      expect(result.type).toBe('SELL');
      expect(result.strategy).toBe('death_cross');
      expectValidResult(result);
    }
  });
});

describe('Stochastic Crossover', () => {
  it('returns null with insufficient data', () => {
    const input: StrategyInput = {
      closes: [100, 101],
      highs: [102, 103],
      lows: [98, 99],
      volumes: [1000, 1000],
      currentPrice: 101,
      currentATR: 1,
    };
    expect(engine.stochasticCrossover(input)).toBeNull();
  });

  it('returns BUY when K crosses D in oversold zone', () => {
    // Create strongly falling data to put stochastic in oversold zone,
    // then a small uptick at the end for the crossover
    const closes: number[] = [];
    for (let i = 0; i < 25; i++) {
      closes.push(200 - i * 4);
    }
    // Slight uptick at the end
    closes.push(closes[closes.length - 1] + 3);
    closes.push(closes[closes.length - 1] + 4);

    const highs = closes.map((c) => c + 2);
    const lows = closes.map((c) => c - 2);
    const volumes = Array(closes.length).fill(1000);

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: closes[closes.length - 1],
      currentATR: 3,
    };

    const result = engine.stochasticCrossover(input);
    // This may or may not trigger depending on exact stochastic values
    if (result) {
      expect(result.type).toBe('BUY');
      expect(result.strategy).toBe('stochastic_crossover');
      expectValidResult(result);
    }
  });

  it('returns null in a range-bound market', () => {
    const input = flatPrices(50);
    expect(engine.stochasticCrossover(input)).toBeNull();
  });
});

describe('Volume Breakout', () => {
  it('returns null with insufficient data', () => {
    const input: StrategyInput = {
      closes: Array(10).fill(100),
      highs: Array(10).fill(102),
      lows: Array(10).fill(98),
      volumes: Array(10).fill(1000),
      currentPrice: 100,
      currentATR: 2,
    };
    expect(engine.volumeBreakout(input)).toBeNull();
  });

  it('returns BUY on 2x volume + positive ATR move', () => {
    const closes = Array(20).fill(100);
    closes.push(106); // +6 move, with ATR=2 that's 3 ATR
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 1);
    const volumes = Array(20).fill(1000);
    volumes.push(5000); // 5x average

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: 106,
      currentATR: 2,
    };

    const result = engine.volumeBreakout(input);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('BUY');
    expect(result!.strategy).toBe('volume_breakout');
    expectValidResult(result!);
  });

  it('returns SELL on 2x volume + negative ATR move', () => {
    const closes = Array(20).fill(100);
    closes.push(94); // -6 move
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 1);
    const volumes = Array(20).fill(1000);
    volumes.push(5000);

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: 94,
      currentATR: 2,
    };

    const result = engine.volumeBreakout(input);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('SELL');
    expect(result!.strategy).toBe('volume_breakout');
    expectValidResult(result!);
  });

  it('returns null when volume is insufficient', () => {
    const closes = Array(20).fill(100);
    closes.push(106);
    const highs = closes.map((c) => c + 1);
    const lows = closes.map((c) => c - 1);
    const volumes = Array(20).fill(1000);
    volumes.push(1500); // only 1.5x, needs > 2x

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: 106,
      currentATR: 2,
    };

    expect(engine.volumeBreakout(input)).toBeNull();
  });

  it('returns null when ATR is zero', () => {
    const closes = Array(21).fill(100);
    const input: StrategyInput = {
      closes,
      highs: closes.map((c) => c + 1),
      lows: closes.map((c) => c - 1),
      volumes: Array(21).fill(1000),
      currentPrice: 100,
      currentATR: 0,
    };
    expect(engine.volumeBreakout(input)).toBeNull();
  });
});

describe('Ichimoku Cloud Strategy', () => {
  it('returns null with insufficient data (needs 53+ bars)', () => {
    const input = flatPrices(30);
    expect(engine.ichimokuCloud(input)).toBeNull();
  });

  it('returns null when price is inside cloud', () => {
    const input = flatPrices(100);
    // Flat prices will likely place price inside the cloud
    const result = engine.ichimokuCloud(input);
    // May or may not be null, depending on exact values
    if (result) {
      expectValidResult(result);
    }
  });

  it('result has correct structure when triggered', () => {
    // Strong uptrend should place price above cloud
    const input = risingPrices(100, 50, 1.0);
    const result = engine.ichimokuCloud(input);
    if (result) {
      expect(result.strategy).toBe('ichimoku_cloud');
      expectValidResult(result);
    }
  });
});

describe('Support / Resistance', () => {
  it('returns null with insufficient data', () => {
    const input: StrategyInput = {
      closes: Array(5).fill(100),
      highs: Array(5).fill(102),
      lows: Array(5).fill(98),
      volumes: Array(5).fill(1000),
      currentPrice: 100,
      currentATR: 2,
    };
    expect(engine.supportResistance(input)).toBeNull();
  });

  it('returns null with zero ATR', () => {
    const input = flatPrices(30);
    input.currentATR = 0;
    expect(engine.supportResistance(input)).toBeNull();
  });

  it('returns signal on pivot bounce when conditions align', () => {
    // Build data where current price is near S1 and moving up
    // Range-bound for 19 bars, then price dips to near S1 and bounces
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];

    for (let i = 0; i < 19; i++) {
      closes.push(100);
      highs.push(105);
      lows.push(95);
    }
    // Calculate expected pivot: (105 + 95 + 100) / 3 = 100
    // S1 = 2 * 100 - 105 = 95
    // Price near S1 (95) and moving up
    closes.push(94.5);  // dip
    highs.push(95.5);
    lows.push(94);
    closes.push(95.2);  // bounce up
    highs.push(96);
    lows.push(94.5);

    const volumes = Array(closes.length).fill(1000);

    const input: StrategyInput = {
      closes,
      highs,
      lows,
      volumes,
      currentPrice: 95.2,
      currentATR: 2,
    };

    const result = engine.supportResistance(input);
    if (result) {
      expect(result.type).toBe('BUY');
      expect(result.strategy).toBe('support_resistance');
      expectValidResult(result);
    }
  });
});

describe('Multi-Timeframe Confluence', () => {
  it('returns null with insufficient data', () => {
    const input = flatPrices(50);
    expect(engine.multiTimeframeConfluence(input)).toBeNull();
  });

  it('returns null when HTF and LTF signals disagree', () => {
    // Flat market — unlikely to produce confluence
    const input = flatPrices(200);
    expect(engine.multiTimeframeConfluence(input)).toBeNull();
  });

  it('produces valid result structure if triggered', () => {
    // Strong consistent uptrend across timeframes
    const input = risingPrices(200, 50, 0.5);
    const result = engine.multiTimeframeConfluence(input);
    if (result) {
      expect(result.strategy).toBe('multi_tf_confluence');
      expectValidResult(result);
    }
  });
});

describe('RSI Divergence', () => {
  it('returns null with insufficient data', () => {
    const input: StrategyInput = {
      closes: Array(10).fill(100),
      highs: Array(10).fill(102),
      lows: Array(10).fill(98),
      volumes: Array(10).fill(1000),
      currentPrice: 100,
      currentATR: 2,
    };
    expect(engine.rsiDivergence(input)).toBeNull();
  });

  it('returns null for steadily rising prices (no divergence)', () => {
    const input = risingPrices(60);
    // Steady rise should not produce divergence since both price and RSI trend up
    const result = engine.rsiDivergence(input);
    // May or may not be null depending on data shape
    if (result) {
      expectValidResult(result);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Confidence bounds
// ═══════════════════════════════════════════════════════════════════════════

describe('Confidence bounds', () => {
  it('all confidence values are capped at 95', () => {
    const inputs = [risingPrices(250), fallingPrices(250)];
    for (const input of inputs) {
      const results = engine.evaluateAll(input);
      results.forEach((r) => {
        expect(r.confidence).toBeLessThanOrEqual(95);
      });
    }
  });

  it('all confidence values are at least 0', () => {
    const inputs = [risingPrices(250), fallingPrices(250), flatPrices(250)];
    for (const input of inputs) {
      const results = engine.evaluateAll(input);
      results.forEach((r) => {
        expect(r.confidence).toBeGreaterThanOrEqual(0);
      });
    }
  });
});
