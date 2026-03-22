import calculator from '../indicators/calculator.js';

// ── Types ────────────────────────────────────────────────────────────

export interface StrategyResult {
  type: 'BUY' | 'SELL';
  strategy: string;
  confidence: number;
  reasoning: string;
  sources: string[];
}

export interface StrategyInput {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  currentPrice: number;
  currentATR: number;
}

// ── Strategy Engine ──────────────────────────────────────────────────

export class StrategyEngine {
  /**
   * Runs all 12 strategies (2 original + 10 new) and returns every signal
   * that fired, sorted by confidence descending.
   */
  evaluateAll(input: StrategyInput): StrategyResult[] {
    const strategies: Array<(input: StrategyInput) => StrategyResult | null> = [
      (i) => this.trendFollowing(i),
      (i) => this.meanReversion(i),
      (i) => this.bollingerBounce(i),
      (i) => this.macdDivergence(i),
      (i) => this.breakout(i),
      (i) => this.goldenDeathCross(i),
      (i) => this.rsiDivergence(i),
      (i) => this.stochasticCrossover(i),
      (i) => this.volumeBreakout(i),
      (i) => this.ichimokuCloud(i),
      (i) => this.supportResistance(i),
      (i) => this.multiTimeframeConfluence(i),
    ];

    const results: StrategyResult[] = [];
    for (const fn of strategies) {
      const r = fn(input);
      if (r) results.push(r);
    }

    // Sort by confidence descending so the caller can pick the best
    results.sort((a, b) => b.confidence - a.confidence);
    return results;
  }

  // ── Helper: safe last N values ─────────────────────────────────────

  private last(arr: number[], n = 1): number[] {
    return arr.slice(-n);
  }

  // ── Original Strategy 1: Trend Following ───────────────────────────

  trendFollowing(input: StrategyInput): StrategyResult | null {
    const { closes, volumes } = input;

    const ema9 = calculator.calculateEMA(closes, 9);
    const ema21 = calculator.calculateEMA(closes, 21);
    const rsi = calculator.calculateRSI(closes, 14);

    if (ema9.length < 2 || ema21.length < 2 || rsi.length < 1) return null;

    const curEma9 = ema9[ema9.length - 1];
    const prevEma9 = ema9[ema9.length - 2];
    const curEma21 = ema21[ema21.length - 1];
    const prevEma21 = ema21[ema21.length - 2];
    const curRsi = rsi[rsi.length - 1];

    const avgVol = volumes.slice(-20).reduce((s, v) => s + v, 0) / Math.min(volumes.length, 20);
    const curVol = volumes[volumes.length - 1];
    const volumeSurge = curVol > avgVol * 1.3;

    const bullishCross = prevEma9 <= prevEma21 && curEma9 > curEma21;
    const bearishCross = prevEma9 >= prevEma21 && curEma9 < curEma21;

    if (bullishCross && curRsi > 45 && curRsi < 75 && volumeSurge) {
      const spread = Math.abs(curEma9 - curEma21) / curEma21;
      const confidence = Math.min(95, Math.round(50 + (curRsi - 50) * 0.5 + spread * 500 + 10));
      return {
        type: 'BUY',
        strategy: 'trend_following',
        confidence,
        reasoning: `EMA(9) crossed above EMA(21) with RSI at ${curRsi.toFixed(1)} and volume surge confirmed.`,
        sources: ['EMA(9)', 'EMA(21)', 'RSI(14)', 'Volume'],
      };
    }

    if (bearishCross && curRsi < 55 && curRsi > 25 && volumeSurge) {
      const spread = Math.abs(curEma9 - curEma21) / curEma21;
      const confidence = Math.min(95, Math.round(50 + (50 - curRsi) * 0.5 + spread * 500 + 10));
      return {
        type: 'SELL',
        strategy: 'trend_following',
        confidence,
        reasoning: `EMA(9) crossed below EMA(21) with RSI at ${curRsi.toFixed(1)} and volume surge confirmed.`,
        sources: ['EMA(9)', 'EMA(21)', 'RSI(14)', 'Volume'],
      };
    }

    return null;
  }

  // ── Original Strategy 2: Mean Reversion ────────────────────────────

  meanReversion(input: StrategyInput): StrategyResult | null {
    const { closes } = input;
    const rsi = calculator.calculateRSI(closes, 14);

    if (rsi.length < 1) return null;
    const curRsi = rsi[rsi.length - 1];

    if (curRsi < 25) {
      const confidence = Math.min(95, Math.round(50 + (25 - curRsi) * 2 + 5));
      return {
        type: 'BUY',
        strategy: 'mean_reversion',
        confidence,
        reasoning: `RSI(14) at ${curRsi.toFixed(1)} indicates oversold conditions. Mean reversion expected.`,
        sources: ['RSI(14)', 'Mean Reversion'],
      };
    }

    if (curRsi > 75) {
      const confidence = Math.min(95, Math.round(50 + (curRsi - 75) * 2 + 5));
      return {
        type: 'SELL',
        strategy: 'mean_reversion',
        confidence,
        reasoning: `RSI(14) at ${curRsi.toFixed(1)} indicates overbought conditions. Mean reversion expected.`,
        sources: ['RSI(14)', 'Mean Reversion'],
      };
    }

    return null;
  }

  // ── Strategy 3: Bollinger Bounce ───────────────────────────────────

  bollingerBounce(input: StrategyInput): StrategyResult | null {
    const { closes } = input;

    const bb = calculator.calculateBollingerBands(closes, 20, 2);
    const rsi = calculator.calculateRSI(closes, 14);

    if (bb.lower.length < 1 || rsi.length < 1) return null;

    const curPrice = closes[closes.length - 1];
    const curLower = bb.lower[bb.lower.length - 1];
    const curUpper = bb.upper[bb.upper.length - 1];
    const curMiddle = bb.middle[bb.middle.length - 1];
    const curRsi = rsi[rsi.length - 1];

    // BUY: price touches lower BB + RSI < 35
    const touchLower = curPrice <= curLower * 1.005;
    // SELL: price touches upper BB + RSI > 65
    const touchUpper = curPrice >= curUpper * 0.995;

    if (touchLower && curRsi < 35) {
      // Confidence: deeper RSI + closer to band = higher
      const rsiScore = Math.min((35 - curRsi) / 35, 1) * 40;
      const bandProximity = curLower > 0 ? Math.max(1 - Math.abs(curPrice - curLower) / Math.abs(curMiddle - curLower), 0) * 30 : 15;
      const confidence = Math.min(95, Math.round(30 + rsiScore + bandProximity));

      return {
        type: 'BUY',
        strategy: 'bollinger_bounce',
        confidence,
        reasoning: `Price touching lower Bollinger Band (${curLower.toFixed(2)}) with RSI at ${curRsi.toFixed(1)}. Bounce expected.`,
        sources: ['Bollinger Bands(20,2)', 'RSI(14)'],
      };
    }

    if (touchUpper && curRsi > 65) {
      const rsiScore = Math.min((curRsi - 65) / 35, 1) * 40;
      const bandProximity = curUpper > 0 ? Math.max(1 - Math.abs(curPrice - curUpper) / Math.abs(curUpper - curMiddle), 0) * 30 : 15;
      const confidence = Math.min(95, Math.round(30 + rsiScore + bandProximity));

      return {
        type: 'SELL',
        strategy: 'bollinger_bounce',
        confidence,
        reasoning: `Price touching upper Bollinger Band (${curUpper.toFixed(2)}) with RSI at ${curRsi.toFixed(1)}. Rejection expected.`,
        sources: ['Bollinger Bands(20,2)', 'RSI(14)'],
      };
    }

    return null;
  }

  // ── Strategy 4: MACD Divergence ────────────────────────────────────

  macdDivergence(input: StrategyInput): StrategyResult | null {
    const { closes } = input;

    const macd = calculator.calculateMACD(closes, 12, 26, 9);

    if (macd.histogram.length < 2 || macd.macd.length < 1 || macd.signal.length < 1) return null;

    const curHist = macd.histogram[macd.histogram.length - 1];
    const prevHist = macd.histogram[macd.histogram.length - 2];
    const curMACD = macd.macd[macd.macd.length - 1];
    const curSignal = macd.signal[macd.signal.length - 1];

    // Positive zero-line cross: histogram goes from negative to positive
    const bullishCross = prevHist <= 0 && curHist > 0;
    // Negative zero-line cross: histogram goes from positive to negative
    const bearishCross = prevHist >= 0 && curHist < 0;

    if (bullishCross && curMACD > curSignal) {
      const histStrength = Math.abs(curHist);
      const macdSpread = Math.abs(curMACD - curSignal);
      const confidence = Math.min(95, Math.round(45 + Math.min(histStrength / (input.currentPrice * 0.001), 1) * 25 + Math.min(macdSpread / (input.currentPrice * 0.001), 1) * 20));

      return {
        type: 'BUY',
        strategy: 'macd_divergence',
        confidence,
        reasoning: `MACD histogram crossed above zero (${curHist.toFixed(4)}). MACD (${curMACD.toFixed(4)}) above signal (${curSignal.toFixed(4)}). Bullish momentum.`,
        sources: ['MACD(12,26,9)', 'MACD Histogram', 'MACD Signal'],
      };
    }

    if (bearishCross && curMACD < curSignal) {
      const histStrength = Math.abs(curHist);
      const macdSpread = Math.abs(curMACD - curSignal);
      const confidence = Math.min(95, Math.round(45 + Math.min(histStrength / (input.currentPrice * 0.001), 1) * 25 + Math.min(macdSpread / (input.currentPrice * 0.001), 1) * 20));

      return {
        type: 'SELL',
        strategy: 'macd_divergence',
        confidence,
        reasoning: `MACD histogram crossed below zero (${curHist.toFixed(4)}). MACD (${curMACD.toFixed(4)}) below signal (${curSignal.toFixed(4)}). Bearish momentum.`,
        sources: ['MACD(12,26,9)', 'MACD Histogram', 'MACD Signal'],
      };
    }

    return null;
  }

  // ── Strategy 5: Breakout ───────────────────────────────────────────

  breakout(input: StrategyInput): StrategyResult | null {
    const { closes, highs, lows, volumes, currentATR } = input;

    if (closes.length < 21 || volumes.length < 21) return null;

    const curPrice = closes[closes.length - 1];
    const curVol = volumes[volumes.length - 1];

    // 20-period high/low (excluding current candle)
    const lookback = 20;
    const recentHighs = highs.slice(-(lookback + 1), -1);
    const recentLows = lows.slice(-(lookback + 1), -1);
    const high20 = Math.max(...recentHighs);
    const low20 = Math.min(...recentLows);

    // Volume condition: > 1.5x 20-period average
    const avgVol = volumes.slice(-(lookback + 1), -1).reduce((s, v) => s + v, 0) / lookback;
    const volumeConfirm = curVol > avgVol * 1.5;

    if (!volumeConfirm) return null;

    // Breakout above 20-period high
    if (curPrice > high20) {
      const breakoutMagnitude = (curPrice - high20) / currentATR;
      const volRatio = curVol / avgVol;
      const confidence = Math.min(95, Math.round(40 + Math.min(breakoutMagnitude, 2) * 15 + Math.min(volRatio - 1, 2) * 10));

      return {
        type: 'BUY',
        strategy: 'breakout',
        confidence,
        reasoning: `Price broke above 20-period high (${high20.toFixed(2)}) at ${curPrice.toFixed(2)} with ${volRatio.toFixed(1)}x average volume.`,
        sources: ['20-Period High', 'Volume', 'ATR(14)'],
      };
    }

    // Breakdown below 20-period low
    if (curPrice < low20) {
      const breakoutMagnitude = (low20 - curPrice) / currentATR;
      const volRatio = curVol / avgVol;
      const confidence = Math.min(95, Math.round(40 + Math.min(breakoutMagnitude, 2) * 15 + Math.min(volRatio - 1, 2) * 10));

      return {
        type: 'SELL',
        strategy: 'breakout',
        confidence,
        reasoning: `Price broke below 20-period low (${low20.toFixed(2)}) at ${curPrice.toFixed(2)} with ${volRatio.toFixed(1)}x average volume.`,
        sources: ['20-Period Low', 'Volume', 'ATR(14)'],
      };
    }

    return null;
  }

  // ── Strategy 6: Golden / Death Cross ───────────────────────────────

  goldenDeathCross(input: StrategyInput): StrategyResult | null {
    const { closes } = input;

    const sma50 = calculator.calculateSMA(closes, 50);
    const sma200 = calculator.calculateSMA(closes, 200);

    if (sma50.length < 2 || sma200.length < 2) return null;

    const curSma50 = sma50[sma50.length - 1];
    const prevSma50 = sma50[sma50.length - 2];
    const curSma200 = sma200[sma200.length - 1];
    const prevSma200 = sma200[sma200.length - 2];

    const goldenCross = prevSma50 <= prevSma200 && curSma50 > curSma200;
    const deathCross = prevSma50 >= prevSma200 && curSma50 < curSma200;

    if (goldenCross) {
      const spread = (curSma50 - curSma200) / curSma200;
      const confidence = Math.min(95, Math.round(60 + Math.min(spread / 0.005, 1) * 25));

      return {
        type: 'BUY',
        strategy: 'golden_cross',
        confidence,
        reasoning: `Golden Cross: SMA(50) (${curSma50.toFixed(2)}) crossed above SMA(200) (${curSma200.toFixed(2)}). Long-term bullish signal.`,
        sources: ['SMA(50)', 'SMA(200)'],
      };
    }

    if (deathCross) {
      const spread = (curSma200 - curSma50) / curSma200;
      const confidence = Math.min(95, Math.round(60 + Math.min(spread / 0.005, 1) * 25));

      return {
        type: 'SELL',
        strategy: 'death_cross',
        confidence,
        reasoning: `Death Cross: SMA(50) (${curSma50.toFixed(2)}) crossed below SMA(200) (${curSma200.toFixed(2)}). Long-term bearish signal.`,
        sources: ['SMA(50)', 'SMA(200)'],
      };
    }

    return null;
  }

  // ── Strategy 7: RSI Divergence ─────────────────────────────────────

  rsiDivergence(input: StrategyInput): StrategyResult | null {
    const { closes } = input;

    const rsi = calculator.calculateRSI(closes, 14);

    // Need enough data to find two swing points — at least 20 bars of RSI
    if (rsi.length < 20 || closes.length < 20) return null;

    // We compare the last 20 bars of closes and RSI for divergence.
    // Align: RSI output is shorter than closes by (period) bars.
    // RSI[i] corresponds to closes[i + (closes.length - rsi.length)]
    const offset = closes.length - rsi.length;

    // Find local lows in last 20 bars (for bullish divergence)
    // Find local highs in last 20 bars (for bearish divergence)
    const windowSize = 20;
    const startIdx = rsi.length - windowSize;
    if (startIdx < 0) return null;

    // Simple approach: find two lowest price points in the window
    let lowIdx1 = -1;
    let lowIdx2 = -1;
    let lowPrice1 = Infinity;
    let lowPrice2 = Infinity;

    // Split window into two halves and find min in each
    const halfWin = Math.floor(windowSize / 2);
    for (let i = startIdx; i < startIdx + halfWin; i++) {
      const price = closes[i + offset];
      if (price < lowPrice1) {
        lowPrice1 = price;
        lowIdx1 = i;
      }
    }
    for (let i = startIdx + halfWin; i < rsi.length; i++) {
      const price = closes[i + offset];
      if (price < lowPrice2) {
        lowPrice2 = price;
        lowIdx2 = i;
      }
    }

    // Bullish divergence: price makes lower low, RSI makes higher low
    if (lowIdx1 >= 0 && lowIdx2 >= 0 && lowPrice2 < lowPrice1 && rsi[lowIdx2] > rsi[lowIdx1]) {
      const priceDivergence = (lowPrice1 - lowPrice2) / lowPrice1;
      const rsiDivergence = rsi[lowIdx2] - rsi[lowIdx1];
      const confidence = Math.min(95, Math.round(40 + Math.min(priceDivergence / 0.02, 1) * 25 + Math.min(rsiDivergence / 10, 1) * 25));

      return {
        type: 'BUY',
        strategy: 'rsi_divergence',
        confidence,
        reasoning: `Bullish RSI divergence: price made lower low (${lowPrice2.toFixed(2)} < ${lowPrice1.toFixed(2)}) but RSI made higher low (${rsi[lowIdx2].toFixed(1)} > ${rsi[lowIdx1].toFixed(1)}).`,
        sources: ['RSI(14)', 'Price Action'],
      };
    }

    // Now check bearish divergence (higher price high, lower RSI high)
    let highIdx1 = -1;
    let highIdx2 = -1;
    let highPrice1 = -Infinity;
    let highPrice2 = -Infinity;

    for (let i = startIdx; i < startIdx + halfWin; i++) {
      const price = closes[i + offset];
      if (price > highPrice1) {
        highPrice1 = price;
        highIdx1 = i;
      }
    }
    for (let i = startIdx + halfWin; i < rsi.length; i++) {
      const price = closes[i + offset];
      if (price > highPrice2) {
        highPrice2 = price;
        highIdx2 = i;
      }
    }

    // Bearish divergence: price makes higher high, RSI makes lower high
    if (highIdx1 >= 0 && highIdx2 >= 0 && highPrice2 > highPrice1 && rsi[highIdx2] < rsi[highIdx1]) {
      const priceDivergence = (highPrice2 - highPrice1) / highPrice1;
      const rsiDivergence = rsi[highIdx1] - rsi[highIdx2];
      const confidence = Math.min(95, Math.round(40 + Math.min(priceDivergence / 0.02, 1) * 25 + Math.min(rsiDivergence / 10, 1) * 25));

      return {
        type: 'SELL',
        strategy: 'rsi_divergence',
        confidence,
        reasoning: `Bearish RSI divergence: price made higher high (${highPrice2.toFixed(2)} > ${highPrice1.toFixed(2)}) but RSI made lower high (${rsi[highIdx2].toFixed(1)} < ${rsi[highIdx1].toFixed(1)}).`,
        sources: ['RSI(14)', 'Price Action'],
      };
    }

    return null;
  }

  // ── Strategy 8: Stochastic Crossover ───────────────────────────────

  stochasticCrossover(input: StrategyInput): StrategyResult | null {
    const { closes, highs, lows } = input;

    const stoch = calculator.calculateStochastic(highs, lows, closes, 14, 3, 3);

    if (stoch.k.length < 2 || stoch.d.length < 2) return null;

    const curK = stoch.k[stoch.k.length - 1];
    const prevK = stoch.k[stoch.k.length - 2];
    const curD = stoch.d[stoch.d.length - 1];
    const prevD = stoch.d[stoch.d.length - 2];

    // BUY: %K crosses above %D while both are below 20 (oversold)
    const bullishCross = prevK <= prevD && curK > curD;
    const inOversold = curK < 20 || curD < 20;

    // SELL: %K crosses below %D while both are above 80 (overbought)
    const bearishCross = prevK >= prevD && curK < curD;
    const inOverbought = curK > 80 || curD > 80;

    if (bullishCross && inOversold) {
      const depthScore = Math.min((20 - Math.min(curK, curD)) / 20, 1) * 30;
      const crossStrength = Math.abs(curK - curD);
      const confidence = Math.min(95, Math.round(45 + depthScore + Math.min(crossStrength / 5, 1) * 15));

      return {
        type: 'BUY',
        strategy: 'stochastic_crossover',
        confidence,
        reasoning: `Stochastic %%K (${curK.toFixed(1)}) crossed above %%D (${curD.toFixed(1)}) in oversold zone. Bullish reversal signal.`,
        sources: ['Stochastic %K(14,3)', 'Stochastic %D(3)'],
      };
    }

    if (bearishCross && inOverbought) {
      const depthScore = Math.min((Math.max(curK, curD) - 80) / 20, 1) * 30;
      const crossStrength = Math.abs(curK - curD);
      const confidence = Math.min(95, Math.round(45 + depthScore + Math.min(crossStrength / 5, 1) * 15));

      return {
        type: 'SELL',
        strategy: 'stochastic_crossover',
        confidence,
        reasoning: `Stochastic %%K (${curK.toFixed(1)}) crossed below %%D (${curD.toFixed(1)}) in overbought zone. Bearish reversal signal.`,
        sources: ['Stochastic %K(14,3)', 'Stochastic %D(3)'],
      };
    }

    return null;
  }

  // ── Strategy 9: Volume Breakout ────────────────────────────────────

  volumeBreakout(input: StrategyInput): StrategyResult | null {
    const { closes, volumes, currentATR } = input;

    if (closes.length < 21 || volumes.length < 21 || currentATR <= 0) return null;

    const curPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2];
    const curVol = volumes[volumes.length - 1];
    const priceMove = curPrice - prevPrice;

    // Volume condition: > 2x 20-period average
    const avgVol = volumes.slice(-21, -1).reduce((s, v) => s + v, 0) / 20;
    const volRatio = curVol / avgVol;
    const volumeExplosion = volRatio > 2;

    // Price move condition: > 1 ATR
    const priceMoveATR = Math.abs(priceMove) / currentATR;
    const significantMove = priceMoveATR > 1;

    if (!volumeExplosion || !significantMove) return null;

    const volScore = Math.min((volRatio - 2) / 3, 1) * 25; // bonus for vol > 2x, max at 5x
    const moveScore = Math.min((priceMoveATR - 1) / 2, 1) * 25; // bonus for move > 1 ATR, max at 3 ATR
    const confidence = Math.min(95, Math.round(45 + volScore + moveScore));

    if (priceMove > 0) {
      return {
        type: 'BUY',
        strategy: 'volume_breakout',
        confidence,
        reasoning: `Volume explosion (${volRatio.toFixed(1)}x avg) with price surge of ${priceMoveATR.toFixed(1)} ATR. Strong buying pressure.`,
        sources: ['Volume', 'ATR(14)', 'Price Action'],
      };
    } else {
      return {
        type: 'SELL',
        strategy: 'volume_breakout',
        confidence,
        reasoning: `Volume explosion (${volRatio.toFixed(1)}x avg) with price drop of ${priceMoveATR.toFixed(1)} ATR. Strong selling pressure.`,
        sources: ['Volume', 'ATR(14)', 'Price Action'],
      };
    }
  }

  // ── Strategy 10: Ichimoku Cloud ────────────────────────────────────

  ichimokuCloud(input: StrategyInput): StrategyResult | null {
    const { closes, highs, lows } = input;

    // Ichimoku parameters: Tenkan=9, Kijun=26, Senkou Span B=52
    // We compute manually since the library may not have Ichimoku.
    const tenkanPeriod = 9;
    const kijunPeriod = 26;
    const senkouBPeriod = 52;

    if (closes.length < senkouBPeriod + 1) return null;

    // Tenkan-sen = (highest high + lowest low) / 2 over last 9 periods
    const tenkanHighs = highs.slice(-tenkanPeriod);
    const tenkanLows = lows.slice(-tenkanPeriod);
    const tenkan = (Math.max(...tenkanHighs) + Math.min(...tenkanLows)) / 2;

    // Kijun-sen = (highest high + lowest low) / 2 over last 26 periods
    const kijunHighs = highs.slice(-kijunPeriod);
    const kijunLows = lows.slice(-kijunPeriod);
    const kijun = (Math.max(...kijunHighs) + Math.min(...kijunLows)) / 2;

    // Senkou Span A = (Tenkan + Kijun) / 2 (displaced 26 periods ahead, but we use current)
    const senkouA = (tenkan + kijun) / 2;

    // Senkou Span B = (highest high + lowest low) / 2 over last 52 periods (displaced 26 ahead)
    const senkouBHighs = highs.slice(-senkouBPeriod);
    const senkouBLows = lows.slice(-senkouBPeriod);
    const senkouB = (Math.max(...senkouBHighs) + Math.min(...senkouBLows)) / 2;

    const cloudTop = Math.max(senkouA, senkouB);
    const cloudBottom = Math.min(senkouA, senkouB);

    const curPrice = closes[closes.length - 1];

    // Previous Tenkan/Kijun for crossover detection
    const prevTenkanHighs = highs.slice(-(tenkanPeriod + 1), -1);
    const prevTenkanLows = lows.slice(-(tenkanPeriod + 1), -1);
    const prevTenkan = (Math.max(...prevTenkanHighs) + Math.min(...prevTenkanLows)) / 2;

    const prevKijunHighs = highs.slice(-(kijunPeriod + 1), -1);
    const prevKijunLows = lows.slice(-(kijunPeriod + 1), -1);
    const prevKijun = (Math.max(...prevKijunHighs) + Math.min(...prevKijunLows)) / 2;

    // BUY: price above cloud + Tenkan > Kijun (or Tenkan crossing above Kijun)
    const aboveCloud = curPrice > cloudTop;
    const belowCloud = curPrice < cloudBottom;
    const tenkanAbove = tenkan > kijun;
    const tenkanBelow = tenkan < kijun;

    if (aboveCloud && tenkanAbove) {
      const cloudDistance = (curPrice - cloudTop) / cloudTop;
      const tkSpread = (tenkan - kijun) / kijun;
      const confidence = Math.min(95, Math.round(50 + Math.min(cloudDistance / 0.02, 1) * 20 + Math.min(tkSpread / 0.01, 1) * 20));

      return {
        type: 'BUY',
        strategy: 'ichimoku_cloud',
        confidence,
        reasoning: `Price (${curPrice.toFixed(2)}) above Ichimoku cloud (top: ${cloudTop.toFixed(2)}). Tenkan (${tenkan.toFixed(2)}) > Kijun (${kijun.toFixed(2)}). Bullish structure.`,
        sources: ['Ichimoku Cloud', 'Tenkan-sen(9)', 'Kijun-sen(26)'],
      };
    }

    if (belowCloud && tenkanBelow) {
      const cloudDistance = (cloudBottom - curPrice) / cloudBottom;
      const tkSpread = (kijun - tenkan) / kijun;
      const confidence = Math.min(95, Math.round(50 + Math.min(cloudDistance / 0.02, 1) * 20 + Math.min(tkSpread / 0.01, 1) * 20));

      return {
        type: 'SELL',
        strategy: 'ichimoku_cloud',
        confidence,
        reasoning: `Price (${curPrice.toFixed(2)}) below Ichimoku cloud (bottom: ${cloudBottom.toFixed(2)}). Tenkan (${tenkan.toFixed(2)}) < Kijun (${kijun.toFixed(2)}). Bearish structure.`,
        sources: ['Ichimoku Cloud', 'Tenkan-sen(9)', 'Kijun-sen(26)'],
      };
    }

    return null;
  }

  // ── Strategy 11: Support / Resistance (Pivot Points) ───────────────

  supportResistance(input: StrategyInput): StrategyResult | null {
    const { closes, highs, lows, currentATR } = input;

    if (closes.length < 20 || currentATR <= 0) return null;

    const curPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2];

    // Calculate classic pivot points using the previous candle's H/L/C
    // We use the average of recent candles for more stable pivots
    const pivotWindow = 10;
    const recentHighs = highs.slice(-(pivotWindow + 1), -1);
    const recentLows = lows.slice(-(pivotWindow + 1), -1);
    const recentCloses = closes.slice(-(pivotWindow + 1), -1);

    const pivotHigh = Math.max(...recentHighs);
    const pivotLow = Math.min(...recentLows);
    const pivotClose = recentCloses[recentCloses.length - 1];

    const pivot = (pivotHigh + pivotLow + pivotClose) / 3;
    const support1 = 2 * pivot - pivotHigh;
    const resistance1 = 2 * pivot - pivotLow;
    const support2 = pivot - (pivotHigh - pivotLow);
    const resistance2 = pivot + (pivotHigh - pivotLow);

    // Proximity threshold: within 0.3% of level
    const threshold = currentATR * 0.5;

    // BUY: price bounces off support (was near support, now moving up)
    const nearSupport1 = Math.abs(curPrice - support1) < threshold;
    const nearSupport2 = Math.abs(curPrice - support2) < threshold;
    const movingUp = curPrice > prevPrice;

    // SELL: price rejected at resistance (was near resistance, now moving down)
    const nearResistance1 = Math.abs(curPrice - resistance1) < threshold;
    const nearResistance2 = Math.abs(curPrice - resistance2) < threshold;
    const movingDown = curPrice < prevPrice;

    if ((nearSupport1 || nearSupport2) && movingUp) {
      const level = nearSupport2 ? support2 : support1;
      const levelName = nearSupport2 ? 'S2' : 'S1';
      const proximity = 1 - Math.abs(curPrice - level) / threshold;
      const confidence = Math.min(95, Math.round(40 + proximity * 25 + (nearSupport2 ? 10 : 5)));

      return {
        type: 'BUY',
        strategy: 'support_resistance',
        confidence,
        reasoning: `Price bouncing off pivot ${levelName} (${level.toFixed(2)}). Current price ${curPrice.toFixed(2)} moving up. Support holding.`,
        sources: ['Pivot Points', 'Support Levels', 'Price Action'],
      };
    }

    if ((nearResistance1 || nearResistance2) && movingDown) {
      const level = nearResistance2 ? resistance2 : resistance1;
      const levelName = nearResistance2 ? 'R2' : 'R1';
      const proximity = 1 - Math.abs(curPrice - level) / threshold;
      const confidence = Math.min(95, Math.round(40 + proximity * 25 + (nearResistance2 ? 10 : 5)));

      return {
        type: 'SELL',
        strategy: 'support_resistance',
        confidence,
        reasoning: `Price rejected at pivot ${levelName} (${level.toFixed(2)}). Current price ${curPrice.toFixed(2)} moving down. Resistance holding.`,
        sources: ['Pivot Points', 'Resistance Levels', 'Price Action'],
      };
    }

    return null;
  }

  // ── Strategy 12: Multi-Timeframe Confluence ────────────────────────

  multiTimeframeConfluence(input: StrategyInput): StrategyResult | null {
    const { closes, highs, lows, volumes } = input;

    // Simulate higher timeframe by aggregating every 5 candles
    // (e.g. if input is 1m candles, this approximates 5m)
    const htfFactor = 5;
    if (closes.length < htfFactor * 20) return null;

    // Build higher-timeframe candles
    const htfCloses: number[] = [];
    const htfHighs: number[] = [];
    const htfLows: number[] = [];
    const htfVolumes: number[] = [];

    const totalBars = closes.length;
    const start = totalBars % htfFactor; // skip incomplete first group
    for (let i = start; i + htfFactor <= totalBars; i += htfFactor) {
      const chunk = closes.slice(i, i + htfFactor);
      const hChunk = highs.slice(i, i + htfFactor);
      const lChunk = lows.slice(i, i + htfFactor);
      const vChunk = volumes.slice(i, i + htfFactor);

      htfCloses.push(chunk[chunk.length - 1]);
      htfHighs.push(Math.max(...hChunk));
      htfLows.push(Math.min(...lChunk));
      htfVolumes.push(vChunk.reduce((s, v) => s + v, 0));
    }

    // Higher TF trend: EMA(9) vs EMA(21)
    const htfEma9 = calculator.calculateEMA(htfCloses, 9);
    const htfEma21 = calculator.calculateEMA(htfCloses, 21);

    if (htfEma9.length < 1 || htfEma21.length < 1) return null;

    const htfBullish = htfEma9[htfEma9.length - 1] > htfEma21[htfEma21.length - 1];
    const htfBearish = htfEma9[htfEma9.length - 1] < htfEma21[htfEma21.length - 1];

    // Lower TF signal: EMA crossover
    const ltfEma9 = calculator.calculateEMA(closes, 9);
    const ltfEma21 = calculator.calculateEMA(closes, 21);
    const rsi = calculator.calculateRSI(closes, 14);

    if (ltfEma9.length < 2 || ltfEma21.length < 2 || rsi.length < 1) return null;

    const curLtfEma9 = ltfEma9[ltfEma9.length - 1];
    const prevLtfEma9 = ltfEma9[ltfEma9.length - 2];
    const curLtfEma21 = ltfEma21[ltfEma21.length - 1];
    const prevLtfEma21 = ltfEma21[ltfEma21.length - 2];
    const curRsi = rsi[rsi.length - 1];

    const ltfBullishCross = prevLtfEma9 <= prevLtfEma21 && curLtfEma9 > curLtfEma21;
    const ltfBearishCross = prevLtfEma9 >= prevLtfEma21 && curLtfEma9 < curLtfEma21;

    // Confluence: HTF trend aligns with LTF signal
    if (htfBullish && ltfBullishCross && curRsi > 40) {
      const htfSpread = (htfEma9[htfEma9.length - 1] - htfEma21[htfEma21.length - 1]) / htfEma21[htfEma21.length - 1];
      const confidence = Math.min(95, Math.round(55 + Math.min(htfSpread / 0.01, 1) * 20 + Math.min((curRsi - 40) / 30, 1) * 15));

      return {
        type: 'BUY',
        strategy: 'multi_tf_confluence',
        confidence,
        reasoning: `Multi-TF confluence: higher TF trend bullish (EMA9 > EMA21) + lower TF bullish EMA crossover. RSI at ${curRsi.toFixed(1)}.`,
        sources: ['HTF EMA(9)', 'HTF EMA(21)', 'LTF EMA Crossover', 'RSI(14)'],
      };
    }

    if (htfBearish && ltfBearishCross && curRsi < 60) {
      const htfSpread = (htfEma21[htfEma21.length - 1] - htfEma9[htfEma9.length - 1]) / htfEma21[htfEma21.length - 1];
      const confidence = Math.min(95, Math.round(55 + Math.min(htfSpread / 0.01, 1) * 20 + Math.min((60 - curRsi) / 30, 1) * 15));

      return {
        type: 'SELL',
        strategy: 'multi_tf_confluence',
        confidence,
        reasoning: `Multi-TF confluence: higher TF trend bearish (EMA9 < EMA21) + lower TF bearish EMA crossover. RSI at ${curRsi.toFixed(1)}.`,
        sources: ['HTF EMA(9)', 'HTF EMA(21)', 'LTF EMA Crossover', 'RSI(14)'],
      };
    }

    return null;
  }
}

export default new StrategyEngine();
