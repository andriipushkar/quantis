import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import redis from '../../config/redis.js';
import logger from '../../config/logger.js';
import { getAllTickers } from '../../utils/ticker-cache.js';
import { CircuitBreaker } from '@quantis/shared';

const router = Router();

// ── Circuit Breakers ────────────────────────────────────────────────
const binanceFuturesBreaker = new CircuitBreaker('binance-futures-arb', {
  failureThreshold: 3,
  resetTimeout: 60_000,
  onStateChange: (name, from, to) => {
    logger.warn(`Circuit breaker "${name}" transitioned ${from} → ${to}`);
  },
});

const bybitBreaker = new CircuitBreaker('bybit-arb', {
  failureThreshold: 3,
  resetTimeout: 60_000,
  onStateChange: (name, from, to) => {
    logger.warn(`Circuit breaker "${name}" transitioned ${from} → ${to}`);
  },
});

// ── Types ───────────────────────────────────────────────────────────
interface CrossExchangeOpportunity {
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  spread_pct: number;
  spread_usd: number;
  estimated_profit_1k: number;
  volume_24h_min: number;
  timestamp: number;
}

interface FundingRateArbitrage {
  symbol: string;
  long_exchange: string;
  short_exchange: string;
  funding_rate_long: number;
  funding_rate_short: number;
  funding_spread: number;
  annualized_return_pct: number;
  next_funding_time: number;
}

interface TriangularLeg {
  pair: string;
  side: 'buy' | 'sell';
  rate: number;
}

interface TriangularOpportunity {
  path: [string, string, string];
  exchange: string;
  profit_pct: number;
  legs: TriangularLeg[];
  timestamp: number;
}

interface BinancePremiumIndex {
  symbol: string;
  lastFundingRate: string;
  nextFundingTime: number;
}

interface BybitTickerItem {
  symbol: string;
  fundingRate: string;
  nextFundingTime: string;
}

interface BybitTickerResponse {
  retCode: number;
  result: {
    category: string;
    list: BybitTickerItem[];
  };
}

// ── Constants ───────────────────────────────────────────────────────
const BINANCE_FUTURES_BASE = 'https://fapi.binance.com/fapi/v1';
const BYBIT_BASE = 'https://api-testnet.bybit.com/v5/market';

const FUNDING_ARB_CACHE_TTL = 60;  // 60 seconds
const CROSS_EXCHANGE_MIN_SPREAD = 0.05; // 0.05%
const CROSS_EXCHANGE_LIMIT = 50;
const TRIANGULAR_MIN_PROFIT = 0.01; // 0.01%

const SUPPORTED_EXCHANGES = ['binance', 'bybit', 'okx'];

// Triangular paths: intermediate coins to test
const TRIANGULAR_INTERMEDIATES = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];

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

// ── GET /arbitrage/cross-exchange ───────────────────────────────────
// Compares spot prices for same pairs across Binance, Bybit, OKX
router.get('/arbitrage/cross-exchange', async (_req: Request, res: Response) => {
  try {
    const tickers = await getAllTickers();

    // Group tickers by symbol across exchanges
    const symbolMap = new Map<string, Array<{ exchange: string; price: number; volume: number }>>();

    for (const [_key, entry] of tickers) {
      if (!SUPPORTED_EXCHANGES.includes(entry.exchange.toLowerCase())) continue;
      if (entry.price <= 0) continue;

      const existing = symbolMap.get(entry.symbol) || [];
      existing.push({
        exchange: entry.exchange.toLowerCase(),
        price: entry.price,
        volume: entry.volume,
      });
      symbolMap.set(entry.symbol, existing);
    }

    const opportunities: CrossExchangeOpportunity[] = [];
    const now = Date.now();

    for (const [symbol, entries] of symbolMap) {
      // Need at least 2 exchanges to compare
      if (entries.length < 2) continue;

      // Find lowest and highest prices
      let lowest = entries[0];
      let highest = entries[0];

      for (const entry of entries) {
        if (entry.price < lowest.price) lowest = entry;
        if (entry.price > highest.price) highest = entry;
      }

      // Skip if same exchange has both best bid/ask
      if (lowest.exchange === highest.exchange) continue;

      const spreadUsd = highest.price - lowest.price;
      const spreadPct = (spreadUsd / lowest.price) * 100;

      if (spreadPct < CROSS_EXCHANGE_MIN_SPREAD) continue;

      const estimatedProfit1k = (spreadPct / 100) * 1000;
      const volumeMin = Math.min(...entries.map((e) => e.volume));

      opportunities.push({
        symbol,
        buy_exchange: lowest.exchange,
        sell_exchange: highest.exchange,
        buy_price: lowest.price,
        sell_price: highest.price,
        spread_pct: Math.round(spreadPct * 10000) / 10000,
        spread_usd: Math.round(spreadUsd * 100) / 100,
        estimated_profit_1k: Math.round(estimatedProfit1k * 100) / 100,
        volume_24h_min: volumeMin,
        timestamp: now,
      });
    }

    // Sort by spread descending, limit to 50
    opportunities.sort((a, b) => b.spread_pct - a.spread_pct);
    const limited = opportunities.slice(0, CROSS_EXCHANGE_LIMIT);

    logger.info(`Cross-exchange arbitrage scan found ${limited.length} opportunities`);

    res.json({ success: true, data: limited });
  } catch (err) {
    logger.error('Cross-exchange arbitrage error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to scan cross-exchange arbitrage' });
  }
});

// ── GET /arbitrage/funding-rate ─────────────────────────────────────
// Finds funding rate arbitrage: long on negative funding, short on positive
router.get('/arbitrage/funding-rate', async (_req: Request, res: Response) => {
  try {
    // Check Redis cache first
    const cached = await redis.get('arb:funding');
    if (cached) {
      const data = JSON.parse(cached) as FundingRateArbitrage[];
      logger.debug('Serving funding rate arbitrage from cache');
      res.json({ success: true, data });
      return;
    }

    // Fetch funding rates from both exchanges in parallel
    const [binanceRates, bybitRates] = await Promise.all([
      fetchBinanceFundingRates(),
      fetchBybitFundingRates(),
    ]);

    // Build a map of symbol → exchange funding rates
    const fundingMap = new Map<string, Array<{ exchange: string; rate: number; nextFundingTime: number }>>();

    for (const entry of [...binanceRates, ...bybitRates]) {
      const existing = fundingMap.get(entry.symbol) || [];
      existing.push({
        exchange: entry.exchange,
        rate: entry.rate,
        nextFundingTime: entry.nextFundingTime,
      });
      fundingMap.set(entry.symbol, existing);
    }

    const opportunities: FundingRateArbitrage[] = [];

    for (const [symbol, entries] of fundingMap) {
      if (entries.length < 2) continue;

      // Find the most negative (best to go long) and most positive (best to short)
      let mostNegative = entries[0];
      let mostPositive = entries[0];

      for (const entry of entries) {
        if (entry.rate < mostNegative.rate) mostNegative = entry;
        if (entry.rate > mostPositive.rate) mostPositive = entry;
      }

      // Only interesting if one is negative and the other is positive,
      // or there is a meaningful spread
      const fundingSpread = mostPositive.rate - mostNegative.rate;
      if (fundingSpread <= 0) continue;

      // Annualized: funding happens 3x/day = 1095x/year
      const annualizedReturn = fundingSpread * 1095;

      opportunities.push({
        symbol,
        long_exchange: mostNegative.exchange,
        short_exchange: mostPositive.exchange,
        funding_rate_long: Math.round(mostNegative.rate * 10000) / 10000,
        funding_rate_short: Math.round(mostPositive.rate * 10000) / 10000,
        funding_spread: Math.round(fundingSpread * 10000) / 10000,
        annualized_return_pct: Math.round(annualizedReturn * 100) / 100,
        next_funding_time: Math.min(mostNegative.nextFundingTime, mostPositive.nextFundingTime),
      });
    }

    // Sort by funding spread descending
    opportunities.sort((a, b) => b.funding_spread - a.funding_spread);

    // Cache for 60 seconds
    await redis.set('arb:funding', JSON.stringify(opportunities), 'EX', FUNDING_ARB_CACHE_TTL);

    logger.info(`Funding rate arbitrage scan found ${opportunities.length} opportunities`);

    res.json({ success: true, data: opportunities });
  } catch (err) {
    logger.error('Funding rate arbitrage error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to scan funding rate arbitrage' });
  }
});

// ── GET /arbitrage/triangular ───────────────────────────────────────
// Finds triangular arbitrage within a single exchange (Binance)
// e.g. USDT → BTC → ETH → USDT
router.get('/arbitrage/triangular', async (_req: Request, res: Response) => {
  try {
    const tickers = await getAllTickers();

    // Build a price lookup for Binance only
    const binancePrices = new Map<string, number>();
    for (const [_key, entry] of tickers) {
      if (entry.exchange.toLowerCase() === 'binance' && entry.price > 0) {
        binancePrices.set(entry.symbol, entry.price);
      }
    }

    const opportunities: TriangularOpportunity[] = [];
    const now = Date.now();

    // Test triangular paths: USDT → A → B → USDT
    for (let i = 0; i < TRIANGULAR_INTERMEDIATES.length; i++) {
      for (let j = 0; j < TRIANGULAR_INTERMEDIATES.length; j++) {
        if (i === j) continue;

        const coinA = TRIANGULAR_INTERMEDIATES[i];
        const coinB = TRIANGULAR_INTERMEDIATES[j];

        // Leg 1: USDT → coinA  (buy coinA with USDT)
        const pairAUsdt = `${coinA}USDT`;
        const priceAUsdt = binancePrices.get(pairAUsdt);
        if (!priceAUsdt) continue;

        // Leg 2: coinA → coinB (trade coinA for coinB)
        // Could be A/B pair or B/A pair
        const pairAB = `${coinA}${coinB}`;
        const pairBA = `${coinB}${coinA}`;
        let leg2Pair: string;
        let leg2Side: 'buy' | 'sell';
        let leg2Rate: number;

        const priceAB = binancePrices.get(pairAB);
        const priceBA = binancePrices.get(pairBA);

        if (priceAB) {
          // Pair is A/B — selling A to get B means we sell at priceAB
          leg2Pair = pairAB;
          leg2Side = 'sell';
          leg2Rate = priceAB;
        } else if (priceBA) {
          // Pair is B/A — buying B/A means we spend A to get B
          leg2Pair = pairBA;
          leg2Side = 'buy';
          leg2Rate = priceBA;
        } else {
          continue; // No direct pair exists
        }

        // Leg 3: coinB → USDT (sell coinB for USDT)
        const pairBUsdt = `${coinB}USDT`;
        const priceBUsdt = binancePrices.get(pairBUsdt);
        if (!priceBUsdt) continue;

        // Calculate round-trip: start with 1 USDT
        // Leg 1: 1 USDT → (1 / priceAUsdt) coinA
        const amountA = 1 / priceAUsdt;

        // Leg 2: convert coinA → coinB
        let amountB: number;
        if (leg2Side === 'sell') {
          // Selling A at price A/B: amountA * priceAB = amountB (in B terms)
          amountB = amountA * leg2Rate;
        } else {
          // Buying B/A: spending amountA of A, get amountA / priceBA of B
          amountB = amountA / leg2Rate;
        }

        // Leg 3: amountB coinB → amountB * priceBUsdt USDT
        const finalUsdt = amountB * priceBUsdt;

        const profitPct = (finalUsdt - 1) * 100;

        if (profitPct < TRIANGULAR_MIN_PROFIT) continue;

        opportunities.push({
          path: [
            `USDT→${coinA}`,
            `${coinA}→${coinB}`,
            `${coinB}→USDT`,
          ] as [string, string, string],
          exchange: 'binance',
          profit_pct: Math.round(profitPct * 10000) / 10000,
          legs: [
            { pair: pairAUsdt, side: 'buy', rate: priceAUsdt },
            { pair: leg2Pair, side: leg2Side, rate: leg2Rate },
            { pair: pairBUsdt, side: 'sell', rate: priceBUsdt },
          ],
          timestamp: now,
        });
      }
    }

    // Sort by profit descending
    opportunities.sort((a, b) => b.profit_pct - a.profit_pct);

    logger.info(`Triangular arbitrage scan found ${opportunities.length} opportunities`);

    res.json({ success: true, data: opportunities });
  } catch (err) {
    logger.error('Triangular arbitrage error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to scan triangular arbitrage' });
  }
});

// ── Helper: Fetch funding rates from exchanges ─────────────────────

interface FundingRateEntry {
  symbol: string;
  exchange: string;
  rate: number;
  nextFundingTime: number;
}

async function fetchBinanceFundingRates(): Promise<FundingRateEntry[]> {
  return binanceFuturesBreaker.call(
    async () => {
      const resp = await fetchWithTimeout(`${BINANCE_FUTURES_BASE}/premiumIndex`);
      if (!resp.ok) throw new Error(`Binance premiumIndex ${resp.status}`);
      const data = (await resp.json()) as unknown as BinancePremiumIndex[];

      return data
        .filter((item) => item.symbol.endsWith('USDT'))
        .map((item) => ({
          symbol: item.symbol,
          exchange: 'binance',
          rate: parseFloat(item.lastFundingRate) * 100,
          nextFundingTime: item.nextFundingTime,
        }));
    },
    () => {
      logger.warn('Binance funding rates circuit breaker fallback (arbitrage)');
      return [] as FundingRateEntry[];
    },
  );
}

async function fetchBybitFundingRates(): Promise<FundingRateEntry[]> {
  return bybitBreaker.call(
    async () => {
      const resp = await fetchWithTimeout(`${BYBIT_BASE}/tickers?category=linear`);
      if (!resp.ok) throw new Error(`Bybit tickers ${resp.status}`);
      const data = (await resp.json()) as unknown as BybitTickerResponse;

      if (data.retCode !== 0) throw new Error(`Bybit retCode ${data.retCode}`);

      return data.result.list
        .filter((item) => item.symbol.endsWith('USDT'))
        .map((item) => ({
          symbol: item.symbol,
          exchange: 'bybit',
          rate: parseFloat(item.fundingRate) * 100,
          nextFundingTime: parseInt(item.nextFundingTime, 10),
        }));
    },
    () => {
      logger.warn('Bybit funding rates circuit breaker fallback (arbitrage)');
      return [] as FundingRateEntry[];
    },
  );
}

export default router;
