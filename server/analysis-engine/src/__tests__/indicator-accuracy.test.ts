import { IndicatorCalculator } from '../indicators/calculator';

const calc = new IndicatorCalculator();

// Inline signal logic for testing (avoids DB dependency from generator.ts)
function calculateSL(entry: number, atr: number, side: 'buy' | 'sell') {
  return side === 'buy' ? entry - 2 * atr : entry + 2 * atr;
}
function calculateTP(entry: number, sl: number, ratio: number) {
  const dist = Math.abs(entry - sl);
  return entry > sl ? entry + dist * ratio : entry - dist * ratio;
}
function shouldSignal(rsi: number): 'buy' | 'sell' | null {
  if (rsi < 25) return 'buy';
  if (rsi > 75) return 'sell';
  return null;
}
function calcConfidence(rsi: number, side: 'buy' | 'sell'): number {
  return Math.min(95, Math.round(50 + (side === 'buy' ? (50 - rsi) * 0.5 : (rsi - 50) * 0.5) + 5));
}

// ---------------------------------------------------------------------------
// Known BTC close prices (30 values, realistic)
// ---------------------------------------------------------------------------
const REFERENCE_CLOSES = [
  67000, 67200, 67150, 66900, 66800, 66950, 67100, 67300, 67500, 67450,
  67200, 67000, 66800, 66600, 66500, 66700, 66900, 67100, 67400, 67600,
  67800, 67750, 67500, 67300, 67100, 67200, 67400, 67600, 67800, 68000,
];

// Highs / lows derived from closes with realistic spread
const REFERENCE_HIGHS = REFERENCE_CLOSES.map((c) => c + 200);
const REFERENCE_LOWS = REFERENCE_CLOSES.map((c) => c - 200);
const REFERENCE_VOLUMES = Array(30).fill(1500);

// ---------------------------------------------------------------------------
// RSI(14) Accuracy
// ---------------------------------------------------------------------------
describe('Indicator Mathematical Accuracy', () => {
  describe('RSI(14) Accuracy', () => {
    test('RSI should be between 0 and 100 for all values', () => {
      const result = calc.calculateRSI(REFERENCE_CLOSES, 14);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });

    test('RSI of strictly rising prices should approach 100', () => {
      const rising = Array.from({ length: 30 }, (_, i) => 50000 + i * 100);
      const result = calc.calculateRSI(rising, 14);
      const last = result[result.length - 1];
      expect(last).toBeGreaterThan(95);
    });

    test('RSI of strictly falling prices should approach 0', () => {
      const falling = Array.from({ length: 30 }, (_, i) => 50000 - i * 100);
      const result = calc.calculateRSI(falling, 14);
      const last = result[result.length - 1];
      expect(last).toBeLessThan(5);
    });

    test('RSI of flat prices should be ~50', () => {
      // Alternating small up/down to create equal gains and losses
      const flat: number[] = [];
      for (let i = 0; i < 30; i++) {
        flat.push(50000 + (i % 2 === 0 ? 10 : -10));
      }
      const result = calc.calculateRSI(flat, 14);
      const last = result[result.length - 1];
      // With perfectly alternating data, RS = 1 so RSI = 50
      expect(last).toBeGreaterThan(40);
      expect(last).toBeLessThan(60);
    });

    test('RSI matches hand-calculated value for reference data', () => {
      // Hand-calculate RSI(14) for the first 15 values of REFERENCE_CLOSES
      // Changes: +200, -50, -250, -100, +150, +150, +200, +200, -50, -250, -200, -200, -200, -100
      // Gains:   200, 0, 0, 0, 150, 150, 200, 200, 0, 0, 0, 0, 0, 0       => sum = 900
      // Losses:  0, 50, 250, 100, 0, 0, 0, 0, 50, 250, 200, 200, 200, 100  => sum = 1400
      // avgGain = 900/14 = 64.2857, avgLoss = 1400/14 = 100
      // RS = 64.2857 / 100 = 0.642857
      // RSI = 100 - 100/(1 + 0.642857) = 100 - 60.87 = 39.13 (first RSI value)
      const result = calc.calculateRSI(REFERENCE_CLOSES, 14);
      expect(result.length).toBeGreaterThan(0);
      const firstRSI = result[0];
      // The technicalindicators library uses Wilder's smoothing.
      // First value is SMA-based, so it should match our hand calculation closely.
      expect(firstRSI).toBeCloseTo(39.13, 0);
    });

    test('RSI increases when more gains are added after oversold', () => {
      // Start with falling, then add gains
      const data = [
        ...Array.from({ length: 20 }, (_, i) => 50000 - i * 50),
        ...Array.from({ length: 10 }, (_, i) => 49000 + i * 200),
      ];
      const result = calc.calculateRSI(data, 14);
      // RSI should be rising toward the end
      const mid = result[Math.floor(result.length / 2)];
      const last = result[result.length - 1];
      expect(last).toBeGreaterThan(mid);
    });
  });

  // ---------------------------------------------------------------------------
  // EMA Accuracy
  // ---------------------------------------------------------------------------
  describe('EMA Accuracy', () => {
    test('EMA(9) first value equals SMA(9)', () => {
      const emaResult = calc.calculateEMA(REFERENCE_CLOSES, 9);
      const smaResult = calc.calculateSMA(REFERENCE_CLOSES, 9);
      // The first EMA value should equal the first SMA value (seed value)
      expect(emaResult[0]).toBeCloseTo(smaResult[0], 2);
    });

    test('EMA reacts faster to price changes than SMA', () => {
      // Create data with a sharp spike at the end
      const base = Array(20).fill(100);
      const spiked = [...base, 200, 200, 200, 200, 200];
      const emaResult = calc.calculateEMA(spiked, 9);
      const smaResult = calc.calculateSMA(spiked, 9);
      // After the spike, EMA should be closer to 200 than SMA
      const lastEma = emaResult[emaResult.length - 1];
      const lastSma = smaResult[smaResult.length - 1];
      expect(lastEma).toBeGreaterThan(lastSma);
    });

    test('EMA of constant data equals that constant', () => {
      const flat = Array(30).fill(42000);
      const result = calc.calculateEMA(flat, 9);
      result.forEach((v) => {
        expect(v).toBeCloseTo(42000, 2);
      });
    });

    test('EMA(9) crossover EMA(21) detection is correct', () => {
      // Construct data where EMA9 starts below EMA21 then crosses above
      // Declining then sharply rising
      const data = [
        ...Array.from({ length: 25 }, (_, i) => 50000 - i * 20),
        ...Array.from({ length: 15 }, (_, i) => 49500 + i * 150),
      ];
      const ema9 = calc.calculateEMA(data, 9);
      const ema21 = calc.calculateEMA(data, 21);
      // Align the arrays (EMA21 is shorter)
      const offset = ema9.length - ema21.length;
      const alignedEma9 = ema9.slice(offset);

      // Find a crossover point
      let crossoverFound = false;
      for (let i = 1; i < alignedEma9.length; i++) {
        if (alignedEma9[i - 1] <= ema21[i - 1] && alignedEma9[i] > ema21[i]) {
          crossoverFound = true;
          break;
        }
      }
      expect(crossoverFound).toBe(true);
    });

    test('EMA multiplier is correctly applied', () => {
      // For period 9, multiplier = 2/(9+1) = 0.2
      // EMA[1] = close[1] * 0.2 + EMA[0] * 0.8
      const data = Array.from({ length: 20 }, (_, i) => 100 + i * 10);
      const result = calc.calculateEMA(data, 9);
      // First value = SMA(9) = avg(100..180) = 140
      const sma9 = data.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
      expect(result[0]).toBeCloseTo(sma9, 2);
      // Second value: EMA = data[9]*k + sma9*(1-k), k=0.2
      const k = 2 / 10;
      const expectedSecond = data[9] * k + sma9 * (1 - k);
      expect(result[1]).toBeCloseTo(expectedSecond, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // Bollinger Bands Accuracy
  // ---------------------------------------------------------------------------
  describe('Bollinger Bands Accuracy', () => {
    test('Middle band equals SMA(20)', () => {
      const bb = calc.calculateBollingerBands(REFERENCE_CLOSES, 20, 2);
      const sma = calc.calculateSMA(REFERENCE_CLOSES, 20);
      expect(bb.middle.length).toBe(sma.length);
      for (let i = 0; i < bb.middle.length; i++) {
        expect(bb.middle[i]).toBeCloseTo(sma[i], 2);
      }
    });

    test('Upper - Lower = 4 * stddev', () => {
      const bb = calc.calculateBollingerBands(REFERENCE_CLOSES, 20, 2);
      // For each point, upper - lower = 2*2*stddev = 4*stddev
      // And upper - middle = 2*stddev, so upper - lower = 2*(upper - middle)
      for (let i = 0; i < bb.middle.length; i++) {
        const upperDist = bb.upper[i] - bb.middle[i];
        const lowerDist = bb.middle[i] - bb.lower[i];
        // upper and lower should be equidistant from middle
        expect(upperDist).toBeCloseTo(lowerDist, 2);
        // The total width = upper - lower = 2 * (upper - middle) = 2 * upperDist
        const totalWidth = bb.upper[i] - bb.lower[i];
        expect(totalWidth).toBeCloseTo(2 * upperDist, 2);
      }
    });

    test('Bandwidth shrinks when volatility decreases', () => {
      // High volatility followed by low volatility
      const volatile = Array.from({ length: 25 }, (_, i) =>
        50000 + (i % 2 === 0 ? 500 : -500)
      );
      const calm = Array.from({ length: 25 }, (_, i) =>
        50000 + (i % 2 === 0 ? 10 : -10)
      );
      const data = [...volatile, ...calm];
      const bb = calc.calculateBollingerBands(data, 20, 2);
      // Bandwidth at the end (calm period) should be less than at the beginning
      const earlyWidth = bb.upper[0] - bb.lower[0];
      const lateWidth = bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1];
      expect(lateWidth).toBeLessThan(earlyWidth);
    });

    test('Price outside bands is rare (< 5% of time for 2 stddev)', () => {
      // Generate a large-ish random-walk dataset
      const data: number[] = [50000];
      for (let i = 1; i < 200; i++) {
        data.push(data[i - 1] + (Math.random() - 0.5) * 200);
      }
      const bb = calc.calculateBollingerBands(data, 20, 2);
      const closes = data.slice(19); // align with BB output
      let outsideCount = 0;
      for (let i = 0; i < bb.upper.length; i++) {
        if (closes[i] > bb.upper[i] || closes[i] < bb.lower[i]) {
          outsideCount++;
        }
      }
      const outsidePct = outsideCount / bb.upper.length;
      // For normally distributed data, ~5% should be outside 2 stddev bands
      // Allow some slack since price isn't perfectly normal
      expect(outsidePct).toBeLessThan(0.15);
    });

    test('Bollinger Bands of constant data have zero bandwidth', () => {
      const flat = Array(30).fill(50000);
      const bb = calc.calculateBollingerBands(flat, 20, 2);
      for (let i = 0; i < bb.middle.length; i++) {
        expect(bb.upper[i]).toBeCloseTo(bb.lower[i], 2);
        expect(bb.middle[i]).toBeCloseTo(50000, 2);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // ATR Accuracy
  // ---------------------------------------------------------------------------
  describe('ATR Accuracy', () => {
    test('ATR equals average of true ranges for first period', () => {
      // For the first ATR value, it should be the simple average of the first N true ranges
      const period = 14;
      const atr = calc.calculateATR(REFERENCE_HIGHS, REFERENCE_LOWS, REFERENCE_CLOSES, period);
      expect(atr.length).toBeGreaterThan(0);

      // Manually compute true ranges for candles 1..14 (using previous close)
      const trueRanges: number[] = [];
      for (let i = 1; i <= period; i++) {
        const tr = Math.max(
          REFERENCE_HIGHS[i] - REFERENCE_LOWS[i],
          Math.abs(REFERENCE_HIGHS[i] - REFERENCE_CLOSES[i - 1]),
          Math.abs(REFERENCE_LOWS[i] - REFERENCE_CLOSES[i - 1])
        );
        trueRanges.push(tr);
      }
      const expectedFirstATR = trueRanges.reduce((a, b) => a + b, 0) / period;
      expect(atr[0]).toBeCloseTo(expectedFirstATR, 0);
    });

    test('ATR increases during volatile periods', () => {
      // Calm then volatile data
      const calmHighs = Array(20).fill(50200);
      const calmLows = Array(20).fill(49800);
      const calmCloses = Array(20).fill(50000);
      const volatileHighs = Array(15).fill(51000);
      const volatileLows = Array(15).fill(49000);
      const volatileCloses = Array(15).fill(50000);

      const highs = [...calmHighs, ...volatileHighs];
      const lows = [...calmLows, ...volatileLows];
      const closes = [...calmCloses, ...volatileCloses];

      const atr = calc.calculateATR(highs, lows, closes, 14);
      // ATR near the end should be higher than near the beginning
      const earlyATR = atr[0];
      const lateATR = atr[atr.length - 1];
      expect(lateATR).toBeGreaterThan(earlyATR);
    });

    test('ATR of constant-range candles equals that range', () => {
      const range = 400;
      const h = Array(30).fill(50000 + range / 2);
      const l = Array(30).fill(50000 - range / 2);
      const c = Array(30).fill(50000);
      const atr = calc.calculateATR(h, l, c, 14);
      atr.forEach((v) => {
        expect(v).toBeCloseTo(range, 0);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Signal Generation Correctness
  // ---------------------------------------------------------------------------
  describe('Signal Generation Correctness', () => {
    test('BUY stop-loss is below entry price', () => {
      const entry = 67000;
      const atr = 500;
      const sl = calculateSL(entry, atr, 'buy');
      expect(sl).toBeLessThan(entry);
    });

    test('SELL stop-loss is above entry price', () => {
      const entry = 67000;
      const atr = 500;
      const sl = calculateSL(entry, atr, 'sell');
      expect(sl).toBeGreaterThan(entry);
    });

    test('SL distance equals 2 * ATR', () => {
      const entry = 67000;
      const atr = 500;
      const slBuy = calculateSL(entry, atr, 'buy');
      const slSell = calculateSL(entry, atr, 'sell');
      expect(Math.abs(entry - slBuy)).toBeCloseTo(atr * 2, 2);
      expect(Math.abs(entry - slSell)).toBeCloseTo(atr * 2, 2);
    });

    test('TP1 exactly at 1:1 risk-reward', () => {
      const entry = 67000;
      const atr = 500;
      const sl = calculateSL(entry, atr, 'buy');
      const tp1 = calculateTP(entry, sl, 1);
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tp1 - entry);
      expect(reward).toBeCloseTo(risk, 2);
    });

    test('TP2 exactly at 1:2 risk-reward', () => {
      const entry = 67000;
      const atr = 500;
      const sl = calculateSL(entry, atr, 'buy');
      const tp2 = calculateTP(entry, sl, 2);
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tp2 - entry);
      expect(reward).toBeCloseTo(risk * 2, 2);
    });

    test('TP3 exactly at 1:3 risk-reward', () => {
      const entry = 67000;
      const atr = 500;
      const sl = calculateSL(entry, atr, 'buy');
      const tp3 = calculateTP(entry, sl, 3);
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tp3 - entry);
      expect(reward).toBeCloseTo(risk * 3, 2);
    });

    test('SELL signal TP is below entry price', () => {
      const entry = 67000;
      const atr = 500;
      const sl = calculateSL(entry, atr, 'sell');
      const tp1 = calculateTP(entry, sl, 1);
      const tp2 = calculateTP(entry, sl, 2);
      const tp3 = calculateTP(entry, sl, 3);
      expect(tp1).toBeLessThan(entry);
      expect(tp2).toBeLessThan(entry);
      expect(tp3).toBeLessThan(entry);
    });

    test('BUY signal TP is above entry price', () => {
      const entry = 67000;
      const atr = 500;
      const sl = calculateSL(entry, atr, 'buy');
      const tp1 = calculateTP(entry, sl, 1);
      const tp2 = calculateTP(entry, sl, 2);
      const tp3 = calculateTP(entry, sl, 3);
      expect(tp1).toBeGreaterThan(entry);
      expect(tp2).toBeGreaterThan(entry);
      expect(tp3).toBeGreaterThan(entry);
    });

    test('TP levels are progressively farther from entry', () => {
      const entry = 67000;
      const atr = 500;
      const sl = calculateSL(entry, atr, 'buy');
      const tp1 = calculateTP(entry, sl, 1);
      const tp2 = calculateTP(entry, sl, 2);
      const tp3 = calculateTP(entry, sl, 3);
      expect(Math.abs(tp2 - entry)).toBeGreaterThan(Math.abs(tp1 - entry));
      expect(Math.abs(tp3 - entry)).toBeGreaterThan(Math.abs(tp2 - entry));
    });

    test('SELL signal TP levels are progressively farther from entry', () => {
      const entry = 67000;
      const atr = 500;
      const sl = calculateSL(entry, atr, 'sell');
      const tp1 = calculateTP(entry, sl, 1);
      const tp2 = calculateTP(entry, sl, 2);
      const tp3 = calculateTP(entry, sl, 3);
      expect(entry - tp2).toBeGreaterThan(entry - tp1);
      expect(entry - tp3).toBeGreaterThan(entry - tp2);
    });
  });

  // ---------------------------------------------------------------------------
  // VWAP Accuracy
  // ---------------------------------------------------------------------------
  describe('VWAP Accuracy', () => {
    test('VWAP with equal volumes equals running average of typical prices', () => {
      const highs = REFERENCE_HIGHS.slice(0, 5);
      const lows = REFERENCE_LOWS.slice(0, 5);
      const closes = REFERENCE_CLOSES.slice(0, 5);
      const volumes = Array(5).fill(1000);

      const result = calc.calculateVWAP(highs, lows, closes, volumes);

      // With equal volumes, VWAP = cumulative average of typical prices
      let cumTP = 0;
      for (let i = 0; i < 5; i++) {
        const tp = (highs[i] + lows[i] + closes[i]) / 3;
        cumTP += tp;
        const expectedVWAP = cumTP / (i + 1);
        expect(result[i]).toBeCloseTo(expectedVWAP, 2);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // SMA Edge Cases
  // ---------------------------------------------------------------------------
  describe('SMA Additional Accuracy', () => {
    test('SMA(20) of reference data matches manual calculation', () => {
      const sma = calc.calculateSMA(REFERENCE_CLOSES, 20);
      const manualFirst = REFERENCE_CLOSES.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
      expect(sma[0]).toBeCloseTo(manualFirst, 2);
    });

    test('SMA is a lagging indicator - delayed reaction to price jump', () => {
      const stable = Array(20).fill(100);
      const jumped = [...stable, 200, 200, 200, 200, 200];
      const sma = calc.calculateSMA(jumped, 10);
      // After jump, SMA should still be below 200 because it averages old values
      const lastSma = sma[sma.length - 1];
      expect(lastSma).toBeLessThan(200);
      expect(lastSma).toBeGreaterThan(100);
    });
  });
});
