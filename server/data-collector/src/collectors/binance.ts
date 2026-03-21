import WebSocket from 'ws';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { BaseCollector } from './base.js';
import { normalizeBinanceKline, type BinanceRawKline } from '../normalizers/index.js';
import { CircuitBreaker, CircuitState } from '@quantis/shared';

const DEFAULT_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
];

const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream';
const BINANCE_REST_BASE = 'https://api.binance.com/api/v3';
const BACKFILL_LIMIT = 1000;
const BACKFILL_THRESHOLD = 500;
const PAIR_DELAY_MS = 200;

const AGGREGATE_TIMEFRAMES = [
  { table: 'ohlcv_5m', bucket: '5 minutes' },
  { table: 'ohlcv_15m', bucket: '15 minutes' },
  { table: 'ohlcv_1h', bucket: '1 hour' },
  { table: 'ohlcv_4h', bucket: '4 hours' },
  { table: 'ohlcv_1d', bucket: '1 day' },
] as const;

interface BinanceCombinedMessage {
  stream: string;
  data: {
    e: string;   // Event type
    E: number;   // Event time
    s: string;   // Symbol
    k: BinanceRawKline;
  };
}

interface TradingPair {
  id: number;
  symbol: string;
  exchange_id: number;
}

export class BinanceCollector extends BaseCollector {
  private ws: WebSocket | null = null;
  private pairs: Map<string, TradingPair> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private aggregateInterval: ReturnType<typeof setInterval> | null = null;
  private restBreaker: CircuitBreaker;

  constructor(db: Pool, redis: Redis) {
    super(db, redis);
    this.restBreaker = new CircuitBreaker('binance-rest', {
      failureThreshold: 5,
      resetTimeout: 30_000,
      onStateChange: (name, from, to) => {
        this.logger.warn(`Circuit breaker "${name}" transitioned ${from} → ${to}`);
      },
    });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Starting Binance collector');

    await this.loadTradingPairs();

    if (this.pairs.size === 0) {
      this.logger.warn('No active trading pairs found, seeding defaults');
      await this.seedDefaultPairs();
      await this.loadTradingPairs();
    }

    if (this.pairs.size === 0) {
      this.logger.error('Failed to load trading pairs after seeding');
      return;
    }

    await this.backfill();
    this.connect();

    // Run timeframe aggregation every 5 minutes
    this.aggregateInterval = setInterval(() => {
      this.aggregateTimeframes().catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error('Scheduled aggregation failed', { error: message });
      });
    }, 5 * 60 * 1000);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info('Stopping Binance collector');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.aggregateInterval) {
      clearInterval(this.aggregateInterval);
      this.aggregateInterval = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Collector shutting down');
      }
      this.ws = null;
    }

    this.logger.info('Binance collector stopped');
  }

  private async loadTradingPairs(): Promise<void> {
    try {
      const result = await this.db.query(
        `SELECT tp.id, tp.symbol, tp.exchange_id
         FROM trading_pairs tp
         JOIN exchanges e ON e.id = tp.exchange_id
         WHERE e.name = 'binance' AND tp.is_active = true`
      );

      this.pairs.clear();
      for (const row of result.rows) {
        this.pairs.set(row.symbol.toUpperCase(), {
          id: row.id,
          symbol: row.symbol,
          exchange_id: row.exchange_id,
        });
      }

      this.logger.info(`Loaded ${this.pairs.size} Binance trading pairs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load trading pairs', { error: message });
    }
  }

  private async seedDefaultPairs(): Promise<void> {
    try {
      // Get the binance exchange id (already seeded by migration)
      const exchangeResult = await this.db.query(
        `SELECT id FROM exchanges WHERE name = 'binance'`
      );
      if (exchangeResult.rows.length === 0) {
        this.logger.error('Binance exchange not found in database');
        return;
      }
      const exchangeId = exchangeResult.rows[0].id;

      // Insert default trading pairs
      for (const symbol of DEFAULT_PAIRS) {
        const baseAsset = symbol.replace('USDT', '');
        await this.db.query(
          `INSERT INTO trading_pairs (symbol, base_asset, quote_asset, exchange_id, is_active)
           VALUES ($1, $2, 'USDT', $3, true)
           ON CONFLICT (symbol, exchange_id) DO NOTHING`,
          [symbol, baseAsset, exchangeId]
        );
      }

      this.logger.info(`Seeded ${DEFAULT_PAIRS.length} default Binance trading pairs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to seed default trading pairs', { error: message });
    }
  }

  private connect(): void {
    if (!this.isRunning) return;

    const streams = Array.from(this.pairs.keys())
      .map((s) => `${s.toLowerCase()}@kline_1m`)
      .join('/');

    const url = `${BINANCE_WS_BASE}?streams=${streams}`;
    this.logger.info(`Connecting to Binance WebSocket`, { streams: this.pairs.size });

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.logger.info('Binance WebSocket connected');
      this.resetReconnectAttempts();
      this.startPing();
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const message = JSON.parse(raw.toString()) as BinanceCombinedMessage;
        if (message.data?.e === 'kline') {
          this.handleKline(message.data);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to parse WebSocket message', { error: msg });
      }
    });

    this.ws.on('error', (error: Error) => {
      this.logger.error('Binance WebSocket error', { error: error.message });
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.logger.warn('Binance WebSocket closed', {
        code,
        reason: reason.toString(),
      });
      this.stopPing();
      this.reconnect();
    });

    this.ws.on('pong', () => {
      this.logger.debug('Received pong from Binance');
    });
  }

  private async handleKline(data: BinanceCombinedMessage['data']): Promise<void> {
    const kline = data.k;
    const symbol = data.s.toUpperCase();
    const pair = this.pairs.get(symbol);

    if (!pair) {
      this.logger.debug(`Received kline for unknown pair: ${symbol}`);
      return;
    }

    const normalized = normalizeBinanceKline(kline);

    // Always publish real-time ticker updates regardless of candle close status
    try {
      const change24h = await this.calculate24hChange(symbol, normalized.close);

      await this.publishTicker(symbol, {
        exchange: 'binance',
        price: normalized.close,
        change24h,
        volume: normalized.volume,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to publish ticker', { symbol, error: message });
    }

    // Only store closed candles to the database
    if (!kline.x) return;

    try {
      await this.storeOHLCV('ohlcv_1m', {
        time: normalized.time,
        pairId: pair.id,
        exchangeId: pair.exchange_id,
        open: normalized.open,
        high: normalized.high,
        low: normalized.low,
        close: normalized.close,
        volume: normalized.volume,
        trades: normalized.trades,
      });

      this.logger.debug('Stored closed candle', {
        symbol,
        time: normalized.time.toISOString(),
        close: normalized.close,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to store kline', { symbol, error: message });
    }
  }

  private async calculate24hChange(symbol: string, currentPrice: number): Promise<number> {
    try {
      const cached = await this.redis.get(`ticker:binance:${symbol}:price24hAgo`);
      if (cached) {
        const price24hAgo = parseFloat(cached);
        if (price24hAgo > 0) {
          return ((currentPrice - price24hAgo) / price24hAgo) * 100;
        }
      }

      // Query from database as fallback
      const result = await this.db.query(
        `SELECT close FROM ohlcv_1m
         WHERE pair_id = $1 AND time <= NOW() - INTERVAL '24 hours'
         ORDER BY time DESC LIMIT 1`,
        [this.pairs.get(symbol)?.id]
      );

      if (result.rows.length > 0) {
        const price24hAgo = parseFloat(result.rows[0].close);
        // Cache the 24h ago price for 5 minutes to reduce DB load
        await this.redis.set(
          `ticker:binance:${symbol}:price24hAgo`,
          String(price24hAgo),
          'EX',
          300
        );
        if (price24hAgo > 0) {
          return ((currentPrice - price24hAgo) / price24hAgo) * 100;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug('Failed to calculate 24h change', { symbol, error: message });
    }

    return 0;
  }

  /**
   * Backfill historical 1m klines from Binance REST API for each trading pair.
   * Only backfills pairs that have fewer than BACKFILL_THRESHOLD candles in the DB.
   */
  private async backfill(): Promise<void> {
    this.logger.info('Starting historical data backfill');

    for (const [symbol, pair] of this.pairs) {
      try {
        // Check existing candle count for this pair
        const countResult = await this.db.query(
          `SELECT COUNT(*) as cnt FROM ohlcv_1m WHERE pair_id = $1`,
          [pair.id]
        );
        const existingCount = parseInt(countResult.rows[0].cnt, 10);

        if (existingCount >= BACKFILL_THRESHOLD) {
          this.logger.info(`Skipping backfill for ${symbol}: already has ${existingCount} candles`);
          continue;
        }

        this.logger.info(`Backfilling ${symbol} (${existingCount} candles in DB)`);

        // Skip backfill if circuit breaker is open (Binance REST API is down)
        if (this.restBreaker.getState() === CircuitState.OPEN) {
          this.logger.warn(`Skipping backfill for ${symbol}: circuit breaker is OPEN`);
          continue;
        }

        const url = `${BINANCE_REST_BASE}/klines?symbol=${symbol}&interval=1m&limit=${BACKFILL_LIMIT}`;

        const klines = await this.restBreaker.call(
          async () => {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Binance API ${response.status}: ${response.statusText}`);
            }
            return (await response.json()) as unknown[][];
          },
          () => {
            this.logger.warn(`Circuit breaker fallback for ${symbol}: skipping backfill`);
            return [] as unknown[][];
          },
        );

        if (!Array.isArray(klines) || klines.length === 0) {
          this.logger.warn(`No kline data returned for ${symbol}`);
          continue;
        }

        // Batch insert all klines
        const values: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        for (const k of klines) {
          // Binance kline array: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, ...]
          const openTime = new Date(k[0] as number);
          const open = parseFloat(k[1] as string);
          const high = parseFloat(k[2] as string);
          const low = parseFloat(k[3] as string);
          const close = parseFloat(k[4] as string);
          const volume = parseFloat(k[5] as string);
          const trades = parseInt(k[8] as string, 10);

          values.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`
          );
          params.push(openTime, pair.id, pair.exchange_id, open, high, low, close, volume, trades);
          paramIndex += 9;
        }

        const sql = `
          INSERT INTO ohlcv_1m (time, pair_id, exchange_id, open, high, low, close, volume, trades)
          VALUES ${values.join(', ')}
          ON CONFLICT (time, pair_id, exchange_id) DO NOTHING
        `;

        await this.db.query(sql, params);
        this.logger.info(`Backfilled ${klines.length} candles for ${symbol}`);

        // Small delay between pairs to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, PAIR_DELAY_MS));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to backfill ${symbol}`, { error: message });
        // Continue with next pair - don't crash
      }
    }

    this.logger.info('Historical data backfill complete');
  }

  /**
   * Aggregate 1m candles into higher timeframes (5m, 15m, 1h, 4h, 1d)
   * using TimescaleDB time_bucket, first(), and last() functions.
   */
  async aggregateTimeframes(): Promise<void> {
    this.logger.info('Starting timeframe aggregation');

    for (const { table, bucket } of AGGREGATE_TIMEFRAMES) {
      for (const [symbol, pair] of this.pairs) {
        try {
          const sql = `
            INSERT INTO ${table} (time, pair_id, exchange_id, open, high, low, close, volume, trades)
            SELECT
              time_bucket('${bucket}', time) as bucket,
              pair_id, exchange_id,
              first(open, time), max(high), min(low), last(close, time),
              sum(volume), sum(trades)
            FROM ohlcv_1m
            WHERE pair_id = $1 AND time > NOW() - INTERVAL '24 hours'
            GROUP BY bucket, pair_id, exchange_id
            ON CONFLICT (time, pair_id, exchange_id) DO UPDATE SET
              high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close,
              volume = EXCLUDED.volume, trades = EXCLUDED.trades
          `;

          await this.db.query(sql, [pair.id]);
          this.logger.debug(`Aggregated ${table} for ${symbol}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to aggregate ${table} for ${symbol}`, { error: message });
          // Continue with next pair/timeframe
        }
      }
    }

    this.logger.info('Timeframe aggregation complete');
  }

  private reconnect(): void {
    if (!this.isRunning) return;

    const delay = this.getReconnectDelay();
    this.logger.info(`Reconnecting to Binance in ${delay}ms`, {
      attempt: this.reconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    // Binance requires a pong response within 10 minutes; send pings every 3 minutes
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.logger.debug('Sent ping to Binance');
      }
    }, 180_000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
