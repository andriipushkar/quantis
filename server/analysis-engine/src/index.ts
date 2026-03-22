import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import express from 'express';
import Bull from 'bull';
import logger from './config/logger.js';
import pool from './config/database.js';
import { publisherClient } from './config/redis.js';
import calculator from './indicators/calculator.js';
import { calculateConfluence, type ConfluenceInput } from './confluence/engine.js';
import strategyEngine from './strategies/index.js';

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

// ── Bull Queue for Parallel Pair Analysis ────────────────────────────

export const analysisQueue = new Bull('pair-analysis', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  },
});

// Process analysis jobs — concurrency of 5
analysisQueue.process('analyze-pair', 5, async (job) => {
  const pair = job.data;
  logger.debug('Processing pair analysis', { symbol: pair.symbol, jobId: job.id });

  // Get last 100 1m candles
  const candlesResult = await pool.query(
    `SELECT time, open, high, low, close, volume FROM ohlcv_1m
     WHERE pair_id = $1 ORDER BY time DESC LIMIT 100`,
    [pair.id]
  );

  if (candlesResult.rows.length < 30) return;

  const candles = candlesResult.rows.reverse();
  const closes = candles.map((c: CandleRow) => parseFloat(c.close));
  const highs = candles.map((c: CandleRow) => parseFloat(c.high));
  const lows = candles.map((c: CandleRow) => parseFloat(c.low));
  const volumes = candles.map((c: CandleRow) => parseFloat(c.volume));

  const rsi = calculator.calculateRSI(closes, 14);
  const atr = calculator.calculateATR(highs, lows, closes, 14);

  if (rsi.length === 0 || atr.length === 0) return;

  const currentRSI = rsi[rsi.length - 1];
  const currentATR = atr[atr.length - 1];
  const currentPrice = closes[closes.length - 1];

  // ── Confluence Score ─────────────────────────────────────────────
  try {
    // Gather active signals for this pair
    const signalsResult = await pool.query(
      `SELECT type, confidence, strategy FROM signals WHERE pair_id = $1 AND status = 'active'`,
      [pair.id]
    );

    // Gather sentiment data from Redis
    let fearGreed = 50;
    let newsSentiment = { bullish: 0, bearish: 0, neutral: 1 };
    let whaleAlertCount = 0;
    try {
      const fgData = await publisherClient.get(`confluence:feargreed`);
      if (fgData) fearGreed = parseInt(fgData, 10);
      const newsData = await publisherClient.get(`confluence:news:sentiment`);
      if (newsData) newsSentiment = JSON.parse(newsData);
      const whaleData = await publisherClient.get(`confluence:whales:${pair.symbol}`);
      if (whaleData) whaleAlertCount = parseInt(whaleData, 10);
    } catch { /* use defaults */ }

    const confluenceInput: ConfluenceInput = {
      symbol: pair.symbol,
      highs,
      lows,
      closes,
      volumes,
      activeSignals: signalsResult.rows.map((r: { type: string; confidence: number; strategy: string }) => ({
        type: r.type,
        confidence: r.confidence,
        strategy: r.strategy,
      })),
      newsSentiment,
      fearGreedIndex: fearGreed,
      whaleAlertCount,
    };

    const confluence = calculateConfluence(confluenceInput);

    // Cache in Redis — individual key (120s TTL) + snapshot hash (O(1) reads)
    const confluenceJson = JSON.stringify(confluence);
    await Promise.all([
      publisherClient.set(`confluence:${pair.symbol}`, confluenceJson, 'EX', 120),
      publisherClient.hset('confluence:snapshot', pair.symbol, confluenceJson),
    ]);

    // Publish for real-time WebSocket delivery
    await publisherClient.publish('confluence:update', JSON.stringify(confluence));

    // Persist to database for backtest history
    await pool.query(
      `INSERT INTO confluence_history
         (time, pair_id, symbol, score, label, risk, confidence,
          trend_score, momentum_score, signals_score, sentiment_score, volume_score,
          components_json)
       VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (time, pair_id) DO UPDATE SET
         score = EXCLUDED.score, label = EXCLUDED.label,
         components_json = EXCLUDED.components_json`,
      [
        pair.id,
        pair.symbol,
        confluence.score,
        confluence.label,
        confluence.risk,
        confluence.confidence,
        confluence.components.trend.score,
        confluence.components.momentum.score,
        confluence.components.signals.score,
        confluence.components.sentiment.score,
        confluence.components.volume.score,
        JSON.stringify(confluence.components),
      ]
    );

    logger.debug('Confluence score computed & persisted', {
      symbol: pair.symbol,
      score: confluence.score,
      label: confluence.label,
    });
  } catch (err) {
    logger.error('Confluence scoring failed', {
      symbol: pair.symbol,
      error: (err as Error).message,
    });
  }

  // Check if there's already an active signal for this pair
  const existing = await pool.query(
    `SELECT id FROM signals WHERE pair_id = $1 AND status = 'active' LIMIT 1`,
    [pair.id]
  );
  if (existing.rows.length > 0) return;

  // ── Run all strategies via StrategyEngine ─────────────────────────
  const strategyResults = strategyEngine.evaluateAll({
    closes,
    highs,
    lows,
    volumes,
    currentPrice,
    currentATR,
  });

  // Pick the highest-confidence signal (already sorted desc by evaluateAll)
  if (strategyResults.length > 0) {
    const best = strategyResults[0];
    await createSignal(
      pair,
      best.type.toLowerCase() as 'buy' | 'sell',
      best.strategy,
      currentPrice,
      currentATR,
      currentRSI,
      best.confidence,
      best.sources,
      best.reasoning,
    );
    return;
  }
});

analysisQueue.on('failed', (job, err) => {
  logger.error('Pair analysis job failed', {
    jobId: job.id,
    symbol: job.data.symbol,
    error: err.message,
    attempts: job.attemptsMade,
  });
});

analysisQueue.on('completed', (job) => {
  logger.debug('Pair analysis job completed', { jobId: job.id, symbol: job.data.symbol });
});

async function enqueueAnalysisJobs(): Promise<void> {
  try {
    // Get all active pairs
    const pairsResult = await pool.query(
      `SELECT tp.id, tp.symbol, tp.exchange_id FROM trading_pairs tp WHERE tp.is_active = true`
    );

    for (const pair of pairsResult.rows) {
      await analysisQueue.add('analyze-pair', {
        id: pair.id,
        symbol: pair.symbol,
        exchange_id: pair.exchange_id,
      });
    }

    logger.info(`Enqueued ${pairsResult.rows.length} pair analysis jobs`);
  } catch (err) {
    logger.error('Failed to enqueue analysis jobs', { error: (err as Error).message });
  }
}

async function createSignal(
  pair: { id: number; symbol: string; exchange_id: number },
  type: 'buy' | 'sell',
  strategy: string,
  price: number,
  atr: number,
  rsi: number,
  overrideConfidence?: number,
  overrideSources?: string[],
  overrideReasoning?: string,
): Promise<void> {
  const slDistance = atr * 2;
  const sl = type === 'buy' ? price - slDistance : price + slDistance;
  const tp1 = type === 'buy' ? price + slDistance : price - slDistance;
  const tp2 = type === 'buy' ? price + slDistance * 2 : price - slDistance * 2;
  const tp3 = type === 'buy' ? price + slDistance * 3 : price - slDistance * 3;

  const confidence = overrideConfidence ?? Math.min(95, Math.round(
    50 + (type === 'buy' ? (50 - rsi) * 0.5 : (rsi - 50) * 0.5) + (strategy === 'trend_following' ? 10 : 5)
  ));

  const strength = confidence >= 75 ? 'strong' : confidence >= 55 ? 'medium' : 'weak';

  const sources = overrideSources ?? (strategy === 'trend_following'
    ? ['EMA(9)', 'EMA(21)', 'RSI(14)', 'Volume']
    : ['RSI(14)', 'Mean Reversion']);

  const reasoning = overrideReasoning ?? (strategy === 'trend_following'
    ? `EMA(9) crossed ${type === 'buy' ? 'above' : 'below'} EMA(21) with RSI at ${rsi.toFixed(1)} and volume surge confirmed.`
    : `RSI(14) at ${rsi.toFixed(1)} indicates ${type === 'buy' ? 'oversold' : 'overbought'} conditions. Mean reversion expected.`);

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

    // Run analysis every 60 seconds via Bull queue
    logger.info('Starting signal analysis loop (every 60s)');
    enqueueAnalysisJobs(); // run immediately
    setInterval(enqueueAnalysisJobs, 60_000);

    logger.info('Analysis engine started successfully');
  } catch (error) {
    logger.error('Failed to start', { error: (error as Error).message });
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down gracefully`);
  try {
    await analysisQueue.close();
    logger.info('Analysis queue closed');
    await pool.end();
    logger.info('Database pool closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: (error as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
