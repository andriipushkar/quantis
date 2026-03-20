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

// GET /patterns/:symbol — Detect chart patterns from candle data
router.get('/patterns/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { timeframe = '1h' } = req.query;
    const table = `ohlcv_${timeframe}`;

    // Fetch pair
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

    // Fetch last 50 candles
    const candlesResult = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ${table} o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 50`,
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

    if (candles.length < 10) {
      res.json({ success: true, data: { symbol, timeframe, patterns: [] } });
      return;
    }

    interface PatternResult {
      name: string;
      type: 'bullish' | 'bearish' | 'neutral';
      confidence: number;
      index: number;
      description: string;
    }

    const patterns: PatternResult[] = [];

    // --- Double Top: two similar highs with valley between ---
    for (let i = 4; i < candles.length - 1; i++) {
      // Look for two peaks within 2% of each other
      for (let j = i + 3; j < Math.min(i + 20, candles.length); j++) {
        const peak1 = candles[i].high;
        const peak2 = candles[j].high;
        const diff = Math.abs(peak1 - peak2) / peak1;
        if (diff < 0.02) {
          // Check valley between
          let minBetween = Infinity;
          for (let k = i + 1; k < j; k++) {
            minBetween = Math.min(minBetween, candles[k].low);
          }
          const dropFromPeak = (peak1 - minBetween) / peak1;
          if (dropFromPeak > 0.01) {
            const conf = Math.min(90, Math.round(60 + (1 - diff / 0.02) * 30));
            patterns.push({
              name: 'Double Top',
              type: 'bearish',
              confidence: conf,
              index: j,
              description: `Two similar highs at ~$${peak1.toFixed(2)} with a valley between. Potential bearish reversal signal.`,
            });
            break;
          }
        }
      }
    }

    // --- Double Bottom: two similar lows with peak between ---
    for (let i = 4; i < candles.length - 1; i++) {
      for (let j = i + 3; j < Math.min(i + 20, candles.length); j++) {
        const low1 = candles[i].low;
        const low2 = candles[j].low;
        const diff = Math.abs(low1 - low2) / low1;
        if (diff < 0.02) {
          let maxBetween = -Infinity;
          for (let k = i + 1; k < j; k++) {
            maxBetween = Math.max(maxBetween, candles[k].high);
          }
          const riseFromLow = (maxBetween - low1) / low1;
          if (riseFromLow > 0.01) {
            const conf = Math.min(90, Math.round(60 + (1 - diff / 0.02) * 30));
            patterns.push({
              name: 'Double Bottom',
              type: 'bullish',
              confidence: conf,
              index: j,
              description: `Two similar lows at ~$${low1.toFixed(2)} with a peak between. Potential bullish reversal signal.`,
            });
            break;
          }
        }
      }
    }

    // --- Higher Highs / Lower Lows (last 10 candles) ---
    const last10 = candles.slice(-10);
    let hh = 0;
    let ll = 0;
    for (let i = 1; i < last10.length; i++) {
      if (last10[i].high > last10[i - 1].high) hh++;
      if (last10[i].low < last10[i - 1].low) ll++;
    }
    if (hh >= 6) {
      patterns.push({
        name: 'Higher Highs',
        type: 'bullish',
        confidence: Math.min(85, 50 + hh * 5),
        index: candles.length - 1,
        description: `${hh} out of last 9 candles made higher highs, indicating a strong uptrend structure.`,
      });
    }
    if (ll >= 6) {
      patterns.push({
        name: 'Lower Lows',
        type: 'bearish',
        confidence: Math.min(85, 50 + ll * 5),
        index: candles.length - 1,
        description: `${ll} out of last 9 candles made lower lows, indicating a strong downtrend structure.`,
      });
    }

    // --- Single candle patterns on last 5 candles ---
    for (let i = Math.max(0, candles.length - 5); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;

      // Doji: open ~ close (body within 0.1% of range)
      if (range > 0 && body / range < 0.1) {
        patterns.push({
          name: 'Doji',
          type: 'neutral',
          confidence: Math.round(60 + (1 - body / range / 0.1) * 25),
          index: i,
          description: 'Open and close are nearly equal, signaling indecision. Watch for confirmation in next candles.',
        });
      }

      // Hammer: small body at top, long lower shadow (> 2x body)
      if (body > 0 && lowerShadow > body * 2 && upperShadow < body * 0.5) {
        patterns.push({
          name: 'Hammer',
          type: 'bullish',
          confidence: Math.round(55 + Math.min(30, (lowerShadow / body - 2) * 10)),
          index: i,
          description: 'Small body at top with long lower shadow. Potential bullish reversal when found in a downtrend.',
        });
      }

      // Engulfing: current body engulfs previous body
      if (i > 0) {
        const prev = candles[i - 1];
        const prevBody = Math.abs(prev.close - prev.open);
        if (body > prevBody && body > 0) {
          // Bullish engulfing: prev bearish, current bullish
          if (prev.close < prev.open && c.close > c.open &&
            c.open <= prev.close && c.close >= prev.open) {
            patterns.push({
              name: 'Bullish Engulfing',
              type: 'bullish',
              confidence: Math.round(60 + Math.min(25, (body / prevBody - 1) * 20)),
              index: i,
              description: 'Current bullish candle fully engulfs previous bearish candle. Strong bullish reversal pattern.',
            });
          }
          // Bearish engulfing: prev bullish, current bearish
          if (prev.close > prev.open && c.close < c.open &&
            c.open >= prev.close && c.close <= prev.open) {
            patterns.push({
              name: 'Bearish Engulfing',
              type: 'bearish',
              confidence: Math.round(60 + Math.min(25, (body / prevBody - 1) * 20)),
              index: i,
              description: 'Current bearish candle fully engulfs previous bullish candle. Strong bearish reversal pattern.',
            });
          }
        }
      }
    }

    // Deduplicate by name+index and sort by index descending
    const seen = new Set<string>();
    const uniquePatterns = patterns.filter((p) => {
      const key = `${p.name}:${p.index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    uniquePatterns.sort((a, b) => b.index - a.index);

    res.json({
      success: true,
      data: {
        symbol,
        timeframe,
        patterns: uniquePatterns,
      },
    });
  } catch (err) {
    logger.error('Pattern detection error', { error: (err as Error).message });
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
