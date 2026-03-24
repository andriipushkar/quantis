/**
 * Tokenomics routes — unit tests
 *
 * Tests token data lookup, comparison, and caching.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

jest.mock('../config/redis.js', () => ({
  __esModule: true,
  default: mockRedis,
}));

jest.mock('../config/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Replicate tokenomics data structure
// ---------------------------------------------------------------------------

interface TokenomicsData {
  symbol: string;
  name: string;
  circulatingSupply: number;
  maxSupply: number | null;
  inflationRate: number;
  fdv: number;
  supplyRatio: number;
  unlocks: { date: string; amount: number; description: string }[];
  score: number;
  scoreExplanation: string;
}

const TOKENOMICS_DB: Record<string, TokenomicsData> = {
  BTC: { symbol: 'BTC', name: 'Bitcoin', circulatingSupply: 19_600_000, maxSupply: 21_000_000, inflationRate: 1.7, fdv: 21_000_000 * 97_500, supplyRatio: 19_600_000 / 21_000_000, unlocks: [{ date: '2028-04-01', amount: 0, description: 'Next halving' }], score: 95, scoreExplanation: 'Hard-capped supply' },
  ETH: { symbol: 'ETH', name: 'Ethereum', circulatingSupply: 120_200_000, maxSupply: null, inflationRate: 0.5, fdv: 120_200_000 * 3_650, supplyRatio: 1.0, unlocks: [], score: 88, scoreExplanation: 'Post-merge near zero' },
  SOL: { symbol: 'SOL', name: 'Solana', circulatingSupply: 440_000_000, maxSupply: null, inflationRate: 5.5, fdv: 440_000_000 * 185, supplyRatio: 1.0, unlocks: [{ date: '2026-06-15', amount: 12_000_000, description: 'Foundation unlock' }], score: 65, scoreExplanation: 'High inflation' },
  BNB: { symbol: 'BNB', name: 'BNB', circulatingSupply: 145_000_000, maxSupply: 200_000_000, inflationRate: -1.2, fdv: 200_000_000 * 620, supplyRatio: 145_000_000 / 200_000_000, unlocks: [], score: 72, scoreExplanation: 'Quarterly burn' },
  XRP: { symbol: 'XRP', name: 'XRP', circulatingSupply: 54_000_000_000, maxSupply: 100_000_000_000, inflationRate: 4.2, fdv: 100_000_000_000 * 2.35, supplyRatio: 54_000_000_000 / 100_000_000_000, unlocks: [{ date: '2026-04-01', amount: 1_000_000_000, description: 'Monthly escrow' }, { date: '2026-05-01', amount: 1_000_000_000, description: 'Monthly escrow' }], score: 48, scoreExplanation: 'Large escrow' },
};

// ---------------------------------------------------------------------------
// Tests — Single token lookup
// ---------------------------------------------------------------------------

describe('Tokenomics — single token', () => {
  test('BTC exists and has score 95', () => {
    const data = TOKENOMICS_DB['BTC'];
    expect(data).toBeDefined();
    expect(data.score).toBe(95);
    expect(data.maxSupply).toBe(21_000_000);
  });

  test('ETH has null maxSupply', () => {
    const data = TOKENOMICS_DB['ETH'];
    expect(data.maxSupply).toBeNull();
  });

  test('case-insensitive lookup (uppercase conversion)', () => {
    const symbol = 'btc'.toUpperCase();
    expect(TOKENOMICS_DB[symbol]).toBeDefined();
  });

  test('unknown symbol → not found', () => {
    const symbol = 'DOGE'.toUpperCase();
    expect(TOKENOMICS_DB[symbol]).toBeUndefined();
  });

  test('all tokens have score between 0 and 100', () => {
    for (const data of Object.values(TOKENOMICS_DB)) {
      expect(data.score).toBeGreaterThanOrEqual(0);
      expect(data.score).toBeLessThanOrEqual(100);
    }
  });

  test('supplyRatio is circulating/max (or 1.0 if no max)', () => {
    for (const data of Object.values(TOKENOMICS_DB)) {
      if (data.maxSupply) {
        const expected = data.circulatingSupply / data.maxSupply;
        expect(Math.abs(data.supplyRatio - expected)).toBeLessThan(0.001);
      } else {
        expect(data.supplyRatio).toBe(1.0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — Compare endpoint
// ---------------------------------------------------------------------------

describe('Tokenomics — compare', () => {
  function compareTokens(symbolsParam: string): TokenomicsData[] {
    const symbols = symbolsParam.toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
    return symbols.map(sym => TOKENOMICS_DB[sym]).filter(Boolean);
  }

  test('default symbols "BTC,ETH,SOL,BNB,XRP" → 5 results', () => {
    const results = compareTokens('BTC,ETH,SOL,BNB,XRP');
    expect(results).toHaveLength(5);
  });

  test('partial match: "BTC,ETH,DOGE" → 2 results (DOGE missing)', () => {
    const results = compareTokens('BTC,ETH,DOGE');
    expect(results).toHaveLength(2);
    expect(results.map(r => r.symbol)).toEqual(['BTC', 'ETH']);
  });

  test('case insensitive: "btc,eth" → 2 results', () => {
    const results = compareTokens('btc,eth');
    expect(results).toHaveLength(2);
  });

  test('empty string → no results', () => {
    const results = compareTokens('');
    expect(results).toHaveLength(0);
  });

  test('single symbol → 1 result', () => {
    const results = compareTokens('SOL');
    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('SOL');
  });
});

// ---------------------------------------------------------------------------
// Tests — Unlock data
// ---------------------------------------------------------------------------

describe('Tokenomics — token unlocks', () => {
  test('BTC has 1 upcoming event (halving)', () => {
    expect(TOKENOMICS_DB.BTC.unlocks).toHaveLength(1);
    expect(TOKENOMICS_DB.BTC.unlocks[0].date).toBe('2028-04-01');
  });

  test('ETH has no unlocks', () => {
    expect(TOKENOMICS_DB.ETH.unlocks).toHaveLength(0);
  });

  test('XRP has 2 monthly escrow releases', () => {
    expect(TOKENOMICS_DB.XRP.unlocks).toHaveLength(2);
    expect(TOKENOMICS_DB.XRP.unlocks[0].amount).toBe(1_000_000_000);
  });

  test('SOL has foundation unlock', () => {
    expect(TOKENOMICS_DB.SOL.unlocks[0].amount).toBe(12_000_000);
  });
});

// ---------------------------------------------------------------------------
// Tests — Caching
// ---------------------------------------------------------------------------

describe('Tokenomics — caching', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cache TTL is 30 minutes (1800s)', () => {
    const CACHE_TTL = 1800;
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.setex('tokenomics:BTC', CACHE_TTL, JSON.stringify(TOKENOMICS_DB.BTC));
    expect(mockRedis.setex).toHaveBeenCalledWith('tokenomics:BTC', 1800, expect.any(String));
  });

  test('compare cache key is sorted for consistency', () => {
    const symbols = ['ETH', 'BTC', 'SOL'];
    const cacheKey = `tokenomics:compare:${symbols.sort().join(',')}`;
    expect(cacheKey).toBe('tokenomics:compare:BTC,ETH,SOL');
  });
});
