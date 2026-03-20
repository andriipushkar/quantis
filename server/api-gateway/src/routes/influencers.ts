import { Router, Request, Response } from 'express';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

const router = Router();

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// Mock Data — 10 realistic crypto influencers
// ---------------------------------------------------------------------------

function generateMentionTime(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3600_000).toISOString();
}

const INFLUENCERS: Influencer[] = [
  {
    id: 'inf-001',
    name: 'Plan B',
    handle: '@100trillionUSD',
    followers: 1_900_000,
    category: 'analyst',
    impactScore: 92,
    accuracy: 68,
    avgPriceImpact: 3.2,
    recentMentions: [
      { symbol: 'BTC', sentiment: 'bullish', time: generateMentionTime(2) },
      { symbol: 'BTC', sentiment: 'bullish', time: generateMentionTime(18) },
    ],
    bullishBias: 78,
  },
  {
    id: 'inf-002',
    name: 'Cobie',
    handle: '@coaborofa',
    followers: 720_000,
    category: 'vc',
    impactScore: 85,
    accuracy: 72,
    avgPriceImpact: 2.1,
    recentMentions: [
      { symbol: 'ETH', sentiment: 'bullish', time: generateMentionTime(4) },
      { symbol: 'SOL', sentiment: 'neutral', time: generateMentionTime(12) },
      { symbol: 'BTC', sentiment: 'bullish', time: generateMentionTime(36) },
    ],
    bullishBias: 62,
  },
  {
    id: 'inf-003',
    name: 'Hsaka',
    handle: '@HsakaTrades',
    followers: 410_000,
    category: 'analyst',
    impactScore: 78,
    accuracy: 75,
    avgPriceImpact: 1.8,
    recentMentions: [
      { symbol: 'BTC', sentiment: 'bearish', time: generateMentionTime(1) },
      { symbol: 'ETH', sentiment: 'bearish', time: generateMentionTime(6) },
    ],
    bullishBias: 42,
  },
  {
    id: 'inf-004',
    name: 'Raoul Pal',
    handle: '@RaoulGMI',
    followers: 1_100_000,
    category: 'macro',
    impactScore: 88,
    accuracy: 64,
    avgPriceImpact: 2.8,
    recentMentions: [
      { symbol: 'ETH', sentiment: 'bullish', time: generateMentionTime(3) },
      { symbol: 'SOL', sentiment: 'bullish', time: generateMentionTime(8) },
      { symbol: 'BTC', sentiment: 'bullish', time: generateMentionTime(24) },
    ],
    bullishBias: 75,
  },
  {
    id: 'inf-005',
    name: 'GCR',
    handle: '@GCRClassic',
    followers: 310_000,
    category: 'degen',
    impactScore: 81,
    accuracy: 58,
    avgPriceImpact: 4.5,
    recentMentions: [
      { symbol: 'SOL', sentiment: 'bearish', time: generateMentionTime(5) },
      { symbol: 'BTC', sentiment: 'neutral', time: generateMentionTime(14) },
    ],
    bullishBias: 38,
  },
  {
    id: 'inf-006',
    name: 'Arthur Hayes',
    handle: '@CryptoHayes',
    followers: 580_000,
    category: 'macro',
    impactScore: 90,
    accuracy: 70,
    avgPriceImpact: 3.8,
    recentMentions: [
      { symbol: 'BTC', sentiment: 'bullish', time: generateMentionTime(6) },
      { symbol: 'ETH', sentiment: 'bullish', time: generateMentionTime(12) },
      { symbol: 'SOL', sentiment: 'neutral', time: generateMentionTime(48) },
    ],
    bullishBias: 72,
  },
  {
    id: 'inf-007',
    name: 'Ansem',
    handle: '@blabordeaux',
    followers: 530_000,
    category: 'degen',
    impactScore: 76,
    accuracy: 55,
    avgPriceImpact: 4.9,
    recentMentions: [
      { symbol: 'SOL', sentiment: 'bullish', time: generateMentionTime(1) },
      { symbol: 'BNB', sentiment: 'neutral', time: generateMentionTime(10) },
    ],
    bullishBias: 70,
  },
  {
    id: 'inf-008',
    name: 'Pentoshi',
    handle: '@Pentosh1',
    followers: 680_000,
    category: 'analyst',
    impactScore: 83,
    accuracy: 71,
    avgPriceImpact: 2.4,
    recentMentions: [
      { symbol: 'BTC', sentiment: 'bullish', time: generateMentionTime(3) },
      { symbol: 'XRP', sentiment: 'bearish', time: generateMentionTime(20) },
      { symbol: 'ETH', sentiment: 'neutral', time: generateMentionTime(30) },
    ],
    bullishBias: 60,
  },
  {
    id: 'inf-009',
    name: 'Crypto Birb',
    handle: '@crypto_birb',
    followers: 890_000,
    category: 'analyst',
    impactScore: 74,
    accuracy: 62,
    avgPriceImpact: 1.5,
    recentMentions: [
      { symbol: 'BTC', sentiment: 'bullish', time: generateMentionTime(8) },
      { symbol: 'BNB', sentiment: 'bullish', time: generateMentionTime(16) },
    ],
    bullishBias: 65,
  },
  {
    id: 'inf-010',
    name: 'Zhu Su',
    handle: '@zaborsu',
    followers: 470_000,
    category: 'vc',
    impactScore: 71,
    accuracy: 45,
    avgPriceImpact: -1.2,
    recentMentions: [
      { symbol: 'ETH', sentiment: 'bearish', time: generateMentionTime(2) },
      { symbol: 'SOL', sentiment: 'bearish', time: generateMentionTime(5) },
      { symbol: 'BTC', sentiment: 'neutral', time: generateMentionTime(40) },
    ],
    bullishBias: 32,
  },
];

// ---------------------------------------------------------------------------
// GET /api/v1/influencers — List all influencers (sorted by impactScore)
// ---------------------------------------------------------------------------

const CACHE_KEY_LIST = 'influencers:list';
const CACHE_TTL = 600; // 10 minutes

router.get('/', async (_req: Request, res: Response) => {
  try {
    const cached = await redis.get(CACHE_KEY_LIST);
    if (cached) {
      res.json({ success: true, data: JSON.parse(cached) });
      return;
    }

    const sorted = [...INFLUENCERS].sort((a, b) => b.impactScore - a.impactScore);
    await redis.setex(CACHE_KEY_LIST, CACHE_TTL, JSON.stringify(sorted));
    res.json({ success: true, data: sorted });
  } catch (err) {
    logger.error('Influencers list error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/influencers/consensus — Aggregated sentiment per symbol
// ---------------------------------------------------------------------------

router.get('/consensus', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'influencers:consensus';
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json({ success: true, data: JSON.parse(cached) });
      return;
    }

    const symbolMap: Record<string, { bullish: number; bearish: number; neutral: number }> = {};

    for (const inf of INFLUENCERS) {
      // Use only the most recent mention per symbol per influencer
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

    const consensus = Object.entries(symbolMap).map(([symbol, counts]) => ({
      symbol,
      ...counts,
      total: counts.bullish + counts.bearish + counts.neutral,
    }));

    consensus.sort((a, b) => b.total - a.total);

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(consensus));
    res.json({ success: true, data: consensus });
  } catch (err) {
    logger.error('Influencers consensus error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/influencers/:id — Single influencer detail
// ---------------------------------------------------------------------------

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const influencer = INFLUENCERS.find((i) => i.id === req.params.id);
    if (!influencer) {
      res.status(404).json({ success: false, error: 'Influencer not found' });
      return;
    }
    res.json({ success: true, data: influencer });
  } catch (err) {
    logger.error('Influencer detail error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
