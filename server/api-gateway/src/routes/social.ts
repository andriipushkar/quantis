import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { validateBody, socialPostSchema } from '../validators/index.js';

const router = Router();

// --- Types ---
interface SocialPostResponse {
  id: string;
  userId: string;
  userName: string;
  type: 'trade_idea' | 'analysis' | 'comment';
  content: string;
  symbol?: string;
  direction?: 'bullish' | 'bearish' | 'neutral';
  likeCount: number;
  createdAt: string;
}

function rowToPost(r: Record<string, unknown>): SocialPostResponse {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    userName: r.user_name as string,
    type: r.type as 'trade_idea' | 'analysis' | 'comment',
    content: r.content as string,
    symbol: (r.symbol as string) || undefined,
    direction: (r.direction as 'bullish' | 'bearish' | 'neutral') || undefined,
    likeCount: parseInt(r.like_count as string, 10) || 0,
    createdAt: (r.created_at as Date).toISOString(),
  };
}

// GET /feed — List posts (paginated, newest first)
router.get('/feed', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt((_req.query.page as string) || '1', 10);
    const limit = Math.min(parseInt((_req.query.limit as string) || '20', 10), 50);
    const offset = (page - 1) * limit;

    // Use two queries: count + paginated data
    const countPromise = query(`SELECT COUNT(*) AS total FROM social_posts`);
    const dataPromise = query(
      `SELECT sp.*,
              COALESCE((SELECT COUNT(*) FROM social_likes sl WHERE sl.post_id = sp.id), 0) AS like_count
       FROM social_posts sp
       ORDER BY sp.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    Promise.all([countPromise, dataPromise])
      .then(([countResult, dataResult]) => {
        const total = parseInt(countResult.rows[0].total, 10);
        res.json({
          success: true,
          data: dataResult.rows.map(rowToPost),
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
      })
      .catch((err) => {
        logger.error('Get feed error', { error: (err as Error).message });
        res.status(500).json({ success: false, error: 'Internal server error' });
      });
  } catch (err) {
    logger.error('Get feed error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /post — Create post (auth required)
router.post('/post', authenticate, validateBody(socialPostSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, content, symbol, direction } = req.body;

    const result = await query(
      `INSERT INTO social_posts (user_id, user_name, type, content, symbol, direction)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, 0 AS like_count`,
      [
        req.user!.id,
        req.user!.email.split('@')[0],
        type,
        content.trim(),
        symbol?.toUpperCase() || null,
        direction || null,
      ]
    );

    res.json({ success: true, data: rowToPost(result.rows[0]) });
  } catch (err) {
    logger.error('Create post error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /post/:id/like — Toggle like (auth required)
router.post('/post/:id/like', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.id;

    // Check post exists
    const postCheck = await query(`SELECT id FROM social_posts WHERE id = $1`, [postId]);
    if (postCheck.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Post not found' });
      return;
    }

    // Check if already liked
    const likeCheck = await query(
      `SELECT 1 FROM social_likes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    );

    let liked: boolean;
    if (likeCheck.rows.length > 0) {
      // Unlike
      await query(`DELETE FROM social_likes WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
      liked = false;
    } else {
      // Like
      await query(
        `INSERT INTO social_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [postId, userId]
      );
      liked = true;
    }

    const countResult = await query(
      `SELECT COUNT(*) AS cnt FROM social_likes WHERE post_id = $1`,
      [postId]
    );

    res.json({
      success: true,
      data: { liked, likeCount: parseInt(countResult.rows[0].cnt, 10) },
    });
  } catch (err) {
    logger.error('Toggle like error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /trending — Top 5 most-discussed symbols
router.get('/trending', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT symbol, COUNT(*) AS mentions
       FROM social_posts
       WHERE symbol IS NOT NULL
       GROUP BY symbol
       ORDER BY mentions DESC
       LIMIT 5`
    );

    const trending = result.rows.map((r: Record<string, unknown>) => ({
      symbol: r.symbol as string,
      mentions: parseInt(r.mentions as string, 10),
    }));

    res.json({ success: true, data: trending });
  } catch (err) {
    logger.error('Get trending error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
