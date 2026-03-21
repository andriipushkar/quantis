import { Router, Response } from 'express';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import Redis from 'ioredis';

const router = Router();

// Admin check middleware
function requireAdmin(req: AuthenticatedRequest, res: Response, next: () => void): void {
  const adminEmails = env.ADMIN_EMAILS;
  if (!req.user || !adminEmails.includes(req.user.email.toLowerCase())) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

// All routes require auth + admin
router.use(authenticate);
router.use(requireAdmin);

// GET /dashboard — Admin overview stats
router.get('/dashboard', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [usersTotal, usersToday, signalsTotal, activePairs, candlesTotal] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM users'),
      query("SELECT COUNT(*) AS count FROM users WHERE created_at >= CURRENT_DATE"),
      query('SELECT COUNT(*) AS count FROM signals'),
      query('SELECT COUNT(*) AS count FROM trading_pairs WHERE is_active = true'),
      query('SELECT COUNT(*) AS count FROM candles'),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(usersTotal.rows[0].count, 10),
        usersToday: parseInt(usersToday.rows[0].count, 10),
        totalSignals: parseInt(signalsTotal.rows[0].count, 10),
        activePairs: parseInt(activePairs.rows[0].count, 10),
        totalCandles: parseInt(candlesTotal.rows[0].count, 10),
        revenue: 0,
      },
    });
  } catch (err) {
    logger.error('Admin dashboard error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /users — List all users
router.get('/users', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.tier, u.created_at,
              p.display_name
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ORDER BY u.created_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Admin list users error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /users/:id/tier — Change user tier
router.put('/users/:id/tier', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tier } = req.body;

    const validTiers = ['starter', 'trader', 'pro', 'institutional'];
    if (!tier || !validTiers.includes(tier)) {
      res.status(400).json({ success: false, error: 'Invalid tier. Must be one of: ' + validTiers.join(', ') });
      return;
    }

    const result = await query(
      'UPDATE users SET tier = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, tier',
      [tier, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Admin update tier error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /system — System health
router.get('/system', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // DB check
    let dbStatus = 'ok';
    try {
      await query('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    // Redis check
    let redisStatus = 'ok';
    try {
      const redis = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
      });
      await redis.ping();
      redis.disconnect();
    } catch {
      redisStatus = 'error';
    }

    // Candle counts per exchange
    let candlesByExchange: Array<{ exchange: string; count: string }> = [];
    try {
      const result = await query(
        `SELECT tp.exchange, COUNT(c.id) AS count
         FROM candles c
         JOIN trading_pairs tp ON tp.id = c.pair_id
         GROUP BY tp.exchange
         ORDER BY count DESC`
      );
      candlesByExchange = result.rows;
    } catch {
      // table may not exist
    }

    // Latest signal time
    let latestSignalTime: string | null = null;
    try {
      const result = await query('SELECT created_at FROM signals ORDER BY created_at DESC LIMIT 1');
      latestSignalTime = result.rows[0]?.created_at || null;
    } catch {
      // table may not exist
    }

    res.json({
      success: true,
      data: {
        dbStatus,
        redisStatus,
        candlesByExchange,
        latestSignalTime,
      },
    });
  } catch (err) {
    logger.error('Admin system health error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
