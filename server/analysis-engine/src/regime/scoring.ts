/**
 * Market Regime Scoring Engine
 *
 * Produces a composite score 1–100 for each coin:
 *   1–20  = Strong mean-reversion
 *   21–40 = Weak mean-reversion / choppy
 *   41–60 = Transitional / indeterminate
 *   61–80 = Weak trend
 *   81–100 = Strong trend
 *
 * Components:
 *   - ADX (Average Directional Index)
 *   - Hurst Exponent (Rescaled Range method)
 *   - Choppiness Index
 *   - Efficiency Ratio (Kaufman)
 */

// ── ADX ────────────────────────────────────────────────────────────────

export interface ADXResult {
  adx: number;
  plusDI: number;
  minusDI: number;
}

/**
 * Real ADX calculation using Wilder smoothing.
 * Requires at least `2 * period + 1` candles.
 */
export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
): ADXResult {
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < 2 * period + 1) {
    return { adx: 20, plusDI: 0, minusDI: 0 };
  }

  // True Range, +DM, -DM
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < len; i++) {
    tr.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1]),
      ),
    );
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Wilder-smoothed sums (first value = simple sum of first `period` elements)
  let smoothTR = 0;
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;

  for (let i = 0; i < period; i++) {
    smoothTR += tr[i];
    smoothPlusDM += plusDM[i];
    smoothMinusDM += minusDM[i];
  }

  const dxValues: number[] = [];

  for (let i = period; i < tr.length; i++) {
    smoothTR = smoothTR - smoothTR / period + tr[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];

    const pdi = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const mdi = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = pdi + mdi;
    const dx = diSum > 0 ? (Math.abs(pdi - mdi) / diSum) * 100 : 0;
    dxValues.push(dx);
  }

  if (dxValues.length < period) {
    const avg = dxValues.reduce((s, v) => s + v, 0) / (dxValues.length || 1);
    return { adx: avg, plusDI: 0, minusDI: 0 };
  }

  // Wilder-smoothed ADX from DX values
  let adx = 0;
  for (let i = 0; i < period; i++) adx += dxValues[i];
  adx /= period;

  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  // Final +DI / -DI from last smoothed values
  const finalPlusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
  const finalMinusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;

  return { adx, plusDI: finalPlusDI, minusDI: finalMinusDI };
}

// ── Hurst Exponent (Rescaled Range) ────────────────────────────────────

/**
 * Estimates the Hurst exponent using the Rescaled Range (R/S) method.
 *   H < 0.5 → mean-reverting
 *   H ≈ 0.5 → random walk
 *   H > 0.5 → trending
 *
 * Uses log-returns and multiple sub-series sizes.
 */
export function calculateHurstExponent(closes: number[]): number {
  if (closes.length < 32) return 0.5; // not enough data

  // Log returns
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }
  }

  if (returns.length < 20) return 0.5;

  // Subseries sizes (powers of 2 that fit)
  const sizes: number[] = [];
  let s = 8;
  while (s <= returns.length / 2) {
    sizes.push(s);
    s *= 2;
  }
  if (sizes.length < 2) return 0.5;

  const logN: number[] = [];
  const logRS: number[] = [];

  for (const n of sizes) {
    const numSubseries = Math.floor(returns.length / n);
    let rsSum = 0;

    for (let j = 0; j < numSubseries; j++) {
      const sub = returns.slice(j * n, (j + 1) * n);
      const mean = sub.reduce((a, b) => a + b, 0) / n;
      const std = Math.sqrt(sub.reduce((a, v) => a + (v - mean) ** 2, 0) / n);

      if (std === 0) continue;

      // Cumulative deviations
      let cumSum = 0;
      let maxCum = -Infinity;
      let minCum = Infinity;
      for (const val of sub) {
        cumSum += val - mean;
        if (cumSum > maxCum) maxCum = cumSum;
        if (cumSum < minCum) minCum = cumSum;
      }

      const range = maxCum - minCum;
      rsSum += range / std;
    }

    if (numSubseries > 0) {
      const avgRS = rsSum / numSubseries;
      if (avgRS > 0) {
        logN.push(Math.log(n));
        logRS.push(Math.log(avgRS));
      }
    }
  }

  if (logN.length < 2) return 0.5;

  // Linear regression: logRS = H * logN + c
  const nPts = logN.length;
  const sumX = logN.reduce((a, b) => a + b, 0);
  const sumY = logRS.reduce((a, b) => a + b, 0);
  const sumXY = logN.reduce((a, x, i) => a + x * logRS[i], 0);
  const sumX2 = logN.reduce((a, x) => a + x * x, 0);

  const denom = nPts * sumX2 - sumX * sumX;
  if (denom === 0) return 0.5;

  const hurst = (nPts * sumXY - sumX * sumY) / denom;

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, hurst));
}

// ── Choppiness Index ───────────────────────────────────────────────────

/**
 * Choppiness Index (14-period default).
 *   High (62-100) → choppy / ranging market
 *   Low (0-38)    → trending market
 */
export function calculateChoppinessIndex(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
): number {
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < period + 1) return 50;

  // Use last `period + 1` candles
  const offset = len - period - 1;

  // True ranges
  let atrSum = 0;
  for (let i = offset + 1; i < len; i++) {
    atrSum += Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
  }

  // Highest high and lowest low over the period
  let hh = -Infinity;
  let ll = Infinity;
  for (let i = offset + 1; i < len; i++) {
    if (highs[i] > hh) hh = highs[i];
    if (lows[i] < ll) ll = lows[i];
  }

  const range = hh - ll;
  if (range <= 0 || atrSum <= 0) return 50;

  // CI = 100 * LOG10(SUM(ATR) / (HH - LL)) / LOG10(period)
  const ci = (100 * Math.log10(atrSum / range)) / Math.log10(period);
  return Math.max(0, Math.min(100, ci));
}

// ── Kaufman Efficiency Ratio ───────────────────────────────────────────

/**
 * Efficiency Ratio = |Direction| / Volatility
 *   Close to 1 → strong trend
 *   Close to 0 → choppy / noisy
 */
export function calculateEfficiencyRatio(closes: number[], period: number = 10): number {
  if (closes.length < period + 1) return 0.5;

  const end = closes.length - 1;
  const start = end - period;

  const direction = Math.abs(closes[end] - closes[start]);
  let volatility = 0;
  for (let i = start + 1; i <= end; i++) {
    volatility += Math.abs(closes[i] - closes[i - 1]);
  }

  if (volatility === 0) return 0;
  return Math.min(1, direction / volatility);
}

// ── Composite Regime Score ─────────────────────────────────────────────

export type RegimeLabel =
  | 'strong_trend'
  | 'trending'
  | 'transitional'
  | 'choppy'
  | 'mean_reversion';

export type TrendDirection = 'bullish' | 'bearish' | 'neutral';

export interface RegimeScore {
  score: number;           // 1-100: low=mean-revert, high=trend
  label: RegimeLabel;
  direction: TrendDirection;
  confidence: number;      // 0-100 how confident we are in the classification
  components: {
    adx: number;
    adxScore: number;      // 0-100 normalized
    hurst: number;
    hurstScore: number;
    choppiness: number;
    choppinessScore: number;
    efficiencyRatio: number;
    erScore: number;
  };
  strategies: {
    recommended: string[];
    avoid: string[];
  };
}

export function calculateRegimeScore(
  highs: number[],
  lows: number[],
  closes: number[],
): RegimeScore {
  // Calculate all components
  const adxResult = calculateADX(highs, lows, closes);
  const hurst = calculateHurstExponent(closes);
  const ci = calculateChoppinessIndex(highs, lows, closes);
  const er = calculateEfficiencyRatio(closes);

  // Normalize each to a 0-100 "trendiness" score
  // ADX: 0-60 maps to 0-100 (above 60 is very strong trend)
  const adxScore = Math.min(100, (adxResult.adx / 50) * 100);

  // Hurst: 0-1 maps to 0-100 (0.5 = 50, >0.5 = trending)
  const hurstScore = hurst * 100;

  // Choppiness: inverted (high CI = choppy = low trend score)
  const choppinessScore = 100 - ci;

  // ER: 0-1 maps to 0-100
  const erScore = er * 100;

  // Weighted composite (ADX is most important for regime detection)
  const composite =
    adxScore * 0.35 +
    hurstScore * 0.25 +
    choppinessScore * 0.25 +
    erScore * 0.15;

  // Clamp to 1-100
  const score = Math.max(1, Math.min(100, Math.round(composite)));

  // Classification
  let label: RegimeLabel;
  if (score >= 80) label = 'strong_trend';
  else if (score >= 60) label = 'trending';
  else if (score >= 40) label = 'transitional';
  else if (score >= 20) label = 'choppy';
  else label = 'mean_reversion';

  // Trend direction
  let direction: TrendDirection = 'neutral';
  if (adxResult.adx > 20) {
    if (adxResult.plusDI > adxResult.minusDI) direction = 'bullish';
    else if (adxResult.minusDI > adxResult.plusDI) direction = 'bearish';
  }

  // Confidence: agreement between indicators
  const normalizedScores = [adxScore, hurstScore, choppinessScore, erScore];
  const mean = normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length;
  const variance = normalizedScores.reduce((a, v) => a + (v - mean) ** 2, 0) / normalizedScores.length;
  const stdDev = Math.sqrt(variance);
  // Low stddev = high agreement = high confidence
  const confidence = Math.round(Math.max(20, Math.min(95, 95 - stdDev * 1.5)));

  // Strategy recommendations
  const strategies = getStrategyRecommendations(label, direction);

  return {
    score,
    label,
    direction,
    confidence,
    components: {
      adx: Math.round(adxResult.adx * 100) / 100,
      adxScore: Math.round(adxScore * 100) / 100,
      hurst: Math.round(hurst * 1000) / 1000,
      hurstScore: Math.round(hurstScore * 100) / 100,
      choppiness: Math.round(ci * 100) / 100,
      choppinessScore: Math.round(choppinessScore * 100) / 100,
      efficiencyRatio: Math.round(er * 1000) / 1000,
      erScore: Math.round(erScore * 100) / 100,
    },
    strategies,
  };
}

function getStrategyRecommendations(
  label: RegimeLabel,
  direction: TrendDirection,
): { recommended: string[]; avoid: string[] } {
  switch (label) {
    case 'strong_trend':
      return {
        recommended:
          direction === 'bullish'
            ? ['Trend following long', 'Momentum breakouts', 'Pullback buying']
            : direction === 'bearish'
              ? ['Trend following short', 'Breakdown sells', 'Rally fading']
              : ['Breakout strategies', 'Momentum trading'],
        avoid: ['Mean reversion', 'Grid bots', 'Counter-trend entries'],
      };
    case 'trending':
      return {
        recommended:
          direction === 'bullish'
            ? ['Swing long', 'EMA pullback buys', 'Channel breakouts']
            : direction === 'bearish'
              ? ['Swing short', 'EMA rejection sells', 'Support breakdown']
              : ['Directional plays', 'Moderate leverage'],
        avoid: ['Range trading', 'Tight grid bots', 'Counter-trend'],
      };
    case 'transitional':
      return {
        recommended: ['Reduced sizing', 'Wait for confirmation', 'Scalping'],
        avoid: ['Large directional bets', 'High leverage', 'Position scaling'],
      };
    case 'choppy':
      return {
        recommended: ['Range trading', 'Mean reversion', 'Grid bots', 'Bollinger Band bounces'],
        avoid: ['Trend following', 'Breakout strategies', 'Momentum plays'],
      };
    case 'mean_reversion':
      return {
        recommended: ['Bollinger Band strategies', 'RSI oversold/overbought', 'Channel trading', 'Statistical arbitrage'],
        avoid: ['Breakout strategies', 'Trend following', 'Momentum entries'],
      };
  }
}
