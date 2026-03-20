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

// GET /regime — Market regime classifier (BTCUSDT reference)
router.get('/regime', async (_req: Request, res: Response) => {
  try {
    // Check cache (5 min)
    const cached = await redis.get('market:regime');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Find BTCUSDT pair
    const pairResult = await query(
      `SELECT tp.id FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.symbol = 'BTCUSDT' AND tp.is_active = true
       LIMIT 1`
    );

    if (pairResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'BTCUSDT not found' });
      return;
    }

    const pairId = pairResult.rows[0].id;

    // Fetch last 60 1h candles for robust indicator computation
    const candlesResult = await query(
      `SELECT o.high, o.low, o.close, o.volume FROM ohlcv_1h o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 60`,
      [pairId]
    );

    const candles = candlesResult.rows
      .map((r: { high: string; low: string; close: string; volume: string }) => ({
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      }))
      .reverse();

    if (candles.length < 20) {
      res.status(404).json({ success: false, error: 'Insufficient data for regime detection' });
      return;
    }

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);

    // --- RSI(14) ---
    let rsi = 50;
    if (closes.length >= 15) {
      let gains = 0;
      let losses = 0;
      const offset = closes.length - 15;
      for (let i = 1; i <= 14; i++) {
        const diff = closes[offset + i] - closes[offset + i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    // --- EMA50 ---
    let ema50 = closes[0];
    const k50 = 2 / (50 + 1);
    for (let i = 1; i < closes.length; i++) {
      ema50 = closes[i] * k50 + ema50 * (1 - k50);
    }

    // --- ADX proxy: ratio of directional movement to range over last 14 candles ---
    let adxProxy = 20;
    const adxLen = Math.min(14, candles.length - 1);
    if (adxLen >= 5) {
      let plusDM = 0;
      let minusDM = 0;
      let trSum = 0;
      const start = candles.length - adxLen - 1;
      for (let i = start + 1; i < candles.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        if (upMove > downMove && upMove > 0) plusDM += upMove;
        if (downMove > upMove && downMove > 0) minusDM += downMove;
        const tr = Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        );
        trSum += tr;
      }
      if (trSum > 0) {
        const plusDI = (plusDM / trSum) * 100;
        const minusDI = (minusDM / trSum) * 100;
        const diSum = plusDI + minusDI;
        const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
        adxProxy = dx;
      }
    }

    // --- Bollinger Bandwidth (20-period) ---
    const bbPeriod = Math.min(20, closes.length);
    const bbSlice = closes.slice(closes.length - bbPeriod);
    const bbMean = bbSlice.reduce((a, b) => a + b, 0) / bbPeriod;
    const bbStd = Math.sqrt(bbSlice.reduce((a, v) => a + (v - bbMean) ** 2, 0) / bbPeriod);
    const bbWidth = bbMean > 0 ? (bbStd * 4) / bbMean * 100 : 0; // as percentage

    // --- ATR(14) and ATR average ---
    const atrPeriods: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      atrPeriods.push(tr);
    }
    const recentATR = atrPeriods.length >= 14
      ? atrPeriods.slice(-14).reduce((a, b) => a + b, 0) / 14
      : atrPeriods.reduce((a, b) => a + b, 0) / (atrPeriods.length || 1);
    const avgATR = atrPeriods.length > 0
      ? atrPeriods.reduce((a, b) => a + b, 0) / atrPeriods.length
      : recentATR;
    const atrRatio = avgATR > 0 ? recentATR / avgATR : 1;

    // --- Higher highs / lower lows detection (last 5 candles) ---
    const last5 = candles.slice(-5);
    let higherHighs = 0;
    let lowerLows = 0;
    for (let i = 1; i < last5.length; i++) {
      if (last5[i].high > last5[i - 1].high) higherHighs++;
      if (last5[i].low < last5[i - 1].low) lowerLows++;
    }

    // --- Volume trend (declining?) ---
    const recentVol = volumes.slice(-7);
    const olderVol = volumes.slice(-14, -7);
    const avgRecentVol = recentVol.length > 0 ? recentVol.reduce((a, b) => a + b, 0) / recentVol.length : 0;
    const avgOlderVol = olderVol.length > 0 ? olderVol.reduce((a, b) => a + b, 0) / olderVol.length : avgRecentVol;
    const volumeDeclining = avgOlderVol > 0 ? avgRecentVol / avgOlderVol < 0.8 : false;

    // --- BB expanding/contracting ---
    let bbExpanding = false;
    let bbContracting = false;
    if (closes.length >= 30) {
      const olderSlice = closes.slice(closes.length - 30, closes.length - 10);
      const olderMean = olderSlice.reduce((a, b) => a + b, 0) / olderSlice.length;
      const olderStd = Math.sqrt(olderSlice.reduce((a, v) => a + (v - olderMean) ** 2, 0) / olderSlice.length);
      const olderBBW = olderMean > 0 ? (olderStd * 4) / olderMean * 100 : 0;
      bbExpanding = bbWidth > olderBBW * 1.3;
      bbContracting = bbWidth < olderBBW * 0.7;
    }

    const currentPrice = closes[closes.length - 1];

    // --- Classify regime ---
    let regime: string;
    let confidence: number;
    let description: string;
    let recommended: string[];
    let avoid: string[];

    if (bbExpanding && atrRatio > 2) {
      regime = 'high_volatility';
      confidence = Math.min(95, 60 + atrRatio * 10);
      description = 'Market is experiencing high volatility with expanding Bollinger Bands and ATR spikes. Expect large price swings.';
      recommended = ['Straddle/Strangle', 'Scalping breakouts', 'Reduced position sizing'];
      avoid = ['Grid trading', 'Tight stop-losses', 'High leverage'];
    } else if (bbContracting && volumeDeclining) {
      regime = 'low_volatility';
      confidence = Math.min(90, 55 + (1 - atrRatio) * 30);
      description = 'Market is in a low volatility compression phase with declining volume. A breakout may be imminent.';
      recommended = ['Breakout anticipation', 'Accumulation', 'Options buying'];
      avoid = ['Mean reversion', 'Scalping', 'Large positions'];
    } else if (currentPrice > ema50 && adxProxy > 25 && higherHighs >= 3) {
      regime = 'trending_up';
      confidence = Math.min(95, 50 + adxProxy);
      description = 'Strong uptrend detected. Price is above EMA50 with strong directional movement and consecutive higher highs.';
      recommended = ['Trend following long', 'Pullback buying', 'Momentum strategies'];
      avoid = ['Short selling', 'Mean reversion shorts', 'Counter-trend entries'];
    } else if (currentPrice < ema50 && adxProxy > 25 && lowerLows >= 3) {
      regime = 'trending_down';
      confidence = Math.min(95, 50 + adxProxy);
      description = 'Strong downtrend detected. Price is below EMA50 with strong directional movement and consecutive lower lows.';
      recommended = ['Trend following short', 'Rally selling', 'Hedging'];
      avoid = ['Buying dips', 'Long-only strategies', 'High leverage longs'];
    } else if (adxProxy < 20) {
      regime = 'ranging';
      confidence = Math.min(85, 50 + (20 - adxProxy) * 2);
      description = 'Market is range-bound with weak directional movement. Price is oscillating without a clear trend.';
      recommended = ['Mean reversion', 'Range trading', 'Grid bots'];
      avoid = ['Trend following', 'Breakout strategies', 'Momentum plays'];
    } else {
      // Transitional state
      regime = 'ranging';
      confidence = 40;
      description = 'Market is in a transitional phase. Indicators show mixed signals between trending and ranging conditions.';
      recommended = ['Reduced position sizing', 'Wait for confirmation', 'Scalping'];
      avoid = ['Large directional bets', 'High leverage'];
    }

    confidence = Math.round(Math.max(0, Math.min(100, confidence)));

    const response = {
      success: true,
      data: {
        regime,
        confidence,
        description,
        recommended,
        avoid,
        indicators: {
          adx: Math.round(adxProxy * 100) / 100,
          rsi: Math.round(rsi * 100) / 100,
          bbWidth: Math.round(bbWidth * 100) / 100,
          atr: Math.round(recentATR * 100) / 100,
        },
      },
    };

    // Cache 5 min
    await redis.set('market:regime', JSON.stringify(response), 'EX', 300);

    res.json(response);
  } catch (err) {
    logger.error('Regime error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /funding-rates — Simulated funding rates based on RSI momentum
router.get('/funding-rates', async (_req: Request, res: Response) => {
  try {
    // Check cache (5 min)
    const cached = await redis.get('market:funding-rates');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Get active pairs
    const pairsResult = await query(
      `SELECT tp.id, tp.symbol, e.name as exchange
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.is_active = true
       ORDER BY tp.symbol ASC`
    );

    // Fetch tickers from Redis
    const tickerKeys = await redis.keys('ticker:*:*');
    const tickerMap: Record<string, { price: number; change24h: number; volume: number; timestamp?: number }> = {};

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
            tickerMap[`${parts[1]}:${parts[2]}`] = {
              price: parsed.price ?? 0,
              change24h: parsed.change24h ?? 0,
              volume: parsed.volume ?? 0,
              timestamp: parsed.timestamp,
            };
          } catch { /* skip */ }
        }
      });
    }

    const rates: Array<{
      symbol: string;
      exchange: string;
      rate: number;
      annualized: number;
      nextFunding: string;
      prediction: 'up' | 'down' | 'stable';
    }> = [];

    for (const pair of pairsResult.rows) {
      const tickerKey = `${pair.exchange}:${pair.symbol.toUpperCase()}`;
      const ticker = tickerMap[tickerKey];
      if (!ticker) continue;

      // Compute RSI(14)
      const candlesResult = await query(
        `SELECT close FROM ohlcv_1m
         WHERE pair_id = $1
         ORDER BY time DESC
         LIMIT 15`,
        [pair.id]
      );

      const closes = candlesResult.rows.map((r: { close: string }) => parseFloat(r.close)).reverse();
      let rsi = 50;
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
        rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }

      // Compute funding rate from RSI
      // RSI > 60: positive funding (longs pay shorts)
      // RSI < 40: negative funding (shorts pay longs)
      // Magnitude proportional to RSI distance from 50, capped at ±0.1%
      const rsiDistance = rsi - 50;
      let rate = (rsiDistance / 50) * 0.1; // max ±0.1%
      rate = Math.max(-0.1, Math.min(0.1, rate));
      rate = Math.round(rate * 10000) / 10000;

      // Annualized: 3 funding periods per day * 365
      const annualized = Math.round(rate * 3 * 365 * 100) / 100;

      // Next funding: next 8-hour mark
      const now = new Date();
      const hours = now.getUTCHours();
      const nextHour = hours < 8 ? 8 : hours < 16 ? 16 : 24;
      const nextFundingDate = new Date(now);
      nextFundingDate.setUTCHours(nextHour % 24, 0, 0, 0);
      if (nextHour === 24) nextFundingDate.setUTCDate(nextFundingDate.getUTCDate() + 1);

      // Prediction based on momentum
      const prediction: 'up' | 'down' | 'stable' =
        rsi > 60 ? 'up' :
        rsi < 40 ? 'down' :
        'stable';

      rates.push({
        symbol: pair.symbol,
        exchange: pair.exchange,
        rate,
        annualized,
        nextFunding: nextFundingDate.toISOString(),
        prediction,
      });
    }

    // Sort by absolute rate descending
    rates.sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));

    const response = { success: true, data: rates };
    await redis.set('market:funding-rates', JSON.stringify(response), 'EX', 300);

    res.json(response);
  } catch (err) {
    logger.error('Funding rates error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// --- Narrative sector mappings ---
const NARRATIVE_SECTORS: Record<string, string[]> = {
  'AI & ML': ['LINKUSDT', 'DOTUSDT'],
  'Layer 1': ['ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'ADAUSDT'],
  'Meme': ['DOGEUSDT'],
  'DeFi': ['LINKUSDT'],
  'Exchange': ['BNBUSDT'],
  'Payments': ['XRPUSDT'],
};

// GET /narratives — Crypto sector/narrative performance tracker
router.get('/narratives', async (_req: Request, res: Response) => {
  try {
    // Check cache (5 min)
    const cached = await redis.get('market:narratives');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Fetch all tickers from Redis
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
            tickerMap[parts[2]] = {
              price: parsed.price ?? 0,
              change24h: parsed.change24h ?? 0,
              volume: parsed.volume ?? 0,
            };
          } catch { /* skip */ }
        }
      });
    }

    // Get active pairs for RSI computation
    const pairsResult = await query(
      `SELECT tp.id, tp.symbol
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.is_active = true`
    );

    // Compute RSI for each symbol
    const rsiMap: Record<string, number> = {};
    for (const pair of pairsResult.rows) {
      const candlesResult = await query(
        `SELECT close FROM ohlcv_1m
         WHERE pair_id = $1
         ORDER BY time DESC
         LIMIT 15`,
        [pair.id]
      );
      const closes = candlesResult.rows.map((r: { close: string }) => parseFloat(r.close)).reverse();
      let rsi = 50;
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
        rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
      rsiMap[pair.symbol] = rsi;
    }

    // Build narratives
    const narratives = Object.entries(NARRATIVE_SECTORS).map(([name, symbols]) => {
      const tokens: Array<{ symbol: string; change24h: number; price: number }> = [];
      let totalChange = 0;
      let totalVolume = 0;
      let totalRsi = 0;
      let count = 0;

      for (const sym of symbols) {
        const ticker = tickerMap[sym];
        if (ticker) {
          tokens.push({ symbol: sym, change24h: ticker.change24h, price: ticker.price });
          totalChange += ticker.change24h;
          totalVolume += ticker.volume;
          totalRsi += rsiMap[sym] ?? 50;
          count++;
        }
      }

      const avgChange = count > 0 ? totalChange / count : 0;
      const avgVolume = count > 0 ? totalVolume / count : 0;
      const avgRsi = count > 0 ? totalRsi / count : 50;

      // Score 0-100: price momentum (40%), volume (30%), RSI strength (30%)
      // Price momentum: map avgChange from [-10, 10] -> [0, 100]
      const momentumScore = Math.max(0, Math.min(100, (avgChange + 10) * 5));
      // Volume: higher volume = higher score, normalize relative
      const volumeScore = Math.min(100, (avgVolume / 1e9) * 50);
      // RSI strength: RSI 50 = 50, RSI 70 = 100, RSI 30 = 0
      const rsiScore = Math.max(0, Math.min(100, ((avgRsi - 30) / 40) * 100));

      const score = Math.round(momentumScore * 0.4 + volumeScore * 0.3 + rsiScore * 0.3);
      const clampedScore = Math.max(0, Math.min(100, score));

      const trend: 'rising' | 'falling' | 'stable' =
        avgChange > 1 ? 'rising' :
        avgChange < -1 ? 'falling' :
        'stable';

      return {
        name,
        score: clampedScore,
        tokens,
        avgChange: Math.round(avgChange * 100) / 100,
        avgVolume: Math.round(avgVolume),
        avgRsi: Math.round(avgRsi * 100) / 100,
        trend,
      };
    });

    // Sort by score desc
    narratives.sort((a, b) => b.score - a.score);

    const response = { success: true, data: { narratives } };
    await redis.set('market:narratives', JSON.stringify(response), 'EX', 300);

    res.json(response);
  } catch (err) {
    logger.error('Narratives error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /breadth — Market breadth indicators
router.get('/breadth', async (_req: Request, res: Response) => {
  try {
    // Check cache (5 min)
    const cached = await redis.get('market:breadth');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Get active pairs
    const pairsResult = await query(
      `SELECT tp.id, tp.symbol, e.name as exchange
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.is_active = true`
    );

    // Fetch tickers
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
            tickerMap[`${parts[1]}:${parts[2]}`] = {
              price: parsed.price ?? 0,
              change24h: parsed.change24h ?? 0,
              volume: parsed.volume ?? 0,
            };
          } catch { /* skip */ }
        }
      });
    }

    let advancing = 0;
    let declining = 0;
    let aboveSma = 0;
    let totalRsi = 0;
    let rsiCount = 0;
    let newHighs = 0;
    let newLows = 0;
    let totalPairs = 0;

    for (const pair of pairsResult.rows) {
      const tickerKey = `${pair.exchange}:${pair.symbol.toUpperCase()}`;
      const ticker = tickerMap[tickerKey];
      if (!ticker) continue;

      totalPairs++;

      // Advance / decline
      if (ticker.change24h > 0) advancing++;
      else if (ticker.change24h < 0) declining++;

      // Fetch last 20 candles for SMA20 + RSI + high/low
      const candlesResult = await query(
        `SELECT close, high, low FROM ohlcv_1m
         WHERE pair_id = $1
         ORDER BY time DESC
         LIMIT 20`,
        [pair.id]
      );

      const rows = candlesResult.rows;
      const closes = rows.map((r: { close: string }) => parseFloat(r.close)).reverse();

      // SMA20
      if (closes.length >= 20) {
        const sma20 = closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
        if (ticker.price > sma20) aboveSma++;
      }

      // RSI(14)
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
        const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        totalRsi += rsi;
        rsiCount++;
      }

      // New highs / lows: check if current price is at candle range extremes
      const highs = rows.map((r: { high: string }) => parseFloat(r.high));
      const lowsArr = rows.map((r: { low: string }) => parseFloat(r.low));
      if (highs.length > 0) {
        const maxHigh = Math.max(...highs);
        const minLow = Math.min(...lowsArr);
        if (ticker.price >= maxHigh * 0.999) newHighs++;
        if (ticker.price <= minLow * 1.001) newLows++;
      }
    }

    const avgRsi = rsiCount > 0 ? Math.round((totalRsi / rsiCount) * 100) / 100 : 50;
    const pctAboveSma = totalPairs > 0 ? Math.round((aboveSma / totalPairs) * 10000) / 100 : 0;

    // Breadth score: composite
    // Advancing ratio (30%), pctAboveSma (30%), RSI mapping (20%), highsVsLows (20%)
    const advRatio = totalPairs > 0 ? (advancing / totalPairs) * 100 : 50;
    const rsiScore = Math.max(0, Math.min(100, ((avgRsi - 30) / 40) * 100));
    const hlScore = totalPairs > 0
      ? Math.max(0, Math.min(100, ((newHighs - newLows) / totalPairs + 0.5) * 100))
      : 50;

    const score = Math.round(advRatio * 0.3 + pctAboveSma * 0.3 + rsiScore * 0.2 + hlScore * 0.2);
    const clampedScore = Math.max(0, Math.min(100, score));

    let label: string;
    if (clampedScore >= 70) label = 'Strong Bull';
    else if (clampedScore >= 55) label = 'Moderate Bull';
    else if (clampedScore >= 45) label = 'Neutral';
    else if (clampedScore >= 30) label = 'Moderate Bear';
    else label = 'Weak / Bearish';

    const breadthLine = advancing - declining;

    const response = {
      success: true,
      data: {
        score: clampedScore,
        label,
        advancing,
        declining,
        pctAboveSma,
        avgRsi,
        newHighs,
        newLows,
        breadthLine,
      },
    };

    await redis.set('market:breadth', JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Market breadth error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /open-interest — Simulated OI data
router.get('/open-interest', async (_req: Request, res: Response) => {
  try {
    // Check cache (5 min)
    const cached = await redis.get('market:open-interest');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Get active pairs
    const pairsResult = await query(
      `SELECT tp.id, tp.symbol, e.name as exchange
       FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.is_active = true
       ORDER BY tp.symbol ASC`
    );

    // Fetch tickers
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
            tickerMap[`${parts[1]}:${parts[2]}`] = {
              price: parsed.price ?? 0,
              change24h: parsed.change24h ?? 0,
              volume: parsed.volume ?? 0,
            };
          } catch { /* skip */ }
        }
      });
    }

    const oiData: Array<{
      symbol: string;
      exchange: string;
      openInterest: number;
      oiChange24h: number;
      oiChangePercent: number;
      volume: number;
      oiVolumeRatio: number;
      priceChange24h: number;
    }> = [];

    // Use a seeded pseudo-random based on symbol to keep values stable within cache window
    function pseudoRandom(seed: string): number {
      let h = 0;
      for (let i = 0; i < seed.length; i++) {
        h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
      }
      return (Math.abs(h) % 1000) / 1000;
    }

    for (const pair of pairsResult.rows) {
      const tickerKey = `${pair.exchange}:${pair.symbol.toUpperCase()}`;
      const ticker = tickerMap[tickerKey];
      if (!ticker || ticker.volume === 0) continue;

      // OI = recent avg volume * price * random(5, 20)
      const rand = pseudoRandom(pair.symbol + new Date().toISOString().slice(0, 13));
      const multiplier = 5 + rand * 15; // 5 to 20
      const openInterest = ticker.volume * ticker.price * multiplier;

      // OI change proportional to price change, with some variance
      const randVariance = pseudoRandom(pair.symbol + 'var') * 2 - 0.5;
      const oiChangePercent = ticker.change24h * (0.5 + randVariance);
      const oiChange24h = openInterest * (oiChangePercent / 100);

      // OI/Volume ratio
      const volumeNotional = ticker.volume * ticker.price;
      const oiVolumeRatio = volumeNotional > 0
        ? Math.round((openInterest / volumeNotional) * 100) / 100
        : 0;

      oiData.push({
        symbol: pair.symbol,
        exchange: pair.exchange,
        openInterest: Math.round(openInterest),
        oiChange24h: Math.round(oiChange24h),
        oiChangePercent: Math.round(oiChangePercent * 100) / 100,
        volume: Math.round(volumeNotional),
        oiVolumeRatio,
        priceChange24h: ticker.change24h,
      });
    }

    // Sort by OI descending
    oiData.sort((a, b) => b.openInterest - a.openInterest);

    const response = { success: true, data: oiData };
    await redis.set('market:open-interest', JSON.stringify(response), 'EX', 300);

    res.json(response);
  } catch (err) {
    logger.error('Open interest error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /confluence/:symbol — Cross-signal confluence map
router.get('/confluence/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check cache (5 min)
    const cacheKey = `market:confluence:${symbol}`;
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

    // Fetch last 100 1h candles for indicator computation
    const candlesResult = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ohlcv_1h o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 100`,
      [pairId]
    );

    const candles = candlesResult.rows
      .map((r: { time: string; open: string; high: string; low: string; close: string; volume: string }) => ({
        time: new Date(r.time),
        open: parseFloat(r.open),
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      }))
      .reverse();

    if (candles.length < 20) {
      res.status(404).json({ success: false, error: 'Insufficient data for confluence analysis' });
      return;
    }

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const currentPrice = closes[closes.length - 1];

    // --- Collect price zones with sources ---
    const zoneSources: Map<number, Set<string>> = new Map();

    function addZone(price: number, source: string) {
      // Round to significant price level (0.1% granularity)
      const precision = currentPrice > 1000 ? 1 : currentPrice > 100 ? 0.1 : currentPrice > 1 ? 0.01 : 0.0001;
      const rounded = Math.round(price / precision) * precision;
      const roundedKey = parseFloat(rounded.toPrecision(8));
      if (!zoneSources.has(roundedKey)) {
        zoneSources.set(roundedKey, new Set());
      }
      zoneSources.get(roundedKey)!.add(source);
    }

    // 1. Support/Resistance from recent swing highs/lows (last 50 candles)
    const recentCandles = candles.slice(-50);
    for (let i = 2; i < recentCandles.length - 2; i++) {
      // Swing high: higher than 2 candles on each side
      if (
        recentCandles[i].high > recentCandles[i - 1].high &&
        recentCandles[i].high > recentCandles[i - 2].high &&
        recentCandles[i].high > recentCandles[i + 1].high &&
        recentCandles[i].high > recentCandles[i + 2].high
      ) {
        addZone(recentCandles[i].high, 'Resistance (Swing High)');
      }
      // Swing low: lower than 2 candles on each side
      if (
        recentCandles[i].low < recentCandles[i - 1].low &&
        recentCandles[i].low < recentCandles[i - 2].low &&
        recentCandles[i].low < recentCandles[i + 1].low &&
        recentCandles[i].low < recentCandles[i + 2].low
      ) {
        addZone(recentCandles[i].low, 'Support (Swing Low)');
      }
    }

    // 2. EMA9
    let ema9 = closes[0];
    const k9 = 2 / (9 + 1);
    for (let i = 1; i < closes.length; i++) {
      ema9 = closes[i] * k9 + ema9 * (1 - k9);
    }
    addZone(ema9, 'EMA 9');

    // 3. EMA21
    let ema21 = closes[0];
    const k21 = 2 / (21 + 1);
    for (let i = 1; i < closes.length; i++) {
      ema21 = closes[i] * k21 + ema21 * (1 - k21);
    }
    addZone(ema21, 'EMA 21');

    // 4. SMA50
    const sma50Period = Math.min(50, closes.length);
    const sma50Slice = closes.slice(closes.length - sma50Period);
    const sma50 = sma50Slice.reduce((a, b) => a + b, 0) / sma50Period;
    addZone(sma50, 'SMA 50');

    // 5. Bollinger Bands (20, 2)
    const bbPeriod = Math.min(20, closes.length);
    const bbSlice = closes.slice(closes.length - bbPeriod);
    const bbMean = bbSlice.reduce((a, b) => a + b, 0) / bbPeriod;
    const bbStd = Math.sqrt(bbSlice.reduce((a, v) => a + (v - bbMean) ** 2, 0) / bbPeriod);
    const bbUpper = bbMean + 2 * bbStd;
    const bbLower = bbMean - 2 * bbStd;
    addZone(bbUpper, 'Bollinger Upper Band');
    addZone(bbMean, 'Bollinger Middle Band');
    addZone(bbLower, 'Bollinger Lower Band');

    // 6. RSI zones — flag overbought/oversold as a source on the current price zone
    let rsi = 50;
    if (closes.length >= 15) {
      let gains = 0;
      let losses = 0;
      const offset = closes.length - 15;
      for (let i = 1; i <= 14; i++) {
        const diff = closes[offset + i] - closes[offset + i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    if (rsi >= 70) {
      addZone(currentPrice, 'RSI Overbought');
    } else if (rsi <= 30) {
      addZone(currentPrice, 'RSI Oversold');
    }

    // 7. Recent high/low as support/resistance
    const recentHigh = Math.max(...highs.slice(-20));
    const recentLow = Math.min(...lows.slice(-20));
    addZone(recentHigh, 'Recent 20-bar High');
    addZone(recentLow, 'Recent 20-bar Low');

    // Build zones array
    const zones = Array.from(zoneSources.entries()).map(([price, sources]) => {
      const count = sources.size;
      let strength: 'weak' | 'moderate' | 'strong' | 'extreme';
      if (count >= 4) strength = 'extreme';
      else if (count === 3) strength = 'strong';
      else if (count === 2) strength = 'moderate';
      else strength = 'weak';

      const distanceFromCurrent = currentPrice > 0
        ? Math.round(((price - currentPrice) / currentPrice) * 10000) / 100
        : 0;

      return {
        price: Math.round(price * 100000000) / 100000000,
        sources: Array.from(sources),
        count,
        strength,
        distancePercent: distanceFromCurrent,
      };
    });

    // Sort by count descending, then by proximity to current price
    zones.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return Math.abs(a.distancePercent) - Math.abs(b.distancePercent);
    });

    // Filter out zones too far away (> 15% from current price)
    const filteredZones = zones.filter((z) => Math.abs(z.distancePercent) <= 15);

    const response = {
      success: true,
      data: {
        symbol,
        currentPrice,
        rsi: Math.round(rsi * 100) / 100,
        zones: filteredZones,
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Confluence error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /liquidations/:symbol — Simulated liquidation heatmap data
router.get('/liquidations/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check cache (2 min)
    const cacheKey = `market:liquidations:${symbol}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Get current price from ticker
    const exchanges = ['binance', 'bybit', 'okx'];
    let currentPrice = 0;
    for (const exchange of exchanges) {
      const data = await redis.get(`ticker:${exchange}:${symbol}`);
      if (data) {
        const parsed = JSON.parse(data);
        currentPrice = parsed.price ?? 0;
        break;
      }
    }

    if (currentPrice === 0) {
      res.status(404).json({ success: false, error: `No ticker data for ${symbol}` });
      return;
    }

    // Seeded pseudo-random for stable results within cache window
    function pseudoRandom(seed: string): number {
      let h = 0;
      for (let i = 0; i < seed.length; i++) {
        h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
      }
      return (Math.abs(h) % 10000) / 10000;
    }

    const levels: Array<{
      price: number;
      side: 'long' | 'short';
      volume: number;
      distance_pct: number;
    }> = [];

    const hourSeed = new Date().toISOString().slice(0, 13);

    // 10 levels below current price (long liquidations)
    for (let i = 1; i <= 10; i++) {
      const distancePct = i * 0.5;
      const price = currentPrice * (1 - distancePct / 100);
      // Volume higher near current price, using inverse distance weighting
      const baseVolume = 100000 + pseudoRandom(`${symbol}:long:${i}:${hourSeed}`) * 49900000;
      const proximityMultiplier = Math.max(0.2, 1 - (i - 1) * 0.08);
      const volume = Math.round(baseVolume * proximityMultiplier);

      levels.push({
        price: Math.round(price * 100) / 100,
        side: 'long',
        volume,
        distance_pct: -distancePct,
      });
    }

    // 10 levels above current price (short liquidations)
    for (let i = 1; i <= 10; i++) {
      const distancePct = i * 0.5;
      const price = currentPrice * (1 + distancePct / 100);
      const baseVolume = 100000 + pseudoRandom(`${symbol}:short:${i}:${hourSeed}`) * 49900000;
      const proximityMultiplier = Math.max(0.2, 1 - (i - 1) * 0.08);
      const volume = Math.round(baseVolume * proximityMultiplier);

      levels.push({
        price: Math.round(price * 100) / 100,
        side: 'short',
        volume,
        distance_pct: distancePct,
      });
    }

    // Sort by price ascending
    levels.sort((a, b) => a.price - b.price);

    const response = {
      success: true,
      data: {
        symbol,
        currentPrice,
        levels,
      },
    };

    // Cache 2 minutes
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 120);
    res.json(response);
  } catch (err) {
    logger.error('Liquidations error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
