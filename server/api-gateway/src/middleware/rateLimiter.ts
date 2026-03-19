import { Response, NextFunction } from 'express';
import redis from '../config/redis.js';
import logger from '../config/logger.js';
import { AuthenticatedRequest } from './auth.js';

const TIER_LIMITS: Record<string, number> = {
  anonymous: 30,
  starter: 60,
  trader: 300,
  pro: 1000,
  institutional: -1, // unlimited
};

const WINDOW_SECONDS = 60;

export async function rateLimiter(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tier = req.user?.tier || 'anonymous';
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.anonymous;

    // Unlimited for institutional tier
    if (limit === -1) {
      next();
      return;
    }

    const identifier = req.user?.id || req.ip || 'unknown';
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;

    const pipeline = redis.pipeline();
    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    // Add current request
    pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
    // Count requests in window
    pipeline.zcard(key);
    // Set expiry on the key
    pipeline.expire(key, WINDOW_SECONDS);

    const results = await pipeline.exec();
    if (!results) {
      next();
      return;
    }

    const requestCount = results[2]?.[1] as number;

    if (requestCount > limit) {
      const oldestInWindow = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const retryAfter = oldestInWindow.length >= 2
        ? Math.ceil((parseInt(oldestInWindow[1], 10) + WINDOW_SECONDS * 1000 - now) / 1000)
        : WINDOW_SECONDS;

      res.set('Retry-After', String(Math.max(retryAfter, 1)));
      res.status(429).json({
        error: 'Too many requests',
        limit,
        window: `${WINDOW_SECONDS}s`,
        retryAfter: Math.max(retryAfter, 1),
      });
      return;
    }

    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(Math.max(limit - requestCount, 0)));

    next();
  } catch (err) {
    logger.error('Rate limiter error', { error: (err as Error).message });
    // Fail open - don't block requests if rate limiter has issues
    next();
  }
}
