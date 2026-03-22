import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import redis from '../../config/redis.js';
import logger from '../../config/logger.js';

const router = Router();

// ── Regime Scoring Helpers ──────────────────────────────────────────────

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
type TrendDirection = 'bullish' | 'bearish' | 'neutral';

interface RegimeScoreResult {
  score: number;
  label: RegimeLabel;
  direction: TrendDirection;
  confidence: number;
  description: string;
  components: {
    adx: number; adxScore: number;
    hurst: number; hurstScore: number;
    choppiness: number; choppinessScore: number;
    efficiencyRatio: number; erScore: number;
  };
  strategies: { recommended: string[]; avoid: string[] };
}

function computeRegimeScore(highs: number[], lows: number[], closes: number[]): RegimeScoreResult {
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

  let direction: TrendDirection = 'neutral';
  if (adxR.adx > 20) {
    direction = adxR.plusDI > adxR.minusDI ? 'bullish' : adxR.minusDI > adxR.plusDI ? 'bearish' : 'neutral';
  }

  const scores = [adxScore, hurstScore, choppinessScore, erScore];
  const mean = scores.reduce((a, b) => a + b, 0) / 4;
  const std = Math.sqrt(scores.reduce((a, v) => a + (v - mean) ** 2, 0) / 4);
  const confidence = Math.round(Math.max(20, Math.min(95, 95 - std * 1.5)));

  const descriptions: Record<RegimeLabel, string> = {
    strong_trend: 'Market is in a strong trending phase. ADX and Hurst exponent both confirm directional momentum. Use trend-following strategies.',
    trending: 'Market shows moderate trend strength. Directional bias is present but not overwhelming. Trend strategies work with proper risk management.',
    transitional: 'Market is transitioning between regimes. Indicators show mixed signals. Reduce position sizes and wait for clearer confirmation.',
    choppy: 'Market is choppy with frequent reversals. Price oscillates without a clear direction. Mean-reversion and range strategies are preferred.',
    mean_reversion: 'Market is strongly mean-reverting. Price tends to snap back to the mean. Bollinger Band and RSI-based strategies excel here.',
  };

  const strategyMap: Record<RegimeLabel, { recommended: string[]; avoid: string[] }> = {
    strong_trend: {
      recommended: direction === 'bullish'
        ? ['Trend following long', 'Momentum breakouts', 'Pullback buying']
        : direction === 'bearish'
          ? ['Trend following short', 'Breakdown sells', 'Rally fading']
          : ['Breakout strategies', 'Momentum trading'],
      avoid: ['Mean reversion', 'Grid bots', 'Counter-trend entries'],
    },
    trending: {
      recommended: direction === 'bullish'
        ? ['Swing long', 'EMA pullback buys', 'Channel breakouts']
        : direction === 'bearish'
          ? ['Swing short', 'EMA rejection sells', 'Support breakdown']
          : ['Directional plays', 'Moderate leverage'],
      avoid: ['Range trading', 'Tight grid bots', 'Counter-trend'],
    },
    transitional: {
      recommended: ['Reduced sizing', 'Wait for confirmation', 'Scalping'],
      avoid: ['Large directional bets', 'High leverage', 'Position scaling'],
    },
    choppy: {
      recommended: ['Range trading', 'Mean reversion', 'Grid bots', 'BB bounces'],
      avoid: ['Trend following', 'Breakout strategies', 'Momentum plays'],
    },
    mean_reversion: {
      recommended: ['BB strategies', 'RSI oversold/overbought', 'Channel trading', 'Stat arb'],
      avoid: ['Breakout strategies', 'Trend following', 'Momentum entries'],
    },
  };

  return {
    score, label, direction, confidence,
    description: descriptions[label],
    components: {
      adx: Math.round(adxR.adx * 100) / 100, adxScore: Math.round(adxScore * 100) / 100,
      hurst: Math.round(hurst * 1000) / 1000, hurstScore: Math.round(hurstScore * 100) / 100,
      choppiness: Math.round(ci * 100) / 100, choppinessScore: Math.round(choppinessScore * 100) / 100,
      efficiencyRatio: Math.round(er * 1000) / 1000, erScore: Math.round(erScore * 100) / 100,
    },
    strategies: strategyMap[label],
  };
}

async function fetchCandlesForRegime(pairId: number, limit = 100) {
  const candlesResult = await query(
    `SELECT o.high, o.low, o.close, o.volume FROM ohlcv_1h o
     WHERE o.pair_id = $1 ORDER BY o.time DESC LIMIT $2`,
    [pairId, limit]
  );
  const candles = candlesResult.rows
    .map((r: { high: string; low: string; close: string; volume: string }) => ({
      high: parseFloat(r.high), low: parseFloat(r.low),
      close: parseFloat(r.close), volume: parseFloat(r.volume),
    }))
    .reverse();
  return candles;
}

// GET /regime — Market regime for BTCUSDT (backward compatible) + enriched with scoring
router.get('/regime', async (_req: Request, res: Response) => {
  try {
    const cached = await redis.get('market:regime:v2');
    if (cached) { res.json(JSON.parse(cached)); return; }

    const pairResult = await query(
      `SELECT tp.id FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.symbol = 'BTCUSDT' AND tp.is_active = true LIMIT 1`
    );
    if (pairResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'BTCUSDT not found' });
      return;
    }

    const candles = await fetchCandlesForRegime(pairResult.rows[0].id);
    if (candles.length < 20) {
      res.status(404).json({ success: false, error: 'Insufficient data for regime detection' });
      return;
    }

    const highs = candles.map((c: { high: number }) => c.high);
    const lows = candles.map((c: { low: number }) => c.low);
    const closes = candles.map((c: { close: number }) => c.close);

    const regime = computeRegimeScore(highs, lows, closes);

    // Compute RSI for backward compat
    let rsi = 50;
    if (closes.length >= 15) {
      let gains = 0, losses = 0;
      const off = closes.length - 15;
      for (let i = 1; i <= 14; i++) {
        const d = closes[off + i] - closes[off + i - 1];
        if (d > 0) gains += d; else losses += Math.abs(d);
      }
      rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / 14 / (losses / 14));
    }

    // BB Width for backward compat
    const bbP = Math.min(20, closes.length);
    const bbS = closes.slice(-bbP);
    const bbM = bbS.reduce((a, b) => a + b, 0) / bbP;
    const bbStd = Math.sqrt(bbS.reduce((a, v) => a + (v - bbM) ** 2, 0) / bbP);
    const bbWidth = bbM > 0 ? (bbStd * 4) / bbM * 100 : 0;

    // ATR for backward compat
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    const atr = trs.length >= 14
      ? trs.slice(-14).reduce((a, b) => a + b, 0) / 14
      : trs.reduce((a, b) => a + b, 0) / (trs.length || 1);

    const response = {
      success: true,
      data: {
        // Backward compatible fields
        regime: regime.label === 'strong_trend' ? (regime.direction === 'bearish' ? 'trending_down' : 'trending_up')
          : regime.label === 'trending' ? (regime.direction === 'bearish' ? 'trending_down' : 'trending_up')
          : regime.label === 'choppy' || regime.label === 'mean_reversion' ? 'ranging'
          : regime.label === 'transitional' ? 'ranging'
          : 'ranging',
        confidence: regime.confidence,
        description: regime.description,
        recommended: regime.strategies.recommended,
        avoid: regime.strategies.avoid,
        indicators: {
          adx: regime.components.adx,
          rsi: Math.round(rsi * 100) / 100,
          bbWidth: Math.round(bbWidth * 100) / 100,
          atr: Math.round(atr * 100) / 100,
        },
        // New regime scoring fields
        regimeScore: regime.score,
        regimeLabel: regime.label,
        direction: regime.direction,
        components: regime.components,
      },
    };

    await redis.set('market:regime:v2', JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Regime error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /regime/scores — Per-coin regime scoring for all active pairs
router.get('/regime/scores', async (_req: Request, res: Response) => {
  try {
    const cached = await redis.get('market:regime:scores');
    if (cached) { res.json(JSON.parse(cached)); return; }

    const pairsResult = await query(
      `SELECT tp.id, tp.symbol, e.name as exchange FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.is_active = true ORDER BY tp.symbol`
    );

    const scores: Array<{
      symbol: string;
      exchange: string;
      score: number;
      label: string;
      direction: string;
      confidence: number;
      description: string;
      components: RegimeScoreResult['components'];
      strategies: RegimeScoreResult['strategies'];
      price: number;
      change24h: number;
    }> = [];

    for (const pair of pairsResult.rows) {
      try {
        const candles = await fetchCandlesForRegime(pair.id, 100);
        if (candles.length < 30) continue;

        const highs = candles.map((c: { high: number }) => c.high);
        const lows = candles.map((c: { low: number }) => c.low);
        const closes = candles.map((c: { close: number }) => c.close);

        const regime = computeRegimeScore(highs, lows, closes);
        const price = closes[closes.length - 1];
        const price24hAgo = closes.length >= 24 ? closes[closes.length - 24] : closes[0];
        const change24h = price24hAgo > 0 ? ((price - price24hAgo) / price24hAgo) * 100 : 0;

        scores.push({
          symbol: pair.symbol,
          exchange: pair.exchange,
          score: regime.score,
          label: regime.label,
          direction: regime.direction,
          confidence: regime.confidence,
          description: regime.description,
          components: regime.components,
          strategies: regime.strategies,
          price: Math.round(price * 100) / 100,
          change24h: Math.round(change24h * 100) / 100,
        });
      } catch (err) {
        logger.warn('Regime score failed for pair', { symbol: pair.symbol, error: (err as Error).message });
      }
    }

    // Sort by score descending (most trending first)
    scores.sort((a, b) => b.score - a.score);

    const response = { success: true, data: scores };
    await redis.set('market:regime:scores', JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Regime scores error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /confluence/:symbol — Cross-signal confluence map
router.get('/confluence/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check cache (5 min)
    const cacheKey = `market:confluence:${symbol}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Find pair
    const pairResult = await query(
      `SELECT tp.id FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.symbol = $1 AND tp.is_active = true
       LIMIT 1`,
      [symbol]
    );

    if (pairResult.rows.length === 0) {
      res.status(404).json({ success: false, error: `No data found for ${symbol}` });
      return;
    }

    const pairId = pairResult.rows[0].id;

    // Fetch last 100 1h candles for indicator computation
    const candlesResult = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ohlcv_1h o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 100`,
      [pairId]
    );

    const candles = candlesResult.rows
      .map((r: { time: string; open: string; high: string; low: string; close: string; volume: string }) => ({
        time: new Date(r.time),
        open: parseFloat(r.open),
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      }))
      .reverse();

    if (candles.length < 20) {
      res.status(404).json({ success: false, error: 'Insufficient data for confluence analysis' });
      return;
    }

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const currentPrice = closes[closes.length - 1];

    // --- Collect price zones with sources ---
    const zoneSources: Map<number, Set<string>> = new Map();

    function addZone(price: number, source: string) {
      const precision = currentPrice > 1000 ? 1 : currentPrice > 100 ? 0.1 : currentPrice > 1 ? 0.01 : 0.0001;
      const rounded = Math.round(price / precision) * precision;
      const roundedKey = parseFloat(rounded.toPrecision(8));
      if (!zoneSources.has(roundedKey)) {
        zoneSources.set(roundedKey, new Set());
      }
      zoneSources.get(roundedKey)!.add(source);
    }

    // 1. Support/Resistance from recent swing highs/lows (last 50 candles)
    const recentCandles = candles.slice(-50);
    for (let i = 2; i < recentCandles.length - 2; i++) {
      if (
        recentCandles[i].high > recentCandles[i - 1].high &&
        recentCandles[i].high > recentCandles[i - 2].high &&
        recentCandles[i].high > recentCandles[i + 1].high &&
        recentCandles[i].high > recentCandles[i + 2].high
      ) {
        addZone(recentCandles[i].high, 'Resistance (Swing High)');
      }
      if (
        recentCandles[i].low < recentCandles[i - 1].low &&
        recentCandles[i].low < recentCandles[i - 2].low &&
        recentCandles[i].low < recentCandles[i + 1].low &&
        recentCandles[i].low < recentCandles[i + 2].low
      ) {
        addZone(recentCandles[i].low, 'Support (Swing Low)');
      }
    }

    // 2. EMA9
    let ema9 = closes[0];
    const k9 = 2 / (9 + 1);
    for (let i = 1; i < closes.length; i++) {
      ema9 = closes[i] * k9 + ema9 * (1 - k9);
    }
    addZone(ema9, 'EMA 9');

    // 3. EMA21
    let ema21 = closes[0];
    const k21 = 2 / (21 + 1);
    for (let i = 1; i < closes.length; i++) {
      ema21 = closes[i] * k21 + ema21 * (1 - k21);
    }
    addZone(ema21, 'EMA 21');

    // 4. SMA50
    const sma50Period = Math.min(50, closes.length);
    const sma50Slice = closes.slice(closes.length - sma50Period);
    const sma50 = sma50Slice.reduce((a, b) => a + b, 0) / sma50Period;
    addZone(sma50, 'SMA 50');

    // 5. Bollinger Bands (20, 2)
    const bbPeriod = Math.min(20, closes.length);
    const bbSlice = closes.slice(closes.length - bbPeriod);
    const bbMean = bbSlice.reduce((a, b) => a + b, 0) / bbPeriod;
    const bbStd = Math.sqrt(bbSlice.reduce((a, v) => a + (v - bbMean) ** 2, 0) / bbPeriod);
    const bbUpper = bbMean + 2 * bbStd;
    const bbLower = bbMean - 2 * bbStd;
    addZone(bbUpper, 'Bollinger Upper Band');
    addZone(bbMean, 'Bollinger Middle Band');
    addZone(bbLower, 'Bollinger Lower Band');

    // 6. RSI zones
    let rsi = 50;
    if (closes.length >= 15) {
      let gains = 0;
      let losses = 0;
      const offset = closes.length - 15;
      for (let i = 1; i <= 14; i++) {
        const diff = closes[offset + i] - closes[offset + i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    if (rsi >= 70) {
      addZone(currentPrice, 'RSI Overbought');
    } else if (rsi <= 30) {
      addZone(currentPrice, 'RSI Oversold');
    }

    // 7. Recent high/low as support/resistance
    const recentHigh = Math.max(...highs.slice(-20));
    const recentLow = Math.min(...lows.slice(-20));
    addZone(recentHigh, 'Recent 20-bar High');
    addZone(recentLow, 'Recent 20-bar Low');

    // Build zones array
    const zones = Array.from(zoneSources.entries()).map(([price, sources]) => {
      const count = sources.size;
      let strength: 'weak' | 'moderate' | 'strong' | 'extreme';
      if (count >= 4) strength = 'extreme';
      else if (count === 3) strength = 'strong';
      else if (count === 2) strength = 'moderate';
      else strength = 'weak';

      const distanceFromCurrent = currentPrice > 0
        ? Math.round(((price - currentPrice) / currentPrice) * 10000) / 100
        : 0;

      return {
        price: Math.round(price * 100000000) / 100000000,
        sources: Array.from(sources),
        count,
        strength,
        distancePercent: distanceFromCurrent,
      };
    });

    // Sort by count descending, then by proximity to current price
    zones.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return Math.abs(a.distancePercent) - Math.abs(b.distancePercent);
    });

    // Filter out zones too far away (> 15% from current price)
    const filteredZones = zones.filter((z) => Math.abs(z.distancePercent) <= 15);

    const response = {
      success: true,
      data: {
        symbol,
        currentPrice,
        rsi: Math.round(rsi * 100) / 100,
        zones: filteredZones,
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Confluence error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /seasonality/:symbol — Day-of-week and hour-of-day performance analysis
router.get('/seasonality/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check Redis cache (5 min)
    const cacheKey = `market:seasonality:${symbol}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Find pair
    const pairResult = await query(
      `SELECT tp.id FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.symbol = $1 AND tp.is_active = true
       LIMIT 1`,
      [symbol]
    );

    if (pairResult.rows.length === 0) {
      res.status(404).json({ success: false, error: `No data found for ${symbol}` });
      return;
    }

    const pairId = pairResult.rows[0].id;

    // Fetch 1m candles (last ~7 days = ~10080 candles)
    const candlesResult = await query(
      `SELECT o.time, o.open, o.close
       FROM ohlcv_1m o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 10080`,
      [pairId]
    );

    const candles = candlesResult.rows.map((r: { time: string; open: string; close: string }) => ({
      time: new Date(r.time),
      open: parseFloat(r.open),
      close: parseFloat(r.close),
    })).reverse();

    if (candles.length < 60) {
      res.status(404).json({ success: false, error: 'Insufficient data for seasonality analysis' });
      return;
    }

    // Aggregate by hour (0-23)
    const hourlyBuckets: Array<{ returns: number[]; positive: number; negative: number }> = [];
    for (let h = 0; h < 24; h++) {
      hourlyBuckets.push({ returns: [], positive: 0, negative: 0 });
    }

    // Aggregate by day of week (0=Sun, 6=Sat)
    const dailyBuckets: Array<{ returns: number[]; positive: number; negative: number }> = [];
    for (let d = 0; d < 7; d++) {
      dailyBuckets.push({ returns: [], positive: 0, negative: 0 });
    }

    for (const c of candles) {
      if (c.open === 0) continue;
      const ret = ((c.close - c.open) / c.open) * 100;
      const hour = c.time.getUTCHours();
      const day = c.time.getUTCDay();

      hourlyBuckets[hour].returns.push(ret);
      if (ret > 0) hourlyBuckets[hour].positive++;
      else hourlyBuckets[hour].negative++;

      dailyBuckets[day].returns.push(ret);
      if (ret > 0) dailyBuckets[day].positive++;
      else dailyBuckets[day].negative++;
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const hourly = hourlyBuckets.map((b, hour) => {
      const count = b.returns.length;
      const avgReturn = count > 0
        ? Math.round((b.returns.reduce((a, v) => a + v, 0) / count) * 10000) / 10000
        : 0;
      const winRate = count > 0 ? Math.round((b.positive / count) * 10000) / 100 : 0;
      return { hour, avgReturn, winRate, count };
    });

    const daily = dailyBuckets.map((b, idx) => {
      const count = b.returns.length;
      const avgReturn = count > 0
        ? Math.round((b.returns.reduce((a, v) => a + v, 0) / count) * 10000) / 10000
        : 0;
      const winRate = count > 0 ? Math.round((b.positive / count) * 10000) / 100 : 0;
      return { day: dayNames[idx], avgReturn, winRate, count };
    });

    const response = {
      success: true,
      data: { symbol, hourly, daily },
    };

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);

    res.json(response);
  } catch (err) {
    logger.error('Seasonality error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /profile/:symbol — Market Profile (TPO / Volume Profile)
router.get('/profile/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check cache (5 min)
    const cacheKey = `market:profile:${symbol}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Find pair
    const pairResult = await query(
      `SELECT tp.id FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.symbol = $1 AND tp.is_active = true
       LIMIT 1`,
      [symbol]
    );

    if (pairResult.rows.length === 0) {
      res.status(404).json({ success: false, error: `No data found for ${symbol}` });
      return;
    }

    const pairId = pairResult.rows[0].id;

    // Fetch last 50 candles (1h)
    const candlesResult = await query(
      `SELECT o.high, o.low, o.close, o.volume
       FROM ohlcv_1h o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 50`,
      [pairId]
    );

    const candles = candlesResult.rows
      .map((r: { high: string; low: string; close: string; volume: string }) => ({
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      }))
      .reverse();

    if (candles.length < 10) {
      res.status(404).json({ success: false, error: 'Insufficient data for market profile' });
      return;
    }

    // Determine overall high and low
    const overallHigh = Math.max(...candles.map((c) => c.high));
    const overallLow = Math.min(...candles.map((c) => c.low));
    const range = overallHigh - overallLow;

    if (range === 0) {
      res.status(404).json({ success: false, error: 'No price range in data' });
      return;
    }

    // Split into 10 price levels
    const numLevels = 10;
    const step = range / numLevels;
    const levels: { price: number; volume: number }[] = [];

    for (let i = 0; i < numLevels; i++) {
      levels.push({
        price: Math.round((overallLow + step * (i + 0.5)) * 100) / 100,
        volume: 0,
      });
    }

    // Distribute volume into levels
    let totalVolume = 0;
    for (const c of candles) {
      const candleRange = c.high - c.low;
      if (candleRange === 0) {
        const idx = Math.min(Math.floor((c.close - overallLow) / step), numLevels - 1);
        levels[Math.max(0, idx)].volume += c.volume;
      } else {
        for (let i = 0; i < numLevels; i++) {
          const levelLow = overallLow + step * i;
          const levelHigh = levelLow + step;
          const overlap = Math.max(0, Math.min(c.high, levelHigh) - Math.max(c.low, levelLow));
          if (overlap > 0) {
            const fraction = overlap / candleRange;
            levels[i].volume += c.volume * fraction;
          }
        }
      }
      totalVolume += c.volume;
    }

    // Round volumes
    levels.forEach((l) => { l.volume = Math.round(l.volume); });

    // POC: level with most volume
    let pocIdx = 0;
    let maxVol = 0;
    for (let i = 0; i < numLevels; i++) {
      if (levels[i].volume > maxVol) {
        maxVol = levels[i].volume;
        pocIdx = i;
      }
    }
    const poc = levels[pocIdx].price;

    // Value Area: 70% of total volume centered around POC
    const vaTarget = totalVolume * 0.7;
    let vaVolume = levels[pocIdx].volume;
    let vaLowIdx = pocIdx;
    let vaHighIdx = pocIdx;

    while (vaVolume < vaTarget && (vaLowIdx > 0 || vaHighIdx < numLevels - 1)) {
      const canGoLow = vaLowIdx > 0;
      const canGoHigh = vaHighIdx < numLevels - 1;

      if (canGoLow && canGoHigh) {
        if (levels[vaLowIdx - 1].volume >= levels[vaHighIdx + 1].volume) {
          vaLowIdx--;
          vaVolume += levels[vaLowIdx].volume;
        } else {
          vaHighIdx++;
          vaVolume += levels[vaHighIdx].volume;
        }
      } else if (canGoLow) {
        vaLowIdx--;
        vaVolume += levels[vaLowIdx].volume;
      } else {
        vaHighIdx++;
        vaVolume += levels[vaHighIdx].volume;
      }
    }

    const vaHigh = Math.round((overallLow + step * (vaHighIdx + 1)) * 100) / 100;
    const vaLow = Math.round((overallLow + step * vaLowIdx) * 100) / 100;

    // Distribution shape
    const topThirdVol = levels.slice(Math.floor(numLevels * 0.67)).reduce((s, l) => s + l.volume, 0);
    const bottomThirdVol = levels.slice(0, Math.ceil(numLevels * 0.33)).reduce((s, l) => s + l.volume, 0);

    let distributionShape: 'normal' | 'p-shape' | 'b-shape';
    if (topThirdVol > totalVolume * 0.45) {
      distributionShape = 'p-shape';
    } else if (bottomThirdVol > totalVolume * 0.45) {
      distributionShape = 'b-shape';
    } else {
      distributionShape = 'normal';
    }

    // Build volume profile with percentages
    const volumeProfile = levels.map((l) => ({
      price: l.price,
      volume: l.volume,
      pct: totalVolume > 0 ? Math.round((l.volume / totalVolume) * 10000) / 100 : 0,
    }));

    const response = {
      success: true,
      data: {
        symbol,
        poc,
        vaHigh,
        vaLow,
        distributionShape,
        volumeProfile,
        totalVolume: Math.round(totalVolume),
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Market profile error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
