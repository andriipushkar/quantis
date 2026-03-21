/**
 * Decision Confluence Engine
 *
 * Aggregates data from Technical Analysis, On-chain metrics, and Sentiment
 * into a single actionable score (1-100) per asset.
 *
 * Components and weights:
 *   1. Trend       (30%) — Market regime + EMA alignment + ADX direction
 *   2. Momentum    (25%) — RSI, MACD histogram, Stochastic
 *   3. Signals     (20%) — Active signal count, confidence, strategy agreement
 *   4. Sentiment   (15%) — News sentiment + Fear & Greed index
 *   5. Volume      (10%) — Volume surge, OBV trend, whale activity
 *
 * Output:
 *   score 1-100 (bearish → bullish)
 *   label: 'strong_sell' | 'sell' | 'neutral' | 'buy' | 'strong_buy'
 *   risk: 'low' | 'medium' | 'high'
 */

import calculator from '../indicators/calculator.js';
import { calculateRegimeScore, type RegimeScore } from '../regime/scoring.js';

// ── Types ──────────────────────────────────────────────────────────

export type ConfluenceLabel = 'strong_sell' | 'sell' | 'neutral' | 'buy' | 'strong_buy';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ConfluenceComponents {
  trend: { score: number; weight: number; details: TrendDetails };
  momentum: { score: number; weight: number; details: MomentumDetails };
  signals: { score: number; weight: number; details: SignalDetails };
  sentiment: { score: number; weight: number; details: SentimentDetails };
  volume: { score: number; weight: number; details: VolumeDetails };
}

export interface TrendDetails {
  regimeScore: number;
  regimeLabel: string;
  direction: string;
  emaAlignment: 'bullish' | 'bearish' | 'mixed';
}

export interface MomentumDetails {
  rsi: number;
  rsiSignal: 'oversold' | 'neutral' | 'overbought';
  macdHistogram: number;
  macdSignal: 'bullish' | 'bearish' | 'neutral';
  stochasticK: number;
}

export interface SignalDetails {
  activeCount: number;
  buyCount: number;
  sellCount: number;
  avgConfidence: number;
  agreement: 'bullish' | 'bearish' | 'mixed' | 'none';
}

export interface SentimentDetails {
  newsScore: number;
  fearGreed: number;
  newsLabel: string;
  fearGreedLabel: string;
}

export interface VolumeDetails {
  volumeRatio: number;
  obvTrend: 'rising' | 'falling' | 'flat';
  whaleActivity: 'high' | 'moderate' | 'low';
}

export interface ConfluenceResult {
  symbol: string;
  score: number;
  label: ConfluenceLabel;
  risk: RiskLevel;
  confidence: number;
  components: ConfluenceComponents;
  timestamp: string;
}

// ── Inputs ─────────────────────────────────────────────────────────

export interface ConfluenceInput {
  symbol: string;
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
  activeSignals: Array<{ type: string; confidence: number; strategy: string }>;
  newsSentiment: { bullish: number; bearish: number; neutral: number };
  fearGreedIndex: number;
  whaleAlertCount: number;
}

// ── Weights ────────────────────────────────────────────────────────

const WEIGHTS = {
  trend: 0.30,
  momentum: 0.25,
  signals: 0.20,
  sentiment: 0.15,
  volume: 0.10,
} as const;

// ── Engine ─────────────────────────────────────────────────────────

export function calculateConfluence(input: ConfluenceInput): ConfluenceResult {
  const trend = scoreTrend(input);
  const momentum = scoreMomentum(input);
  const signals = scoreSignals(input);
  const sentiment = scoreSentiment(input);
  const volume = scoreVolume(input);

  const composite =
    trend.score * WEIGHTS.trend +
    momentum.score * WEIGHTS.momentum +
    signals.score * WEIGHTS.signals +
    sentiment.score * WEIGHTS.sentiment +
    volume.score * WEIGHTS.volume;

  const score = Math.max(1, Math.min(100, Math.round(composite)));

  const label = scoreToLabel(score);
  const risk = assessRisk(trend, momentum, volume);
  const confidence = calculateConfidence([
    trend.score, momentum.score, signals.score, sentiment.score, volume.score,
  ]);

  return {
    symbol: input.symbol,
    score,
    label,
    risk,
    confidence,
    components: {
      trend: { score: trend.score, weight: WEIGHTS.trend * 100, details: trend.details },
      momentum: { score: momentum.score, weight: WEIGHTS.momentum * 100, details: momentum.details },
      signals: { score: signals.score, weight: WEIGHTS.signals * 100, details: signals.details },
      sentiment: { score: sentiment.score, weight: WEIGHTS.sentiment * 100, details: sentiment.details },
      volume: { score: volume.score, weight: WEIGHTS.volume * 100, details: volume.details },
    },
    timestamp: new Date().toISOString(),
  };
}

// ── Component 1: Trend (30%) ───────────────────────────────────────

function scoreTrend(input: ConfluenceInput): { score: number; details: TrendDetails } {
  const { highs, lows, closes } = input;

  // Regime scoring
  const regime: RegimeScore = calculateRegimeScore(highs, lows, closes);

  // EMA alignment
  const ema9 = calculator.calculateEMA(closes, 9);
  const ema21 = calculator.calculateEMA(closes, 21);
  const ema50 = calculator.calculateSMA(closes, 50);

  let emaAlignment: 'bullish' | 'bearish' | 'mixed' = 'mixed';
  if (ema9.length > 0 && ema21.length > 0 && ema50.length > 0) {
    const e9 = ema9[ema9.length - 1];
    const e21 = ema21[ema21.length - 1];
    const s50 = ema50[ema50.length - 1];
    if (e9 > e21 && e21 > s50) emaAlignment = 'bullish';
    else if (e9 < e21 && e21 < s50) emaAlignment = 'bearish';
  }

  // Combine: regime strength × direction → 0-100 bullish scale
  let trendScore = 50; // neutral baseline

  if (regime.direction === 'bullish') {
    // Strong trend + bullish = high score
    trendScore = 50 + (regime.score / 100) * 50;
  } else if (regime.direction === 'bearish') {
    // Strong trend + bearish = low score
    trendScore = 50 - (regime.score / 100) * 50;
  }

  // EMA alignment bonus/penalty (±10)
  if (emaAlignment === 'bullish') trendScore = Math.min(100, trendScore + 10);
  else if (emaAlignment === 'bearish') trendScore = Math.max(0, trendScore - 10);

  return {
    score: clamp(trendScore),
    details: {
      regimeScore: regime.score,
      regimeLabel: regime.label,
      direction: regime.direction,
      emaAlignment,
    },
  };
}

// ── Component 2: Momentum (25%) ───────────────────────────────────

function scoreMomentum(input: ConfluenceInput): { score: number; details: MomentumDetails } {
  const { closes } = input;

  const rsi = calculator.calculateRSI(closes, 14);
  const macd = calculator.calculateMACD(closes);
  const stoch = calculator.calculateStochastic(input.highs, input.lows, closes);

  const currentRSI = rsi.length > 0 ? rsi[rsi.length - 1] : 50;
  const currentHist = macd.histogram.length > 0 ? macd.histogram[macd.histogram.length - 1] : 0;
  const currentK = stoch.k.length > 0 ? stoch.k[stoch.k.length - 1] : 50;

  // RSI → 0-100 scale (already is, but normalize for scoring)
  const rsiScore = currentRSI;
  const rsiSignal: 'oversold' | 'neutral' | 'overbought' =
    currentRSI < 30 ? 'oversold' : currentRSI > 70 ? 'overbought' : 'neutral';

  // MACD histogram → bullish/bearish signal
  const macdSignal: 'bullish' | 'bearish' | 'neutral' =
    currentHist > 0 ? 'bullish' : currentHist < 0 ? 'bearish' : 'neutral';

  // Normalize MACD to 0-100 (histogram can be any range, use sigmoid-like)
  const price = closes[closes.length - 1] || 1;
  const normalizedHist = (currentHist / price) * 10000; // basis points
  const macdScore = 50 + Math.max(-50, Math.min(50, normalizedHist));

  // Stochastic K → direct 0-100
  const stochScore = currentK;

  // Weighted average: RSI 40%, MACD 35%, Stochastic 25%
  const momentumScore = rsiScore * 0.40 + macdScore * 0.35 + stochScore * 0.25;

  return {
    score: clamp(momentumScore),
    details: {
      rsi: round2(currentRSI),
      rsiSignal,
      macdHistogram: round2(currentHist),
      macdSignal,
      stochasticK: round2(currentK),
    },
  };
}

// ── Component 3: Signals (20%) ────────────────────────────────────

function scoreSignals(input: ConfluenceInput): { score: number; details: SignalDetails } {
  const { activeSignals } = input;

  if (activeSignals.length === 0) {
    return {
      score: 50, // neutral when no signals
      details: { activeCount: 0, buyCount: 0, sellCount: 0, avgConfidence: 0, agreement: 'none' },
    };
  }

  const buys = activeSignals.filter((s) => s.type.toLowerCase() === 'buy');
  const sells = activeSignals.filter((s) => s.type.toLowerCase() === 'sell');
  const avgConf = activeSignals.reduce((a, s) => a + s.confidence, 0) / activeSignals.length;

  let agreement: 'bullish' | 'bearish' | 'mixed' | 'none' = 'mixed';
  if (buys.length > 0 && sells.length === 0) agreement = 'bullish';
  else if (sells.length > 0 && buys.length === 0) agreement = 'bearish';

  // Score: bullish signals push up, bearish push down
  const ratio = buys.length / activeSignals.length; // 0=all sell, 1=all buy
  const directionScore = ratio * 100; // 0-100
  const confidenceMultiplier = avgConf / 100; // 0-1

  // Blend direction with confidence (high confidence = stronger signal)
  const signalScore = 50 + (directionScore - 50) * confidenceMultiplier;

  return {
    score: clamp(signalScore),
    details: {
      activeCount: activeSignals.length,
      buyCount: buys.length,
      sellCount: sells.length,
      avgConfidence: round2(avgConf),
      agreement,
    },
  };
}

// ── Component 4: Sentiment (15%) ──────────────────────────────────

function scoreSentiment(input: ConfluenceInput): { score: number; details: SentimentDetails } {
  const { newsSentiment, fearGreedIndex } = input;

  // News score: net bullish/bearish ratio → 0-100
  const totalNews = newsSentiment.bullish + newsSentiment.bearish + newsSentiment.neutral;
  let newsScore = 50;
  if (totalNews > 0) {
    newsScore = ((newsSentiment.bullish - newsSentiment.bearish) / totalNews + 1) * 50;
  }

  const newsLabel = newsScore > 60 ? 'Bullish' : newsScore < 40 ? 'Bearish' : 'Neutral';

  // Fear & Greed → use directly (0-100, greed=bullish)
  const fgScore = fearGreedIndex;
  const fearGreedLabel =
    fgScore < 20 ? 'Extreme Fear' :
    fgScore < 40 ? 'Fear' :
    fgScore < 60 ? 'Neutral' :
    fgScore < 80 ? 'Greed' : 'Extreme Greed';

  // Blend: News 50%, Fear&Greed 50%
  const sentimentScore = newsScore * 0.50 + fgScore * 0.50;

  return {
    score: clamp(sentimentScore),
    details: {
      newsScore: round2(newsScore),
      fearGreed: round2(fgScore),
      newsLabel,
      fearGreedLabel,
    },
  };
}

// ── Component 5: Volume (10%) ─────────────────────────────────────

function scoreVolume(input: ConfluenceInput): { score: number; details: VolumeDetails } {
  const { volumes, closes, whaleAlertCount } = input;

  // Volume ratio: current vs 20-period average
  const recentVols = volumes.slice(-20);
  const avgVol = recentVols.reduce((s, v) => s + v, 0) / (recentVols.length || 1);
  const currentVol = volumes[volumes.length - 1] || 0;
  const volumeRatio = avgVol > 0 ? currentVol / avgVol : 1;

  // OBV trend — check if OBV is rising (bullish) or falling (bearish)
  const obv = calculator.calculateOBV(closes, volumes);
  let obvTrend: 'rising' | 'falling' | 'flat' = 'flat';
  if (obv.length >= 5) {
    const recent = obv.slice(-5);
    const obvChange = recent[recent.length - 1] - recent[0];
    if (obvChange > 0) obvTrend = 'rising';
    else if (obvChange < 0) obvTrend = 'falling';
  }

  // Whale activity level
  const whaleActivity: 'high' | 'moderate' | 'low' =
    whaleAlertCount >= 3 ? 'high' : whaleAlertCount >= 1 ? 'moderate' : 'low';

  // Score: volume surge + OBV direction + whale activity
  // High volume + rising OBV = bullish confirmation
  let volumeScore = 50;

  // Volume surge adds conviction (but is direction-neutral, so modify based on OBV)
  const surgeFactor = Math.min(2, volumeRatio); // cap at 2x
  if (obvTrend === 'rising') volumeScore = 50 + surgeFactor * 15;
  else if (obvTrend === 'falling') volumeScore = 50 - surgeFactor * 15;

  // Whale activity adds volatility signal (slight bullish bias — smart money)
  if (whaleActivity === 'high') volumeScore += 10;
  else if (whaleActivity === 'moderate') volumeScore += 5;

  return {
    score: clamp(volumeScore),
    details: {
      volumeRatio: round2(volumeRatio),
      obvTrend,
      whaleActivity,
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(1, Math.min(100, Math.round(v)));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function scoreToLabel(score: number): ConfluenceLabel {
  if (score >= 75) return 'strong_buy';
  if (score >= 60) return 'buy';
  if (score >= 40) return 'neutral';
  if (score >= 25) return 'sell';
  return 'strong_sell';
}

function assessRisk(
  trend: { score: number; details: TrendDetails },
  momentum: { score: number; details: MomentumDetails },
  volume: { score: number; details: VolumeDetails },
): RiskLevel {
  // High risk: extreme readings or conflicting signals
  const trendExtreme = trend.score > 85 || trend.score < 15;
  const rsiExtreme = momentum.details.rsi > 80 || momentum.details.rsi < 20;
  const highVolatility = volume.details.volumeRatio > 2;

  const riskFactors = [trendExtreme, rsiExtreme, highVolatility].filter(Boolean).length;

  if (riskFactors >= 2) return 'high';
  if (riskFactors === 1) return 'medium';
  return 'low';
}

function calculateConfidence(scores: number[]): number {
  // Confidence = agreement between components
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, v) => a + (v - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Low stdDev = high agreement = high confidence
  return Math.round(Math.max(20, Math.min(95, 95 - stdDev * 1.2)));
}
