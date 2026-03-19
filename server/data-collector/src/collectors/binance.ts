import WebSocket from 'ws';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { BaseCollector } from './base.js';
import { normalizeBinanceKline, type BinanceRawKline } from '../normalizers/index.js';

const DEFAULT_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
];

const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream';

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

  constructor(db: Pool, redis: Redis) {
    super(db, redis);
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

    this.connect();
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
