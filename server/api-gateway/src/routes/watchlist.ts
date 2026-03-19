import { Router, Response } from 'express';
import { query } from '../config/database.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const TIER_WATCHLIST_LIMITS: Record<string, number> = {
  starter: 10,
  trader: 50,
  pro: 200,
  institutional: -1, // unlimited
};

// All routes require authentication
router.use(authenticate);

// GET / - list user's watchlist with current prices
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT w.id, w.pair_id, tp.symbol, tp.base_currency, tp.quote_currency, tp.exchange, w.created_at
       FROM watchlist w
       JOIN trading_pairs tp ON tp.id = w.pair_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [req.user!.id]
    );

    // Enrich with current prices from Redis
    const items = await Promise.all(
      result.rows.map(async (row) => {
        const tickerData = await redis.get(`ticker:${row.symbol}`);
        const ticker = tickerData ? JSON.parse(tickerData) : null;
        return { ...row, ticker };
      })
    );

    res.json({ watchlist: items });
  } catch (err) {
    logger.error('Get watchlist error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:symbol - add pair to watchlist
router.post('/:symbol', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check tier limit
    const tier = req.user!.tier;
    const limit = TIER_WATCHLIST_LIMITS[tier] ?? TIER_WATCHLIST_LIMITS.starter;

    if (limit !== -1) {
      const countResult = await query(
        'SELECT COUNT(*) as count FROM watchlist WHERE user_id = $1',
        [req.user!.id]
      );
      const currentCount = parseInt(countResult.rows[0].count, 10);
      if (currentCount >= limit) {
        res.status(403).json({
          error: 'Watchlist limit reached',
          limit,
          current: currentCount,
          tier,
        });
        return;
      }
    }

    // Find the trading pair
    const pairResult = await query(
      'SELECT id, symbol FROM trading_pairs WHERE symbol = $1',
      [req.params.symbol]
    );
    if (pairResult.rows.length === 0) {
      res.status(404).json({ error: 'Trading pair not found' });
      return;
    }

    const pairId = pairResult.rows[0].id;

    // Check for duplicate
    const existing = await query(
      'SELECT id FROM watchlist WHERE user_id = $1 AND pair_id = $2',
      [req.user!.id, pairId]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Pair already in watchlist' });
      return;
    }

    const result = await query(
      'INSERT INTO watchlist (user_id, pair_id) VALUES ($1, $2) RETURNING id, pair_id, created_at',
      [req.user!.id, pairId]
    );

    res.status(201).json({ item: { ...result.rows[0], symbol: req.params.symbol } });
  } catch (err) {
    logger.error('Add to watchlist error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:symbol - remove pair from watchlist
router.delete('/:symbol', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pairResult = await query(
      'SELECT id FROM trading_pairs WHERE symbol = $1',
      [req.params.symbol]
    );
    if (pairResult.rows.length === 0) {
      res.status(404).json({ error: 'Trading pair not found' });
      return;
    }

    const result = await query(
      'DELETE FROM watchlist WHERE user_id = $1 AND pair_id = $2 RETURNING id',
      [req.user!.id, pairResult.rows[0].id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Pair not in watchlist' });
      return;
    }

    res.json({ message: 'Removed from watchlist' });
  } catch (err) {
    logger.error('Remove from watchlist error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
