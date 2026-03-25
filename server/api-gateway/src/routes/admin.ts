import { Router, Response } from 'express';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import Redis from 'ioredis';
import crypto from 'crypto';

const router = Router();

// ---------------------------------------------------------------------------
// Shared Redis helper — creates a short-lived connection
// ---------------------------------------------------------------------------
function createRedis(): Redis {
  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
  });
}

// ---------------------------------------------------------------------------
// Admin check middleware
// ---------------------------------------------------------------------------
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

// ===========================================================================
// 1. GET /dashboard — Admin overview stats (with real revenue)
// ===========================================================================
router.get('/dashboard', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      usersTotal,
      usersToday,
      signalsTotal,
      activePairs,
      candlesTotal,
      revenueToday,
      revenueWeek,
      revenueMonth,
      totalRevenue,
      mrr,
    ] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM users'),
      query("SELECT COUNT(*) AS count FROM users WHERE created_at >= CURRENT_DATE"),
      query('SELECT COUNT(*) AS count FROM signals').catch(() => ({ rows: [{ count: '0' }] })),
      query('SELECT COUNT(*) AS count FROM trading_pairs WHERE is_active = true').catch(() => ({ rows: [{ count: '0' }] })),
      query('SELECT COUNT(*) AS count FROM candles').catch(() => ({ rows: [{ count: '0' }] })),
      // Revenue today
      query(
        `SELECT COALESCE(SUM(amount_usd), 0) AS total
         FROM payments WHERE status = 'confirmed' AND created_at >= CURRENT_DATE`
      ).catch(() => ({ rows: [{ total: '0' }] })),
      // Revenue this week
      query(
        `SELECT COALESCE(SUM(amount_usd), 0) AS total
         FROM payments WHERE status = 'confirmed' AND created_at >= date_trunc('week', NOW())`
      ).catch(() => ({ rows: [{ total: '0' }] })),
      // Revenue this month
      query(
        `SELECT COALESCE(SUM(amount_usd), 0) AS total
         FROM payments WHERE status = 'confirmed' AND created_at >= date_trunc('month', NOW())`
      ).catch(() => ({ rows: [{ total: '0' }] })),
      // Total revenue all time
      query(
        `SELECT COALESCE(SUM(amount_usd), 0) AS total
         FROM payments WHERE status = 'confirmed'`
      ).catch(() => ({ rows: [{ total: '0' }] })),
      // MRR — confirmed payments in last 30 days
      query(
        `SELECT COALESCE(SUM(amount_usd), 0) AS total
         FROM payments WHERE status = 'confirmed' AND created_at >= NOW() - INTERVAL '30 days'`
      ).catch(() => ({ rows: [{ total: '0' }] })),
    ]);

    const mrrValue = parseFloat(mrr.rows[0].total);
    const arrValue = mrrValue * 12;

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(usersTotal.rows[0].count, 10),
        usersToday: parseInt(usersToday.rows[0].count, 10),
        totalSignals: parseInt(signalsTotal.rows[0].count, 10),
        activePairs: parseInt(activePairs.rows[0].count, 10),
        totalCandles: parseInt(candlesTotal.rows[0].count, 10),
        revenue: {
          today: parseFloat(revenueToday.rows[0].total),
          week: parseFloat(revenueWeek.rows[0].total),
          month: parseFloat(revenueMonth.rows[0].total),
          total: parseFloat(totalRevenue.rows[0].total),
          mrr: mrrValue,
          arr: arrValue,
        },
      },
    });
  } catch (err) {
    logger.error('Admin dashboard error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================================================
// 2. GET /users — List users with search, filter, pagination
// ===========================================================================
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = (req.query.search as string) || '';
    const tier = req.query.tier as string | undefined;
    const sort = (req.query.sort as string) || 'created_at';
    const order = ((req.query.order as string) || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    // Whitelist sortable columns to prevent SQL injection
    const allowedSorts: Record<string, string> = {
      created_at: 'u.created_at',
      email: 'u.email',
      tier: 'u.tier',
      display_name: 'p.display_name',
    };
    const sortColumn = allowedSorts[sort] || 'u.created_at';

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`(u.email ILIKE $${paramIdx} OR p.display_name ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (tier && ['starter', 'trader', 'pro', 'institutional'].includes(tier)) {
      conditions.push(`u.tier = $${paramIdx}`);
      params.push(tier);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    // Fetch page
    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT u.id, u.email, u.tier, u.is_2fa_enabled, u.created_at, u.updated_at,
              p.display_name, p.experience_level, p.balance_usdt
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      dataParams
    );

    res.json({
      success: true,
      data: {
        users: result.rows,
        total,
        page,
        totalPages,
      },
    });
  } catch (err) {
    logger.error('Admin list users error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================================================
// 3. PUT /users/:id/tier — Change user tier
// ===========================================================================
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

// ===========================================================================
// 4. GET /system — System health
// ===========================================================================
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
      const redis = createRedis();
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

// ===========================================================================
// 5. GET /users/:id — User detail view
// ===========================================================================
router.get('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // User + profile
    const userResult = await query(
      `SELECT u.id, u.email, u.tier, u.language, u.is_2fa_enabled, u.created_at, u.updated_at,
              p.display_name, p.timezone, p.experience_level, p.ui_mode, p.balance_usdt, p.referral_code
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];

    // Check ban status in Redis
    let isBanned = false;
    try {
      const redis = createRedis();
      isBanned = await redis.sismember('banned_emails', user.email) === 1;
      redis.disconnect();
    } catch {
      // Redis unavailable — assume not banned
    }

    // Subscription history
    let subscriptions: unknown[] = [];
    try {
      const subResult = await query(
        `SELECT id, tier, starts_at, expires_at, status, auto_renew, created_at
         FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC`,
        [id]
      );
      subscriptions = subResult.rows;
    } catch {
      // table may not exist
    }

    // Payments
    let payments: unknown[] = [];
    try {
      const payResult = await query(
        `SELECT id, amount_usd, crypto_currency, crypto_amount, tx_hash, status, created_at
         FROM payments WHERE user_id = $1 ORDER BY created_at DESC`,
        [id]
      );
      payments = payResult.rows;
    } catch {
      // table may not exist
    }

    // Alerts count
    let alertsCount = 0;
    try {
      const alertResult = await query(
        'SELECT COUNT(*) AS count FROM alerts WHERE user_id = $1',
        [id]
      );
      alertsCount = parseInt(alertResult.rows[0].count, 10);
    } catch {
      // table may not exist
    }

    // Paper trading summary
    let paperAccount: unknown = null;
    let paperTradesCount = 0;
    try {
      const paResult = await query(
        'SELECT balance, equity, realized_pnl FROM paper_accounts WHERE user_id = $1',
        [id]
      );
      paperAccount = paResult.rows[0] || null;

      const ptResult = await query(
        'SELECT COUNT(*) AS total_trades FROM paper_trades WHERE user_id = $1',
        [id]
      );
      paperTradesCount = parseInt(ptResult.rows[0].total_trades, 10);
    } catch {
      // table may not exist
    }

    res.json({
      success: true,
      data: {
        user: { ...user, isBanned },
        subscriptions,
        payments,
        alertsCount,
        paperTrading: {
          account: paperAccount,
          totalTrades: paperTradesCount,
        },
      },
    });
  } catch (err) {
    logger.error('Admin user detail error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================================================
// 6. PUT /users/:id/ban — Ban or unban a user
// ===========================================================================
router.put('/users/:id/ban', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!action || !['ban', 'unban'].includes(action)) {
      res.status(400).json({ success: false, error: "Invalid action. Must be 'ban' or 'unban'" });
      return;
    }

    // Look up user email
    const userResult = await query('SELECT id, email, tier FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];
    const redis = createRedis();

    try {
      if (action === 'ban') {
        // Downgrade to starter and add to banned set
        await query(
          'UPDATE users SET tier = $1, updated_at = NOW() WHERE id = $2',
          ['starter', id]
        );
        await redis.sadd('banned_emails', user.email);
        logger.info('Admin banned user', { userId: id, email: user.email, admin: req.user?.email });
      } else {
        // Remove from banned set
        await redis.srem('banned_emails', user.email);
        logger.info('Admin unbanned user', { userId: id, email: user.email, admin: req.user?.email });
      }
    } finally {
      redis.disconnect();
    }

    res.json({
      success: true,
      data: {
        userId: id,
        email: user.email,
        action,
        tier: action === 'ban' ? 'starter' : user.tier,
      },
    });
  } catch (err) {
    logger.error('Admin ban user error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================================================
// 7. DELETE /users/:id — Soft delete user
// ===========================================================================
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify user exists
    const userResult = await query('SELECT id, email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const deletedEmail = `deleted_${crypto.randomUUID()}@quantis.io`;
    const randomPassword = crypto.randomBytes(32).toString('hex');

    await query(
      `UPDATE users
       SET email = $1,
           password_hash = $2,
           tier = 'starter',
           updated_at = NOW()
       WHERE id = $3`,
      [deletedEmail, randomPassword, id]
    );

    logger.info('Admin soft-deleted user', {
      userId: id,
      originalEmail: userResult.rows[0].email,
      admin: req.user?.email,
    });

    res.json({
      success: true,
      data: { userId: id, message: 'User has been soft-deleted' },
    });
  } catch (err) {
    logger.error('Admin delete user error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================================================
// 8. GET /revenue — Revenue details with daily breakdown and growth
// ===========================================================================
router.get('/revenue', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [mrrResult, prevMrrResult, dailyResult, totalResult] = await Promise.all([
      // MRR — last 30 days
      query(
        `SELECT COALESCE(SUM(amount_usd), 0) AS total
         FROM payments WHERE status = 'confirmed' AND created_at >= NOW() - INTERVAL '30 days'`
      ),
      // Previous period MRR (30-60 days ago) for growth calculation
      query(
        `SELECT COALESCE(SUM(amount_usd), 0) AS total
         FROM payments WHERE status = 'confirmed'
           AND created_at >= NOW() - INTERVAL '60 days'
           AND created_at < NOW() - INTERVAL '30 days'`
      ),
      // Daily breakdown (last 30 days)
      query(
        `SELECT date_trunc('day', created_at) AS day, SUM(amount_usd) AS total
         FROM payments WHERE status = 'confirmed' AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY day ORDER BY day`
      ),
      // All-time total
      query(
        `SELECT COALESCE(SUM(amount_usd), 0) AS total
         FROM payments WHERE status = 'confirmed'`
      ),
    ]);

    const mrrValue = parseFloat(mrrResult.rows[0].total);
    const prevMrrValue = parseFloat(prevMrrResult.rows[0].total);
    const growthPct = prevMrrValue > 0
      ? ((mrrValue - prevMrrValue) / prevMrrValue) * 100
      : mrrValue > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        mrr: mrrValue,
        arr: mrrValue * 12,
        totalRevenue: parseFloat(totalResult.rows[0].total),
        growthPct: Math.round(growthPct * 100) / 100,
        daily: dailyResult.rows.map((row) => ({
          day: row.day,
          total: parseFloat(row.total),
        })),
      },
    });
  } catch (err) {
    logger.error('Admin revenue error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================================================
// 9. GET /revenue/payments — Payments list with filters
// ===========================================================================
router.get('/revenue/payments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status && ['pending', 'confirmed', 'failed', 'refunded'].includes(status)) {
      conditions.push(`p.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM payments p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    // Fetch page
    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT p.id, p.user_id, p.subscription_id, p.amount_usd, p.crypto_currency,
              p.crypto_amount, p.tx_hash, p.gateway_payment_id, p.status, p.created_at,
              u.email
       FROM payments p
       JOIN users u ON u.id = p.user_id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      dataParams
    );

    res.json({
      success: true,
      data: {
        payments: result.rows,
        total,
        page,
        totalPages,
      },
    });
  } catch (err) {
    logger.error('Admin payments list error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================================================
// 10. GET /revenue/subscriptions — Subscriptions overview
// ===========================================================================
router.get('/revenue/subscriptions', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [statusCounts, expiringSoon, churnData] = await Promise.all([
      // Active, expired, cancelled counts
      query('SELECT status, COUNT(*) AS count FROM subscriptions GROUP BY status'),
      // Expiring in the next 7 days
      query(
        `SELECT s.id, s.user_id, s.tier, s.starts_at, s.expires_at, s.auto_renew, u.email
         FROM subscriptions s
         JOIN users u ON u.id = s.user_id
         WHERE s.status = 'active' AND s.expires_at <= NOW() + INTERVAL '7 days'
         ORDER BY s.expires_at ASC`
      ),
      // Churn rate: cancelled in last 30d vs active at start of period
      Promise.all([
        query(
          `SELECT COUNT(*) AS cancelled
           FROM subscriptions
           WHERE status = 'cancelled' AND created_at >= NOW() - INTERVAL '30 days'`
        ),
        query(
          `SELECT COUNT(*) AS active_start
           FROM subscriptions
           WHERE status = 'active' AND created_at < NOW() - INTERVAL '30 days'`
        ),
      ]),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of statusCounts.rows) {
      statusMap[row.status] = parseInt(row.count, 10);
    }

    const cancelled = parseInt(churnData[0].rows[0].cancelled, 10);
    const activeAtStart = parseInt(churnData[1].rows[0].active_start, 10);
    const churnRate = activeAtStart > 0
      ? Math.round((cancelled / activeAtStart) * 10000) / 100
      : 0;

    res.json({
      success: true,
      data: {
        statusCounts: statusMap,
        expiringSoon: expiringSoon.rows,
        churnRate,
      },
    });
  } catch (err) {
    logger.error('Admin subscriptions overview error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================================================
// 11. GET /analytics/user-growth — Registration data for charts (90 days)
// ===========================================================================
router.get('/analytics/user-growth', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT date_trunc('day', created_at) AS day, COUNT(*) AS registrations
       FROM users
       WHERE created_at >= NOW() - INTERVAL '90 days'
       GROUP BY day
       ORDER BY day`
    );

    // Also provide cumulative total
    const totalResult = await query('SELECT COUNT(*) AS total FROM users');
    const total = parseInt(totalResult.rows[0].total, 10);

    res.json({
      success: true,
      data: {
        daily: result.rows.map((row) => ({
          day: row.day,
          registrations: parseInt(row.registrations, 10),
        })),
        totalUsers: total,
      },
    });
  } catch (err) {
    logger.error('Admin user growth error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================================================
// 12. GET /analytics/tier-distribution — Tier breakdown
// ===========================================================================
router.get('/analytics/tier-distribution', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT tier, COUNT(*) AS count FROM users GROUP BY tier ORDER BY count DESC'
    );

    const distribution = result.rows.map((row) => ({
      tier: row.tier,
      count: parseInt(row.count, 10),
    }));

    const total = distribution.reduce((sum, d) => sum + d.count, 0);

    res.json({
      success: true,
      data: {
        distribution,
        total,
      },
    });
  } catch (err) {
    logger.error('Admin tier distribution error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================================================
// 13. GET /analytics/collector-status — Data collector monitoring
// ===========================================================================
router.get('/analytics/collector-status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const redis = createRedis();
    const exchanges: Array<{
      exchange: string;
      lastUpdate: string | null;
      lagMs: number | null;
      pairs: number;
    }> = [];

    try {
      // Read ticker snapshots from Redis
      const snapshotData = await redis.hgetall('ticker:snapshot');
      const now = Date.now();

      // Group by exchange
      const exchangeMap = new Map<string, { lastUpdate: number; pairs: number }>();

      for (const [key, value] of Object.entries(snapshotData)) {
        try {
          const parsed = JSON.parse(value);
          // Keys typically formatted as "exchange:SYMBOL" or contain exchange info
          const exchange = parsed.exchange || key.split(':')[0] || 'unknown';
          const timestamp = parsed.timestamp || parsed.updatedAt || 0;
          const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;

          const existing = exchangeMap.get(exchange);
          if (!existing || ts > existing.lastUpdate) {
            exchangeMap.set(exchange, {
              lastUpdate: ts,
              pairs: (existing?.pairs || 0) + 1,
            });
          } else {
            existing.pairs += 1;
          }
        } catch {
          // Skip unparseable entries
        }
      }

      for (const [exchange, data] of exchangeMap.entries()) {
        exchanges.push({
          exchange,
          lastUpdate: data.lastUpdate > 0 ? new Date(data.lastUpdate).toISOString() : null,
          lagMs: data.lastUpdate > 0 ? now - data.lastUpdate : null,
          pairs: data.pairs,
        });
      }
    } finally {
      redis.disconnect();
    }

    // Also get DB-level exchange stats
    let dbExchangeStats: Array<{ exchange: string; active_pairs: string }> = [];
    try {
      const dbResult = await query(
        `SELECT exchange, COUNT(*) AS active_pairs
         FROM trading_pairs WHERE is_active = true
         GROUP BY exchange ORDER BY exchange`
      );
      dbExchangeStats = dbResult.rows;
    } catch {
      // table may not exist
    }

    res.json({
      success: true,
      data: {
        collectors: exchanges,
        dbExchangeStats: dbExchangeStats.map((row) => ({
          exchange: row.exchange,
          activePairs: parseInt(row.active_pairs, 10),
        })),
      },
    });
  } catch (err) {
    logger.error('Admin collector status error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
