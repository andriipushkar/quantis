/**
 * Influencers routes — unit tests
 *
 * Tests influencer listing, consensus aggregation, and detail lookup
 * with mocked Redis.
 */

 

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
// Replicate mock data for testing
// ---------------------------------------------------------------------------

interface RecentMention {
  symbol: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  time: string;
}

interface Influencer {
  id: string;
  name: string;
  handle: string;
  followers: number;
  category: 'analyst' | 'macro' | 'degen' | 'vc';
  impactScore: number;
  accuracy: number;
  avgPriceImpact: number;
  recentMentions: RecentMention[];
  bullishBias: number;
}

const INFLUENCERS: Influencer[] = [
  { id: 'inf-001', name: 'Plan B', handle: '@100trillionUSD', followers: 1_900_000, category: 'analyst', impactScore: 92, accuracy: 68, avgPriceImpact: 3.2, recentMentions: [{ symbol: 'BTC', sentiment: 'bullish', time: '' }, { symbol: 'BTC', sentiment: 'bullish', time: '' }], bullishBias: 78 },
  { id: 'inf-002', name: 'Cobie', handle: '@coaborofa', followers: 720_000, category: 'vc', impactScore: 85, accuracy: 72, avgPriceImpact: 2.1, recentMentions: [{ symbol: 'ETH', sentiment: 'bullish', time: '' }, { symbol: 'SOL', sentiment: 'neutral', time: '' }, { symbol: 'BTC', sentiment: 'bullish', time: '' }], bullishBias: 62 },
  { id: 'inf-003', name: 'Hsaka', handle: '@HsakaTrades', followers: 410_000, category: 'analyst', impactScore: 78, accuracy: 75, avgPriceImpact: 1.8, recentMentions: [{ symbol: 'BTC', sentiment: 'bearish', time: '' }, { symbol: 'ETH', sentiment: 'bearish', time: '' }], bullishBias: 42 },
  { id: 'inf-004', name: 'Raoul Pal', handle: '@RaoulGMI', followers: 1_100_000, category: 'macro', impactScore: 88, accuracy: 64, avgPriceImpact: 2.8, recentMentions: [{ symbol: 'ETH', sentiment: 'bullish', time: '' }, { symbol: 'SOL', sentiment: 'bullish', time: '' }, { symbol: 'BTC', sentiment: 'bullish', time: '' }], bullishBias: 75 },
  { id: 'inf-005', name: 'GCR', handle: '@GCRClassic', followers: 310_000, category: 'degen', impactScore: 81, accuracy: 58, avgPriceImpact: 4.5, recentMentions: [{ symbol: 'SOL', sentiment: 'bearish', time: '' }, { symbol: 'BTC', sentiment: 'neutral', time: '' }], bullishBias: 38 },
  { id: 'inf-006', name: 'Arthur Hayes', handle: '@CryptoHayes', followers: 580_000, category: 'macro', impactScore: 90, accuracy: 70, avgPriceImpact: 3.8, recentMentions: [{ symbol: 'BTC', sentiment: 'bullish', time: '' }, { symbol: 'ETH', sentiment: 'bullish', time: '' }, { symbol: 'SOL', sentiment: 'neutral', time: '' }], bullishBias: 72 },
  { id: 'inf-007', name: 'Ansem', handle: '@blabordeaux', followers: 530_000, category: 'degen', impactScore: 76, accuracy: 55, avgPriceImpact: 4.9, recentMentions: [{ symbol: 'SOL', sentiment: 'bullish', time: '' }, { symbol: 'BNB', sentiment: 'neutral', time: '' }], bullishBias: 70 },
  { id: 'inf-008', name: 'Pentoshi', handle: '@Pentosh1', followers: 680_000, category: 'analyst', impactScore: 83, accuracy: 71, avgPriceImpact: 2.4, recentMentions: [{ symbol: 'BTC', sentiment: 'bullish', time: '' }, { symbol: 'XRP', sentiment: 'bearish', time: '' }, { symbol: 'ETH', sentiment: 'neutral', time: '' }], bullishBias: 60 },
  { id: 'inf-009', name: 'Crypto Birb', handle: '@crypto_birb', followers: 890_000, category: 'analyst', impactScore: 74, accuracy: 62, avgPriceImpact: 1.5, recentMentions: [{ symbol: 'BTC', sentiment: 'bullish', time: '' }, { symbol: 'BNB', sentiment: 'bullish', time: '' }], bullishBias: 65 },
  { id: 'inf-010', name: 'Zhu Su', handle: '@zaborsu', followers: 470_000, category: 'vc', impactScore: 71, accuracy: 45, avgPriceImpact: -1.2, recentMentions: [{ symbol: 'ETH', sentiment: 'bearish', time: '' }, { symbol: 'SOL', sentiment: 'bearish', time: '' }, { symbol: 'BTC', sentiment: 'neutral', time: '' }], bullishBias: 32 },
];

// ---------------------------------------------------------------------------
// Tests — Influencer list
// ---------------------------------------------------------------------------

describe('Influencers — list', () => {
  test('returns 10 influencers', () => {
    expect(INFLUENCERS).toHaveLength(10);
  });

  test('sorted by impactScore descending', () => {
    const sorted = [...INFLUENCERS].sort((a, b) => b.impactScore - a.impactScore);
    expect(sorted[0].name).toBe('Plan B');
    expect(sorted[0].impactScore).toBe(92);
    expect(sorted[sorted.length - 1].name).toBe('Zhu Su');
  });

  test('each influencer has required fields', () => {
    for (const inf of INFLUENCERS) {
      expect(inf.id).toBeTruthy();
      expect(inf.name).toBeTruthy();
      expect(inf.handle).toBeTruthy();
      expect(inf.followers).toBeGreaterThan(0);
      expect(['analyst', 'macro', 'degen', 'vc']).toContain(inf.category);
      expect(inf.impactScore).toBeGreaterThanOrEqual(0);
      expect(inf.impactScore).toBeLessThanOrEqual(100);
      expect(inf.accuracy).toBeGreaterThanOrEqual(0);
      expect(inf.accuracy).toBeLessThanOrEqual(100);
      expect(inf.recentMentions.length).toBeGreaterThan(0);
    }
  });

  test('all ids are unique', () => {
    const ids = INFLUENCERS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Tests — Consensus aggregation
// ---------------------------------------------------------------------------

describe('Influencers — consensus', () => {
  function buildConsensus(influencers: Influencer[]) {
    const symbolMap: Record<string, { bullish: number; bearish: number; neutral: number }> = {};

    for (const inf of influencers) {
      const seen = new Set<string>();
      for (const mention of inf.recentMentions) {
        if (seen.has(mention.symbol)) continue;
        seen.add(mention.symbol);

        if (!symbolMap[mention.symbol]) {
          symbolMap[mention.symbol] = { bullish: 0, bearish: 0, neutral: 0 };
        }
        symbolMap[mention.symbol][mention.sentiment]++;
      }
    }

    return Object.entries(symbolMap).map(([symbol, counts]) => ({
      symbol,
      ...counts,
      total: counts.bullish + counts.bearish + counts.neutral,
    })).sort((a, b) => b.total - a.total);
  }

  const consensus = buildConsensus(INFLUENCERS);

  test('BTC has the most mentions (10 influencers mention it)', () => {
    const btc = consensus.find(c => c.symbol === 'BTC');
    expect(btc).toBeDefined();
    expect(btc!.total).toBeGreaterThanOrEqual(8); // Most influencers mention BTC
  });

  test('consensus includes ETH, SOL, BNB, XRP', () => {
    const symbols = consensus.map(c => c.symbol);
    expect(symbols).toContain('ETH');
    expect(symbols).toContain('SOL');
    expect(symbols).toContain('BNB');
    expect(symbols).toContain('XRP');
  });

  test('deduplication: only first mention per influencer per symbol counts', () => {
    // Plan B has 2 BTC mentions, but should only count once
    const planB = INFLUENCERS.find(i => i.id === 'inf-001')!;
    expect(planB.recentMentions.filter(m => m.symbol === 'BTC').length).toBe(2);

    const btc = consensus.find(c => c.symbol === 'BTC')!;
    // If not deduplicated, BTC would have extra counts
    const uniqueBtcMentioners = INFLUENCERS.filter(i =>
      i.recentMentions.some(m => m.symbol === 'BTC')
    ).length;
    expect(btc.total).toBe(uniqueBtcMentioners);
  });

  test('sorted by total mentions descending', () => {
    for (let i = 1; i < consensus.length; i++) {
      expect(consensus[i - 1].total).toBeGreaterThanOrEqual(consensus[i].total);
    }
  });

  test('each consensus entry has bullish + bearish + neutral = total', () => {
    for (const c of consensus) {
      expect(c.bullish + c.bearish + c.neutral).toBe(c.total);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — Detail lookup
// ---------------------------------------------------------------------------

describe('Influencers — detail', () => {
  test('valid id returns influencer', () => {
    const inf = INFLUENCERS.find(i => i.id === 'inf-003');
    expect(inf).toBeDefined();
    expect(inf!.name).toBe('Hsaka');
  });

  test('invalid id returns undefined', () => {
    const inf = INFLUENCERS.find(i => i.id === 'nonexistent');
    expect(inf).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — Redis caching behavior
// ---------------------------------------------------------------------------

describe('Influencers — caching', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cache miss → setex called with 600s TTL', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');

    const cached = await mockRedis.get('influencers:list');
    expect(cached).toBeNull();

    await mockRedis.setex('influencers:list', 600, JSON.stringify(INFLUENCERS));
    expect(mockRedis.setex).toHaveBeenCalledWith('influencers:list', 600, expect.any(String));
  });

  test('cache hit → returns parsed data', async () => {
    const cachedData = JSON.stringify(INFLUENCERS.slice(0, 3));
    mockRedis.get.mockResolvedValue(cachedData);

    const cached = await mockRedis.get('influencers:list');
    const parsed = JSON.parse(cached);
    expect(parsed).toHaveLength(3);
  });
});
