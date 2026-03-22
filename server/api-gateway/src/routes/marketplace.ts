import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import logger from '../config/logger.js';

const router = Router();

// --- Types ---
interface StrategyResponse {
  id: string;
  name: string;
  description: string;
  creator: string;
  type: string;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  followers: number;
  rating: number;
  ratingCount: number;
  price: number | 'free';
  timeframe: string;
  pairs: string[];
  createdAt: string;
}

function rowToStrategy(r: Record<string, unknown>, avgRating: number, ratingCount: number): StrategyResponse {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    creator: r.author_name as string,
    type: r.type as string,
    winRate: parseFloat(r.win_rate as string),
    totalReturn: parseFloat(r.total_return as string),
    maxDrawdown: parseFloat(r.max_drawdown as string),
    sharpeRatio: parseFloat(r.sharpe_ratio as string),
    followers: parseInt(r.followers_count as string, 10),
    rating: avgRating,
    ratingCount,
    price: r.price != null ? parseFloat(r.price as string) : 'free',
    timeframe: r.timeframe as string,
    pairs: r.pairs as string[],
    createdAt: (r.created_at as Date).toISOString(),
  };
}

// --- Routes ---

// GET / — List all strategies
router.get('/', async (req: Request, res: Response) => {
  try {
    const { sort = 'rating', type } = req.query;

    let sql = `
      SELECT ms.*,
             COALESCE(AVG(mr.rating), 0) AS avg_rating,
             COUNT(mr.rating) AS rating_count
      FROM marketplace_strategies ms
      LEFT JOIN marketplace_ratings mr ON mr.strategy_id = ms.id
    `;
    const params: unknown[] = [];

    if (type && type !== 'all') {
      params.push(type);
      sql += ` WHERE ms.type = $${params.length}`;
    }

    sql += ` GROUP BY ms.id`;

    if (sort === 'return') {
      sql += ` ORDER BY ms.total_return DESC`;
    } else if (sort === 'followers') {
      sql += ` ORDER BY ms.followers_count DESC`;
    } else {
      sql += ` ORDER BY avg_rating DESC`;
    }

    const result = await query(sql, params);

    const list = result.rows.map((r: Record<string, unknown>) =>
      rowToStrategy(
        r,
        Math.round(parseFloat(r.avg_rating as string) * 10) / 10,
        parseInt(r.rating_count as string, 10)
      )
    );

    res.json({ success: true, data: list });
  } catch (err) {
    logger.error('Marketplace list error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to fetch strategies' });
  }
});

// GET /:id — Strategy detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT ms.*,
              COALESCE(AVG(mr.rating), 0) AS avg_rating,
              COUNT(mr.rating) AS rating_count
       FROM marketplace_strategies ms
       LEFT JOIN marketplace_ratings mr ON mr.strategy_id = ms.id
       WHERE ms.id = $1
       GROUP BY ms.id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Strategy not found' });
      return;
    }

    const r = result.rows[0];
    res.json({
      success: true,
      data: rowToStrategy(
        r,
        Math.round(parseFloat(r.avg_rating as string) * 10) / 10,
        parseInt(r.rating_count as string, 10)
      ),
    });
  } catch (err) {
    logger.error('Marketplace detail error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to fetch strategy' });
  }
});

// POST /:id/follow — Follow/unfollow strategy
router.post('/:id/follow', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verify strategy exists
    const stratCheck = await query(`SELECT id, followers_count FROM marketplace_strategies WHERE id = $1`, [req.params.id]);
    if (stratCheck.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Strategy not found' });
      return;
    }

    const userId = req.user!.id;
    const strategyId = req.params.id;

    // Check if already following
    const existing = await query(
      `SELECT 1 FROM marketplace_followers WHERE strategy_id = $1 AND user_id = $2`,
      [strategyId, userId]
    );

    if (existing.rows.length > 0) {
      // Unfollow
      await query(`DELETE FROM marketplace_followers WHERE strategy_id = $1 AND user_id = $2`, [strategyId, userId]);
      await query(`UPDATE marketplace_strategies SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = $1`, [strategyId]);
      const updated = await query(`SELECT followers_count FROM marketplace_strategies WHERE id = $1`, [strategyId]);
      res.json({ success: true, data: { followed: false, followers: parseInt(updated.rows[0].followers_count, 10) } });
    } else {
      // Follow
      await query(
        `INSERT INTO marketplace_followers (strategy_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [strategyId, userId]
      );
      await query(`UPDATE marketplace_strategies SET followers_count = followers_count + 1 WHERE id = $1`, [strategyId]);
      const updated = await query(`SELECT followers_count FROM marketplace_strategies WHERE id = $1`, [strategyId]);
      res.json({ success: true, data: { followed: true, followers: parseInt(updated.rows[0].followers_count, 10) } });
    }
  } catch (err) {
    logger.error('Marketplace follow error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to follow strategy' });
  }
});

// POST /:id/rate — Rate strategy 1-5
router.post('/:id/rate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verify strategy exists
    const stratCheck = await query(`SELECT id FROM marketplace_strategies WHERE id = $1`, [req.params.id]);
    if (stratCheck.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Strategy not found' });
      return;
    }

    const { rating } = req.body;
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
      return;
    }

    await query(
      `INSERT INTO marketplace_ratings (strategy_id, user_id, rating) VALUES ($1, $2, $3)
       ON CONFLICT (strategy_id, user_id) DO UPDATE SET rating = $3`,
      [req.params.id, req.user!.id, Math.round(rating)]
    );

    const ratingResult = await query(
      `SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS cnt
       FROM marketplace_ratings WHERE strategy_id = $1`,
      [req.params.id]
    );

    const avgRating = Math.round(parseFloat(ratingResult.rows[0].avg_rating) * 10) / 10;
    const ratingCount = parseInt(ratingResult.rows[0].cnt, 10);

    res.json({
      success: true,
      data: { rating: avgRating, ratingCount },
    });
  } catch (err) {
    logger.error('Marketplace rate error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to rate strategy' });
  }
});

// POST /publish — Publish own strategy
router.post('/publish', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, type, timeframe, pairs } = req.body;

    if (!name || !description || !type || !timeframe || !pairs || !Array.isArray(pairs)) {
      res.status(400).json({ success: false, error: 'Missing required fields: name, description, type, timeframe, pairs' });
      return;
    }

    const validTypes = ['trend', 'mean_reversion', 'breakout', 'scalp'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const result = await query(
      `INSERT INTO marketplace_strategies (author_id, author_name, name, description, type, timeframe, pairs)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user!.id, req.user!.email.split('@')[0], name, description, type, timeframe, pairs]
    );

    const r = result.rows[0];
    res.status(201).json({ success: true, data: rowToStrategy(r, 0, 0) });
  } catch (err) {
    logger.error('Marketplace publish error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to publish strategy' });
  }
});

export default router;
