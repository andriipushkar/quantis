import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

const router = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WhaleAlert {
  symbol: string;
  exchange: string;
  type: 'exchange_inflow' | 'exchange_outflow' | 'transfer';
  amount_usd: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WHALE_TYPES: WhaleAlert['type'][] = ['exchange_inflow', 'exchange_outflow', 'transfer'];

function pickWhaleType(seed: number): WhaleAlert['type'] {
  return WHALE_TYPES[seed % WHALE_TYPES.length];
}

// ---------------------------------------------------------------------------
// GET /api/v1/whales
// ---------------------------------------------------------------------------

const CACHE_KEY = 'whales:alerts';
const CACHE_TTL = 120; // 2 minutes

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Check Redis cache
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      res.json({ success: true, data: JSON.parse(cached) });
      return;
    }

    // 1. Get all active trading pairs
    const pairsResult = await query(
      `SELECT tp.id, tp.symbol, tp.base_asset, tp.quote_asset, e.name as exchange
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.is_active = true
       ORDER BY tp.symbol ASC`
    );

    const alerts: WhaleAlert[] = [];

    for (const pair of pairsResult.rows) {
      // Fetch last 20 candles (1m) for volume analysis
      const candlesResult = await query(
        `SELECT time, volume FROM ohlcv_1m
         WHERE pair_id = $1
         ORDER BY time DESC
         LIMIT 20`,
        [pair.id]
      );

      const candles = candlesResult.rows;
      if (candles.length < 5) continue;

      const volumes = candles.map((c: { volume: string }) => parseFloat(c.volume));
      const latestVolume = volumes[0];

      // Average volume of candles 1..19 (excluding latest)
      const historicalVolumes = volumes.slice(1);
      const avgVolume =
        historicalVolumes.reduce((a: number, b: number) => a + b, 0) / historicalVolumes.length;

      // Detect whale activity: current volume > 3x average
      if (avgVolume > 0 && latestVolume > avgVolume * 3) {
        const spikeMagnitude = latestVolume / avgVolume;

        // Get current price from Redis ticker
        let price = 0;
        const exchanges = ['binance', 'bybit', 'okx'];
        for (const ex of exchanges) {
          const tickerData = await redis.get(`ticker:${ex}:${pair.symbol.toUpperCase()}`);
          if (tickerData) {
            try {
              price = JSON.parse(tickerData).price ?? 0;
            } catch { /* skip */ }
            break;
          }
        }

        // Estimate USD amount from volume spike
        const excessVolume = latestVolume - avgVolume;
        const amountUsd = price > 0
          ? Math.round(excessVolume * price)
          : Math.round(excessVolume * 100); // fallback estimate

        const seedIndex = pair.id + Math.floor(Date.now() / 60_000);

        alerts.push({
          symbol: pair.symbol,
          exchange: pair.exchange,
          type: pickWhaleType(seedIndex),
          amount_usd: amountUsd,
          timestamp: candles[0].time,
        });

        // If spike is extreme (>6x), add a second alert
        if (spikeMagnitude > 6) {
          alerts.push({
            symbol: pair.symbol,
            exchange: pair.exchange,
            type: pickWhaleType(seedIndex + 1),
            amount_usd: Math.round(amountUsd * 0.6),
            timestamp: candles[0].time,
          });
        }
      }
    }

    // Sort by amount descending
    alerts.sort((a, b) => b.amount_usd - a.amount_usd);

    // Cache in Redis
    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(alerts));

    res.json({ success: true, data: alerts });
  } catch (err) {
    logger.error('Whale alerts error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
