import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import redis from '../../config/redis.js';
import logger from '../../config/logger.js';

const router = Router();

// --- Narrative sector mappings ---
const NARRATIVE_SECTORS: Record<string, string[]> = {
  'AI & ML': ['LINKUSDT', 'DOTUSDT'],
  'Layer 1': ['ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'ADAUSDT'],
  'Meme': ['DOGEUSDT'],
  'DeFi': ['LINKUSDT'],
  'Exchange': ['BNBUSDT'],
  'Payments': ['XRPUSDT'],
};

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

    // Volume trend (weight 20%)
    const avgChange = changes.length > 0
      ? changes.reduce((a, b) => a + b, 0) / changes.length
      : 0;
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
      const momentumScore = Math.max(0, Math.min(100, (avgChange + 10) * 5));
      const volumeScore = Math.min(100, (avgVolume / 1e9) * 50);
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

export default router;
