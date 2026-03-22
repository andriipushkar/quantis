import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import logger from '../../config/logger.js';

const router = Router();

// GET /pairs
router.get('/pairs', async (req: Request, res: Response) => {
  try {
    const { exchange, quote, active } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (exchange) {
      conditions.push(`e.name = $${paramIndex++}`);
      params.push(exchange);
    }
    if (quote) {
      conditions.push(`tp.quote_asset = $${paramIndex++}`);
      params.push(quote);
    }
    if (active !== undefined) {
      conditions.push(`tp.is_active = $${paramIndex++}`);
      params.push(active === 'true');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT tp.id, tp.symbol, tp.base_asset, tp.quote_asset, e.name as exchange, tp.is_active
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       ${where}
       ORDER BY tp.symbol ASC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Get pairs error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /pairs/:symbol
router.get('/pairs/:symbol', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT tp.id, tp.symbol, tp.base_asset, tp.quote_asset, e.name as exchange, tp.is_active
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.symbol = $1`,
      [req.params.symbol.toUpperCase()]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Trading pair not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Get pair error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
