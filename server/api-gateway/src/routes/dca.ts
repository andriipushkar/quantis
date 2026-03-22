import { Router, Response } from 'express';
import { query } from '../config/database.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Fetch ticker from Redis
async function getTickerPrice(symbol: string): Promise<number | null> {
  const exchanges = ['binance', 'bybit', 'okx'];
  for (const exchange of exchanges) {
    const data = await redis.get(`ticker:${exchange}:${symbol}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return parsed.price ?? null;
      } catch { /* skip */ }
    }
  }
  return null;
}

// GET / — List user's DCA bots
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM dca_bots WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC`,
      [req.user!.id]
    );

    const bots = result.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      userId: r.user_id as string,
      symbol: r.symbol as string,
      baseAmount: parseFloat(r.base_amount as string),
      interval: r.interval as string,
      strategy: r.strategy as string,
      createdAt: (r.created_at as Date).toISOString(),
    }));

    res.json({ success: true, data: bots });
  } catch (err) {
    logger.error('DCA list error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST / — Create bot
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { symbol: rawSymbol, baseAmount, interval, strategy } = req.body;

    if (!rawSymbol || !baseAmount || !interval || !strategy) {
      res.status(400).json({ success: false, error: 'symbol, baseAmount, interval, and strategy are required' });
      return;
    }

    const validIntervals = ['daily', 'weekly'];
    const validStrategies = ['standard', 'rsi_weighted', 'fear_greed'];

    if (!validIntervals.includes(interval)) {
      res.status(400).json({ success: false, error: 'interval must be "daily" or "weekly"' });
      return;
    }

    if (!validStrategies.includes(strategy)) {
      res.status(400).json({ success: false, error: 'strategy must be "standard", "rsi_weighted", or "fear_greed"' });
      return;
    }

    const amount = parseFloat(baseAmount);
    if (isNaN(amount) || amount <= 0) {
      res.status(400).json({ success: false, error: 'baseAmount must be a positive number' });
      return;
    }

    const symbol = rawSymbol.toUpperCase();

    const result = await query(
      `INSERT INTO dca_bots (user_id, symbol, base_amount, interval, strategy)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user!.id, symbol, amount, interval, strategy]
    );

    const r = result.rows[0];
    res.json({
      success: true,
      data: {
        id: r.id,
        userId: r.user_id,
        symbol: r.symbol,
        baseAmount: parseFloat(r.base_amount),
        interval: r.interval,
        strategy: r.strategy,
        createdAt: r.created_at.toISOString(),
      },
    });
  } catch (err) {
    logger.error('DCA create error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /:id — Delete bot
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `UPDATE dca_bots SET is_active = false WHERE id = $1 AND user_id = $2 AND is_active = true RETURNING id`,
      [req.params.id, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Bot not found' });
      return;
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    logger.error('DCA delete error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /:id/simulate — Simulate performance over last 30 days
router.get('/:id/simulate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const botResult = await query(
      `SELECT * FROM dca_bots WHERE id = $1 AND user_id = $2 AND is_active = true`,
      [req.params.id, req.user!.id]
    );

    if (botResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Bot not found' });
      return;
    }

    const botRow = botResult.rows[0];
    const bot = {
      id: botRow.id as string,
      symbol: botRow.symbol as string,
      baseAmount: parseFloat(botRow.base_amount as string),
      interval: botRow.interval as string,
      strategy: botRow.strategy as string,
    };

    // Find pair ID
    const pairResult = await query(
      `SELECT tp.id FROM trading_pairs tp
       JOIN exchanges e ON e.id = tp.exchange_id
       WHERE tp.symbol = $1 AND tp.is_active = true
       LIMIT 1`,
      [bot.symbol]
    );

    if (pairResult.rows.length === 0) {
      res.status(404).json({ success: false, error: `No data found for ${bot.symbol}` });
      return;
    }

    const pairId = pairResult.rows[0].id;

    // Fetch daily candles for last 30 days (use 1d if available, else aggregate 1h)
    const dailyResult = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ohlcv_1d o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 30`,
      [pairId]
    );

    let dailyCandles: Array<{ time: string; close: number; volume: number }> = dailyResult.rows.map((r: { time: string; close: string; volume: string }) => ({
      time: r.time,
      close: parseFloat(r.close),
      volume: parseFloat(r.volume),
    })).reverse();

    // Fallback to 1h candles, one per day
    if (dailyCandles.length === 0) {
      const hourlyResult = await query(
        `SELECT DISTINCT ON (DATE(o.time)) o.time, o.close, o.volume
         FROM ohlcv_1h o
         WHERE o.pair_id = $1
         ORDER BY DATE(o.time), o.time DESC
         LIMIT 30`,
        [pairId]
      );
      dailyCandles = hourlyResult.rows.map((r: { time: string; close: string; volume: string }) => ({
        time: r.time,
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      })).reverse();
    }

    if (dailyCandles.length === 0) {
      res.status(404).json({ success: false, error: 'No historical data available for simulation' });
      return;
    }

    // Get Fear & Greed score for fear_greed strategy
    let fearGreedScore = 50;
    if (bot.strategy === 'fear_greed') {
      try {
        const fgData = await redis.get('market:fear_greed');
        if (fgData) {
          const parsed = JSON.parse(fgData);
          fearGreedScore = parsed.score ?? 50;
        }
      } catch { /* use default */ }
    }

    // Compute RSI(14) for rsi_weighted strategy
    const closes = dailyCandles.map((c) => c.close);
    let currentRsi = 50;
    if (bot.strategy === 'rsi_weighted' && closes.length >= 15) {
      let gains = 0;
      let losses = 0;
      for (let i = closes.length - 14; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      currentRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    // Simulate purchases
    const purchases: Array<{ date: string; amount: number; price: number; quantity: number }> = [];
    let totalInvested = 0;
    let totalQuantity = 0;

    const step = bot.interval === 'weekly' ? 7 : 1;

    for (let i = 0; i < dailyCandles.length; i += step) {
      const candle = dailyCandles[i];
      let amount = bot.baseAmount;

      if (bot.strategy === 'rsi_weighted') {
        // Recalculate RSI at each point if possible
        if (i >= 14) {
          let g = 0, l = 0;
          for (let j = i - 13; j <= i; j++) {
            const diff = closes[j] - closes[j - 1];
            if (diff > 0) g += diff;
            else l += Math.abs(diff);
          }
          const ag = g / 14;
          const al = l / 14;
          const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
          amount = bot.baseAmount * (2 - rsi / 50);
        } else {
          amount = bot.baseAmount * (2 - currentRsi / 50);
        }
      } else if (bot.strategy === 'fear_greed') {
        amount = bot.baseAmount * (2 - fearGreedScore / 50);
      }

      // Ensure amount is at least 1
      amount = Math.max(1, amount);
      const quantity = amount / candle.close;

      purchases.push({
        date: candle.time,
        amount: Math.round(amount * 100) / 100,
        price: candle.close,
        quantity,
      });

      totalInvested += amount;
      totalQuantity += quantity;
    }

    // Current value
    const currentPrice = await getTickerPrice(bot.symbol);
    const lastPrice = currentPrice ?? (dailyCandles.length > 0 ? dailyCandles[dailyCandles.length - 1].close : 0);
    const currentValue = totalQuantity * lastPrice;
    const roi = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

    res.json({
      success: true,
      data: {
        botId: bot.id,
        symbol: bot.symbol,
        strategy: bot.strategy,
        totalInvested: Math.round(totalInvested * 100) / 100,
        currentValue: Math.round(currentValue * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        avgBuyPrice: totalQuantity > 0 ? Math.round((totalInvested / totalQuantity) * 100) / 100 : 0,
        purchases,
      },
    });
  } catch (err) {
    logger.error('DCA simulate error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
