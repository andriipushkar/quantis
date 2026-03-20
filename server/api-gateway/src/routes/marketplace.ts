import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import logger from '../config/logger.js';

const router = Router();

// --- Types ---
interface Strategy {
  id: string;
  name: string;
  description: string;
  creator: { id: string; displayName: string };
  type: 'trend' | 'mean_reversion' | 'breakout' | 'scalp';
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  followers: Set<string>;
  ratings: Map<string, number>;
  price: number | 'free';
  timeframe: string;
  pairs: string[];
  createdAt: string;
}

interface StrategyResponse {
  id: string;
  name: string;
  description: string;
  creator: string;
  type: string;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  followers: number;
  rating: number;
  ratingCount: number;
  price: number | 'free';
  timeframe: string;
  pairs: string[];
  createdAt: string;
}

// --- In-memory storage ---
const strategies: Map<string, Strategy> = new Map();

function averageRating(ratings: Map<string, number>): number {
  if (ratings.size === 0) return 0;
  let sum = 0;
  ratings.forEach((v) => (sum += v));
  return Math.round((sum / ratings.size) * 10) / 10;
}

function serializeStrategy(s: Strategy): StrategyResponse {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    creator: s.creator.displayName,
    type: s.type,
    winRate: s.winRate,
    totalReturn: s.totalReturn,
    maxDrawdown: s.maxDrawdown,
    sharpeRatio: s.sharpeRatio,
    followers: s.followers.size,
    rating: averageRating(s.ratings),
    ratingCount: s.ratings.size,
    price: s.price,
    timeframe: s.timeframe,
    pairs: s.pairs,
    createdAt: s.createdAt,
  };
}

// --- Seed 8 mock strategies ---
const now = Date.now();
const mockStrategies: Omit<Strategy, 'followers' | 'ratings'>[] = [
  {
    id: 'strat-001',
    name: 'Golden Cross Momentum',
    description: 'Trend-following strategy using 50/200 EMA crossover with volume confirmation. Optimized for 4H charts on major pairs.',
    creator: { id: 'user-m-1', displayName: 'CryptoAlpha' },
    type: 'trend',
    winRate: 62,
    totalReturn: 145.3,
    maxDrawdown: 18.2,
    sharpeRatio: 1.85,
    price: 'free',
    timeframe: '4H',
    pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    createdAt: new Date(now - 90 * 86400000).toISOString(),
  },
  {
    id: 'strat-002',
    name: 'Bollinger Mean Revert',
    description: 'Mean reversion on Bollinger Band extremes with RSI divergence filter. Best for ranging markets.',
    creator: { id: 'user-m-2', displayName: 'QuantDegen' },
    type: 'mean_reversion',
    winRate: 71,
    totalReturn: 89.7,
    maxDrawdown: 12.5,
    sharpeRatio: 2.1,
    price: 29,
    timeframe: '1H',
    pairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT'],
    createdAt: new Date(now - 60 * 86400000).toISOString(),
  },
  {
    id: 'strat-003',
    name: 'Range Breakout Pro',
    description: 'Detects consolidation ranges and trades confirmed breakouts with tight stop losses. High R:R ratio.',
    creator: { id: 'user-m-3', displayName: 'AlgoWizard' },
    type: 'breakout',
    winRate: 48,
    totalReturn: 200.1,
    maxDrawdown: 24.8,
    sharpeRatio: 1.55,
    price: 49,
    timeframe: '15m',
    pairs: ['BTCUSDT', 'ETHUSDT'],
    createdAt: new Date(now - 120 * 86400000).toISOString(),
  },
  {
    id: 'strat-004',
    name: 'Micro Scalp Machine',
    description: 'High-frequency scalping on 1m charts using order flow imbalance and VWAP bounces.',
    creator: { id: 'user-m-4', displayName: 'ScalpKing' },
    type: 'scalp',
    winRate: 78,
    totalReturn: 67.2,
    maxDrawdown: 8.1,
    sharpeRatio: 2.45,
    price: 99,
    timeframe: '1m',
    pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT'],
    createdAt: new Date(now - 45 * 86400000).toISOString(),
  },
  {
    id: 'strat-005',
    name: 'DeFi Narrative Surfer',
    description: 'Trend strategy that tracks DeFi narrative rotations using social sentiment and on-chain TVL shifts.',
    creator: { id: 'user-m-5', displayName: 'OnChainSage' },
    type: 'trend',
    winRate: 55,
    totalReturn: 178.5,
    maxDrawdown: 31.2,
    sharpeRatio: 1.32,
    price: 'free',
    timeframe: '1D',
    pairs: ['AAVEUSDT', 'UNIUSDT', 'LINKUSDT', 'MKRUSDT'],
    createdAt: new Date(now - 150 * 86400000).toISOString(),
  },
  {
    id: 'strat-006',
    name: 'RSI Reversion Engine',
    description: 'Enters positions when RSI hits extreme levels with MACD histogram confirmation. Conservative sizing.',
    creator: { id: 'user-m-6', displayName: 'SteadyEddie' },
    type: 'mean_reversion',
    winRate: 66,
    totalReturn: 42.8,
    maxDrawdown: 9.3,
    sharpeRatio: 1.92,
    price: 19,
    timeframe: '4H',
    pairs: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
    createdAt: new Date(now - 75 * 86400000).toISOString(),
  },
  {
    id: 'strat-007',
    name: 'Volatility Squeeze Play',
    description: 'Identifies low-volatility squeezes using Keltner channels and Bollinger Bands, trading the expansion.',
    creator: { id: 'user-m-7', displayName: 'VolTrader' },
    type: 'breakout',
    winRate: 52,
    totalReturn: -5.3,
    maxDrawdown: 22.7,
    sharpeRatio: 0.45,
    price: 'free',
    timeframe: '1H',
    pairs: ['BTCUSDT', 'ETHUSDT', 'AVAXUSDT', 'DOTUSDT'],
    createdAt: new Date(now - 30 * 86400000).toISOString(),
  },
  {
    id: 'strat-008',
    name: 'Funding Rate Scalper',
    description: 'Scalps perpetual futures based on extreme funding rate deviations and open interest divergences.',
    creator: { id: 'user-m-8', displayName: 'PerpGuru' },
    type: 'scalp',
    winRate: 69,
    totalReturn: 112.6,
    maxDrawdown: 14.9,
    sharpeRatio: 1.78,
    price: 39,
    timeframe: '5m',
    pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    createdAt: new Date(now - 55 * 86400000).toISOString(),
  },
];

// Seed with mock ratings and followers
const mockRatings: Record<string, [string, number][]> = {
  'strat-001': [['u1', 5], ['u2', 4], ['u3', 5], ['u4', 4], ['u5', 5]],
  'strat-002': [['u1', 4], ['u2', 5], ['u3', 4], ['u6', 5]],
  'strat-003': [['u2', 5], ['u3', 4], ['u4', 5], ['u7', 3], ['u8', 5], ['u9', 4]],
  'strat-004': [['u1', 5], ['u5', 5], ['u6', 4], ['u7', 5], ['u10', 5], ['u11', 4], ['u12', 5]],
  'strat-005': [['u3', 3], ['u4', 4], ['u8', 3]],
  'strat-006': [['u1', 4], ['u2', 4], ['u5', 5], ['u9', 4]],
  'strat-007': [['u3', 2], ['u6', 3]],
  'strat-008': [['u1', 4], ['u2', 5], ['u4', 4], ['u7', 5], ['u10', 4]],
};

const mockFollowerCounts: Record<string, number> = {
  'strat-001': 342,
  'strat-002': 218,
  'strat-003': 507,
  'strat-004': 891,
  'strat-005': 156,
  'strat-006': 274,
  'strat-007': 43,
  'strat-008': 419,
};

for (const m of mockStrategies) {
  const ratings = new Map<string, number>();
  (mockRatings[m.id] || []).forEach(([uid, r]) => ratings.set(uid, r));
  const followers = new Set<string>();
  const count = mockFollowerCounts[m.id] || 0;
  for (let i = 0; i < count; i++) followers.add(`follower-${m.id}-${i}`);
  strategies.set(m.id, { ...m, followers, ratings });
}

// --- Routes ---

// GET / — List all strategies
router.get('/', (req: Request, res: Response) => {
  try {
    const { sort = 'rating', type } = req.query;
    let list = Array.from(strategies.values()).map(serializeStrategy);

    if (type && type !== 'all') {
      list = list.filter((s) => s.type === type);
    }

    if (sort === 'return') {
      list.sort((a, b) => b.totalReturn - a.totalReturn);
    } else if (sort === 'followers') {
      list.sort((a, b) => b.followers - a.followers);
    } else {
      list.sort((a, b) => b.rating - a.rating);
    }

    res.json({ success: true, data: list });
  } catch (err) {
    logger.error('Marketplace list error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to fetch strategies' });
  }
});

// GET /:id — Strategy detail
router.get('/:id', (req: Request, res: Response) => {
  try {
    const strategy = strategies.get(req.params.id);
    if (!strategy) {
      res.status(404).json({ success: false, error: 'Strategy not found' });
      return;
    }
    res.json({ success: true, data: serializeStrategy(strategy) });
  } catch (err) {
    logger.error('Marketplace detail error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to fetch strategy' });
  }
});

// POST /:id/follow — Follow/unfollow strategy
router.post('/:id/follow', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const strategy = strategies.get(req.params.id);
    if (!strategy) {
      res.status(404).json({ success: false, error: 'Strategy not found' });
      return;
    }

    const userId = req.user!.id;
    if (strategy.followers.has(userId)) {
      strategy.followers.delete(userId);
      res.json({ success: true, data: { followed: false, followers: strategy.followers.size } });
    } else {
      strategy.followers.add(userId);
      res.json({ success: true, data: { followed: true, followers: strategy.followers.size } });
    }
  } catch (err) {
    logger.error('Marketplace follow error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to follow strategy' });
  }
});

// POST /:id/rate — Rate strategy 1-5
router.post('/:id/rate', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const strategy = strategies.get(req.params.id);
    if (!strategy) {
      res.status(404).json({ success: false, error: 'Strategy not found' });
      return;
    }

    const { rating } = req.body;
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
      return;
    }

    strategy.ratings.set(req.user!.id, Math.round(rating));
    res.json({
      success: true,
      data: { rating: averageRating(strategy.ratings), ratingCount: strategy.ratings.size },
    });
  } catch (err) {
    logger.error('Marketplace rate error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to rate strategy' });
  }
});

// POST /publish — Publish own strategy
router.post('/publish', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, type, timeframe, pairs } = req.body;

    if (!name || !description || !type || !timeframe || !pairs || !Array.isArray(pairs)) {
      res.status(400).json({ success: false, error: 'Missing required fields: name, description, type, timeframe, pairs' });
      return;
    }

    const validTypes = ['trend', 'mean_reversion', 'breakout', 'scalp'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const id = `strat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const strategy: Strategy = {
      id,
      name,
      description,
      creator: { id: req.user!.id, displayName: req.user!.email.split('@')[0] },
      type,
      winRate: 0,
      totalReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      followers: new Set(),
      ratings: new Map(),
      price: 'free',
      timeframe,
      pairs,
      createdAt: new Date().toISOString(),
    };

    strategies.set(id, strategy);
    res.status(201).json({ success: true, data: serializeStrategy(strategy) });
  } catch (err) {
    logger.error('Marketplace publish error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Failed to publish strategy' });
  }
});

export default router;
