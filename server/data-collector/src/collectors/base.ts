import { Pool } from 'pg';
import Redis from 'ioredis';
import logger from '../config/logger.js';

export abstract class BaseCollector {
  protected db: Pool;
  protected redis: Redis;
  protected logger = logger;
  protected reconnectAttempts = 0;
  protected maxReconnectDelay = 60_000;
  protected isRunning = false;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  /**
   * Insert OHLCV candle data into the specified table.
   * Uses ON CONFLICT to upsert - updates if a row with the same
   * (time, pair_id, exchange_id) already exists.
   * Also publishes ohlcv:update via Redis for real-time WebSocket delivery.
   */
  protected async storeOHLCV(
    table: string,
    data: {
      time: Date;
      pairId: number;
      exchangeId: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      trades: number;
    },
    meta?: { symbol: string; timeframe: string }
  ): Promise<void> {
    const sql = `
      INSERT INTO ${table} (time, pair_id, exchange_id, open, high, low, close, volume, trades)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (time, pair_id, exchange_id) DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume,
        trades = EXCLUDED.trades
    `;

    try {
      await this.db.query(sql, [
        data.time,
        data.pairId,
        data.exchangeId,
        data.open,
        data.high,
        data.low,
        data.close,
        data.volume,
        data.trades,
      ]);

      // Publish real-time OHLCV update for WebSocket clients
      if (meta?.symbol && meta?.timeframe) {
        const payload = JSON.stringify({
          symbol: meta.symbol,
          timeframe: meta.timeframe,
          time: Math.floor(data.time.getTime() / 1000),
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: data.volume,
        });
        await this.redis.publish('ohlcv:update', payload).catch(() => {});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to store OHLCV data in ${table}`, { error: message });
      throw error;
    }
  }

  /**
   * Publish a ticker update via Redis pub/sub and cache the latest value.
   */
  protected async publishTicker(
    symbol: string,
    data: {
      exchange: string;
      price: number;
      change24h: number;
      volume: number;
    }
  ): Promise<void> {
    const payload = JSON.stringify({ symbol, ...data, timestamp: Date.now() });

    try {
      await Promise.all([
        this.redis.publish('ticker:update', payload),
        // Individual key (legacy, 10s TTL)
        this.redis.set(
          `ticker:${data.exchange}:${symbol}`,
          payload,
          'EX',
          10
        ),
        // Snapshot hash (O(1) lookup, no redis.keys() needed)
        this.redis.hset('ticker:snapshot', `${data.exchange}:${symbol}`, payload),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to publish ticker update', { symbol, error: message });
    }
  }

  /**
   * Calculate reconnection delay with exponential backoff.
   * Starts at 1s, doubles each attempt, capped at maxReconnectDelay.
   */
  protected getReconnectDelay(): number {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;
    return delay;
  }

  /**
   * Reset reconnection counter (call after successful connection).
   */
  protected resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }
}
