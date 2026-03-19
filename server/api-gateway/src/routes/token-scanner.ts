import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

const router = Router();

interface RiskFactor {
  name: string;
  score: number;
  maxScore: number;
  detail: string;
}

// GET /:symbol — Token risk assessment
router.get('/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check Redis cache (10 min)
    const cacheKey = `scanner:${symbol}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // 1. Find the trading pair(s) across exchanges
    const pairsResult = await query(
      `SELECT tp.id, tp.symbol, e.name as exchange
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.symbol = $1 AND tp.is_active = true`,
      [symbol]
    );

    if (pairsResult.rows.length === 0) {
      res.status(404).json({ success: false, error: `No data found for ${symbol}` });
      return;
    }

    const pairId = pairsResult.rows[0].id;
    const exchangeCount = pairsResult.rows.length;

    // 2. Fetch candles for analysis (last 100 1h candles for stability, last 20 for volume consistency)
    const candlesResult = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ohlcv_1h o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 100`,
      [pairId]
    );

    const candles = candlesResult.rows.map((r: { time: string; open: string; high: string; low: string; close: string; volume: string }) => ({
      time: r.time,
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
    })).reverse();

    // Fallback to 1m candles if no 1h data
    let candleData: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }> = candles;
    if (candleData.length === 0) {
      const fallbackResult = await query(
        `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
         FROM ohlcv_1m o
         WHERE o.pair_id = $1
         ORDER BY o.time DESC
         LIMIT 100`,
        [pairId]
      );
      candleData = fallbackResult.rows.map((r: { time: string; open: string; high: string; low: string; close: string; volume: string }) => ({
        time: r.time,
        open: parseFloat(r.open),
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      })).reverse();
    }

    const factors: RiskFactor[] = [];

    // Factor 1: Liquidity — check if volume > $10k/day (20 pts)
    let liquidityScore = 0;
    const recentVolumes = candleData.slice(-24).map((c) => c.volume * c.close);
    const dailyVolume = recentVolumes.reduce((a, b) => a + b, 0);
    if (dailyVolume > 100000) liquidityScore = 20;
    else if (dailyVolume > 50000) liquidityScore = 16;
    else if (dailyVolume > 10000) liquidityScore = 12;
    else if (dailyVolume > 1000) liquidityScore = 6;
    factors.push({
      name: 'Liquidity',
      score: liquidityScore,
      maxScore: 20,
      detail: `Est. daily volume: $${Math.round(dailyVolume).toLocaleString()}`,
    });

    // Factor 2: Age — more candles = older = safer (15 pts)
    const totalCandles = candleData.length;
    let ageScore = 0;
    if (totalCandles >= 100) ageScore = 15;
    else if (totalCandles >= 80) ageScore = 12;
    else if (totalCandles >= 50) ageScore = 9;
    else if (totalCandles >= 20) ageScore = 5;
    else ageScore = 2;
    factors.push({
      name: 'Data History',
      score: ageScore,
      maxScore: 15,
      detail: `${totalCandles} candles available`,
    });

    // Factor 3: Volatility — ATR/price ratio (15 pts, lower = safer)
    let volatilityScore = 0;
    if (candleData.length >= 14) {
      let atrSum = 0;
      for (let i = 1; i < Math.min(15, candleData.length); i++) {
        const tr = Math.max(
          candleData[i].high - candleData[i].low,
          Math.abs(candleData[i].high - candleData[i - 1].close),
          Math.abs(candleData[i].low - candleData[i - 1].close)
        );
        atrSum += tr;
      }
      const atr = atrSum / 14;
      const currentPrice = candleData[candleData.length - 1].close;
      const atrRatio = currentPrice > 0 ? (atr / currentPrice) * 100 : 100;

      if (atrRatio < 1) volatilityScore = 15;
      else if (atrRatio < 2) volatilityScore = 12;
      else if (atrRatio < 5) volatilityScore = 9;
      else if (atrRatio < 10) volatilityScore = 5;
      else volatilityScore = 2;

      factors.push({
        name: 'Volatility',
        score: volatilityScore,
        maxScore: 15,
        detail: `ATR/Price ratio: ${atrRatio.toFixed(2)}%`,
      });
    } else {
      factors.push({ name: 'Volatility', score: 0, maxScore: 15, detail: 'Insufficient data' });
    }

    // Factor 4: Volume consistency — stddev of volume over 20 candles (15 pts)
    let consistencyScore = 0;
    const last20 = candleData.slice(-20);
    if (last20.length >= 10) {
      const vols = last20.map((c) => c.volume);
      const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
      const variance = vols.reduce((sum, v) => sum + (v - mean) ** 2, 0) / vols.length;
      const stddev = Math.sqrt(variance);
      const cv = mean > 0 ? stddev / mean : 10; // coefficient of variation

      if (cv < 0.3) consistencyScore = 15;
      else if (cv < 0.5) consistencyScore = 12;
      else if (cv < 1) consistencyScore = 9;
      else if (cv < 2) consistencyScore = 5;
      else consistencyScore = 2;

      factors.push({
        name: 'Volume Consistency',
        score: consistencyScore,
        maxScore: 15,
        detail: `Coefficient of variation: ${cv.toFixed(2)}`,
      });
    } else {
      factors.push({ name: 'Volume Consistency', score: 0, maxScore: 15, detail: 'Insufficient data' });
    }

    // Factor 5: Price stability — max drawdown in last 100 candles (15 pts)
    let stabilityScore = 0;
    if (candleData.length >= 5) {
      let peak = candleData[0].close;
      let maxDrawdown = 0;
      for (const c of candleData) {
        if (c.close > peak) peak = c.close;
        const dd = peak > 0 ? ((peak - c.close) / peak) * 100 : 0;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      if (maxDrawdown < 5) stabilityScore = 15;
      else if (maxDrawdown < 10) stabilityScore = 12;
      else if (maxDrawdown < 20) stabilityScore = 9;
      else if (maxDrawdown < 40) stabilityScore = 5;
      else stabilityScore = 2;

      factors.push({
        name: 'Price Stability',
        score: stabilityScore,
        maxScore: 15,
        detail: `Max drawdown: ${maxDrawdown.toFixed(1)}%`,
      });
    } else {
      factors.push({ name: 'Price Stability', score: 0, maxScore: 15, detail: 'Insufficient data' });
    }

    // Factor 6: Exchange presence (20 pts)
    let exchangeScore = 0;
    if (exchangeCount >= 3) exchangeScore = 20;
    else if (exchangeCount === 2) exchangeScore = 14;
    else exchangeScore = 7;
    factors.push({
      name: 'Exchange Presence',
      score: exchangeScore,
      maxScore: 20,
      detail: `Listed on ${exchangeCount} exchange${exchangeCount > 1 ? 's' : ''}`,
    });

    // Total score
    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);

    let label: 'SAFE' | 'CAUTION' | 'RISKY' | 'DANGER';
    if (totalScore >= 75) label = 'SAFE';
    else if (totalScore >= 50) label = 'CAUTION';
    else if (totalScore >= 25) label = 'RISKY';
    else label = 'DANGER';

    const response = {
      success: true,
      data: { symbol, score: totalScore, label, factors },
    };

    // Cache for 10 minutes
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 600);

    res.json(response);
  } catch (err) {
    logger.error('Token scanner error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
