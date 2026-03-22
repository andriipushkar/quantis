import { Router, Request, Response } from 'express';
import logger from '../config/logger.js';
import { getTickersByExchange } from '../utils/ticker-cache.js';

const router = Router();

interface ExchangeHealth {
  exchange: string;
  score: number;
  label: 'Healthy' | 'Degraded' | 'Critical';
  metrics: {
    activePairs: number;
    latestUpdate: string | null;
    dataFreshness: number;
    wsStatus: 'connected' | 'stale' | 'disconnected';
  };
}

// GET /health — Health check for all exchanges
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const exchanges = ['binance', 'bybit', 'okx'];
    const results: ExchangeHealth[] = [];

    for (const exchange of exchanges) {
      // Get all tickers for this exchange from shared cache
      const exchangeTickers = await getTickersByExchange(exchange);
      const activePairs = exchangeTickers.size;

      let latestTimestamp: number | null = null;
      let freshCount = 0;

      if (activePairs > 0) {
        const now = Date.now();
        for (const [, entry] of exchangeTickers) {
          const ts = entry.timestamp || 0;
          if (ts > (latestTimestamp || 0)) {
            latestTimestamp = ts;
          }
          // Fresh if within 60 seconds
          if (now - ts < 60000) {
            freshCount++;
          }
        }
      }

      // Data freshness score (0-100): percentage of pairs with fresh data
      const dataFreshness = activePairs > 0
        ? Math.round((freshCount / activePairs) * 100)
        : 0;

      // WebSocket status based on latest ticker recency
      const now = Date.now();
      const staleness = latestTimestamp ? now - latestTimestamp : Infinity;
      const wsStatus: 'connected' | 'stale' | 'disconnected' =
        staleness < 60000 ? 'connected' :
        staleness < 300000 ? 'stale' :
        'disconnected';

      // Pairs score: normalized (assume 10+ pairs is full score)
      const pairsScore = Math.min(100, (activePairs / 10) * 100);

      // Data quality: based on ws status
      const dataQuality = wsStatus === 'connected' ? 100 : wsStatus === 'stale' ? 50 : 0;

      // Overall score: weighted average
      const score = Math.round(
        dataFreshness * 0.4 +
        pairsScore * 0.3 +
        dataQuality * 0.3
      );

      const label: 'Healthy' | 'Degraded' | 'Critical' =
        score >= 70 ? 'Healthy' :
        score >= 40 ? 'Degraded' :
        'Critical';

      results.push({
        exchange,
        score,
        label,
        metrics: {
          activePairs,
          latestUpdate: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
          dataFreshness,
          wsStatus,
        },
      });
    }

    res.json({ success: true, data: results });
  } catch (err) {
    logger.error('Exchange health error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
