import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import logger from '../config/logger.js';

const router = Router();

// --- Types ---
interface SocialPost {
  id: string;
  userId: string;
  userName: string;
  type: 'trade_idea' | 'analysis' | 'comment';
  content: string;
  symbol?: string;
  direction?: 'bullish' | 'bearish' | 'neutral';
  likes: Set<string>;
  createdAt: string;
}

interface SocialPostResponse {
  id: string;
  userId: string;
  userName: string;
  type: 'trade_idea' | 'analysis' | 'comment';
  content: string;
  symbol?: string;
  direction?: 'bullish' | 'bearish' | 'neutral';
  likeCount: number;
  createdAt: string;
}

// --- In-memory storage ---
const posts: Map<string, SocialPost> = new Map();

function serializePost(post: SocialPost): SocialPostResponse {
  return {
    id: post.id,
    userId: post.userId,
    userName: post.userName,
    type: post.type,
    content: post.content,
    symbol: post.symbol,
    direction: post.direction,
    likeCount: post.likes.size,
    createdAt: post.createdAt,
  };
}

// --- Seed 10 mock posts ---
const now = Date.now();
const mockPosts: Omit<SocialPost, 'likes'>[] = [
  {
    id: 'sp-001',
    userId: 'user-mock-1',
    userName: 'CryptoAlpha',
    type: 'trade_idea',
    content:
      'BTC forming a classic bull flag on the 4H chart. Expecting a breakout above 71k with targets at 73.5k. Stop below 69.2k. Risk/reward is 2.8:1.',
    symbol: 'BTCUSDT',
    direction: 'bullish',
    createdAt: new Date(now - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'sp-002',
    userId: 'user-mock-2',
    userName: 'DeFiWhale',
    type: 'analysis',
    content:
      'ETH/BTC ratio hitting multi-month support at 0.046. Historically this level has held 4 times in the past year. If it breaks, could see ETH underperformance accelerate toward 0.042.',
    symbol: 'ETHUSDT',
    direction: 'neutral',
    createdAt: new Date(now - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'sp-003',
    userId: 'user-mock-3',
    userName: 'SwingMaster_X',
    type: 'trade_idea',
    content:
      'SOL breaking out of the descending wedge on daily. Volume confirming. Entered long at 142 with TP at 165 and SL at 134. Strong conviction play.',
    symbol: 'SOLUSDT',
    direction: 'bullish',
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sp-004',
    userId: 'user-mock-4',
    userName: 'QuantBot_v2',
    type: 'analysis',
    content:
      'On-chain data shows whale wallets accumulating LINK aggressively over the past 72h. Top 100 wallets increased holdings by 4.2M tokens. Oracle narrative heating up.',
    symbol: 'LINKUSDT',
    direction: 'bullish',
    createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sp-005',
    userId: 'user-mock-5',
    userName: 'NarrativeHunter',
    type: 'comment',
    content:
      'Market feels overextended after 3 consecutive green weeks. Fear & Greed at 78. Taking some profit on alts and rotating into stables. Will re-enter on any meaningful pullback to the 20-day EMA.',
    createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sp-006',
    userId: 'user-mock-6',
    userName: 'GridGuru',
    type: 'trade_idea',
    content:
      'DOGE showing a classic range between 0.14 and 0.17 for the past 10 days. Running a grid bot with 15 levels. Collecting 0.3-0.5% per grid. Perfect for the current low-vol environment.',
    symbol: 'DOGEUSDT',
    direction: 'neutral',
    createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sp-007',
    userId: 'user-mock-7',
    userName: 'SteadyEddie',
    type: 'analysis',
    content:
      'BTC dominance breaking above 54% resistance. This typically signals an alt-season cooldown. Historically, BTC.D above 55% has led to 2-4 weeks of alt underperformance. Staying BTC-heavy for now.',
    symbol: 'BTCUSDT',
    direction: 'bullish',
    createdAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sp-008',
    userId: 'user-mock-8',
    userName: 'MoonShot_Pro',
    type: 'trade_idea',
    content:
      'AVAX looks weak. Head and shoulders forming on the daily with neckline at 32.50. If it breaks, measured move targets 26. Shorting with tight risk above 35.',
    symbol: 'AVAXUSDT',
    direction: 'bearish',
    createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sp-009',
    userId: 'user-mock-1',
    userName: 'CryptoAlpha',
    type: 'comment',
    content:
      'Funding rates across the board are turning negative after the flush. This is actually constructive for longs — the market has reset leverage. Watch for a sharp bounce in the next 24-48h.',
    createdAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sp-010',
    userId: 'user-mock-3',
    userName: 'SwingMaster_X',
    type: 'analysis',
    content:
      'XRP cleared the 0.62 resistance with massive volume. This was a multi-month consolidation breakout. Next major resistance at 0.74. Pullbacks to 0.62 are a buy zone now.',
    symbol: 'XRPUSDT',
    direction: 'bullish',
    createdAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
  },
];

for (const mock of mockPosts) {
  const likeCount = Math.floor(Math.random() * 30) + 1;
  const likes = new Set<string>();
  for (let i = 0; i < likeCount; i++) {
    likes.add(`user-fake-${i}`);
  }
  posts.set(mock.id, { ...mock, likes });
}

// GET /feed — List posts (paginated, newest first)
router.get('/feed', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt((_req.query.page as string) || '1', 10);
    const limit = Math.min(parseInt((_req.query.limit as string) || '20', 10), 50);
    const offset = (page - 1) * limit;

    const allPosts = Array.from(posts.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const paginated = allPosts.slice(offset, offset + limit);
    const total = allPosts.length;

    res.json({
      success: true,
      data: paginated.map(serializePost),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('Get feed error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /post — Create post (auth required)
router.post('/post', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, content, symbol, direction } = req.body;

    if (!type || !['trade_idea', 'analysis', 'comment'].includes(type)) {
      res.status(400).json({ success: false, error: 'Invalid post type' });
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Content is required' });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({ success: false, error: 'Content exceeds 2000 character limit' });
      return;
    }

    if (direction && !['bullish', 'bearish', 'neutral'].includes(direction)) {
      res.status(400).json({ success: false, error: 'Invalid direction' });
      return;
    }

    const post: SocialPost = {
      id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: req.user!.id,
      userName: req.user!.email.split('@')[0],
      type,
      content: content.trim(),
      symbol: symbol?.toUpperCase(),
      direction,
      likes: new Set(),
      createdAt: new Date().toISOString(),
    };

    posts.set(post.id, post);

    res.json({ success: true, data: serializePost(post) });
  } catch (err) {
    logger.error('Create post error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /post/:id/like — Toggle like (auth required)
router.post('/post/:id/like', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = posts.get(req.params.id);
    if (!post) {
      res.status(404).json({ success: false, error: 'Post not found' });
      return;
    }

    const userId = req.user!.id;
    const liked = post.likes.has(userId);

    if (liked) {
      post.likes.delete(userId);
    } else {
      post.likes.add(userId);
    }

    res.json({
      success: true,
      data: { liked: !liked, likeCount: post.likes.size },
    });
  } catch (err) {
    logger.error('Toggle like error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /trending — Top 5 most-discussed symbols
router.get('/trending', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const symbolCounts: Record<string, number> = {};

    for (const post of posts.values()) {
      if (post.symbol) {
        symbolCounts[post.symbol] = (symbolCounts[post.symbol] || 0) + 1;
      }
    }

    const trending = Object.entries(symbolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([symbol, mentions]) => ({ symbol, mentions }));

    res.json({ success: true, data: trending });
  } catch (err) {
    logger.error('Get trending error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
