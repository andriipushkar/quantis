import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

// Whitelist of valid timeframe table names to prevent SQL injection
const SAFE_TABLES: Record<string, string> = {
  '1m': 'ohlcv_1m', '5m': 'ohlcv_5m', '15m': 'ohlcv_15m',
  '1h': 'ohlcv_1h', '4h': 'ohlcv_4h', '1d': 'ohlcv_1d',
};

const router = Router();

// GET /indicators/:symbol — calculate indicators on the fly from OHLCV data
router.get('/indicators/:symbol', async (req: Request, res: Response) => {
  try {
    const { timeframe = '1m', period = '14' } = req.query;
    const symbol = req.params.symbol.toUpperCase();
    const table = SAFE_TABLES[timeframe as string];
    if (!table) {
      res.status(400).json({ success: false, error: 'Invalid timeframe', validTimeframes: Object.keys(SAFE_TABLES) });
      return;
    }
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
    const table = SAFE_TABLES[timeframe as string];
    if (!table) {
      res.status(400).json({ success: false, error: 'Invalid timeframe', validTimeframes: Object.keys(SAFE_TABLES) });
      return;
    }

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

// GET /elliott/:symbol — Simplified Elliott Wave auto-count
router.get('/elliott/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { timeframe = '1h' } = req.query;
    const table = SAFE_TABLES[timeframe as string];
    if (!table) {
      res.status(400).json({ success: false, error: 'Invalid timeframe', validTimeframes: Object.keys(SAFE_TABLES) });
      return;
    }

    // Check cache (5 min)
    const cacheKey = `analysis:elliott:${symbol}:${timeframe}`;
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

    // Fetch last 100 candles
    const candlesResult = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ${table} o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 100`,
      [pairId]
    );

    const candles = candlesResult.rows
      .map((r: { time: string; open: string; high: string; low: string; close: string; volume: string }) => ({
        time: new Date(r.time).toISOString(),
        open: parseFloat(r.open),
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      }))
      .reverse();

    if (candles.length < 20) {
      res.json({ success: true, data: { symbol, waves: [], pattern: 'none', confidence: 0, description: 'Insufficient data', fibTargets: {} } });
      return;
    }

    // Find swing highs and lows (5-bar window)
    interface SwingPoint {
      type: 'high' | 'low';
      price: number;
      index: number;
      time: string;
    }

    const swings: SwingPoint[] = [];
    for (let i = 2; i < candles.length - 2; i++) {
      const isHigh = candles[i].high > candles[i - 1].high &&
        candles[i].high > candles[i - 2].high &&
        candles[i].high > candles[i + 1].high &&
        candles[i].high > candles[i + 2].high;
      const isLow = candles[i].low < candles[i - 1].low &&
        candles[i].low < candles[i - 2].low &&
        candles[i].low < candles[i + 1].low &&
        candles[i].low < candles[i + 2].low;

      if (isHigh) swings.push({ type: 'high', price: candles[i].high, index: i, time: candles[i].time });
      if (isLow) swings.push({ type: 'low', price: candles[i].low, index: i, time: candles[i].time });
    }

    // Deduplicate consecutive same-type swings (keep the most extreme)
    const filteredSwings: SwingPoint[] = [];
    for (let i = 0; i < swings.length; i++) {
      if (filteredSwings.length === 0 || filteredSwings[filteredSwings.length - 1].type !== swings[i].type) {
        filteredSwings.push(swings[i]);
      } else {
        const last = filteredSwings[filteredSwings.length - 1];
        if (swings[i].type === 'high' && swings[i].price > last.price) {
          filteredSwings[filteredSwings.length - 1] = swings[i];
        } else if (swings[i].type === 'low' && swings[i].price < last.price) {
          filteredSwings[filteredSwings.length - 1] = swings[i];
        }
      }
    }

    interface WavePoint {
      label: string;
      price: number;
      index: number;
      time: string;
    }

    let waves: WavePoint[] = [];
    let pattern: 'impulse' | 'correction' | 'none' = 'none';
    let confidence = 0;
    let description = 'No clear Elliott Wave pattern detected.';
    let fibTargets: { wave3Target?: number; wave5Target?: number } = {};

    // Try to fit 5-wave impulse pattern
    // Need alternating low-high-low-high-low-high-low-high-low-high (start from a low: 0-1-2-3-4-5)
    for (let s = 0; s < filteredSwings.length - 8; s++) {
      // Find a starting low
      if (filteredSwings[s].type !== 'low') continue;

      const w0 = filteredSwings[s];     // Start
      const w1 = filteredSwings[s + 1]; // Wave 1 top (high)
      const w2 = filteredSwings[s + 2]; // Wave 2 bottom (low)
      const w3 = filteredSwings[s + 3]; // Wave 3 top (high)
      const w4 = filteredSwings[s + 4]; // Wave 4 bottom (low)
      const w5 = filteredSwings[s + 5]; // Wave 5 top (high)

      if (w1.type !== 'high' || w2.type !== 'low' || w3.type !== 'high' || w4.type !== 'low' || w5.type !== 'high') continue;

      const wave1Len = w1.price - w0.price;
      const wave2Retrace = w1.price - w2.price;
      const wave3Len = w3.price - w2.price;
      const wave4Retrace = w3.price - w4.price;
      const wave5Len = w5.price - w4.price;

      // Wave 1 must go up
      if (wave1Len <= 0) continue;
      // Wave 2 must not retrace more than 100% of Wave 1
      if (wave2Retrace <= 0 || wave2Retrace >= wave1Len) continue;
      // Wave 3 must go up and be the longest
      if (wave3Len <= 0) continue;
      if (wave3Len <= wave1Len || wave3Len <= wave5Len) continue;
      // Wave 4 must not go into Wave 1 territory
      if (w4.price <= w1.price) continue;
      // Wave 5 must go up
      if (wave5Len <= 0) continue;

      // Score the fit based on Fibonacci ratios
      let score = 60; // base

      // W2 retraces 50-61.8% of W1
      const w2Ratio = wave2Retrace / wave1Len;
      if (w2Ratio >= 0.382 && w2Ratio <= 0.786) score += 10;
      if (w2Ratio >= 0.5 && w2Ratio <= 0.618) score += 10;

      // W3 ~1.618x W1
      const w3Ratio = wave3Len / wave1Len;
      if (w3Ratio >= 1.3 && w3Ratio <= 2.0) score += 10;
      if (w3Ratio >= 1.5 && w3Ratio <= 1.75) score += 5;

      // W4 retraces 38.2% of W3
      const w4Ratio = wave4Retrace / wave3Len;
      if (w4Ratio >= 0.236 && w4Ratio <= 0.5) score += 5;

      if (score > confidence) {
        confidence = Math.min(95, score);
        pattern = 'impulse';
        waves = [
          { label: '0', price: round(w0.price), index: w0.index, time: w0.time },
          { label: '1', price: round(w1.price), index: w1.index, time: w1.time },
          { label: '2', price: round(w2.price), index: w2.index, time: w2.time },
          { label: '3', price: round(w3.price), index: w3.index, time: w3.time },
          { label: '4', price: round(w4.price), index: w4.index, time: w4.time },
          { label: '5', price: round(w5.price), index: w5.index, time: w5.time },
        ];
        description = `5-wave impulse detected. Wave 3 is ${round(w3Ratio)}x Wave 1. Wave 2 retraces ${round(w2Ratio * 100)}% of Wave 1.`;
        fibTargets = {
          wave3Target: round(w2.price + wave1Len * 1.618),
          wave5Target: round(w4.price + wave3Len * 0.618),
        };
      }
    }

    // Try ABC correction if no impulse found
    if (pattern === 'none') {
      for (let s = 0; s < filteredSwings.length - 5; s++) {
        if (filteredSwings[s].type !== 'high') continue;

        const wA0 = filteredSwings[s];     // Start (high)
        const wA = filteredSwings[s + 1];  // A bottom (low)
        const wB = filteredSwings[s + 2];  // B top (high)
        const wC = filteredSwings[s + 3];  // C bottom (low)

        if (wA.type !== 'low' || wB.type !== 'high' || wC.type !== 'low') continue;

        const legA = wA0.price - wA.price;
        const legB = wB.price - wA.price;
        const legC = wB.price - wC.price;

        // A must go down
        if (legA <= 0) continue;
        // B retraces part of A
        const bRetrace = legB / legA;
        if (bRetrace <= 0.2 || bRetrace >= 1.0) continue;
        // C must go down
        if (legC <= 0) continue;

        let score = 55;
        if (bRetrace >= 0.5 && bRetrace <= 0.786) score += 15;
        const cRatio = legC / legA;
        if (cRatio >= 0.618 && cRatio <= 1.618) score += 10;
        if (cRatio >= 0.9 && cRatio <= 1.1) score += 10;

        if (score > confidence) {
          confidence = Math.min(90, score);
          pattern = 'correction';
          waves = [
            { label: 'A', price: round(wA.price), index: wA.index, time: wA.time },
            { label: 'B', price: round(wB.price), index: wB.index, time: wB.time },
            { label: 'C', price: round(wC.price), index: wC.index, time: wC.time },
          ];
          description = `ABC correction detected. B retraces ${round(bRetrace * 100)}% of A. C is ${round(cRatio)}x A.`;
          fibTargets = {
            wave3Target: round(wA.price - legA * 0.618),
          };
        }
      }
    }

    const response = {
      success: true,
      data: {
        symbol,
        waves,
        pattern,
        confidence,
        description,
        fibTargets,
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Elliott Wave error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /harmonics/:symbol — Detect XABCD harmonic patterns
router.get('/harmonics/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { timeframe = '1h' } = req.query;
    const table = SAFE_TABLES[timeframe as string];
    if (!table) {
      res.status(400).json({ success: false, error: 'Invalid timeframe', validTimeframes: Object.keys(SAFE_TABLES) });
      return;
    }

    // Check cache (5 min)
    const cacheKey = `analysis:harmonics:${symbol}:${timeframe}`;
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

    // Fetch last 80 candles
    const candlesResult = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ${table} o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 80`,
      [pairId]
    );

    const candles = candlesResult.rows
      .map((r: { time: string; open: string; high: string; low: string; close: string; volume: string }) => ({
        time: new Date(r.time).toISOString(),
        open: parseFloat(r.open),
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      }))
      .reverse();

    if (candles.length < 15) {
      res.json({ success: true, data: { symbol, patterns: [] } });
      return;
    }

    // Find swing points (5-bar pivots)
    interface SwingPt {
      type: 'high' | 'low';
      price: number;
      index: number;
    }

    const swingPts: SwingPt[] = [];
    for (let i = 2; i < candles.length - 2; i++) {
      const isHigh = candles[i].high > candles[i - 1].high &&
        candles[i].high > candles[i - 2].high &&
        candles[i].high > candles[i + 1].high &&
        candles[i].high > candles[i + 2].high;
      const isLow = candles[i].low < candles[i - 1].low &&
        candles[i].low < candles[i - 2].low &&
        candles[i].low < candles[i + 1].low &&
        candles[i].low < candles[i + 2].low;
      if (isHigh) swingPts.push({ type: 'high', price: candles[i].high, index: i });
      if (isLow) swingPts.push({ type: 'low', price: candles[i].low, index: i });
    }

    // Deduplicate consecutive same-type
    const pivots: SwingPt[] = [];
    for (const pt of swingPts) {
      if (pivots.length === 0 || pivots[pivots.length - 1].type !== pt.type) {
        pivots.push(pt);
      } else {
        const last = pivots[pivots.length - 1];
        if (pt.type === 'high' && pt.price > last.price) pivots[pivots.length - 1] = pt;
        else if (pt.type === 'low' && pt.price < last.price) pivots[pivots.length - 1] = pt;
      }
    }

    // Harmonic pattern definitions
    const harmonicDefs = [
      { name: 'Gartley', bRange: [0.568, 0.668], dRange: [0.736, 0.836] },
      { name: 'Butterfly', bRange: [0.736, 0.836], dRange: [1.22, 1.32] },
      { name: 'Bat', bRange: [0.332, 0.55], dRange: [0.836, 0.936] },
      { name: 'Crab', bRange: [0.332, 0.668], dRange: [1.568, 1.668] },
    ];

    interface HarmonicPattern {
      name: string;
      type: 'bullish' | 'bearish';
      points: { X: { price: number; index: number }; A: { price: number; index: number }; B: { price: number; index: number }; C: { price: number; index: number }; D: { price: number; index: number } };
      ratios: { AB_XA: number; BC_AB: number; CD_BC: number; AD_XA: number };
      confidence: number;
      prz: { low: number; high: number };
      description: string;
    }

    const patterns: HarmonicPattern[] = [];

    for (let i = 0; i < pivots.length - 4; i++) {
      const X = pivots[i];
      const A = pivots[i + 1];
      const B = pivots[i + 2];
      const C = pivots[i + 3];
      const D = pivots[i + 4];

      const XA = Math.abs(A.price - X.price);
      if (XA === 0) continue;
      const AB = Math.abs(B.price - A.price);
      const BC = Math.abs(C.price - B.price);
      const CD = Math.abs(D.price - C.price);
      const AD = Math.abs(D.price - A.price);

      const abXaRatio = AB / XA;
      const bcAbRatio = AB > 0 ? BC / AB : 0;
      const cdBcRatio = BC > 0 ? CD / BC : 0;
      const adXaRatio = AD / XA;

      // Determine if bullish or bearish
      const isBullish = X.type === 'low' && A.type === 'high';
      const isBearish = X.type === 'high' && A.type === 'low';

      if (!isBullish && !isBearish) continue;

      for (const def of harmonicDefs) {
        if (abXaRatio >= def.bRange[0] && abXaRatio <= def.bRange[1] &&
            adXaRatio >= def.dRange[0] && adXaRatio <= def.dRange[1]) {
          // Calculate confidence
          const bMid = (def.bRange[0] + def.bRange[1]) / 2;
          const dMid = (def.dRange[0] + def.dRange[1]) / 2;
          const bDev = Math.abs(abXaRatio - bMid) / (def.bRange[1] - def.bRange[0]);
          const dDev = Math.abs(adXaRatio - dMid) / (def.dRange[1] - def.dRange[0]);
          const conf = Math.round(Math.max(40, Math.min(95, 85 - (bDev + dDev) * 30)));

          const przRange = D.price * 0.005;
          patterns.push({
            name: def.name,
            type: isBullish ? 'bullish' : 'bearish',
            points: {
              X: { price: round(X.price), index: X.index },
              A: { price: round(A.price), index: A.index },
              B: { price: round(B.price), index: B.index },
              C: { price: round(C.price), index: C.index },
              D: { price: round(D.price), index: D.index },
            },
            ratios: {
              AB_XA: round(abXaRatio * 1000) / 1000,
              BC_AB: round(bcAbRatio * 1000) / 1000,
              CD_BC: round(cdBcRatio * 1000) / 1000,
              AD_XA: round(adXaRatio * 1000) / 1000,
            },
            confidence: conf,
            prz: { low: round(D.price - przRange), high: round(D.price + przRange) },
            description: `${def.name} ${isBullish ? 'bullish' : 'bearish'} pattern. AB/XA=${round(abXaRatio * 100) / 100}, AD/XA=${round(adXaRatio * 100) / 100}. PRZ near $${round(D.price)}.`,
          });
        }
      }
    }

    // Sort by confidence descending
    patterns.sort((a, b) => b.confidence - a.confidence);

    const response = {
      success: true,
      data: { symbol, patterns: patterns.slice(0, 10) },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Harmonics error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /wyckoff/:symbol — Detect Wyckoff market phase
router.get('/wyckoff/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check cache (5 min)
    const cacheKey = `analysis:wyckoff:${symbol}`;
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

    // Fetch last 200 1m candles
    const candlesResult = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ohlcv_1m o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 200`,
      [pairId]
    );

    const candles = candlesResult.rows
      .map((r: { time: string; open: string; high: string; low: string; close: string; volume: string }) => ({
        time: new Date(r.time).toISOString(),
        open: parseFloat(r.open),
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      }))
      .reverse();

    if (candles.length < 30) {
      res.json({
        success: true,
        data: {
          symbol, phase: 'unknown', confidence: 0,
          description: 'Insufficient data for Wyckoff analysis.',
          events: [], volumeAnalysis: { upVolume: 0, downVolume: 0, ratio: 0 },
          tradingImplication: 'Wait for more data.',
        },
      });
      return;
    }

    // Volume analysis: up vs down volume
    let upVolume = 0;
    let downVolume = 0;
    for (const c of candles) {
      if (c.close >= c.open) upVolume += c.volume;
      else downVolume += c.volume;
    }
    const volumeRatio = downVolume > 0 ? round(upVolume / downVolume * 100) / 100 : 999;

    // Price structure analysis
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);

    const overallHigh = Math.max(...highs);
    const overallLow = Math.min(...lows);
    const range = overallHigh - overallLow;
    const currentPrice = closes[closes.length - 1];

    // Average volume
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

    // Detect events
    interface WyckoffEvent {
      name: string;
      type: string;
      index: number;
      price: number;
    }

    const events: WyckoffEvent[] = [];

    // Selling Climax (SC): sharp drop + high volume spike
    for (let i = 5; i < candles.length; i++) {
      const drop = (candles[i - 5].close - candles[i].close) / candles[i - 5].close;
      if (drop > 0.02 && candles[i].volume > avgVolume * 2) {
        events.push({ name: 'Selling Climax', type: 'SC', index: i, price: round(candles[i].low) });
        break;
      }
    }

    // Automatic Rally (AR): bounce after any SC
    const scEvent = events.find((e) => e.type === 'SC');
    if (scEvent) {
      for (let i = scEvent.index + 1; i < Math.min(scEvent.index + 15, candles.length); i++) {
        const bounce = (candles[i].high - candles[scEvent.index].low) / candles[scEvent.index].low;
        if (bounce > 0.01) {
          events.push({ name: 'Automatic Rally', type: 'AR', index: i, price: round(candles[i].high) });
          break;
        }
      }
    }

    // Spring: false breakout below support with quick recovery
    const supportLevel = overallLow + range * 0.1;
    for (let i = candles.length - 30; i < candles.length - 2; i++) {
      if (i < 0) continue;
      if (candles[i].low < supportLevel && candles[i + 1].close > supportLevel && candles[i + 2].close > supportLevel) {
        events.push({ name: 'Spring', type: 'spring', index: i, price: round(candles[i].low) });
        break;
      }
    }

    // Sign of Strength (SOS): breakout above range with volume
    const resistanceLevel = overallHigh - range * 0.1;
    for (let i = candles.length - 20; i < candles.length; i++) {
      if (i < 0) continue;
      if (candles[i].close > resistanceLevel && candles[i].volume > avgVolume * 1.5) {
        events.push({ name: 'Sign of Strength', type: 'SOS', index: i, price: round(candles[i].close) });
        break;
      }
    }

    // Classify phase
    let phase: string;
    let confidence: number;
    let description: string;
    let tradingImplication: string;

    // Check if price is ranging (within 80% of range middle)
    const midRange = (overallHigh + overallLow) / 2;
    const recentCloses = closes.slice(-20);
    const recentHigh = Math.max(...recentCloses);
    const recentLow = Math.min(...recentCloses);
    const recentRange = recentHigh - recentLow;
    const isRanging = range > 0 ? recentRange / range < 0.5 : false;

    // Check trend direction
    const firstHalf = closes.slice(0, Math.floor(closes.length / 2));
    const secondHalf = closes.slice(Math.floor(closes.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const trendUp = secondAvg > firstAvg * 1.005;
    const trendDown = secondAvg < firstAvg * 0.995;

    if (isRanging && volumeRatio > 1.2 && events.some((e) => e.type === 'spring' || e.type === 'SC')) {
      phase = 'accumulation';
      confidence = Math.min(85, 55 + events.length * 8);
      description = 'Price is consolidating in a range with higher buying volume. Potential accumulation phase before a markup move.';
      tradingImplication = 'Look for spring or sign-of-strength events as entry signals for long positions.';
    } else if (isRanging && volumeRatio < 0.8) {
      phase = 'distribution';
      confidence = Math.min(80, 50 + (1 / volumeRatio) * 10);
      description = 'Price is consolidating with selling pressure dominating. Potential distribution before a markdown move.';
      tradingImplication = 'Exercise caution on long positions. Watch for upthrust failures as potential short signals.';
    } else if (trendUp) {
      phase = 'markup';
      confidence = Math.min(85, 55 + Math.round((secondAvg / firstAvg - 1) * 500));
      description = 'Price is in an uptrend with sustained buying. Markup phase indicates the trend following accumulation.';
      tradingImplication = 'Look for pullbacks to support levels for long entries. Trail stops to protect profits.';
    } else if (trendDown) {
      phase = 'markdown';
      confidence = Math.min(85, 55 + Math.round((1 - secondAvg / firstAvg) * 500));
      description = 'Price is in a downtrend with sustained selling. Markdown phase indicates the trend following distribution.';
      tradingImplication = 'Avoid long positions. Wait for selling climax and signs of accumulation before buying.';
    } else {
      phase = 'accumulation';
      confidence = 40;
      description = 'Market is in a transitional state. No clear Wyckoff phase dominates.';
      tradingImplication = 'Stay on the sidelines or use reduced position sizes until a clearer signal emerges.';
    }

    const response = {
      success: true,
      data: {
        symbol,
        phase,
        confidence,
        description,
        events,
        volumeAnalysis: {
          upVolume: Math.round(upVolume),
          downVolume: Math.round(downVolume),
          ratio: volumeRatio,
        },
        tradingImplication,
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Wyckoff error', { error: (err as Error).message });
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

// ── Decision Confluence Score ──────────────────────────────────────

// GET /confluence/:symbol/history — historical confluence scores for backtesting
router.get('/confluence/:symbol/history', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const hours = Math.min(720, Math.max(1, parseInt(req.query.hours as string, 10) || 24));
    const resolution = (req.query.resolution as string) || 'raw'; // 'raw' | 'hourly'

    let rows;

    if (resolution === 'hourly') {
      // Use the continuous aggregate for longer time ranges
      const result = await query(
        `SELECT bucket as time, avg_score as score, min_score, max_score,
                avg_confidence as confidence,
                avg_trend as trend_score, avg_momentum as momentum_score,
                avg_signals as signals_score, avg_sentiment as sentiment_score,
                avg_volume as volume_score, sample_count
         FROM confluence_hourly
         WHERE symbol = $1 AND bucket >= NOW() - make_interval(hours => $2)
         ORDER BY bucket ASC`,
        [symbol, hours]
      );
      rows = result.rows;
    } else {
      // Raw 60-second resolution (limit to prevent huge payloads)
      const limit = Math.min(1440, hours * 60); // cap at 1440 points (24h of raw data)
      const result = await query(
        `SELECT time, score, label, risk, confidence,
                trend_score, momentum_score, signals_score,
                sentiment_score, volume_score
         FROM confluence_history
         WHERE symbol = $1 AND time >= NOW() - make_interval(hours => $2)
         ORDER BY time ASC
         LIMIT $3`,
        [symbol, hours, limit]
      );
      rows = result.rows;
    }

    // Also fetch matching price data for overlay
    const priceResult = await query(
      `SELECT o.time, o.close as price
       FROM ohlcv_1m o
       JOIN trading_pairs tp ON tp.id = o.pair_id
       WHERE tp.symbol = $1 AND o.time >= NOW() - make_interval(hours => $2)
       ORDER BY o.time ASC`,
      [symbol, hours]
    );

    res.json({
      success: true,
      data: {
        symbol,
        resolution,
        hours,
        scores: rows,
        prices: priceResult.rows,
      },
    });
  } catch (err) {
    logger.error('Confluence history error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /confluence/:symbol — aggregated 1-100 decision score
router.get('/confluence/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Try Redis cache first (computed every 60s by analysis-engine)
    const cached = await redis.get(`confluence:${symbol}`);
    if (cached) {
      res.json({ success: true, data: JSON.parse(cached) });
      return;
    }

    // Cache miss — return 404 with guidance
    res.status(404).json({
      success: false,
      error: `No confluence data for ${symbol}. Score is computed every 60 seconds for active trading pairs.`,
    });
  } catch (err) {
    logger.error('Confluence endpoint error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /confluence — all available confluence scores
router.get('/confluence', async (_req: Request, res: Response) => {
  try {
    // Read all confluence scores from snapshot hash (O(1), no redis.keys)
    const raw = await redis.hgetall('confluence:snapshot');

    if (!raw || Object.keys(raw).length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const scores = Object.values(raw)
      .map((v) => { try { return JSON.parse(v); } catch { return null; } })
      .filter(Boolean)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    res.json({ success: true, data: scores });
  } catch (err) {
    logger.error('Confluence list error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
