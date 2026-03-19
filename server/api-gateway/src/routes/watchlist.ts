import { Router, Response } from 'express';
import { query } from '../config/database.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// GET / — user's watchlist with live prices
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT tp.id, tp.symbol, tp.base_asset, tp.quote_asset, e.name as exchange, w.added_at
       FROM watchlists w
       JOIN trading_pairs tp ON tp.id = w.pair_id
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE w.user_id = $1
       ORDER BY w.added_at DESC`,
      [req.user!.id]
    );

    const items = await Promise.all(
      result.rows.map(async (row) => {
        const exchanges = ['binance', 'bybit', 'okx'];
        let ticker = null;
        for (const ex of exchanges) {
          const data = await redis.get(`ticker:${ex}:${row.symbol}`);
          if (data) { ticker = JSON.parse(data); break; }
        }
        return { ...row, ticker };
      })
    );

    res.json({ success: true, data: items });
  } catch (err) {
    logger.error('Get watchlist error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /:symbol — add to watchlist
router.post('/:symbol', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const pairResult = await query('SELECT id FROM trading_pairs WHERE symbol = $1 LIMIT 1', [symbol]);
    if (pairResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Trading pair not found' });
      return;
    }

    await query(
      'INSERT INTO watchlists (user_id, pair_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user!.id, pairResult.rows[0].id]
    );

    res.status(201).json({ success: true, message: 'Added to watchlist' });
  } catch (err) {
    logger.error('Add to watchlist error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /:symbol — remove from watchlist
router.delete('/:symbol', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const pairResult = await query('SELECT id FROM trading_pairs WHERE symbol = $1 LIMIT 1', [symbol]);
    if (pairResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Trading pair not found' });
      return;
    }

    const result = await query(
      'DELETE FROM watchlists WHERE user_id = $1 AND pair_id = $2',
      [req.user!.id, pairResult.rows[0].id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Not in watchlist' });
      return;
    }

    res.json({ success: true, message: 'Removed from watchlist' });
  } catch (err) {
    logger.error('Remove from watchlist error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
