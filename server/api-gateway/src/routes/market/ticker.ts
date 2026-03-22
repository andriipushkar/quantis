import { Router, Request, Response } from 'express';
import redis from '../../config/redis.js';
import logger from '../../config/logger.js';

const router = Router();

// GET /ticker — all tickers
router.get('/ticker', async (_req: Request, res: Response) => {
  try {
    const keys = await redis.keys('ticker:*:*');
    if (keys.length === 0) {
      res.json({ success: true, data: {} });
      return;
    }

    const pipeline = redis.pipeline();
    for (const key of keys) {
      pipeline.get(key);
    }
    const results = await pipeline.exec();

    const tickers: Record<string, unknown> = {};
    keys.forEach((key, i) => {
      const value = results?.[i]?.[1];
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          tickers[parsed.symbol] = parsed;
        } catch {
          // skip
        }
      }
    });

    res.json({ success: true, data: tickers });
  } catch (err) {
    logger.error('Get tickers error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /ticker/:symbol
router.get('/ticker/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    // Try binance first, then other exchanges
    const exchanges = ['binance', 'bybit', 'okx'];
    for (const exchange of exchanges) {
      const data = await redis.get(`ticker:${exchange}:${symbol}`);
      if (data) {
        res.json({ success: true, data: JSON.parse(data) });
        return;
      }
    }

    res.status(404).json({ success: false, error: 'Ticker not found' });
  } catch (err) {
    logger.error('Get ticker error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
