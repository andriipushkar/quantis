import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import logger from './config/logger.js';
import pool from './config/database.js';
import { publisherClient } from './config/redis.js';

const PORT = parseInt(process.env.PORT || '3003', 10);
const app = express();

// ── Signal Generation Logic ──────────────────────────────────────────

interface CandleRow {
  time: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  pair_id: number;
  exchange_id: number;
  symbol: string;
}

function calculateRSI(closes: number[], period: number): number[] {
  if (closes.length < period + 1) return [];
  const rsi: number[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss += Math.abs(d);
  }
  avgGain /= period; avgLoss /= period;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  ema.push(sum / period);
  for (let i = period; i < data.length; i++) ema.push(data[i] * k + ema[ema.length - 1] * (1 - k));
  return ema;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
  if (highs.length < period + 1) return [];
  const tr: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  const atr: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  atr.push(sum / period);
  for (let i = period; i < tr.length; i++) atr.push((atr[atr.length - 1] * (period - 1) + tr[i]) / period);
  return atr;
}

async function analyzeAndGenerateSignals(): Promise<void> {
  try {
    // Get all active pairs
    const pairsResult = await pool.query(
      `SELECT tp.id, tp.symbol, tp.exchange_id FROM trading_pairs tp WHERE tp.is_active = true`
    );

    for (const pair of pairsResult.rows) {
      try {
        // Get last 100 1m candles
        const candlesResult = await pool.query(
          `SELECT time, open, high, low, close, volume FROM ohlcv_1m
           WHERE pair_id = $1 ORDER BY time DESC LIMIT 100`,
          [pair.id]
        );

        if (candlesResult.rows.length < 30) continue;

        const candles = candlesResult.rows.reverse();
        const closes = candles.map((c: CandleRow) => parseFloat(c.close));
        const highs = candles.map((c: CandleRow) => parseFloat(c.high));
        const lows = candles.map((c: CandleRow) => parseFloat(c.low));
        const volumes = candles.map((c: CandleRow) => parseFloat(c.volume));

        const rsi = calculateRSI(closes, 14);
        const ema9 = calculateEMA(closes, 9);
        const ema21 = calculateEMA(closes, 21);
        const atr = calculateATR(highs, lows, closes, 14);

        if (rsi.length === 0 || ema9.length === 0 || ema21.length === 0 || atr.length === 0) continue;

        const currentRSI = rsi[rsi.length - 1];
        const currentEMA9 = ema9[ema9.length - 1];
        const currentEMA21 = ema21[ema21.length - 1];
        const prevEMA9 = ema9.length > 1 ? ema9[ema9.length - 2] : currentEMA9;
        const prevEMA21 = ema21.length > 1 ? ema21[ema21.length - 2] : currentEMA21;
        const currentATR = atr[atr.length - 1];
        const currentPrice = closes[closes.length - 1];
        const avgVolume = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;
        const currentVolume = volumes[volumes.length - 1];

        // Check if there's already an active signal for this pair
        const existing = await pool.query(
          `SELECT id FROM signals WHERE pair_id = $1 AND status = 'active' LIMIT 1`,
          [pair.id]
        );
        if (existing.rows.length > 0) continue;

        // Strategy 1: Trend Following — EMA crossover + RSI confirmation
        const emaCrossUp = prevEMA9 <= prevEMA21 && currentEMA9 > currentEMA21;
        const emaCrossDown = prevEMA9 >= prevEMA21 && currentEMA9 < currentEMA21;
        const volumeSurge = currentVolume > avgVolume * 1.3;

        if (emaCrossUp && currentRSI > 45 && currentRSI < 75 && volumeSurge) {
          await createSignal(pair, 'buy', 'trend_following', currentPrice, currentATR, currentRSI);
          continue;
        }
        if (emaCrossDown && currentRSI < 55 && currentRSI > 25 && volumeSurge) {
          await createSignal(pair, 'sell', 'trend_following', currentPrice, currentATR, currentRSI);
          continue;
        }

        // Strategy 2: Mean Reversion — RSI extremes
        if (currentRSI < 25) {
          await createSignal(pair, 'buy', 'mean_reversion', currentPrice, currentATR, currentRSI);
          continue;
        }
        if (currentRSI > 75) {
          await createSignal(pair, 'sell', 'mean_reversion', currentPrice, currentATR, currentRSI);
          continue;
        }
      } catch (err) {
        logger.error('Error analyzing pair', { pair: pair.symbol, error: (err as Error).message });
      }
    }
  } catch (err) {
    logger.error('Signal generation error', { error: (err as Error).message });
  }
}

async function createSignal(
  pair: { id: number; symbol: string; exchange_id: number },
  type: 'buy' | 'sell',
  strategy: string,
  price: number,
  atr: number,
  rsi: number,
): Promise<void> {
  const slDistance = atr * 2;
  const sl = type === 'buy' ? price - slDistance : price + slDistance;
  const tp1 = type === 'buy' ? price + slDistance : price - slDistance;
  const tp2 = type === 'buy' ? price + slDistance * 2 : price - slDistance * 2;
  const tp3 = type === 'buy' ? price + slDistance * 3 : price - slDistance * 3;

  const confidence = Math.min(95, Math.round(
    50 + (type === 'buy' ? (50 - rsi) * 0.5 : (rsi - 50) * 0.5) + (strategy === 'trend_following' ? 10 : 5)
  ));

  const strength = confidence >= 75 ? 'strong' : confidence >= 55 ? 'medium' : 'weak';

  const sources = strategy === 'trend_following'
    ? ['EMA(9)', 'EMA(21)', 'RSI(14)', 'Volume']
    : ['RSI(14)', 'Mean Reversion'];

  const reasoning = strategy === 'trend_following'
    ? `EMA(9) crossed ${type === 'buy' ? 'above' : 'below'} EMA(21) with RSI at ${rsi.toFixed(1)} and volume surge confirmed.`
    : `RSI(14) at ${rsi.toFixed(1)} indicates ${type === 'buy' ? 'oversold' : 'overbought'} conditions. Mean reversion expected.`;

  const result = await pool.query(
    `INSERT INTO signals (id, pair_id, exchange_id, strategy, type, strength, entry_price, stop_loss, tp1, tp2, tp3, confidence, sources_json, reasoning, timeframe, status, expires_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, '1m', 'active', NOW() + INTERVAL '1 hour')
     RETURNING id`,
    [pair.id, pair.exchange_id, strategy, type, strength, price, sl, tp1, tp2, tp3, confidence, JSON.stringify(sources), reasoning]
  );

  logger.info(`Signal generated: ${type.toUpperCase()} ${pair.symbol}`, {
    id: result.rows[0].id,
    strategy,
    confidence,
    price,
  });

  // Publish to Redis for real-time delivery
  await publisherClient.publish('signal:new', JSON.stringify({
    id: result.rows[0].id,
    pair: pair.symbol,
    type,
    strategy,
    strength,
    confidence,
    entry_price: price,
    stop_loss: sl,
    tp1, tp2, tp3,
  }));
}

// ── Health Check ──────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1');
    const redisStatus = publisherClient.status;
    const healthy = dbResult.rowCount === 1 && redisStatus === 'ready';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      service: 'analysis-engine',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      connections: { database: 'connected', redis: redisStatus },
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: 'analysis-engine', error: (error as Error).message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  try {
    await pool.query('SELECT 1');
    logger.info('Database connection established');

    app.listen(PORT, () => {
      logger.info(`Analysis engine listening on port ${PORT}`);
    });

    // Run analysis every 60 seconds
    logger.info('Starting signal analysis loop (every 60s)');
    analyzeAndGenerateSignals(); // run immediately
    setInterval(analyzeAndGenerateSignals, 60_000);

    logger.info('Analysis engine started successfully');
  } catch (error) {
    logger.error('Failed to start', { error: (error as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => { logger.info('SIGTERM received'); process.exit(0); });
process.on('SIGINT', () => { logger.info('SIGINT received'); process.exit(0); });

start();
