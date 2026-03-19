import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import logger from '../config/logger.js';

const router = Router();

// GET /indicators/:symbol — calculate indicators on the fly from OHLCV data
router.get('/indicators/:symbol', async (req: Request, res: Response) => {
  try {
    const { timeframe = '1m', period = '14' } = req.query;
    const symbol = req.params.symbol.toUpperCase();
    const table = `ohlcv_${timeframe}`;
    const p = parseInt(period as string, 10) || 14;

    // Fetch enough candles for calculations
    const limit = Math.max(p * 3, 100);
    const result = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ${table} o
       JOIN trading_pairs tp ON tp.id = o.pair_id
       WHERE tp.symbol = $1
       ORDER BY o.time DESC
       LIMIT $2`,
      [symbol, limit]
    );

    if (result.rows.length < p + 1) {
      res.json({ success: true, data: { rsi: null, ema9: null, ema21: null, sma20: null, message: 'Not enough data' } });
      return;
    }

    const candles = result.rows.reverse();
    const closes = candles.map((c: { close: string }) => parseFloat(c.close));

    // Calculate RSI
    const rsi = calculateRSI(closes, p);

    // Calculate EMAs
    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);
    const sma20 = calculateSMA(closes, 20);

    // Calculate Bollinger Bands
    const bb = calculateBB(closes, 20, 2);

    res.json({
      success: true,
      data: {
        symbol,
        timeframe,
        candles: candles.length,
        current: {
          price: closes[closes.length - 1],
          rsi: rsi.length > 0 ? round(rsi[rsi.length - 1]) : null,
          ema9: ema9.length > 0 ? round(ema9[ema9.length - 1]) : null,
          ema21: ema21.length > 0 ? round(ema21[ema21.length - 1]) : null,
          sma20: sma20.length > 0 ? round(sma20[sma20.length - 1]) : null,
          bb_upper: bb.upper.length > 0 ? round(bb.upper[bb.upper.length - 1]) : null,
          bb_lower: bb.lower.length > 0 ? round(bb.lower[bb.lower.length - 1]) : null,
          bb_middle: bb.middle.length > 0 ? round(bb.middle[bb.middle.length - 1]) : null,
        },
        series: {
          rsi: rsi.slice(-60).map(round),
          ema9: ema9.slice(-60).map(round),
          ema21: ema21.slice(-60).map(round),
        },
      },
    });
  } catch (err) {
    logger.error('Get indicators error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /signals — list signals from DB
router.get('/signals', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT s.id, tp.symbol as pair, e.name as exchange, s.strategy,
              s.type, s.strength, s.entry_price, s.stop_loss, s.tp1, s.tp2, s.tp3,
              s.confidence, s.sources_json, s.reasoning, s.timeframe, s.status,
              s.result_pnl, s.created_at, s.expires_at
       FROM signals s
       JOIN trading_pairs tp ON tp.id = s.pair_id
       JOIN exchanges e ON e.id = s.exchange_id
       ORDER BY s.created_at DESC
       LIMIT 50`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Get signals error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /signals/:id
router.get('/signals/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT s.*, tp.symbol as pair, e.name as exchange
       FROM signals s
       JOIN trading_pairs tp ON tp.id = s.pair_id
       JOIN exchanges e ON e.id = s.exchange_id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Signal not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Get signal error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// --- Helper math functions ---

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function calculateRSI(closes: number[], period: number): number[] {
  if (closes.length < period + 1) return [];
  const rsi: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }

  return rsi;
}

function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  ema.push(sum / period);
  for (let i = period; i < data.length; i++) {
    ema.push(data[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

function calculateSMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const sma: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    sma.push(sum / period);
  }
  return sma;
}

function calculateBB(data: number[], period: number, mult: number) {
  const middle = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < middle.length; i++) {
    const slice = data.slice(i, i + period);
    const mean = middle[i];
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper.push(mean + mult * std);
    lower.push(mean - mult * std);
  }
  return { upper, middle, lower };
}

export default router;
