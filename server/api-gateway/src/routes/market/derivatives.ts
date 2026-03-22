import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import redis from '../../config/redis.js';
import logger from '../../config/logger.js';
import { getAllTickers } from '../../utils/ticker-cache.js';
import { CircuitBreaker } from '@quantis/shared';

const router = Router();

// ── Circuit Breakers ────────────────────────────────────────────────
const binanceFuturesBreaker = new CircuitBreaker('binance-futures', {
  failureThreshold: 3,
  resetTimeout: 60_000,
  onStateChange: (name, from, to) => {
    logger.warn(`Circuit breaker "${name}" transitioned ${from} → ${to}`);
  },
});

const bybitBreaker = new CircuitBreaker('bybit-derivatives', {
  failureThreshold: 3,
  resetTimeout: 60_000,
  onStateChange: (name, from, to) => {
    logger.warn(`Circuit breaker "${name}" transitioned ${from} → ${to}`);
  },
});

// ── Types ───────────────────────────────────────────────────────────
interface BinancePremiumIndex {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  interestRate: string;
  time: number;
}

interface BinanceOpenInterest {
  symbol: string;
  openInterest: string;
  time: number;
}

interface BybitTickerItem {
  symbol: string;
  lastPrice: string;
  fundingRate: string;
  nextFundingTime: string;
  openInterest: string;
  openInterestValue: string;
  turnover24h: string;
  volume24h: string;
  price24hPcnt: string;
}

interface BybitTickerResponse {
  retCode: number;
  result: {
    category: string;
    list: BybitTickerItem[];
  };
}

interface BybitOIItem {
  openInterest: string;
  timestamp: string;
}

interface BybitOIResponse {
  retCode: number;
  result: {
    symbol: string;
    category: string;
    list: BybitOIItem[];
  };
}

// ── Constants ───────────────────────────────────────────────────────
const BINANCE_FUTURES_BASE = 'https://fapi.binance.com/fapi/v1';
const BYBIT_BASE = 'https://api.bybit.com/v5/market';

const FUNDING_CACHE_TTL = 300;  // 5 minutes
const OI_CACHE_TTL = 120;       // 2 minutes

// Symbols we fetch from futures exchanges (superset of common perps)
const FUTURES_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
];

// ── Utility: fetch with timeout ─────────────────────────────────────
type FetchResponse = Awaited<ReturnType<typeof fetch>>;

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<FetchResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

// ── Fetch Funding Rates ─────────────────────────────────────────────

interface FundingRateData {
  symbol: string;
  exchange: string;
  rate: number;          // e.g. 0.01 means 0.01%
  nextFundingTime: number; // unix ms
}

async function fetchBinanceFundingRates(): Promise<FundingRateData[]> {
  return binanceFuturesBreaker.call(
    async () => {
      const resp = await fetchWithTimeout(`${BINANCE_FUTURES_BASE}/premiumIndex`);
      if (!resp.ok) throw new Error(`Binance premiumIndex ${resp.status}`);
      const data = (await resp.json()) as unknown as BinancePremiumIndex[];

      const symbolSet = new Set(FUTURES_SYMBOLS);
      return data
        .filter((item) => symbolSet.has(item.symbol))
        .map((item) => ({
          symbol: item.symbol,
          exchange: 'binance',
          rate: parseFloat(item.lastFundingRate) * 100, // Convert to percentage
          nextFundingTime: item.nextFundingTime,
        }));
    },
    () => {
      logger.warn('Binance funding rates circuit breaker fallback');
      return [] as FundingRateData[];
    },
  );
}

async function fetchBybitFundingRates(): Promise<FundingRateData[]> {
  return bybitBreaker.call(
    async () => {
      const resp = await fetchWithTimeout(`${BYBIT_BASE}/tickers?category=linear`);
      if (!resp.ok) throw new Error(`Bybit tickers ${resp.status}`);
      const data = (await resp.json()) as unknown as BybitTickerResponse;

      if (data.retCode !== 0) throw new Error(`Bybit retCode ${data.retCode}`);

      const symbolSet = new Set(FUTURES_SYMBOLS);
      return data.result.list
        .filter((item) => symbolSet.has(item.symbol))
        .map((item) => ({
          symbol: item.symbol,
          exchange: 'bybit',
          rate: parseFloat(item.fundingRate) * 100, // Convert to percentage
          nextFundingTime: parseInt(item.nextFundingTime, 10),
        }));
    },
    () => {
      logger.warn('Bybit funding rates circuit breaker fallback');
      return [] as FundingRateData[];
    },
  );
}

// ── Fetch Open Interest ─────────────────────────────────────────────

interface OIData {
  symbol: string;
  exchange: string;
  openInterestContracts: number; // OI in base asset (contracts)
  openInterestUsd: number;       // OI in USD
}

async function fetchBinanceOpenInterest(
  tickerMap: Record<string, { price: number }>,
): Promise<OIData[]> {
  return binanceFuturesBreaker.call(
    async () => {
      // Binance doesn't have a bulk OI endpoint, fetch per-symbol in parallel
      const results = await Promise.allSettled(
        FUTURES_SYMBOLS.map(async (symbol) => {
          const resp = await fetchWithTimeout(
            `${BINANCE_FUTURES_BASE}/openInterest?symbol=${symbol}`,
          );
          if (!resp.ok) throw new Error(`Binance OI ${symbol} ${resp.status}`);
          const data = (await resp.json()) as unknown as BinanceOpenInterest;
          const contracts = parseFloat(data.openInterest);
          const price = tickerMap[symbol]?.price ?? 0;
          return {
            symbol,
            exchange: 'binance' as const,
            openInterestContracts: contracts,
            openInterestUsd: contracts * price,
          };
        }),
      );

      const fulfilled: OIData[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') fulfilled.push(r.value);
      }
      return fulfilled;
    },
    () => {
      logger.warn('Binance open interest circuit breaker fallback');
      return [] as OIData[];
    },
  );
}

async function fetchBybitOpenInterest(
  tickerMap: Record<string, { price: number }>,
): Promise<OIData[]> {
  return bybitBreaker.call(
    async () => {
      // Bybit linear tickers already include OI, but we can also use the dedicated endpoint
      const resp = await fetchWithTimeout(`${BYBIT_BASE}/tickers?category=linear`);
      if (!resp.ok) throw new Error(`Bybit tickers (OI) ${resp.status}`);
      const data = (await resp.json()) as unknown as BybitTickerResponse;
      if (data.retCode !== 0) throw new Error(`Bybit retCode ${data.retCode}`);

      const symbolSet = new Set(FUTURES_SYMBOLS);
      return data.result.list
        .filter((item) => symbolSet.has(item.symbol))
        .map((item) => {
          const contracts = parseFloat(item.openInterest);
          const price = tickerMap[item.symbol]?.price ?? parseFloat(item.lastPrice);
          return {
            symbol: item.symbol,
            exchange: 'bybit',
            openInterestContracts: contracts,
            openInterestUsd: contracts * price,
          };
        });
    },
    () => {
      logger.warn('Bybit open interest circuit breaker fallback');
      return [] as OIData[];
    },
  );
}

// ── Mock Fallback Data (used when all real APIs fail) ───────────────

function generateMockFundingRates(): Array<{
  symbol: string;
  exchange: string;
  rate: number;
  annualized: number;
  nextFunding: string;
  prediction: 'up' | 'down' | 'stable';
}> {
  const now = new Date();
  const hours = now.getUTCHours();
  const nextHour = hours < 8 ? 8 : hours < 16 ? 16 : 24;
  const nextFundingDate = new Date(now);
  nextFundingDate.setUTCHours(nextHour % 24, 0, 0, 0);
  if (nextHour === 24) nextFundingDate.setUTCDate(nextFundingDate.getUTCDate() + 1);

  return FUTURES_SYMBOLS.map((symbol) => {
    // Seeded pseudo-random for stable mock values
    let h = 0;
    for (let i = 0; i < symbol.length; i++) {
      h = ((h << 5) - h + symbol.charCodeAt(i)) | 0;
    }
    const rate = ((Math.abs(h) % 200) - 100) / 10000; // -0.01 to +0.01
    const annualized = Math.round(rate * 3 * 365 * 100) / 100;
    return {
      symbol,
      exchange: 'binance',
      rate: Math.round(rate * 10000) / 10000,
      annualized,
      nextFunding: nextFundingDate.toISOString(),
      prediction: rate > 0.005 ? 'up' as const : rate < -0.005 ? 'down' as const : 'stable' as const,
    };
  });
}

function generateMockOpenInterest(): Array<{
  symbol: string;
  exchange: string;
  openInterest: number;
  oiChange24h: number;
  oiChangePercent: number;
  volume: number;
  oiVolumeRatio: number;
  priceChange24h: number;
}> {
  const baseOIs: Record<string, number> = {
    BTCUSDT: 12_000_000_000,
    ETHUSDT: 6_000_000_000,
    SOLUSDT: 1_500_000_000,
    BNBUSDT: 800_000_000,
    XRPUSDT: 700_000_000,
    DOGEUSDT: 500_000_000,
    ADAUSDT: 400_000_000,
    AVAXUSDT: 350_000_000,
    DOTUSDT: 300_000_000,
    LINKUSDT: 250_000_000,
  };

  return FUTURES_SYMBOLS.map((symbol) => {
    const oi = baseOIs[symbol] ?? 100_000_000;
    return {
      symbol,
      exchange: 'binance',
      openInterest: oi,
      oiChange24h: Math.round(oi * 0.02),
      oiChangePercent: 2.0,
      volume: Math.round(oi * 0.3),
      oiVolumeRatio: 3.33,
      priceChange24h: 0,
    };
  });
}

// ── GET /funding-rates ──────────────────────────────────────────────
router.get('/funding-rates', async (_req: Request, res: Response) => {
  try {
    // Check cache (5 min)
    const cached = await redis.get('market:funding-rates');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Fetch from both exchanges in parallel
    const [binanceRates, bybitRates] = await Promise.all([
      fetchBinanceFundingRates(),
      fetchBybitFundingRates(),
    ]);

    const hasRealData = binanceRates.length > 0 || bybitRates.length > 0;

    if (!hasRealData) {
      // Both APIs failed — serve mock data
      logger.warn('All funding rate APIs failed, serving mock data');
      const mockRates = generateMockFundingRates();
      const response = { success: true, data: mockRates, _mock: true };
      await redis.set('market:funding-rates', JSON.stringify(response), 'EX', 60); // shorter TTL for mock
      res.json(response);
      return;
    }

    // Merge: prefer Binance when both have data; include Bybit-only symbols separately
    const mergedMap = new Map<string, FundingRateData[]>();
    for (const rate of [...binanceRates, ...bybitRates]) {
      const existing = mergedMap.get(rate.symbol) || [];
      existing.push(rate);
      mergedMap.set(rate.symbol, existing);
    }

    // Also fetch tickers for price context
    const allTickers = await getAllTickers();
    const tickerMap: Record<string, { price: number; change24h: number }> = {};
    for (const [key, entry] of allTickers) {
      const symbol = key.split(':')[1];
      if (symbol && !tickerMap[symbol]) {
        tickerMap[symbol] = { price: entry.price, change24h: entry.change24h };
      }
    }

    // Build response in the format the frontend expects
    const rates: Array<{
      symbol: string;
      exchange: string;
      rate: number;
      annualized: number;
      nextFunding: string;
      prediction: 'up' | 'down' | 'stable';
    }> = [];

    for (const [symbol, exchangeRates] of mergedMap) {
      for (const er of exchangeRates) {
        // Annualized: 3 funding periods per day * 365
        const annualized = Math.round(er.rate * 3 * 365 * 100) / 100;

        // Prediction based on rate magnitude and direction
        const prediction: 'up' | 'down' | 'stable' =
          er.rate > 0.015 ? 'up' :
          er.rate < -0.015 ? 'down' :
          'stable';

        rates.push({
          symbol,
          exchange: er.exchange,
          rate: Math.round(er.rate * 10000) / 10000,
          annualized,
          nextFunding: new Date(er.nextFundingTime).toISOString(),
          prediction,
        });
      }
    }

    // Sort by absolute rate descending
    rates.sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));

    const response = { success: true, data: rates };
    await redis.set('market:funding-rates', JSON.stringify(response), 'EX', FUNDING_CACHE_TTL);

    res.json(response);
  } catch (err) {
    logger.error('Funding rates error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /open-interest ──────────────────────────────────────────────
router.get('/open-interest', async (_req: Request, res: Response) => {
  try {
    // Check cache (2 min)
    const cached = await redis.get('market:open-interest');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Fetch tickers for price data and 24h change
    const allTickers = await getAllTickers();
    const tickerMap: Record<string, { price: number; change24h: number; volume: number }> = {};
    for (const [key, entry] of allTickers) {
      const symbol = key.split(':')[1];
      if (symbol && !tickerMap[symbol]) {
        tickerMap[symbol] = {
          price: entry.price,
          change24h: entry.change24h,
          volume: entry.volume,
        };
      }
    }

    // Fetch OI from both exchanges in parallel
    const [binanceOI, bybitOI] = await Promise.all([
      fetchBinanceOpenInterest(tickerMap),
      fetchBybitOpenInterest(tickerMap),
    ]);

    const hasRealData = binanceOI.length > 0 || bybitOI.length > 0;

    if (!hasRealData) {
      logger.warn('All open interest APIs failed, serving mock data');
      const mockOI = generateMockOpenInterest();
      const response = { success: true, data: mockOI, _mock: true };
      await redis.set('market:open-interest', JSON.stringify(response), 'EX', 60);
      res.json(response);
      return;
    }

    // Try to load previous OI snapshot for 24h change calculation
    const prevSnapshotRaw = await redis.get('market:open-interest:prev-snapshot');
    const prevSnapshot: Record<string, number> = prevSnapshotRaw
      ? JSON.parse(prevSnapshotRaw)
      : {};

    // Aggregate OI per symbol across exchanges
    const oiBySymbol = new Map<string, { totalContracts: number; totalUsd: number; exchanges: string[] }>();
    for (const oi of [...binanceOI, ...bybitOI]) {
      const existing = oiBySymbol.get(oi.symbol) || { totalContracts: 0, totalUsd: 0, exchanges: [] };
      existing.totalContracts += oi.openInterestContracts;
      existing.totalUsd += oi.openInterestUsd;
      existing.exchanges.push(oi.exchange);
      oiBySymbol.set(oi.symbol, existing);
    }

    // Save current snapshot for future 24h change calculation (24h TTL)
    const currentSnapshot: Record<string, number> = {};
    for (const [symbol, data] of oiBySymbol) {
      currentSnapshot[symbol] = data.totalUsd;
    }
    await redis.set(
      'market:open-interest:prev-snapshot',
      JSON.stringify(currentSnapshot),
      'EX',
      86400,
    );

    // Build response
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

    for (const [symbol, data] of oiBySymbol) {
      const ticker = tickerMap[symbol];
      const volumeNotional = ticker ? ticker.volume * ticker.price : 0;

      // Calculate 24h change from previous snapshot
      const prevOi = prevSnapshot[symbol] ?? 0;
      const oiChange24h = prevOi > 0 ? Math.round(data.totalUsd - prevOi) : 0;
      const oiChangePercent = prevOi > 0
        ? Math.round(((data.totalUsd - prevOi) / prevOi) * 10000) / 100
        : 0;

      const oiVolumeRatio = volumeNotional > 0
        ? Math.round((data.totalUsd / volumeNotional) * 100) / 100
        : 0;

      oiData.push({
        symbol,
        exchange: data.exchanges.join('+'), // e.g. "binance+bybit"
        openInterest: Math.round(data.totalUsd),
        oiChange24h,
        oiChangePercent,
        volume: Math.round(volumeNotional),
        oiVolumeRatio,
        priceChange24h: ticker?.change24h ?? 0,
      });
    }

    // Sort by OI descending
    oiData.sort((a, b) => b.openInterest - a.openInterest);

    const response = { success: true, data: oiData };
    await redis.set('market:open-interest', JSON.stringify(response), 'EX', OI_CACHE_TTL);

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

    const footprintCandles = candles.map((c: { time: string; open: number; high: number; low: number; close: number; volume: number }, ci: number) => {
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
