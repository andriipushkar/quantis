import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import redis from '../../config/redis.js';
import logger from '../../config/logger.js';

export const TIMEFRAME_TABLES: Record<string, string> = {
  '1m': 'ohlcv_1m',
  '5m': 'ohlcv_5m',
  '15m': 'ohlcv_15m',
  '1h': 'ohlcv_1h',
  '4h': 'ohlcv_4h',
  '1d': 'ohlcv_1d',
};

const router = Router();

// GET /ohlcv/:symbol
router.get('/ohlcv/:symbol', async (req: Request, res: Response) => {
  try {
    const { timeframe = '1m', limit = '500', from, to } = req.query;
    const table = TIMEFRAME_TABLES[timeframe as string];

    if (!table) {
      res.status(400).json({
        success: false,
        error: 'Invalid timeframe',
        validTimeframes: Object.keys(TIMEFRAME_TABLES),
      });
      return;
    }

    const conditions: string[] = ['tp.symbol = $1'];
    const params: unknown[] = [req.params.symbol.toUpperCase()];
    let paramIndex = 2;

    if (from) {
      conditions.push(`o.time >= $${paramIndex++}::timestamptz`);
      params.push(from);
    }
    if (to) {
      conditions.push(`o.time <= $${paramIndex++}::timestamptz`);
      params.push(to);
    }

    const maxLimit = Math.min(parseInt(limit as string, 10) || 500, 5000);
    params.push(maxLimit);

    const result = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ${table} o
       JOIN trading_pairs tp ON tp.id = o.pair_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY o.time ASC
       LIMIT $${paramIndex}`,
      params
    );

    const candles = result.rows.map((r) => ({
      time: Math.floor(new Date(r.time).getTime() / 1000),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
    }));

    res.json({ success: true, data: candles });
  } catch (err) {
    logger.error('Get OHLCV error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /renko/:symbol — Simulated Renko chart from 1m candles
router.get('/renko/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const cacheKey = `market:renko:${symbol}`;
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
      // Generate fallback renko data
      const fallbackPrice = symbol.includes('BTC') ? 97500 : symbol.includes('ETH') ? 3450 : 100;
      const brickSize = Math.round(fallbackPrice * 0.005);
      const bricks: Array<{ price: number; type: 'up' | 'down'; index: number }> = [];
      let price = fallbackPrice - brickSize * 10;
      const directions = [1, 1, 1, -1, 1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, 1, 1, 1, -1];
      for (let i = 0; i < directions.length; i++) {
        price += directions[i] * brickSize;
        bricks.push({ price, type: directions[i] === 1 ? 'up' : 'down', index: i });
      }

      const response = {
        success: true,
        data: { symbol, brickSize, bricks },
      };
      await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
      res.json(response);
      return;
    }

    const pairId = pairResult.rows[0].id;

    // Fetch last 500 1m candles
    const candlesResult = await query(
      `SELECT o.high, o.low, o.close FROM ohlcv_1m o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 500`,
      [pairId]
    );

    const candles = candlesResult.rows
      .map((r: { high: string; low: string; close: string }) => ({
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
      }))
      .reverse();

    if (candles.length < 20) {
      res.status(404).json({ success: false, error: 'Insufficient data for Renko chart' });
      return;
    }

    // Calculate ATR(20)
    let atrSum = 0;
    for (let i = 0; i < Math.min(20, candles.length); i++) {
      atrSum += candles[i].high - candles[i].low;
    }
    const atr = atrSum / Math.min(20, candles.length);
    const brickSize = Math.round((atr / 2) * 100) / 100;

    if (brickSize <= 0) {
      res.status(400).json({ success: false, error: 'Invalid brick size computed' });
      return;
    }

    // Build Renko bricks
    const bricks: Array<{ price: number; type: 'up' | 'down'; index: number }> = [];
    let lastBrickTop = candles[0].close;
    let lastBrickBottom = candles[0].close - brickSize;
    let idx = 0;

    for (const candle of candles) {
      // Check for up bricks
      while (candle.close >= lastBrickTop + brickSize) {
        lastBrickBottom = lastBrickTop;
        lastBrickTop = lastBrickTop + brickSize;
        bricks.push({ price: Math.round(lastBrickTop * 100) / 100, type: 'up', index: idx++ });
      }
      // Check for down bricks
      while (candle.close <= lastBrickBottom - brickSize) {
        lastBrickTop = lastBrickBottom;
        lastBrickBottom = lastBrickBottom - brickSize;
        bricks.push({ price: Math.round(lastBrickBottom * 100) / 100, type: 'down', index: idx++ });
      }
    }

    const response = {
      success: true,
      data: {
        symbol,
        brickSize: Math.round(brickSize * 100) / 100,
        bricks: bricks.slice(-100), // Last 100 bricks
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Renko error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
