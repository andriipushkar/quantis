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

// GET /fear-greed — Composite Fear & Greed index
router.get('/fear-greed', async (_req: Request, res: Response) => {
  try {
    // 1. Get all active trading pairs
    const pairsResult = await query(
      `SELECT tp.id, tp.symbol, tp.base_asset, tp.quote_asset, e.name as exchange
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.is_active = true`
    );

    // 2. Fetch tickers from Redis
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

    // 3. Compute RSI for each pair and collect metrics
    const rsiValues: number[] = [];
    const changes: number[] = [];
    const volumes: number[] = [];

    for (const pair of pairsResult.rows) {
      const tickerKey = `${pair.exchange}:${pair.symbol.toUpperCase()}`;
      const ticker = tickerMap[tickerKey];
      if (!ticker) continue;

      changes.push(ticker.change24h);
      volumes.push(ticker.volume);

      // Compute RSI(14) from last 15 1m candles
      const candlesResult = await query(
        `SELECT close FROM ohlcv_1m
         WHERE pair_id = $1
         ORDER BY time DESC
         LIMIT 15`,
        [pair.id]
      );

      const closes = candlesResult.rows.map((r) => parseFloat(r.close)).reverse();
      if (closes.length >= 15) {
        let gains = 0;
        let losses = 0;
        for (let i = 1; i <= 14; i++) {
          const diff = closes[i] - closes[i - 1];
          if (diff > 0) gains += diff;
          else losses += Math.abs(diff);
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        rsiValues.push(rsi);
      }
    }

    // 4. Compute component scores

    // RSI component (weight 30%): avg RSI mapped to 0-100 (RSI 30 = 0, RSI 70 = 100)
    const rsiAvg = rsiValues.length > 0
      ? rsiValues.reduce((a, b) => a + b, 0) / rsiValues.length
      : 50;
    const rsiScore = Math.max(0, Math.min(100, ((rsiAvg - 30) / 40) * 100));

    // Price momentum (weight 30%): % of pairs with positive 24h change
    const bullishCount = changes.filter((c) => c > 0).length;
    const bullishPct = changes.length > 0 ? (bullishCount / changes.length) * 100 : 50;

    // Volume trend (weight 20%): high volume during drops = fear
    // Compare current avg volume to a baseline — if prices are dropping and volume is high, it's fear
    const avgChange = changes.length > 0
      ? changes.reduce((a, b) => a + b, 0) / changes.length
      : 0;
    // Volume score: if avg change is negative and volume is high, fear (low score)
    // If avg change is positive and volume is high, greed (high score)
    // Normalize: use bullishPct as proxy — high bullish % with volume = greed
    const volumeScore = Math.max(0, Math.min(100, bullishPct + (avgChange > 0 ? 10 : -10)));

    // Funding rate proxy (weight 20%): neutral placeholder
    const fundingScore = 50;

    // 5. Weighted composite score
    const score = Math.round(
      rsiScore * 0.3 +
      bullishPct * 0.3 +
      volumeScore * 0.2 +
      fundingScore * 0.2
    );
    const clampedScore = Math.max(0, Math.min(100, score));

    // 6. Label
    let label: string;
    if (clampedScore < 20) label = 'Extreme Fear';
    else if (clampedScore < 40) label = 'Fear';
    else if (clampedScore < 60) label = 'Neutral';
    else if (clampedScore < 80) label = 'Greed';
    else label = 'Extreme Greed';

    res.json({
      success: true,
      data: {
        score: clampedScore,
        label,
        components: {
          rsi_avg: Math.round(rsiAvg * 100) / 100,
          bullish_pct: Math.round(bullishPct * 100) / 100,
          volume_score: Math.round(volumeScore * 100) / 100,
          funding_score: fundingScore,
        },
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    logger.error('Fear & Greed error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /correlation — Pearson correlation matrix between top pairs
router.get('/correlation', async (_req: Request, res: Response) => {
  try {
    // Check Redis cache
    const cached = await redis.get('market:correlation');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // 1. Get all active trading pairs
    const pairsResult = await query(
      `SELECT tp.id, tp.symbol
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.is_active = true
       ORDER BY tp.symbol ASC
       LIMIT 20`
    );

    // 2. Fetch last 100 1m closes for each pair
    const pairCloses: Record<string, number[]> = {};
    const validPairs: string[] = [];

    for (const pair of pairsResult.rows) {
      const candlesResult = await query(
        `SELECT close FROM ohlcv_1m
         WHERE pair_id = $1
         ORDER BY time DESC
         LIMIT 100`,
        [pair.id]
      );

      const closes = candlesResult.rows.map((r: { close: string }) => parseFloat(r.close)).reverse();
      if (closes.length > 50) {
        pairCloses[pair.symbol] = closes;
        validPairs.push(pair.symbol);
      }
    }

    // 3. Compute NxN Pearson correlation matrix
    const n = validPairs.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1; // self-correlation
      for (let j = i + 1; j < n; j++) {
        const x = pairCloses[validPairs[i]];
        const y = pairCloses[validPairs[j]];
        const len = Math.min(x.length, y.length);

        const xSlice = x.slice(x.length - len);
        const ySlice = y.slice(y.length - len);

        const xMean = xSlice.reduce((a, b) => a + b, 0) / len;
        const yMean = ySlice.reduce((a, b) => a + b, 0) / len;

        let num = 0;
        let denomX = 0;
        let denomY = 0;
        for (let k = 0; k < len; k++) {
          const dx = xSlice[k] - xMean;
          const dy = ySlice[k] - yMean;
          num += dx * dy;
          denomX += dx * dx;
          denomY += dy * dy;
        }

        const denom = Math.sqrt(denomX * denomY);
        const r = denom === 0 ? 0 : num / denom;
        const rounded = Math.round(r * 10000) / 10000;
        matrix[i][j] = rounded;
        matrix[j][i] = rounded;
      }
    }

    const response = { success: true, data: { pairs: validPairs, matrix } };

    // Cache for 5 minutes
    await redis.set('market:correlation', JSON.stringify(response), 'EX', 300);

    res.json(response);
  } catch (err) {
    logger.error('Correlation error', { error: (err as Error).message });
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

// GET /seasonality/:symbol — Day-of-week and hour-of-day performance analysis
router.get('/seasonality/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check Redis cache (5 min)
    const cacheKey = `market:seasonality:${symbol}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Find pair
    const pairResult = await query(
      `SELECT tp.id FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.symbol = $1 AND tp.is_active = true
       LIMIT 1`,
      [symbol]
    );

    if (pairResult.rows.length === 0) {
      res.status(404).json({ success: false, error: `No data found for ${symbol}` });
      return;
    }

    const pairId = pairResult.rows[0].id;

    // Fetch 1m candles (last ~7 days = ~10080 candles)
    const candlesResult = await query(
      `SELECT o.time, o.open, o.close
       FROM ohlcv_1m o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 10080`,
      [pairId]
    );

    const candles = candlesResult.rows.map((r: { time: string; open: string; close: string }) => ({
      time: new Date(r.time),
      open: parseFloat(r.open),
      close: parseFloat(r.close),
    })).reverse();

    if (candles.length < 60) {
      res.status(404).json({ success: false, error: 'Insufficient data for seasonality analysis' });
      return;
    }

    // Aggregate by hour (0-23)
    const hourlyBuckets: Array<{ returns: number[]; positive: number; negative: number }> = [];
    for (let h = 0; h < 24; h++) {
      hourlyBuckets.push({ returns: [], positive: 0, negative: 0 });
    }

    // Aggregate by day of week (0=Sun, 6=Sat)
    const dailyBuckets: Array<{ returns: number[]; positive: number; negative: number }> = [];
    for (let d = 0; d < 7; d++) {
      dailyBuckets.push({ returns: [], positive: 0, negative: 0 });
    }

    for (const c of candles) {
      if (c.open === 0) continue;
      const ret = ((c.close - c.open) / c.open) * 100;
      const hour = c.time.getUTCHours();
      const day = c.time.getUTCDay();

      hourlyBuckets[hour].returns.push(ret);
      if (ret > 0) hourlyBuckets[hour].positive++;
      else hourlyBuckets[hour].negative++;

      dailyBuckets[day].returns.push(ret);
      if (ret > 0) dailyBuckets[day].positive++;
      else dailyBuckets[day].negative++;
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const hourly = hourlyBuckets.map((b, hour) => {
      const count = b.returns.length;
      const avgReturn = count > 0
        ? Math.round((b.returns.reduce((a, v) => a + v, 0) / count) * 10000) / 10000
        : 0;
      const winRate = count > 0 ? Math.round((b.positive / count) * 10000) / 100 : 0;
      return { hour, avgReturn, winRate, count };
    });

    const daily = dailyBuckets.map((b, idx) => {
      const count = b.returns.length;
      const avgReturn = count > 0
        ? Math.round((b.returns.reduce((a, v) => a + v, 0) / count) * 10000) / 10000
        : 0;
      const winRate = count > 0 ? Math.round((b.positive / count) * 10000) / 100 : 0;
      return { day: dayNames[idx], avgReturn, winRate, count };
    });

    const response = {
      success: true,
      data: { symbol, hourly, daily },
    };

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);

    res.json(response);
  } catch (err) {
    logger.error('Seasonality error', { error: (err as Error).message });
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
