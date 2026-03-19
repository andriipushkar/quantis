import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

const router = Router();

const TIMEFRAME_TABLES: Record<string, string> = {
  '1m': 'ohlcv_1m',
  '5m': 'ohlcv_5m',
  '15m': 'ohlcv_15m',
  '1h': 'ohlcv_1h',
  '4h': 'ohlcv_4h',
  '1d': 'ohlcv_1d',
};

// GET /pairs
router.get('/pairs', async (req: Request, res: Response) => {
  try {
    const { exchange, quote, active } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (exchange) {
      conditions.push(`e.name = $${paramIndex++}`);
      params.push(exchange);
    }
    if (quote) {
      conditions.push(`tp.quote_asset = $${paramIndex++}`);
      params.push(quote);
    }
    if (active !== undefined) {
      conditions.push(`tp.is_active = $${paramIndex++}`);
      params.push(active === 'true');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT tp.id, tp.symbol, tp.base_asset, tp.quote_asset, e.name as exchange, tp.is_active
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       ${where}
       ORDER BY tp.symbol ASC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Get pairs error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /pairs/:symbol
router.get('/pairs/:symbol', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT tp.id, tp.symbol, tp.base_asset, tp.quote_asset, e.name as exchange, tp.is_active
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.symbol = $1`,
      [req.params.symbol.toUpperCase()]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Trading pair not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Get pair error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /ohlcv/:symbol
router.get('/ohlcv/:symbol', async (req: Request, res: Response) => {
  try {
    const { timeframe = '1m', limit = '500', from, to } = req.query;
    const table = TIMEFRAME_TABLES[timeframe as string];

    if (!table) {
      res.status(400).json({
        success: false,
        error: 'Invalid timeframe',
        validTimeframes: Object.keys(TIMEFRAME_TABLES),
      });
      return;
    }

    const conditions: string[] = ['tp.symbol = $1'];
    const params: unknown[] = [req.params.symbol.toUpperCase()];
    let paramIndex = 2;

    if (from) {
      conditions.push(`o.time >= $${paramIndex++}::timestamptz`);
      params.push(from);
    }
    if (to) {
      conditions.push(`o.time <= $${paramIndex++}::timestamptz`);
      params.push(to);
    }

    const maxLimit = Math.min(parseInt(limit as string, 10) || 500, 5000);
    params.push(maxLimit);

    const result = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ${table} o
       JOIN trading_pairs tp ON tp.id = o.pair_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY o.time ASC
       LIMIT $${paramIndex}`,
      params
    );

    const candles = result.rows.map((r) => ({
      time: Math.floor(new Date(r.time).getTime() / 1000),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
    }));

    res.json({ success: true, data: candles });
  } catch (err) {
    logger.error('Get OHLCV error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /screener — Advanced screener with computed metrics
router.get('/screener', async (req: Request, res: Response) => {
  try {
    const {
      sort = 'volume',
      order = 'desc',
      minVolume,
      maxRsi,
      minRsi,
      exchange: exchangeFilter,
      trend: trendFilter,
    } = req.query;

    // 1. Get all active trading pairs
    const pairsResult = await query(
      `SELECT tp.id, tp.symbol, tp.base_asset, tp.quote_asset, e.name as exchange
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.is_active = true
       ORDER BY tp.symbol ASC`
    );

    // 2. Fetch all tickers from Redis
    const tickerKeys = await redis.keys('ticker:*:*');
    const tickerMap: Record<string, { price: number; change24h: number; volume: number }> = {};

    if (tickerKeys.length > 0) {
      const pipeline = redis.pipeline();
      for (const key of tickerKeys) {
        pipeline.get(key);
      }
      const tickerResults = await pipeline.exec();
      tickerKeys.forEach((key, i) => {
        const value = tickerResults?.[i]?.[1];
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            // key format: ticker:<exchange>:<symbol>
            const parts = key.split(':');
            const tickerExchange = parts[1];
            const tickerSymbol = parts[2];
            tickerMap[`${tickerExchange}:${tickerSymbol}`] = {
              price: parsed.price ?? 0,
              change24h: parsed.change24h ?? 0,
              volume: parsed.volume ?? 0,
            };
          } catch { /* skip */ }
        }
      });
    }

    // 3. For each pair, compute RSI(14) and EMA(20) from last 20 1m candles
    const screenerItems: Array<{
      symbol: string;
      exchange: string;
      price: number;
      change24h: number;
      volume: number;
      rsi: number;
      trend: 'bullish' | 'bearish' | 'neutral';
    }> = [];

    for (const pair of pairsResult.rows) {
      const tickerKey = `${pair.exchange}:${pair.symbol.toUpperCase()}`;
      const ticker = tickerMap[tickerKey];

      // Skip pairs without live ticker data
      if (!ticker) continue;

      // Fetch last 20 candles for RSI + EMA calculation
      const candlesResult = await query(
        `SELECT close FROM ohlcv_1m
         WHERE pair_id = $1
         ORDER BY time DESC
         LIMIT 20`,
        [pair.id]
      );

      const closes = candlesResult.rows.map((r) => parseFloat(r.close)).reverse();

      // Compute RSI(14)
      let rsi = 50; // default neutral
      if (closes.length >= 15) {
        let gains = 0;
        let losses = 0;
        for (let i = 1; i <= 14; i++) {
          const diff = closes[closes.length - 15 + i] - closes[closes.length - 15 + i - 1];
          if (diff > 0) gains += diff;
          else losses += Math.abs(diff);
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        if (avgLoss === 0) {
          rsi = 100;
        } else {
          const rs = avgGain / avgLoss;
          rsi = 100 - 100 / (1 + rs);
        }
      }

      // Compute EMA(20) for trend
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (closes.length >= 20) {
        const k = 2 / (20 + 1);
        let ema = closes[0];
        for (let i = 1; i < closes.length; i++) {
          ema = closes[i] * k + ema * (1 - k);
        }
        if (ticker.price > ema) trend = 'bullish';
        else if (ticker.price < ema) trend = 'bearish';
      }

      screenerItems.push({
        symbol: pair.symbol,
        exchange: pair.exchange,
        price: ticker.price,
        change24h: ticker.change24h,
        volume: ticker.volume,
        rsi: Math.round(rsi * 100) / 100,
        trend,
      });
    }

    // 4. Apply filters
    let filtered = screenerItems;

    if (exchangeFilter && exchangeFilter !== 'all') {
      filtered = filtered.filter((item) => item.exchange === exchangeFilter);
    }

    if (trendFilter && trendFilter !== 'all') {
      filtered = filtered.filter((item) => item.trend === trendFilter);
    }

    if (minVolume) {
      const mv = parseFloat(minVolume as string);
      if (!isNaN(mv)) filtered = filtered.filter((item) => item.volume >= mv);
    }

    if (minRsi) {
      const mr = parseFloat(minRsi as string);
      if (!isNaN(mr)) filtered = filtered.filter((item) => item.rsi >= mr);
    }

    if (maxRsi) {
      const mr = parseFloat(maxRsi as string);
      if (!isNaN(mr)) filtered = filtered.filter((item) => item.rsi <= mr);
    }

    // 5. Sort
    const sortField = sort as string;
    const sortOrder = order as string;
    const validSortFields = ['symbol', 'exchange', 'price', 'change24h', 'volume', 'rsi'];
    if (validSortFields.includes(sortField)) {
      filtered.sort((a, b) => {
        const av = a[sortField as keyof typeof a];
        const bv = b[sortField as keyof typeof b];
        if (typeof av === 'string' && typeof bv === 'string') {
          return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortOrder === 'asc'
          ? (av as number) - (bv as number)
          : (bv as number) - (av as number);
      });
    }

    res.json({ success: true, data: filtered });
  } catch (err) {
    logger.error('Screener error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /ticker — all tickers
router.get('/ticker', async (_req: Request, res: Response) => {
  try {
    const keys = await redis.keys('ticker:*:*');
    if (keys.length === 0) {
      res.json({ success: true, data: {} });
      return;
    }

    const pipeline = redis.pipeline();
    for (const key of keys) {
      pipeline.get(key);
    }
    const results = await pipeline.exec();

    const tickers: Record<string, unknown> = {};
    keys.forEach((key, i) => {
      const value = results?.[i]?.[1];
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          tickers[parsed.symbol] = parsed;
        } catch {
          // skip
        }
      }
    });

    res.json({ success: true, data: tickers });
  } catch (err) {
    logger.error('Get tickers error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /ticker/:symbol
router.get('/ticker/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    // Try binance first, then other exchanges
    const exchanges = ['binance', 'bybit', 'okx'];
    for (const exchange of exchanges) {
      const data = await redis.get(`ticker:${exchange}:${symbol}`);
      if (data) {
        res.json({ success: true, data: JSON.parse(data) });
        return;
      }
    }

    res.status(404).json({ success: false, error: 'Ticker not found' });
  } catch (err) {
    logger.error('Get ticker error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
