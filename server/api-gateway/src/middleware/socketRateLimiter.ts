import type { Server, Socket } from 'socket.io';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

// ── Tier-based limits ──────────────────────────────────────────────

interface SocketLimits {
  maxConnectionsPerIp: number;
  maxSubscriptions: number;
  maxEventsPerMinute: number;
}

const TIER_SOCKET_LIMITS: Record<string, SocketLimits> = {
  anonymous: { maxConnectionsPerIp: 3, maxSubscriptions: 10, maxEventsPerMinute: 30 },
  starter: { maxConnectionsPerIp: 5, maxSubscriptions: 20, maxEventsPerMinute: 60 },
  trader: { maxConnectionsPerIp: 10, maxSubscriptions: 100, maxEventsPerMinute: 300 },
  pro: { maxConnectionsPerIp: 20, maxSubscriptions: 500, maxEventsPerMinute: 1000 },
  institutional: { maxConnectionsPerIp: -1, maxSubscriptions: -1, maxEventsPerMinute: -1 },
};

// ── Per-socket state ───────────────────────────────────────────────

const socketSubscriptionCount = new Map<string, number>();

// ── Helpers ────────────────────────────────────────────────────────

function getClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return socket.handshake.address;
}

function getTier(socket: Socket): string {
  // Tier may be attached during auth middleware or handshake
  return (socket.data?.tier as string) || 'anonymous';
}

function getLimits(tier: string): SocketLimits {
  return TIER_SOCKET_LIMITS[tier] ?? TIER_SOCKET_LIMITS.anonymous;
}

// ── Connection limiter (per IP) ────────────────────────────────────

async function checkConnectionLimit(ip: string, limit: number): Promise<boolean> {
  if (limit === -1) return true;

  const key = `ws:conn:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 120); // 2-min sliding window cleanup

  if (count > limit) {
    await redis.decr(key);
    return false;
  }
  return true;
}

async function releaseConnection(ip: string): Promise<void> {
  const key = `ws:conn:${ip}`;
  const val = await redis.decr(key);
  if (val <= 0) await redis.del(key);
}

// ── Event throttle (per socket per minute) ─────────────────────────

async function checkEventRate(socketId: string, limit: number): Promise<boolean> {
  if (limit === -1) return true;

  const key = `ws:events:${socketId}`;
  const now = Date.now();
  const windowStart = now - 60_000;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
  pipeline.zcard(key);
  pipeline.expire(key, 70);

  const results = await pipeline.exec();
  const count = results?.[2]?.[1] as number;
  return count <= limit;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Apply rate limiting middleware to a Socket.IO server:
 * - Per-IP connection limits
 * - Per-socket subscription quotas (tier-based)
 * - Per-socket event throttling
 */
export function applySocketRateLimiting(io: Server): void {
  // ── Connection-level: limit connections per IP ──────────────────
  io.use(async (socket, next) => {
    const ip = getClientIp(socket);
    const tier = getTier(socket);
    const limits = getLimits(tier);

    try {
      const allowed = await checkConnectionLimit(ip, limits.maxConnectionsPerIp);
      if (!allowed) {
        logger.warn('WebSocket connection rejected: IP limit exceeded', { ip, tier });
        next(new Error('Too many connections from this IP'));
        return;
      }
    } catch (err) {
      // Fail open — don't block if Redis is down
      logger.error('Socket rate limiter error (connection)', { error: (err as Error).message });
    }

    next();
  });

  // ── Event-level: wrap subscription handlers ────────────────────
  io.on('connection', (socket) => {
    const ip = getClientIp(socket);
    const tier = getTier(socket);
    const limits = getLimits(tier);

    socketSubscriptionCount.set(socket.id, 0);

    // Release connection count on disconnect
    socket.on('disconnect', async () => {
      socketSubscriptionCount.delete(socket.id);
      try {
        await releaseConnection(ip);
        // Clean up event throttle key
        await redis.del(`ws:events:${socket.id}`);
      } catch {
        // best-effort cleanup
      }
    });

    // Wrap all incoming events with throttle check
    socket.use(async ([event], next) => {
      // Only throttle subscribe/unsubscribe events
      if (!event.startsWith('subscribe:') && !event.startsWith('unsubscribe:')) {
        next();
        return;
      }

      try {
        const allowed = await checkEventRate(socket.id, limits.maxEventsPerMinute);
        if (!allowed) {
          logger.warn('WebSocket event throttled', { socketId: socket.id, event, tier });
          next(new Error('Event rate limit exceeded'));
          return;
        }
      } catch (err) {
        logger.error('Socket rate limiter error (event)', { error: (err as Error).message });
      }

      next();
    });
  });
}

/**
 * Check if a socket can add more subscriptions.
 * Call this before joining rooms in subscription handlers.
 */
export function canSubscribe(socket: Socket, count: number = 1): boolean {
  const tier = getTier(socket);
  const limits = getLimits(tier);
  if (limits.maxSubscriptions === -1) return true;

  const current = socketSubscriptionCount.get(socket.id) ?? 0;
  if (current + count > limits.maxSubscriptions) {
    logger.warn('WebSocket subscription limit reached', {
      socketId: socket.id,
      tier,
      current,
      requested: count,
      max: limits.maxSubscriptions,
    });
    return false;
  }

  socketSubscriptionCount.set(socket.id, current + count);
  return true;
}

/**
 * Decrement subscription count when a socket leaves rooms.
 */
export function releaseSubscriptions(socket: Socket, count: number = 1): void {
  const current = socketSubscriptionCount.get(socket.id) ?? 0;
  socketSubscriptionCount.set(socket.id, Math.max(0, current - count));
}
