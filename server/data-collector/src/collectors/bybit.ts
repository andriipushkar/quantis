import WebSocket from 'ws';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { BaseCollector } from './base.js';
import { normalizeBybitKline } from '../normalizers/index.js';
import { CircuitBreaker, CircuitState } from '@quantis/shared';

const DEFAULT_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT',
];

const BYBIT_WS_URL = 'wss://stream.bybit.com/v5/public/spot';
const BYBIT_REST_BASE = 'https://api.bybit.com/v5/market';
const BACKFILL_LIMIT = 1000;
const BACKFILL_THRESHOLD = 500;
const PAIR_DELAY_MS = 200;
const PING_INTERVAL_MS = 20_000;

const AGGREGATE_TIMEFRAMES = [
  { table: 'ohlcv_5m', bucket: '5 minutes' },
  { table: 'ohlcv_15m', bucket: '15 minutes' },
  { table: 'ohlcv_1h', bucket: '1 hour' },
  { table: 'ohlcv_4h', bucket: '4 hours' },
  { table: 'ohlcv_1d', bucket: '1 day' },
] as const;

interface BybitKlineData {
  start: number;
  end: number;
  interval: string;
  open: string;
  close: string;
  high: string;
  low: string;
  volume: string;
  turnover: string;
  confirm: boolean;
  timestamp: number;
}

interface BybitWsMessage {
  topic?: string;
  data?: BybitKlineData[];
  op?: string;
  success?: boolean;
  ret_msg?: string;
}

interface TradingPair {
  id: number;
  symbol: string;
  exchange_id: number;
}

export class BybitCollector extends BaseCollector {
  private ws: WebSocket | null = null;
  private pairs: Map<string, TradingPair> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private aggregateInterval: ReturnType<typeof setInterval> | null = null;
  private restBreaker: CircuitBreaker;

  constructor(db: Pool, redis: Redis) {
    super(db, redis);
    this.restBreaker = new CircuitBreaker('bybit-rest', {
      failureThreshold: 5,
      resetTimeout: 30_000,
      onStateChange: (name, from, to) => {
        this.logger.warn(`Circuit breaker "${name}" transitioned ${from} → ${to}`);
      },
    });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Starting Bybit collector');

    await this.loadTradingPairs();

    if (this.pairs.size === 0) {
      this.logger.warn('No active Bybit trading pairs found, seeding defaults');
      await this.seedDefaultPairs();
      await this.loadTradingPairs();
    }

    if (this.pairs.size === 0) {
      this.logger.error('Failed to load Bybit trading pairs after seeding');
      return;
    }

    await this.backfill();
    this.connect();

    // Run timeframe aggregation every 5 minutes
    this.aggregateInterval = setInterval(() => {
      this.aggregateTimeframes().catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error('Bybit scheduled aggregation failed', { error: message });
      });
    }, 5 * 60 * 1000);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info('Stopping Bybit collector');

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

    this.logger.info('Bybit collector stopped');
  }

  private async loadTradingPairs(): Promise<void> {
    try {
      const result = await this.db.query(
        `SELECT tp.id, tp.symbol, tp.exchange_id
         FROM trading_pairs tp
         JOIN exchanges e ON e.id = tp.exchange_id
         WHERE e.name = 'bybit' AND tp.is_active = true`
      );

      this.pairs.clear();
      for (const row of result.rows) {
        this.pairs.set(row.symbol.toUpperCase(), {
          id: row.id,
          symbol: row.symbol,
          exchange_id: row.exchange_id,
        });
      }

      this.logger.info(`Loaded ${this.pairs.size} Bybit trading pairs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load Bybit trading pairs', { error: message });
    }
  }

  private async seedDefaultPairs(): Promise<void> {
    try {
      const exchangeResult = await this.db.query(
        `SELECT id FROM exchanges WHERE name = 'bybit'`
      );
      if (exchangeResult.rows.length === 0) {
        this.logger.error('Bybit exchange not found in database');
        return;
      }
      const exchangeId = exchangeResult.rows[0].id;

      for (const symbol of DEFAULT_PAIRS) {
        const baseAsset = symbol.replace('USDT', '');
        await this.db.query(
          `INSERT INTO trading_pairs (symbol, base_asset, quote_asset, exchange_id, is_active)
           VALUES ($1, $2, 'USDT', $3, true)
           ON CONFLICT (symbol, exchange_id) DO NOTHING`,
          [symbol, baseAsset, exchangeId]
        );
      }

      this.logger.info(`Seeded ${DEFAULT_PAIRS.length} default Bybit trading pairs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to seed default Bybit trading pairs', { error: message });
    }
  }

  private connect(): void {
    if (!this.isRunning) return;

    this.logger.info('Connecting to Bybit WebSocket', { streams: this.pairs.size });

    this.ws = new WebSocket(BYBIT_WS_URL);

    this.ws.on('open', () => {
      this.logger.info('Bybit WebSocket connected');
      this.resetReconnectAttempts();
      this.subscribe();
      this.startPing();
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const message = JSON.parse(raw.toString()) as BybitWsMessage;

        // Handle subscription response
        if (message.op === 'subscribe') {
          if (message.success) {
            this.logger.info('Bybit subscription confirmed');
          } else {
            this.logger.error('Bybit subscription failed', { reason: message.ret_msg });
          }
          return;
        }

        // Handle pong
        if (message.op === 'pong') {
          this.logger.debug('Received pong from Bybit');
          return;
        }

        // Handle kline data
        if (message.topic && message.data) {
          this.handleKline(message.topic, message.data);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to parse Bybit WebSocket message', { error: msg });
      }
    });

    this.ws.on('error', (error: Error) => {
      this.logger.error('Bybit WebSocket error', { error: error.message });
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.logger.warn('Bybit WebSocket closed', {
        code,
        reason: reason.toString(),
      });
      this.stopPing();
      this.reconnect();
    });
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const args = Array.from(this.pairs.keys()).map((s) => `kline.1.${s}`);

    const subscribeMsg = JSON.stringify({
      op: 'subscribe',
      args,
    });

    this.ws.send(subscribeMsg);
    this.logger.info(`Subscribed to ${args.length} Bybit kline streams`);
  }

  private async handleKline(topic: string, data: BybitKlineData[]): Promise<void> {
    // topic format: "kline.1.BTCUSDT"
    const parts = topic.split('.');
    const symbol = parts[2]?.toUpperCase();

    if (!symbol) return;

    const pair = this.pairs.get(symbol);
    if (!pair) {
      this.logger.debug(`Received kline for unknown Bybit pair: ${symbol}`);
      return;
    }

    for (const kline of data) {
      const normalized = normalizeBybitKline(kline as unknown as Record<string, unknown>);

      // Always publish real-time ticker updates
      try {
        const change24h = await this.calculate24hChange(symbol, normalized.close);

        await this.publishTicker(symbol, {
          exchange: 'bybit',
          price: normalized.close,
          change24h,
          volume: normalized.volume,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to publish Bybit ticker', { symbol, error: message });
      }

      // Only store closed (confirmed) candles
      if (!kline.confirm) continue;

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
        }, { symbol, timeframe: '1m' });

        this.logger.debug('Stored closed Bybit candle', {
          symbol,
          time: normalized.time.toISOString(),
          close: normalized.close,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to store Bybit kline', { symbol, error: message });
      }
    }
  }

  private async calculate24hChange(symbol: string, currentPrice: number): Promise<number> {
    try {
      const cached = await this.redis.get(`ticker:bybit:${symbol}:price24hAgo`);
      if (cached) {
        const price24hAgo = parseFloat(cached);
        if (price24hAgo > 0) {
          return ((currentPrice - price24hAgo) / price24hAgo) * 100;
        }
      }

      const result = await this.db.query(
        `SELECT close FROM ohlcv_1m
         WHERE pair_id = $1 AND time <= NOW() - INTERVAL '24 hours'
         ORDER BY time DESC LIMIT 1`,
        [this.pairs.get(symbol)?.id]
      );

      if (result.rows.length > 0) {
        const price24hAgo = parseFloat(result.rows[0].close);
        await this.redis.set(
          `ticker:bybit:${symbol}:price24hAgo`,
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
      this.logger.debug('Failed to calculate Bybit 24h change', { symbol, error: message });
    }

    return 0;
  }

  /**
   * Backfill historical 1m klines from Bybit REST API.
   * Bybit returns data in REVERSE order (newest first), so we reverse before inserting.
   */
  private async backfill(): Promise<void> {
    this.logger.info('Starting Bybit historical data backfill');

    for (const [symbol, pair] of this.pairs) {
      try {
        const countResult = await this.db.query(
          `SELECT COUNT(*) as cnt FROM ohlcv_1m WHERE pair_id = $1`,
          [pair.id]
        );
        const existingCount = parseInt(countResult.rows[0].cnt, 10);

        if (existingCount >= BACKFILL_THRESHOLD) {
          this.logger.info(`Skipping Bybit backfill for ${symbol}: already has ${existingCount} candles`);
          continue;
        }

        this.logger.info(`Backfilling Bybit ${symbol} (${existingCount} candles in DB)`);

        if (this.restBreaker.getState() === CircuitState.OPEN) {
          this.logger.warn(`Skipping Bybit backfill for ${symbol}: circuit breaker is OPEN`);
          continue;
        }

        const url = `${BYBIT_REST_BASE}/kline?category=spot&symbol=${symbol}&interval=1&limit=${BACKFILL_LIMIT}`;

        const klines = await this.restBreaker.call(
          async () => {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Bybit API ${response.status}: ${response.statusText}`);
            }
            const json = (await response.json()) as {
              retCode: number;
              result: { list: string[][] };
            };
            if (json.retCode !== 0 || !json.result?.list?.length) {
              return [] as string[][];
            }
            // Bybit returns newest first — reverse to chronological order
            return json.result.list.reverse();
          },
          () => {
            this.logger.warn(`Circuit breaker fallback for Bybit ${symbol}: skipping backfill`);
            return [] as string[][];
          },
        );

        const values: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        for (const k of klines) {
          // Bybit kline array: [timestamp, open, high, low, close, volume, turnover]
          const openTime = new Date(parseInt(k[0], 10));
          const open = parseFloat(k[1]);
          const high = parseFloat(k[2]);
          const low = parseFloat(k[3]);
          const close = parseFloat(k[4]);
          const volume = parseFloat(k[5]);
          values.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`
          );
          params.push(openTime, pair.id, pair.exchange_id, open, high, low, close, volume, 0);
          paramIndex += 9;
        }

        const sql = `
          INSERT INTO ohlcv_1m (time, pair_id, exchange_id, open, high, low, close, volume, trades)
          VALUES ${values.join(', ')}
          ON CONFLICT (time, pair_id, exchange_id) DO NOTHING
        `;

        await this.db.query(sql, params);
        this.logger.info(`Backfilled ${klines.length} Bybit candles for ${symbol}`);

        await new Promise((resolve) => setTimeout(resolve, PAIR_DELAY_MS));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to backfill Bybit ${symbol}`, { error: message });
      }
    }

    this.logger.info('Bybit historical data backfill complete');
  }

  /**
   * Aggregate 1m candles into higher timeframes.
   */
  async aggregateTimeframes(): Promise<void> {
    this.logger.info('Starting Bybit timeframe aggregation');

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
          this.logger.debug(`Aggregated ${table} for Bybit ${symbol}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to aggregate ${table} for Bybit ${symbol}`, { error: message });
        }
      }
    }

    this.logger.info('Bybit timeframe aggregation complete');
  }

  private reconnect(): void {
    if (!this.isRunning) return;

    const delay = this.getReconnectDelay();
    this.logger.info(`Reconnecting to Bybit in ${delay}ms`, {
      attempt: this.reconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    // Bybit requires ping every 20s to keep the connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 'ping' }));
        this.logger.debug('Sent ping to Bybit');
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
