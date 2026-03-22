/**
 * Shared ticker cache utility.
 *
 * Replaces redis.keys('ticker:*:*') pattern (O(N) blocking scan)
 * with a single HGETALL on 'ticker:snapshot' hash (O(1) amortized).
 *
 * The data-collector writes to this hash on every ticker update.
 * All API routes read from it instead of scanning keys.
 */

import redis from '../config/redis.js';
import logger from '../config/logger.js';

export interface TickerEntry {
  symbol: string;
  exchange: string;
  price: number;
  change24h: number;
  volume: number;
  timestamp: number;
}

// In-memory fallback cache when Redis is unavailable
const memoryCache = new Map<string, TickerEntry>();
let memoryCacheUpdatedAt = 0;
const MEMORY_CACHE_TTL_MS = 30_000; // 30s stale tolerance

/**
 * Get all tickers from Redis hash (single O(1) call).
 * Falls back to in-memory cache if Redis is down.
 */
export async function getAllTickers(): Promise<Map<string, TickerEntry>> {
  try {
    const raw = await redis.hgetall('ticker:snapshot');
    if (!raw || Object.keys(raw).length === 0) {
      // Return memory cache if Redis has no data
      if (memoryCache.size > 0 && Date.now() - memoryCacheUpdatedAt < MEMORY_CACHE_TTL_MS) {
        return new Map(memoryCache);
      }
      return new Map();
    }

    const result = new Map<string, TickerEntry>();
    for (const [key, value] of Object.entries(raw)) {
      try {
        const parsed = JSON.parse(value) as TickerEntry;
        result.set(key, parsed);
      } catch { /* skip malformed */ }
    }

    // Update memory fallback
    memoryCache.clear();
    for (const [k, v] of result) memoryCache.set(k, v);
    memoryCacheUpdatedAt = Date.now();

    return result;
  } catch (err) {
    logger.error('getAllTickers Redis error, using memory cache', { error: (err as Error).message });
    // Graceful degradation: return stale memory cache
    return new Map(memoryCache);
  }
}

/**
 * Get tickers filtered by exchange.
 */
export async function getTickersByExchange(exchange: string): Promise<Map<string, TickerEntry>> {
  const all = await getAllTickers();
  const filtered = new Map<string, TickerEntry>();
  for (const [key, entry] of all) {
    if (entry.exchange === exchange) {
      filtered.set(key, entry);
    }
  }
  return filtered;
}

/**
 * Get a single ticker by symbol (tries binance → bybit → okx).
 */
export async function getTickerBySymbol(symbol: string): Promise<TickerEntry | null> {
  const exchanges = ['binance', 'bybit', 'okx'];
  for (const exchange of exchanges) {
    try {
      const data = await redis.hget('ticker:snapshot', `${exchange}:${symbol}`);
      if (data) return JSON.parse(data) as TickerEntry;
    } catch { /* try next */ }
  }

  // Fallback: check memory cache
  for (const exchange of exchanges) {
    const entry = memoryCache.get(`${exchange}:${symbol}`);
    if (entry) return entry;
  }

  return null;
}

/**
 * Get all tickers as a simple object keyed by symbol (last exchange wins).
 * This is the format most routes expect.
 */
export async function getAllTickersAsObject(): Promise<Record<string, TickerEntry>> {
  const all = await getAllTickers();
  const result: Record<string, TickerEntry> = {};
  for (const [, entry] of all) {
    result[entry.symbol] = entry;
  }
  return result;
}
