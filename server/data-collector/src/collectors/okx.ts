import WebSocket from 'ws';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { BaseCollector } from './base.js';
import { normalizeOkxKline } from '../normalizers/index.js';
import { CircuitBreaker, CircuitState } from '@quantis/shared';

const DEFAULT_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT',
];

const OKX_WS_URL = 'wss://ws.okx.com:8443/ws/v5/business';
const OKX_REST_BASE = 'https://www.okx.com/api/v5/market';
const BACKFILL_LIMIT = 300;
const BACKFILL_THRESHOLD = 500;
const PAIR_DELAY_MS = 200;
const PING_INTERVAL_MS = 25_000;

const AGGREGATE_TIMEFRAMES = [
  { table: 'ohlcv_5m', bucket: '5 minutes' },
  { table: 'ohlcv_15m', bucket: '15 minutes' },
  { table: 'ohlcv_1h', bucket: '1 hour' },
  { table: 'ohlcv_4h', bucket: '4 hours' },
  { table: 'ohlcv_1d', bucket: '1 day' },
] as const;

interface OkxWsArg {
  channel: string;
  instId: string;
}

interface OkxWsMessage {
  arg?: OkxWsArg;
  data?: string[][];
  event?: string;
  code?: string;
  msg?: string;
}

interface TradingPair {
  id: number;
  symbol: string;
  exchange_id: number;
}

/**
 * Convert Quantis symbol (e.g. BTCUSDT) to OKX instId (e.g. BTC-USDT).
 */
function toOkxInstId(symbol: string): string {
  const base = symbol.replace('USDT', '');
  return `${base}-USDT`;
}

/**
 * Convert OKX instId (e.g. BTC-USDT) to Quantis symbol (e.g. BTCUSDT).
 */
function fromOkxInstId(instId: string): string {
  return instId.replace('-', '');
}

export class OkxCollector extends BaseCollector {
  private ws: WebSocket | null = null;
  private pairs: Map<string, TradingPair> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private aggregateInterval: ReturnType<typeof setInterval> | null = null;
  private restBreaker: CircuitBreaker;

  constructor(db: Pool, redis: Redis) {
    super(db, redis);
    this.restBreaker = new CircuitBreaker('okx-rest', {
      failureThreshold: 5,
      resetTimeout: 30_000,
      onStateChange: (name, from, to) => {
        this.logger.warn(`Circuit breaker "${name}" transitioned ${from} → ${to}`);
      },
    });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Starting OKX collector');

    await this.loadTradingPairs();

    if (this.pairs.size === 0) {
      this.logger.warn('No active OKX trading pairs found, seeding defaults');
      await this.seedDefaultPairs();
      await this.loadTradingPairs();
    }

    if (this.pairs.size === 0) {
      this.logger.error('Failed to load OKX trading pairs after seeding');
      return;
    }

    await this.backfill();
    this.connect();

    // Run timeframe aggregation every 5 minutes
    this.aggregateInterval = setInterval(() => {
      this.aggregateTimeframes().catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error('OKX scheduled aggregation failed', { error: message });
      });
    }, 5 * 60 * 1000);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info('Stopping OKX collector');

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

    this.logger.info('OKX collector stopped');
  }

  private async loadTradingPairs(): Promise<void> {
    try {
      const result = await this.db.query(
        `SELECT tp.id, tp.symbol, tp.exchange_id
         FROM trading_pairs tp
         JOIN exchanges e ON e.id = tp.exchange_id
         WHERE e.name = 'okx' AND tp.is_active = true`
      );

      this.pairs.clear();
      for (const row of result.rows) {
        this.pairs.set(row.symbol.toUpperCase(), {
          id: row.id,
          symbol: row.symbol,
          exchange_id: row.exchange_id,
        });
      }

      this.logger.info(`Loaded ${this.pairs.size} OKX trading pairs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load OKX trading pairs', { error: message });
    }
  }

  private async seedDefaultPairs(): Promise<void> {
    try {
      const exchangeResult = await this.db.query(
        `SELECT id FROM exchanges WHERE name = 'okx'`
      );
      if (exchangeResult.rows.length === 0) {
        this.logger.error('OKX exchange not found in database');
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

      this.logger.info(`Seeded ${DEFAULT_PAIRS.length} default OKX trading pairs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to seed default OKX trading pairs', { error: message });
    }
  }

  private connect(): void {
    if (!this.isRunning) return;

    this.logger.info('Connecting to OKX WebSocket', { streams: this.pairs.size });

    this.ws = new WebSocket(OKX_WS_URL);

    this.ws.on('open', () => {
      this.logger.info('OKX WebSocket connected');
      this.resetReconnectAttempts();
      this.subscribe();
      this.startPing();
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const text = raw.toString();

        // OKX may respond with "pong" as a text frame
        if (text === 'pong') {
          this.logger.debug('Received pong from OKX');
          return;
        }

        const message = JSON.parse(text) as OkxWsMessage;

        // Handle subscription response
        if (message.event === 'subscribe') {
          this.logger.info('OKX subscription confirmed', { channel: message.arg?.channel });
          return;
        }

        if (message.event === 'error') {
          this.logger.error('OKX WebSocket error event', {
            code: message.code,
            msg: message.msg,
          });
          return;
        }

        // Handle kline data
        if (message.arg?.channel === 'candle1m' && message.data) {
          this.handleKline(message.arg.instId, message.data);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to parse OKX WebSocket message', { error: msg });
      }
    });

    this.ws.on('error', (error: Error) => {
      this.logger.error('OKX WebSocket error', { error: error.message });
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.logger.warn('OKX WebSocket closed', {
        code,
        reason: reason.toString(),
      });
      this.stopPing();
      this.reconnect();
    });
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const args = Array.from(this.pairs.keys()).map((symbol) => ({
      channel: 'candle1m',
      instId: toOkxInstId(symbol),
    }));

    const subscribeMsg = JSON.stringify({
      op: 'subscribe',
      args,
    });

    this.ws.send(subscribeMsg);
    this.logger.info(`Subscribed to ${args.length} OKX kline streams`);
  }

  private async handleKline(instId: string, data: string[][]): Promise<void> {
    const symbol = fromOkxInstId(instId).toUpperCase();

    const pair = this.pairs.get(symbol);
    if (!pair) {
      this.logger.debug(`Received kline for unknown OKX pair: ${symbol}`);
      return;
    }

    for (const klineArr of data) {
      // OKX kline array: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
      const normalized = normalizeOkxKline(klineArr as unknown as Record<string, unknown>);
      const confirm = klineArr[8];

      // Always publish real-time ticker updates
      try {
        const change24h = await this.calculate24hChange(symbol, normalized.close);

        await this.publishTicker(symbol, {
          exchange: 'okx',
          price: normalized.close,
          change24h,
          volume: normalized.volume,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to publish OKX ticker', { symbol, error: message });
      }

      // Only store confirmed (closed) candles
      if (confirm !== '1') continue;

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

        this.logger.debug('Stored closed OKX candle', {
          symbol,
          time: normalized.time.toISOString(),
          close: normalized.close,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to store OKX kline', { symbol, error: message });
      }
    }
  }

  private async calculate24hChange(symbol: string, currentPrice: number): Promise<number> {
    try {
      const cached = await this.redis.get(`ticker:okx:${symbol}:price24hAgo`);
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
          `ticker:okx:${symbol}:price24hAgo`,
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
      this.logger.debug('Failed to calculate OKX 24h change', { symbol, error: message });
    }

    return 0;
  }

  /**
   * Backfill historical 1m klines from OKX REST API.
   * OKX returns data in REVERSE order (newest first), so we reverse before inserting.
   * OKX limit is 300 candles per request.
   */
  private async backfill(): Promise<void> {
    this.logger.info('Starting OKX historical data backfill');

    for (const [symbol, pair] of this.pairs) {
      try {
        const countResult = await this.db.query(
          `SELECT COUNT(*) as cnt FROM ohlcv_1m WHERE pair_id = $1`,
          [pair.id]
        );
        const existingCount = parseInt(countResult.rows[0].cnt, 10);

        if (existingCount >= BACKFILL_THRESHOLD) {
          this.logger.info(`Skipping OKX backfill for ${symbol}: already has ${existingCount} candles`);
          continue;
        }

        this.logger.info(`Backfilling OKX ${symbol} (${existingCount} candles in DB)`);

        if (this.restBreaker.getState() === CircuitState.OPEN) {
          this.logger.warn(`Skipping OKX backfill for ${symbol}: circuit breaker is OPEN`);
          continue;
        }

        const instId = toOkxInstId(symbol);
        const url = `${OKX_REST_BASE}/candles?instId=${instId}&bar=1m&limit=${BACKFILL_LIMIT}`;

        const klines = await this.restBreaker.call(
          async () => {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`OKX API ${response.status}: ${response.statusText}`);
            }
            const json = (await response.json()) as {
              code: string;
              data: string[][];
            };
            if (json.code !== '0' || !json.data?.length) {
              return [] as string[][];
            }
            // OKX returns newest first — reverse to chronological order
            return json.data.reverse();
          },
          () => {
            this.logger.warn(`Circuit breaker fallback for OKX ${symbol}: skipping backfill`);
            return [] as string[][];
          },
        );

        const values: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        for (const k of klines) {
          // OKX kline array: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
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
        this.logger.info(`Backfilled ${klines.length} OKX candles for ${symbol}`);

        await new Promise((resolve) => setTimeout(resolve, PAIR_DELAY_MS));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to backfill OKX ${symbol}`, { error: message });
      }
    }

    this.logger.info('OKX historical data backfill complete');
  }

  /**
   * Aggregate 1m candles into higher timeframes.
   */
  async aggregateTimeframes(): Promise<void> {
    this.logger.info('Starting OKX timeframe aggregation');

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
          this.logger.debug(`Aggregated ${table} for OKX ${symbol}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to aggregate ${table} for OKX ${symbol}`, { error: message });
        }
      }
    }

    this.logger.info('OKX timeframe aggregation complete');
  }

  private reconnect(): void {
    if (!this.isRunning) return;

    const delay = this.getReconnectDelay();
    this.logger.info(`Reconnecting to OKX in ${delay}ms`, {
      attempt: this.reconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    // OKX requires ping every 25s to keep the connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
        this.logger.debug('Sent ping to OKX');
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
