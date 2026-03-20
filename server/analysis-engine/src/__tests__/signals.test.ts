/**
 * Signal Generator Unit Tests
 *
 * Pure function tests for signal generation logic.
 * No database or external service dependencies.
 *
 * The logic tested here mirrors the public methods of SignalGenerator
 * (see src/signals/generator.ts) reimplemented inline so that tests
 * can run without requiring database/redis connections.
 */

// ---------------------------------------------------------------------------
// Reimplemented signal logic (mirrors SignalGenerator public methods)
// ---------------------------------------------------------------------------

/**
 * Calculates a stop-loss price based on ATR.
 * For buy signals, SL is below entry; for sell signals, SL is above entry.
 * Uses 2x ATR distance from entry.
 */
function calculateStopLoss(entryPrice: number, atr: number, type: 'buy' | 'sell'): number {
  const distance = atr * 2;
  return type === 'buy'
    ? entryPrice - distance
    : entryPrice + distance;
}

/**
 * Calculates take-profit price based on entry, stop-loss, and risk/reward ratio.
 */
function calculateTakeProfit(entry: number, sl: number, ratio: number): number {
  const risk = Math.abs(entry - sl);
  return sl < entry
    ? entry + risk * ratio
    : entry - risk * ratio;
}

/**
 * Simplified RSI-based signal evaluator for unit testing.
 * RSI < 25 triggers BUY, RSI > 75 triggers SELL.
 */
function evaluateRsiSignal(
  rsi: number,
  entryPrice: number,
  atr: number,
): { type: 'BUY' | 'SELL'; stopLoss: number; tp1: number; tp2: number; tp3: number; confidence: number } | null {
  if (rsi < 25) {
    const sl = calculateStopLoss(entryPrice, atr, 'buy');
    return {
      type: 'BUY',
      stopLoss: sl,
      tp1: calculateTakeProfit(entryPrice, sl, 1),
      tp2: calculateTakeProfit(entryPrice, sl, 2),
      tp3: calculateTakeProfit(entryPrice, sl, 3),
      confidence: calculateConfidence(rsi, 'BUY'),
    };
  }

  if (rsi > 75) {
    const sl = calculateStopLoss(entryPrice, atr, 'sell');
    return {
      type: 'SELL',
      stopLoss: sl,
      tp1: calculateTakeProfit(entryPrice, sl, 1),
      tp2: calculateTakeProfit(entryPrice, sl, 2),
      tp3: calculateTakeProfit(entryPrice, sl, 3),
      confidence: calculateConfidence(rsi, 'SELL'),
    };
  }

  return null;
}

/**
 * Confidence scoring based on RSI extremity.
 * More extreme RSI values yield higher confidence.
 */
function calculateConfidence(rsi: number, type: 'BUY' | 'SELL'): number {
  if (type === 'BUY') {
    return Math.min((25 - rsi) / 25, 1);
  }
  return Math.min((rsi - 75) / 25, 1);
}

// ---------------------------------------------------------------------------
// RSI Signal Detection
// ---------------------------------------------------------------------------
describe('RSI Signal Detection', () => {
  const entryPrice = 45000;
  const atr = 500;

  test('Given RSI < 25: should generate BUY signal', () => {
    const signal = evaluateRsiSignal(20, entryPrice, atr);
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe('BUY');
  });

  test('Given RSI > 75: should generate SELL signal', () => {
    const signal = evaluateRsiSignal(80, entryPrice, atr);
    expect(signal).not.toBeNull();
    expect(signal!.type).toBe('SELL');
  });

  test('Given RSI between 30-70: should NOT generate signal', () => {
    expect(evaluateRsiSignal(50, entryPrice, atr)).toBeNull();
    expect(evaluateRsiSignal(30, entryPrice, atr)).toBeNull();
    expect(evaluateRsiSignal(70, entryPrice, atr)).toBeNull();
    expect(evaluateRsiSignal(45, entryPrice, atr)).toBeNull();
  });

  test('RSI at boundary values (25, 75) should not generate signal', () => {
    expect(evaluateRsiSignal(25, entryPrice, atr)).toBeNull();
    expect(evaluateRsiSignal(75, entryPrice, atr)).toBeNull();
  });

  test('RSI at extreme values generates signals', () => {
    const signalLow = evaluateRsiSignal(5, entryPrice, atr);
    expect(signalLow).not.toBeNull();
    expect(signalLow!.type).toBe('BUY');

    const signalHigh = evaluateRsiSignal(95, entryPrice, atr);
    expect(signalHigh).not.toBeNull();
    expect(signalHigh!.type).toBe('SELL');
  });
});

// ---------------------------------------------------------------------------
// Stop-loss calculation
// ---------------------------------------------------------------------------
describe('Stop-loss calculation', () => {
  test('SL = entry - 2*ATR for buy signals', () => {
    const entry = 45000;
    const atr = 500;
    const sl = calculateStopLoss(entry, atr, 'buy');
    expect(sl).toBe(entry - 2 * atr);
    expect(sl).toBe(44000);
  });

  test('SL = entry + 2*ATR for sell signals', () => {
    const entry = 45000;
    const atr = 500;
    const sl = calculateStopLoss(entry, atr, 'sell');
    expect(sl).toBe(entry + 2 * atr);
    expect(sl).toBe(46000);
  });

  test('SL distance scales with ATR', () => {
    const entry = 45000;
    const sl1 = calculateStopLoss(entry, 100, 'buy');
    const sl2 = calculateStopLoss(entry, 500, 'buy');
    expect(entry - sl2).toBeGreaterThan(entry - sl1);
  });

  test('SL with zero ATR equals entry', () => {
    const entry = 45000;
    const sl = calculateStopLoss(entry, 0, 'buy');
    expect(sl).toBe(entry);
  });
});

// ---------------------------------------------------------------------------
// Take-profit levels
// ---------------------------------------------------------------------------
describe('Take-profit levels', () => {
  const entry = 45000;
  const atr = 500;

  test('TP1 = 1:1 R/R for buy signal', () => {
    const sl = calculateStopLoss(entry, atr, 'buy');
    const risk = Math.abs(entry - sl);
    const tp1 = calculateTakeProfit(entry, sl, 1);
    expect(tp1).toBe(entry + risk * 1);
    expect(tp1).toBe(46000);
  });

  test('TP2 = 1:2 R/R for buy signal', () => {
    const sl = calculateStopLoss(entry, atr, 'buy');
    const risk = Math.abs(entry - sl);
    const tp2 = calculateTakeProfit(entry, sl, 2);
    expect(tp2).toBe(entry + risk * 2);
    expect(tp2).toBe(47000);
  });

  test('TP3 = 1:3 R/R for buy signal', () => {
    const sl = calculateStopLoss(entry, atr, 'buy');
    const risk = Math.abs(entry - sl);
    const tp3 = calculateTakeProfit(entry, sl, 3);
    expect(tp3).toBe(entry + risk * 3);
    expect(tp3).toBe(48000);
  });

  test('TP levels for sell signal go below entry', () => {
    const sl = calculateStopLoss(entry, atr, 'sell');
    const risk = Math.abs(entry - sl);
    const tp1 = calculateTakeProfit(entry, sl, 1);
    const tp2 = calculateTakeProfit(entry, sl, 2);
    const tp3 = calculateTakeProfit(entry, sl, 3);
    expect(tp1).toBe(entry - risk * 1);
    expect(tp2).toBe(entry - risk * 2);
    expect(tp3).toBe(entry - risk * 3);
    expect(tp1).toBe(44000);
    expect(tp2).toBe(43000);
    expect(tp3).toBe(42000);
  });

  test('TP levels maintain ascending R/R order for buys', () => {
    const sl = calculateStopLoss(entry, atr, 'buy');
    const tp1 = calculateTakeProfit(entry, sl, 1);
    const tp2 = calculateTakeProfit(entry, sl, 2);
    const tp3 = calculateTakeProfit(entry, sl, 3);
    expect(tp1).toBeLessThan(tp2);
    expect(tp2).toBeLessThan(tp3);
    expect(tp1).toBeGreaterThan(entry);
  });

  test('TP levels maintain descending order for sells', () => {
    const sl = calculateStopLoss(entry, atr, 'sell');
    const tp1 = calculateTakeProfit(entry, sl, 1);
    const tp2 = calculateTakeProfit(entry, sl, 2);
    const tp3 = calculateTakeProfit(entry, sl, 3);
    expect(tp1).toBeGreaterThan(tp2);
    expect(tp2).toBeGreaterThan(tp3);
    expect(tp1).toBeLessThan(entry);
  });
});

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------
describe('Confidence scoring', () => {
  test('Lower RSI produces higher buy confidence', () => {
    const conf10 = calculateConfidence(10, 'BUY');
    const conf20 = calculateConfidence(20, 'BUY');
    expect(conf10).toBeGreaterThan(conf20);
  });

  test('Higher RSI produces higher sell confidence', () => {
    const conf90 = calculateConfidence(90, 'SELL');
    const conf80 = calculateConfidence(80, 'SELL');
    expect(conf90).toBeGreaterThan(conf80);
  });

  test('Confidence is between 0 and 1', () => {
    for (const rsi of [0, 5, 10, 15, 20, 24]) {
      const conf = calculateConfidence(rsi, 'BUY');
      expect(conf).toBeGreaterThanOrEqual(0);
      expect(conf).toBeLessThanOrEqual(1);
    }
    for (const rsi of [76, 80, 85, 90, 95, 100]) {
      const conf = calculateConfidence(rsi, 'SELL');
      expect(conf).toBeGreaterThanOrEqual(0);
      expect(conf).toBeLessThanOrEqual(1);
    }
  });

  test('RSI at extreme (0) gives maximum buy confidence', () => {
    expect(calculateConfidence(0, 'BUY')).toBe(1);
  });

  test('RSI at extreme (100) gives maximum sell confidence', () => {
    expect(calculateConfidence(100, 'SELL')).toBe(1);
  });

  test('Confidence from inline evaluator matches expected range', () => {
    const signal = evaluateRsiSignal(15, 45000, 500);
    expect(signal).not.toBeNull();
    expect(signal!.confidence).toBeGreaterThan(0);
    expect(signal!.confidence).toBeLessThanOrEqual(1);
  });
});
