import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import redis from '../../config/redis.js';
import logger from '../../config/logger.js';
import { getAllTickers } from '../../utils/ticker-cache.js';

const router = Router();

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

    // Fetch tickers from shared cache
    const allTickers = await getAllTickers();
    const tickerMap: Record<string, { price: number; change24h: number; volume: number; timestamp?: number }> = {};
    for (const [key, entry] of allTickers) {
      tickerMap[key] = {
        price: entry.price,
        change24h: entry.change24h,
        volume: entry.volume,
        timestamp: entry.timestamp,
      };
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
      const rsiDistance = rsi - 50;
      let rate = (rsiDistance / 50) * 0.1; // max +/-0.1%
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

    // Fetch tickers from shared cache
    const allTickersOI = await getAllTickers();
    const tickerMap: Record<string, { price: number; change24h: number; volume: number }> = {};
    for (const [key, entry] of allTickersOI) {
      tickerMap[key] = {
        price: entry.price,
        change24h: entry.change24h,
        volume: entry.volume,
      };
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

// GET /orderflow/:symbol — Simulated order flow / footprint data
router.get('/orderflow/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check cache (2 min)
    const cacheKey = `market:orderflow:${symbol}`;
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

    // Fetch last 20 candles
    const candlesResult = await query(
      `SELECT o.time, o.open, o.high, o.low, o.close, o.volume
       FROM ohlcv_1m o
       WHERE o.pair_id = $1
       ORDER BY o.time DESC
       LIMIT 20`,
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

    if (candles.length === 0) {
      res.json({
        success: true,
        data: { symbol, candles: [], cumulativeDelta: [], summary: { totalBuys: 0, totalSells: 0, netDelta: 0, dominantSide: 'neutral' } },
      });
      return;
    }

    // Seeded pseudo-random for stable results
    function pseudoRandom(seed: string): number {
      let h = 0;
      for (let i = 0; i < seed.length; i++) {
        h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
      }
      return (Math.abs(h) % 10000) / 10000;
    }

    const hourSeed = new Date().toISOString().slice(0, 16); // changes every minute
    let totalBuys = 0;
    let totalSells = 0;
    let cumDelta = 0;
    const cumulativeDelta: number[] = [];

    const footprintCandles = candles.map((c, ci) => {
      const range = c.high - c.low;
      const levels: Array<{ price: number; buyVol: number; sellVol: number; delta: number }> = [];

      if (range === 0) {
        // Single level
        const buyVol = Math.round(c.volume * 0.5);
        const sellVol = Math.round(c.volume * 0.5);
        levels.push({ price: Math.round(c.close * 100) / 100, buyVol, sellVol, delta: buyVol - sellVol });
        cumDelta += buyVol - sellVol;
        totalBuys += buyVol;
        totalSells += sellVol;
      } else {
        // Split into 5 price levels
        const step = range / 5;
        const closePosition = (c.close - c.low) / range; // 0 = at low, 1 = at high

        for (let lvl = 0; lvl < 5; lvl++) {
          const levelPrice = c.low + step * (lvl + 0.5);
          const levelPosition = (lvl + 0.5) / 5; // 0-1

          const isBullish = c.close > c.open;
          const rand = pseudoRandom(`${symbol}:${ci}:${lvl}:${hourSeed}`);

          // Base allocation per level
          const baseVol = c.volume / 5;
          let buyRatio: number;

          if (isBullish) {
            buyRatio = 0.4 + closePosition * 0.3 - levelPosition * 0.15 + rand * 0.15;
          } else {
            buyRatio = 0.3 + (1 - closePosition) * 0.15 - (1 - levelPosition) * 0.1 + rand * 0.15;
          }

          buyRatio = Math.max(0.1, Math.min(0.9, buyRatio));
          const buyVol = Math.round(baseVol * buyRatio);
          const sellVol = Math.round(baseVol * (1 - buyRatio));
          const delta = buyVol - sellVol;

          totalBuys += buyVol;
          totalSells += sellVol;
          cumDelta += delta;

          levels.push({
            price: Math.round(levelPrice * 100) / 100,
            buyVol,
            sellVol,
            delta,
          });
        }
      }

      cumulativeDelta.push(Math.round(cumDelta));

      return {
        time: c.time,
        levels,
      };
    });

    const netDelta = totalBuys - totalSells;
    const dominantSide = netDelta > totalBuys * 0.05 ? 'buyers' : netDelta < -totalSells * 0.05 ? 'sellers' : 'neutral';

    const response = {
      success: true,
      data: {
        symbol,
        candles: footprintCandles,
        cumulativeDelta,
        summary: {
          totalBuys: Math.round(totalBuys),
          totalSells: Math.round(totalSells),
          netDelta: Math.round(netDelta),
          dominantSide,
        },
      },
    };

    // Cache 2 minutes
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 120);
    res.json(response);
  } catch (err) {
    logger.error('Order flow error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /options/:symbol — Simulated options chain data
router.get('/options/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // Check cache (5 min)
    const cacheKey = `market:options:${symbol}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Get current price from Redis ticker
    let currentPrice = 0;
    const exchanges = ['binance', 'bybit', 'okx'];
    for (const exchange of exchanges) {
      const data = await redis.get(`ticker:${exchange}:${symbol}`);
      if (data) {
        const parsed = JSON.parse(data);
        currentPrice = parsed.price ?? 0;
        break;
      }
    }

    if (currentPrice === 0) {
      // Fallback prices
      const fallbacks: Record<string, number> = {
        BTCUSDT: 97500,
        ETHUSDT: 3450,
        SOLUSDT: 178,
        BNBUSDT: 620,
      };
      currentPrice = fallbacks[symbol] || 100;
    }

    // Generate expiry date (next Friday)
    const now = new Date();
    const daysUntilFriday = (5 - now.getUTCDay() + 7) % 7 || 7;
    const expiry = new Date(now.getTime() + daysUntilFriday * 86400000);
    const expiryDate = expiry.toISOString().split('T')[0];
    const daysToExpiry = daysUntilFriday;
    const T = daysToExpiry / 365;

    // Generate 5 strikes above and 5 below, spaced ~2% apart
    const spacing = currentPrice * 0.02;
    const roundTo = currentPrice > 10000 ? 500 : currentPrice > 1000 ? 50 : currentPrice > 100 ? 5 : 1;
    const atmStrike = Math.round(currentPrice / roundTo) * roundTo;

    const chain: Array<{
      strike: number;
      callPrice: number;
      putPrice: number;
      callIV: number;
      putIV: number;
      callDelta: number;
      putDelta: number;
      callGamma: number;
      callTheta: number;
      callOI: number;
      putOI: number;
      callVolume: number;
      putVolume: number;
    }> = [];

    for (let i = -5; i <= 5; i++) {
      const strike = atmStrike + i * Math.round(spacing / roundTo) * roundTo;
      const moneyness = (strike - currentPrice) / currentPrice;
      const absMoneyness = Math.abs(moneyness);

      // IV smile: higher at extremes, lower at ATM
      const baseIV = 0.45;
      const ivSmile = baseIV + absMoneyness * 1.5;
      const callIV = Math.round((ivSmile + (moneyness > 0 ? 0.02 : -0.01)) * 1000) / 10;
      const putIV = Math.round((ivSmile + (moneyness < 0 ? 0.02 : -0.01)) * 1000) / 10;

      // Simplified Black-Scholes-ish pricing
      const intrinsicCall = Math.max(0, currentPrice - strike);
      const intrinsicPut = Math.max(0, strike - currentPrice);
      const timeValue = currentPrice * ivSmile * Math.sqrt(T) * 0.4;
      const callPrice = Math.round((intrinsicCall + timeValue * Math.max(0.1, 1 - moneyness * 2)) * 100) / 100;
      const putPrice = Math.round((intrinsicPut + timeValue * Math.max(0.1, 1 + moneyness * 2)) * 100) / 100;

      // Delta approximation
      const callDelta = Math.round(Math.max(0.02, Math.min(0.98, 0.5 - moneyness * 3)) * 100) / 100;
      const putDelta = Math.round((callDelta - 1) * 100) / 100;

      // Gamma (highest ATM)
      const callGamma = Math.round(Math.max(0.001, 0.05 * Math.exp(-moneyness * moneyness * 50)) * 10000) / 10000;

      // Theta (negative, higher for ATM)
      const callTheta = -Math.round(Math.max(5, currentPrice * ivSmile * 0.01 / Math.sqrt(T)) * 100) / 100;

      // OI and Volume (higher near ATM)
      const oiMultiplier = Math.max(0.2, Math.exp(-absMoneyness * absMoneyness * 30));
      const baseOI = 5000;
      const callOI = Math.round(baseOI * oiMultiplier * (1 + Math.random() * 0.3));
      const putOI = Math.round(baseOI * oiMultiplier * 0.8 * (1 + Math.random() * 0.3));
      const callVolume = Math.round(callOI * (0.1 + Math.random() * 0.15));
      const putVolume = Math.round(putOI * (0.1 + Math.random() * 0.15));

      chain.push({
        strike,
        callPrice: Math.max(0.01, callPrice),
        putPrice: Math.max(0.01, putPrice),
        callIV,
        putIV,
        callDelta,
        putDelta,
        callGamma,
        callTheta,
        callOI,
        putOI,
        callVolume,
        putVolume,
      });
    }

    // Calculate Max Pain: strike where total losses for option holders are maximized
    let maxPainStrike = atmStrike;
    let maxPainValue = Infinity;
    for (const row of chain) {
      let totalPain = 0;
      for (const other of chain) {
        if (row.strike > other.strike) {
          totalPain += other.callOI * (row.strike - other.strike);
        }
        if (row.strike < other.strike) {
          totalPain += other.putOI * (other.strike - row.strike);
        }
      }
      if (totalPain < maxPainValue) {
        maxPainValue = totalPain;
        maxPainStrike = row.strike;
      }
    }

    // Put/Call ratio from total OI
    const totalCallOI = chain.reduce((s, r) => s + r.callOI, 0);
    const totalPutOI = chain.reduce((s, r) => s + r.putOI, 0);
    const putCallRatio = Math.round((totalPutOI / Math.max(1, totalCallOI)) * 100) / 100;

    const response = {
      success: true,
      data: {
        symbol,
        currentPrice,
        expiryDate,
        chain,
        maxPain: maxPainStrike,
        putCallRatio,
      },
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
    res.json(response);
  } catch (err) {
    logger.error('Options chain error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
