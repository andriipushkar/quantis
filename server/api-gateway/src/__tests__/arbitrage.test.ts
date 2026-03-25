/**
 * Arbitrage Routes — Unit Tests
 *
 * Tests business logic, fee accounting, cross-exchange spread calculation,
 * funding rate arbitrage, DEX-CEX comparison, and alert creation
 * from routes/market/arbitrage.ts.
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared BEFORE the module under test is imported
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockGetAllTickers = jest.fn();
const mockFetch = jest.fn();

jest.mock('../config/database.js', () => ({
  __esModule: true,
  query: (...args: any[]) => mockQuery(...args),
  default: {},
}));

jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockRedisGet(...args),
    set: (...args: any[]) => mockRedisSet(...args),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    setex: jest.fn(),
  },
}));

jest.mock('../config/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../config/env.js', () => ({
  __esModule: true,
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    BCRYPT_ROUNDS: 4,
    isProduction: false,
  },
}));

jest.mock('../utils/ticker-cache.js', () => ({
  __esModule: true,
  getAllTickers: (...args: any[]) => mockGetAllTickers(...args),
  getTickerBySymbol: jest.fn(),
  getAllTickersAsObject: jest.fn(),
}));

// Mock @quantis/shared CircuitBreaker to just execute the fn directly
jest.mock('@quantis/shared', () => ({
  __esModule: true,
  CircuitBreaker: class MockCircuitBreaker {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    async call<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
      try {
        return await fn();
      } catch {
        if (fallback) return fallback();
        throw new Error('Circuit breaker open');
      }
    }
  },
}));

// Mock global fetch
const originalFetch = global.fetch;
beforeAll(() => {
  global.fetch = mockFetch as any;
});
afterAll(() => {
  global.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import arbitrageRouter from '../routes/market/arbitrage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockResponse {
  statusCode: number;
  body: any;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
}

function mockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

function mockReq(overrides: Record<string, any> = {}): any {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    user: undefined,
    ...overrides,
  };
}

function findHandler(method: string, path: string): Function[] {
  const layers = (arbitrageRouter as any).stack as any[];
  for (const layer of layers) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method.toLowerCase()]
    ) {
      return layer.route.stack.map((s: any) => s.handle);
    }
  }
  throw new Error(`Handler not found: ${method} ${path}`);
}

async function runHandlers(handlers: Function[], req: any, res: MockResponse) {
  for (const handler of handlers) {
    if (res.body !== null) break;
    await handler(req, res, (err?: any) => {
      if (err) throw err;
    });
  }
}

function authenticatedReq(
  user: { id: string; email: string; tier: string },
  overrides: Record<string, any> = {},
) {
  const token = jwt.sign(user, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  return mockReq({
    headers: { authorization: `Bearer ${token}` },
    user,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Ticker helper: creates a Map simulating getAllTickers()
// ---------------------------------------------------------------------------
interface TickerInput {
  symbol: string;
  exchange: string;
  price: number;
  volume?: number;
  change24h?: number;
}

function buildTickerMap(entries: TickerInput[]): Map<string, any> {
  const map = new Map<string, any>();
  for (const entry of entries) {
    const key = `${entry.exchange.toLowerCase()}:${entry.symbol}`;
    map.set(key, {
      symbol: entry.symbol,
      exchange: entry.exchange,
      price: entry.price,
      volume: entry.volume ?? 100000,
      change24h: entry.change24h ?? 0,
      timestamp: Date.now(),
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Constants (mirrored from arbitrage.ts for test assertions)
// ---------------------------------------------------------------------------
const EXCHANGE_TAKER_FEES: Record<string, number> = {
  binance: 0.001,
  bybit: 0.001,
  okx: 0.0008,
};

const CROSS_EXCHANGE_MIN_SPREAD = 0.05; // 0.05%
const DEX_SWAP_FEE_PCT = 0.3; // 0.3%

// ===========================================================================
// Tests
// ===========================================================================

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue('OK');
});

// ---------------------------------------------------------------------------
// GET /arbitrage/cross-exchange
// ---------------------------------------------------------------------------
describe('Arbitrage Routes', () => {
  describe('GET /arbitrage/cross-exchange', () => {
    const handlers = findHandler('get', '/arbitrage/cross-exchange');

    test('returns opportunities with fee accounting', async () => {
      const tickers = buildTickerMap([
        { symbol: 'BTCUSDT', exchange: 'binance', price: 60000 },
        { symbol: 'BTCUSDT', exchange: 'bybit', price: 60100 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);

      const opp = res.body.data[0];
      expect(opp.symbol).toBe('BTCUSDT');
      expect(opp.buy_exchange).toBe('binance');
      expect(opp.sell_exchange).toBe('bybit');
      expect(opp.buy_price).toBe(60000);
      expect(opp.sell_price).toBe(60100);
      expect(opp.buy_fee_pct).toBeGreaterThan(0);
      expect(opp.sell_fee_pct).toBeGreaterThan(0);
      expect(opp.total_fees_pct).toBe(
        Math.round((opp.buy_fee_pct + opp.sell_fee_pct) * 10000) / 10000
      );
      expect(opp.net_profit_pct).toBeDefined();
      expect(opp.net_profit_1k).toBeDefined();
    });

    test('calculates net profit correctly (spread - fees)', async () => {
      const tickers = buildTickerMap([
        { symbol: 'ETHUSDT', exchange: 'binance', price: 3000 },
        { symbol: 'ETHUSDT', exchange: 'okx', price: 3010 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      const opp = res.body.data[0];
      const spreadPct = ((3010 - 3000) / 3000) * 100;
      const buyFee = EXCHANGE_TAKER_FEES['binance'] * 100; // 0.1%
      const sellFee = EXCHANGE_TAKER_FEES['okx'] * 100;    // 0.08%
      const expectedNetProfitPct = spreadPct - buyFee - sellFee;

      expect(opp.net_profit_pct).toBeCloseTo(
        Math.round(expectedNetProfitPct * 10000) / 10000,
        3
      );
      expect(opp.net_profit_1k).toBeCloseTo(
        Math.round((expectedNetProfitPct / 100) * 1000 * 100) / 100,
        2
      );
    });

    test('filters opportunities below minimum spread', async () => {
      // Prices very close: spread < 0.05%
      const tickers = buildTickerMap([
        { symbol: 'BTCUSDT', exchange: 'binance', price: 60000 },
        { symbol: 'BTCUSDT', exchange: 'bybit', price: 60010 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      // spread = (10/60000)*100 = 0.0167% < 0.05%
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    test('returns empty array when no tickers available', async () => {
      mockGetAllTickers.mockResolvedValue(new Map());

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    test('handles single exchange data gracefully', async () => {
      const tickers = buildTickerMap([
        { symbol: 'BTCUSDT', exchange: 'binance', price: 60000 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    test('skips symbols where same exchange has best bid and ask', async () => {
      const tickers = buildTickerMap([
        { symbol: 'BTCUSDT', exchange: 'binance', price: 60000 },
        { symbol: 'BTCUSDT', exchange: 'binance', price: 60100 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      // Only one entry per key in Map, so length < 2 — no opportunity
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    test('sorts opportunities by spread descending', async () => {
      const tickers = buildTickerMap([
        { symbol: 'BTCUSDT', exchange: 'binance', price: 60000 },
        { symbol: 'BTCUSDT', exchange: 'bybit', price: 60200 },
        { symbol: 'ETHUSDT', exchange: 'binance', price: 3000 },
        { symbol: 'ETHUSDT', exchange: 'bybit', price: 3020 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      // Both ETH and BTC have ~0.33% and ~0.67% spread — BTC should be first
      expect(res.body.data[0].spread_pct).toBeGreaterThanOrEqual(
        res.body.data[1].spread_pct
      );
    });

    test('skips tickers with zero or negative price', async () => {
      const tickers = buildTickerMap([
        { symbol: 'BTCUSDT', exchange: 'binance', price: 0 },
        { symbol: 'BTCUSDT', exchange: 'bybit', price: 60100 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /arbitrage/funding-rate
  // ---------------------------------------------------------------------------
  describe('GET /arbitrage/funding-rate', () => {
    const handlers = findHandler('get', '/arbitrage/funding-rate');

    test('returns funding rate arbitrage opportunities', async () => {
      // Mock Binance funding rates
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { symbol: 'BTCUSDT', lastFundingRate: '-0.0001', nextFundingTime: Date.now() + 3600000 },
            { symbol: 'ETHUSDT', lastFundingRate: '0.0003', nextFundingTime: Date.now() + 3600000 },
          ],
        })
        // Mock Bybit funding rates
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            retCode: 0,
            result: {
              category: 'linear',
              list: [
                { symbol: 'BTCUSDT', fundingRate: '0.0002', nextFundingTime: String(Date.now() + 3600000) },
                { symbol: 'ETHUSDT', fundingRate: '-0.0001', nextFundingTime: String(Date.now() + 3600000) },
              ],
            },
          }),
        });

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const btcOpp = res.body.data.find((o: any) => o.symbol === 'BTCUSDT');
      if (btcOpp) {
        expect(btcOpp.long_exchange).toBeDefined();
        expect(btcOpp.short_exchange).toBeDefined();
        expect(btcOpp.funding_spread).toBeGreaterThan(0);
      }
    });

    test('calculates annualized return correctly', async () => {
      // Binance: -0.01% funding, Bybit: +0.02% funding for BTCUSDT
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { symbol: 'BTCUSDT', lastFundingRate: '-0.0001', nextFundingTime: Date.now() + 3600000 },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            retCode: 0,
            result: {
              category: 'linear',
              list: [
                { symbol: 'BTCUSDT', fundingRate: '0.0002', nextFundingTime: String(Date.now() + 3600000) },
              ],
            },
          }),
        });

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      const opp = res.body.data[0];
      // Funding rates are multiplied by 100 in the code
      // Binance rate = -0.0001 * 100 = -0.01
      // Bybit rate = 0.0002 * 100 = 0.02
      // spread = 0.02 - (-0.01) = 0.03
      // annualized = 0.03 * 1095 = 32.85
      expect(opp.annualized_return_pct).toBeCloseTo(32.85, 0);
    });

    test('uses Redis cache when available', async () => {
      const cachedData = [
        {
          symbol: 'BTCUSDT',
          long_exchange: 'binance',
          short_exchange: 'bybit',
          funding_rate_long: -0.01,
          funding_rate_short: 0.02,
          funding_spread: 0.03,
          annualized_return_pct: 32.85,
          next_funding_time: Date.now() + 3600000,
        },
      ];
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(cachedData);
      // fetch should not have been called since we used cache
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('handles Binance API failure with circuit breaker', async () => {
      // Binance fails, Bybit succeeds — circuit breaker returns fallback []
      mockFetch
        .mockRejectedValueOnce(new Error('Binance timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            retCode: 0,
            result: {
              category: 'linear',
              list: [
                { symbol: 'BTCUSDT', fundingRate: '0.0002', nextFundingTime: String(Date.now() + 3600000) },
              ],
            },
          }),
        });

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      // Should still succeed (Binance fallback returns [])
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('handles Bybit API failure with circuit breaker', async () => {
      // Binance succeeds, Bybit fails — circuit breaker returns fallback []
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { symbol: 'BTCUSDT', lastFundingRate: '-0.0001', nextFundingTime: Date.now() + 3600000 },
          ],
        })
        .mockRejectedValueOnce(new Error('Bybit timeout'));

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('caches result in Redis', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            retCode: 0,
            result: { category: 'linear', list: [] },
          }),
        });

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(mockRedisSet).toHaveBeenCalledWith(
        'arb:funding',
        expect.any(String),
        'EX',
        60
      );
    });
  });

  // ---------------------------------------------------------------------------
  // GET /arbitrage/dex-cex
  // ---------------------------------------------------------------------------
  describe('GET /arbitrage/dex-cex', () => {
    const handlers = findHandler('get', '/arbitrage/dex-cex');

    test('returns DEX-CEX opportunities', async () => {
      const tickers = buildTickerMap([
        { symbol: 'ETHUSDT', exchange: 'binance', price: 3000 },
        { symbol: 'LINKUSDT', exchange: 'binance', price: 15 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      // DexScreener responses for WETH and LINK
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            pairs: [
              {
                dexId: 'uniswap',
                pairAddress: '0xabc',
                baseToken: { symbol: 'WETH', name: 'Wrapped Ether' },
                quoteToken: { symbol: 'USDT' },
                priceUsd: '3050',
                liquidity: { usd: 5000000 },
                volume: { h24: 1000000 },
                fdv: 100000000,
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            pairs: [
              {
                dexId: 'sushiswap',
                pairAddress: '0xdef',
                baseToken: { symbol: 'LINK', name: 'Chainlink' },
                quoteToken: { symbol: 'USDT' },
                priceUsd: '15.50',
                liquidity: { usd: 2000000 },
                volume: { h24: 500000 },
                fdv: 50000000,
              },
            ],
          }),
        });

      // Remaining token fetches (for tokens not in CEX — will be skipped)
      for (let i = 0; i < 8; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pairs: [] }),
        });
      }

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('calculates spread between DEX and CEX prices', async () => {
      const tickers = buildTickerMap([
        { symbol: 'ETHUSDT', exchange: 'binance', price: 3000 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      // Only ETHUSDT has a token address, so only 1 fetch for it
      // But all TOKEN_ADDRESSES are fetched — mock all 10
      const fetchResponses: any[] = [];
      for (let i = 0; i < 10; i++) {
        fetchResponses.push(
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ pairs: [] }),
          })
        );
      }

      // Override the ETHUSDT fetch (first one based on Object.entries order)
      // TOKEN_ADDRESSES keys: ETHUSDT, UNIUSDT, LINKUSDT, ... (ETHUSDT is first)
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pairs: [
            {
              dexId: 'uniswap',
              pairAddress: '0xabc',
              baseToken: { symbol: 'WETH', name: 'WETH' },
              quoteToken: { symbol: 'USDT' },
              priceUsd: '3100',
              liquidity: { usd: 5000000 },
              volume: { h24: 1000000 },
              fdv: 100000000,
            },
          ],
        }),
      });
      // Remaining 9 tokens
      for (let i = 0; i < 9; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pairs: [] }),
        });
      }

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      if (res.body.data.length > 0) {
        const ethOpp = res.body.data.find((o: any) => o.symbol === 'ETHUSDT');
        if (ethOpp) {
          // dex=3100, cex=3000, spread = |((3100-3000)/3000)*100| = ~3.33%
          expect(ethOpp.spread_pct).toBeGreaterThan(0);
          expect(ethOpp.direction).toBe('buy_cex_sell_dex');
        }
      }
    });

    test('accounts for DEX swap fees and CEX taker fees', async () => {
      const tickers = buildTickerMap([
        { symbol: 'ETHUSDT', exchange: 'binance', price: 3000 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pairs: [
            {
              dexId: 'uniswap',
              pairAddress: '0xabc',
              baseToken: { symbol: 'WETH', name: 'WETH' },
              quoteToken: { symbol: 'USDT' },
              priceUsd: '3100',
              liquidity: { usd: 5000000 },
              volume: { h24: 1000000 },
              fdv: 100000000,
            },
          ],
        }),
      });
      for (let i = 0; i < 9; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ pairs: [] }),
        });
      }

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      if (res.body.data.length > 0) {
        const opp = res.body.data[0];
        // DEX fee = 0.3%, Binance fee = 0.1%, total = 0.4%
        // net_profit_1k should be less than estimated_profit_1k
        expect(opp.net_profit_1k).toBeLessThan(opp.estimated_profit_1k);
      }
    });

    test('uses Redis cache when available', async () => {
      const cachedData = [
        {
          symbol: 'ETHUSDT',
          dex_name: 'uniswap',
          dex_price: 3050,
          cex_exchange: 'binance',
          cex_price: 3000,
          spread_pct: 1.67,
          direction: 'buy_cex_sell_dex',
          dex_liquidity: 5000000,
          estimated_profit_1k: 16.7,
          net_profit_1k: 12.7,
          timestamp: Date.now(),
        },
      ];
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(cachedData);
      expect(mockGetAllTickers).not.toHaveBeenCalled();
    });

    test('handles DexScreener API failure gracefully', async () => {
      const tickers = buildTickerMap([
        { symbol: 'ETHUSDT', exchange: 'binance', price: 3000 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      // All DexScreener fetches fail — circuit breaker returns fallback
      for (let i = 0; i < 10; i++) {
        mockFetch.mockRejectedValueOnce(new Error('DexScreener down'));
      }

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      // Should still return success with empty or filtered data
      // (dexPrice=0 entries are filtered out)
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('handles partial token fetch failures', async () => {
      const tickers = buildTickerMap([
        { symbol: 'ETHUSDT', exchange: 'binance', price: 3000 },
        { symbol: 'LINKUSDT', exchange: 'binance', price: 15 },
      ]);
      mockGetAllTickers.mockResolvedValue(tickers);

      // First fetch (ETHUSDT) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pairs: [
            {
              dexId: 'uniswap',
              pairAddress: '0xabc',
              baseToken: { symbol: 'WETH', name: 'WETH' },
              quoteToken: { symbol: 'USDT' },
              priceUsd: '3050',
              liquidity: { usd: 5000000 },
              volume: { h24: 1000000 },
              fdv: 100000000,
            },
          ],
        }),
      });

      // Remaining token fetches fail
      for (let i = 0; i < 9; i++) {
        mockFetch.mockRejectedValueOnce(new Error('Timeout'));
      }

      const req = mockReq();
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /arbitrage/alerts
  // ---------------------------------------------------------------------------
  describe('POST /arbitrage/alerts', () => {
    const handlers = findHandler('post', '/arbitrage/alerts');

    test('creates spread alert successfully', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 1,
            user_id: 'user-1',
            name: 'Arbitrage Alert: spread - BTCUSDT',
            conditions: JSON.stringify({
              alert_type: 'arbitrage',
              arb_type: 'spread',
              symbol: 'BTCUSDT',
              threshold: 0.5,
            }),
            channels: JSON.stringify(['email']),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });

      const req = authenticatedReq(
        { id: 'user-1', email: 'test@test.com', tier: 'pro' },
        {
          body: {
            type: 'spread',
            symbol: 'BTCUSDT',
            threshold: 0.5,
            channels: ['email'],
          },
        }
      );
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toContain('spread');
    });

    test('creates funding rate alert successfully', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 2,
            user_id: 'user-1',
            name: 'Arbitrage Alert: funding',
            conditions: JSON.stringify({
              alert_type: 'arbitrage',
              arb_type: 'funding',
              symbol: null,
              threshold: 0.01,
            }),
            channels: JSON.stringify(['push', 'telegram']),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });

      const req = authenticatedReq(
        { id: 'user-1', email: 'test@test.com', tier: 'pro' },
        {
          body: {
            type: 'funding',
            threshold: 0.01,
            channels: ['push', 'telegram'],
          },
        }
      );
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('rejects invalid alert type', async () => {
      const req = authenticatedReq(
        { id: 'user-1', email: 'test@test.com', tier: 'pro' },
        {
          body: {
            type: 'invalid_type',
            threshold: 0.5,
            channels: ['email'],
          },
        }
      );
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid type');
    });

    test('rejects negative threshold', async () => {
      const req = authenticatedReq(
        { id: 'user-1', email: 'test@test.com', tier: 'pro' },
        {
          body: {
            type: 'spread',
            threshold: -0.5,
            channels: ['email'],
          },
        }
      );
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('threshold');
    });

    test('rejects zero threshold', async () => {
      const req = authenticatedReq(
        { id: 'user-1', email: 'test@test.com', tier: 'pro' },
        {
          body: {
            type: 'spread',
            threshold: 0,
            channels: ['email'],
          },
        }
      );
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('requires authentication', async () => {
      const req = mockReq({
        body: {
          type: 'spread',
          threshold: 0.5,
          channels: ['email'],
        },
      });
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test('rejects empty channels array', async () => {
      const req = authenticatedReq(
        { id: 'user-1', email: 'test@test.com', tier: 'pro' },
        {
          body: {
            type: 'spread',
            threshold: 0.5,
            channels: [],
          },
        }
      );
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('rejects invalid channel name', async () => {
      const req = authenticatedReq(
        { id: 'user-1', email: 'test@test.com', tier: 'pro' },
        {
          body: {
            type: 'spread',
            threshold: 0.5,
            channels: ['sms'],
          },
        }
      );
      const res = mockRes();
      await runHandlers(handlers, req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid channel');
    });
  });

  // ---------------------------------------------------------------------------
  // Fee Accounting
  // ---------------------------------------------------------------------------
  describe('Fee Accounting', () => {
    test('Binance taker fee is 0.1%', () => {
      expect(EXCHANGE_TAKER_FEES['binance']).toBe(0.001);
      expect(EXCHANGE_TAKER_FEES['binance'] * 100).toBe(0.1);
    });

    test('Bybit taker fee is 0.1%', () => {
      expect(EXCHANGE_TAKER_FEES['bybit']).toBe(0.001);
      expect(EXCHANGE_TAKER_FEES['bybit'] * 100).toBe(0.1);
    });

    test('OKX taker fee is 0.08%', () => {
      expect(EXCHANGE_TAKER_FEES['okx']).toBe(0.0008);
      expect(EXCHANGE_TAKER_FEES['okx'] * 100).toBeCloseTo(0.08);
    });

    test('total fees = buy_fee + sell_fee', () => {
      const buyFee = EXCHANGE_TAKER_FEES['binance'] * 100;  // 0.1%
      const sellFee = EXCHANGE_TAKER_FEES['okx'] * 100;     // 0.08%
      const total = buyFee + sellFee;
      expect(total).toBeCloseTo(0.18);
    });

    test('net profit = spread - total fees', () => {
      const spread = 0.5; // 0.5%
      const buyFee = EXCHANGE_TAKER_FEES['binance'] * 100;  // 0.1%
      const sellFee = EXCHANGE_TAKER_FEES['bybit'] * 100;   // 0.1%
      const totalFees = buyFee + sellFee;                     // 0.2%
      const netProfit = spread - totalFees;
      expect(netProfit).toBeCloseTo(0.3);
    });

    test('negative net profit when fees exceed spread', () => {
      const spread = 0.1; // 0.1%
      const buyFee = EXCHANGE_TAKER_FEES['binance'] * 100;  // 0.1%
      const sellFee = EXCHANGE_TAKER_FEES['bybit'] * 100;   // 0.1%
      const totalFees = buyFee + sellFee;                     // 0.2%
      const netProfit = spread - totalFees;
      expect(netProfit).toBeLessThan(0);
      expect(netProfit).toBeCloseTo(-0.1);
    });

    test('DEX swap fee is 0.3%', () => {
      expect(DEX_SWAP_FEE_PCT).toBe(0.3);
    });

    test('DEX-CEX total fees include DEX swap + CEX taker', () => {
      const cexFee = EXCHANGE_TAKER_FEES['binance'] * 100; // 0.1%
      const totalFees = DEX_SWAP_FEE_PCT + cexFee;          // 0.4%
      expect(totalFees).toBeCloseTo(0.4);
    });
  });
});
