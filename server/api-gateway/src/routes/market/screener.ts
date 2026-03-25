import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import logger from '../../config/logger.js';
import { getAllTickers } from '../../utils/ticker-cache.js';

const router = Router();

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

    // 2. Fetch all tickers from shared cache
    const allTickers = await getAllTickers();
    const tickerMap: Record<string, { price: number; change24h: number; volume: number }> = {};
    for (const [key, entry] of allTickers) {
      tickerMap[key] = {
        price: entry.price,
        change24h: entry.change24h,
        volume: entry.volume,
      };
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

      const closes = candlesResult.rows.map((r: { close: string }) => parseFloat(r.close)).reverse();

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

export default router;
