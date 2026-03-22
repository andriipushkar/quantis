import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import logger from '../config/logger.js';

const router = Router();

// --- Types ---
interface LeadTrader {
  id: string;
  displayName: string;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  totalTrades: number;
  copiers: number;
  riskScore: number;
  badge: 'bronze' | 'silver' | 'gold' | 'platinum';
  monthsProfitable: number;
  avgTradeReturn: number;
  bio: string;
}

// --- Hardcoded mock lead traders ---
const leadTraders: Map<string, LeadTrader> = new Map();

const mockLeaders: LeadTrader[] = [
  {
    id: 'lt-001',
    displayName: 'CryptoAlpha',
    winRate: 72.5,
    totalReturn: 148.3,
    maxDrawdown: 12.4,
    totalTrades: 1247,
    copiers: 384,
    riskScore: 3,
    badge: 'platinum',
    monthsProfitable: 18,
    avgTradeReturn: 2.1,
    bio: 'Systematic trend follower focused on BTC and ETH momentum plays.',
  },
  {
    id: 'lt-002',
    displayName: 'SwingMaster_X',
    winRate: 68.2,
    totalReturn: 95.7,
    maxDrawdown: 18.6,
    totalTrades: 892,
    copiers: 256,
    riskScore: 4,
    badge: 'gold',
    monthsProfitable: 14,
    avgTradeReturn: 3.4,
    bio: 'Swing trader specializing in altcoin breakouts with tight risk management.',
  },
  {
    id: 'lt-003',
    displayName: 'DeFiWhale',
    winRate: 61.8,
    totalReturn: 67.2,
    maxDrawdown: 22.1,
    totalTrades: 534,
    copiers: 189,
    riskScore: 4,
    badge: 'gold',
    monthsProfitable: 11,
    avgTradeReturn: 4.8,
    bio: 'DeFi-native trader leveraging on-chain signals and yield optimization.',
  },
  {
    id: 'lt-004',
    displayName: 'SteadyEddie',
    winRate: 78.4,
    totalReturn: 42.6,
    maxDrawdown: 5.8,
    totalTrades: 2103,
    copiers: 512,
    riskScore: 1,
    badge: 'platinum',
    monthsProfitable: 20,
    avgTradeReturn: 0.8,
    bio: 'Conservative scalper prioritizing capital preservation over outsized gains.',
  },
  {
    id: 'lt-005',
    displayName: 'MoonShot_Pro',
    winRate: 45.3,
    totalReturn: 112.8,
    maxDrawdown: 35.2,
    totalTrades: 678,
    copiers: 142,
    riskScore: 5,
    badge: 'silver',
    monthsProfitable: 9,
    avgTradeReturn: 7.2,
    bio: 'High-conviction plays on low-cap gems. High risk, high reward.',
  },
  {
    id: 'lt-006',
    displayName: 'QuantBot_v2',
    winRate: 65.9,
    totalReturn: 83.4,
    maxDrawdown: 14.7,
    totalTrades: 3456,
    copiers: 298,
    riskScore: 2,
    badge: 'gold',
    monthsProfitable: 13,
    avgTradeReturn: 1.2,
    bio: 'Algorithmic mean-reversion strategy running 24/7 across top-20 pairs.',
  },
  {
    id: 'lt-007',
    displayName: 'NarrativeHunter',
    winRate: 58.1,
    totalReturn: -8.3,
    maxDrawdown: 28.9,
    totalTrades: 312,
    copiers: 67,
    riskScore: 5,
    badge: 'bronze',
    monthsProfitable: 5,
    avgTradeReturn: 2.9,
    bio: 'Narrative-driven trader riding sector rotations in AI, RWA, and meme sectors.',
  },
  {
    id: 'lt-008',
    displayName: 'GridGuru',
    winRate: 71.0,
    totalReturn: 56.9,
    maxDrawdown: 9.3,
    totalTrades: 1876,
    copiers: 221,
    riskScore: 2,
    badge: 'silver',
    monthsProfitable: 10,
    avgTradeReturn: 1.5,
    bio: 'Grid trading specialist exploiting range-bound markets with optimized parameters.',
  },
];

for (const leader of mockLeaders) {
  leadTraders.set(leader.id, leader);
}

// GET /leaders — List top lead traders (public)
router.get('/leaders', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const leaders = Array.from(leadTraders.values()).sort(
      (a, b) => b.totalReturn - a.totalReturn
    );
    res.json({ success: true, data: leaders });
  } catch (err) {
    logger.error('Get leaders error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /leaders/:id — Single leader detail (public)
router.get('/leaders/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const leader = leadTraders.get(req.params.id);
    if (!leader) {
      res.status(404).json({ success: false, error: 'Leader not found' });
      return;
    }
    res.json({ success: true, data: leader });
  } catch (err) {
    logger.error('Get leader detail error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /follow/:id — Start copying a leader (auth required)
router.post('/follow/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const leader = leadTraders.get(req.params.id);
    if (!leader) {
      res.status(404).json({ success: false, error: 'Leader not found' });
      return;
    }

    const { allocation } = req.body;
    if (!allocation || typeof allocation !== 'number' || allocation <= 0) {
      res.status(400).json({ success: false, error: 'Valid allocation amount is required' });
      return;
    }

    const userId = req.user!.id;

    // Check if already following (active relationship)
    const existing = await query(
      `SELECT id FROM copy_relationships WHERE follower_id = $1 AND leader_id = $2 AND active = true`,
      [userId, req.params.id]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: 'Already copying this leader' });
      return;
    }

    const result = await query(
      `INSERT INTO copy_relationships (follower_id, leader_id, allocation)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, req.params.id, allocation]
    );

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        userId: row.follower_id,
        leaderId: row.leader_id,
        allocation: parseFloat(row.allocation),
        startedAt: row.started_at.toISOString(),
        currentPnl: 0,
      },
    });
  } catch (err) {
    logger.error('Follow leader error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /follow/:id — Stop copying (auth required)
router.delete('/follow/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const leaderId = req.params.id;

    const result = await query(
      `DELETE FROM copy_relationships WHERE follower_id = $1 AND leader_id = $2 AND active = true RETURNING id`,
      [userId, leaderId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Copy relationship not found' });
      return;
    }

    res.json({ success: true, message: 'Stopped copying leader' });
  } catch (err) {
    logger.error('Unfollow leader error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /active — My active copy relationships (auth required)
router.get('/active', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT * FROM copy_relationships WHERE follower_id = $1 AND active = true`,
      [userId]
    );

    const active = result.rows.map((rel: Record<string, unknown>) => {
      const leader = leadTraders.get(rel.leader_id as string);
      const startedAt = new Date(rel.started_at as string);
      const elapsedHours = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);
      const allocation = parseFloat(rel.allocation as string);
      const simulatedPnl = leader
        ? allocation * (leader.totalReturn / 100) * (elapsedHours / (24 * 30))
        : 0;

      return {
        id: rel.id as string,
        userId: rel.follower_id as string,
        leaderId: rel.leader_id as string,
        allocation,
        startedAt: startedAt.toISOString(),
        currentPnl: Math.round(simulatedPnl * 100) / 100,
        leaderName: leader?.displayName ?? 'Unknown',
        leaderBadge: leader?.badge ?? 'bronze',
      };
    });

    res.json({ success: true, data: active });
  } catch (err) {
    logger.error('Get active copies error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
