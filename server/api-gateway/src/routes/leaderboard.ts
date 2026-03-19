import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import logger from '../config/logger.js';

const router = Router();

// GET /paper — Mock paper trading leaderboard
router.get('/paper', async (_req: Request, res: Response) => {
  try {
    // Generate 10 mock traders with realistic stats
    const mockTraders = [
      { rank: 1, displayName: 'CryptoWhale_42', returnPct: 34.7, totalTrades: 128, winRate: 72.3 },
      { rank: 2, displayName: 'AlphaTrader', returnPct: 28.3, totalTrades: 95, winRate: 68.9 },
      { rank: 3, displayName: 'MoonShot99', returnPct: 22.1, totalTrades: 203, winRate: 61.5 },
      { rank: 4, displayName: 'SatoshiFan', returnPct: 18.9, totalTrades: 67, winRate: 65.2 },
      { rank: 5, displayName: 'DeFiKing', returnPct: 15.4, totalTrades: 156, winRate: 59.8 },
      { rank: 6, displayName: 'BlockRunner', returnPct: 12.8, totalTrades: 89, winRate: 57.3 },
      { rank: 7, displayName: 'TokenHunter', returnPct: 10.2, totalTrades: 112, winRate: 55.1 },
      { rank: 8, displayName: 'ChartMaster', returnPct: 8.5, totalTrades: 74, winRate: 54.6 },
      { rank: 9, displayName: 'BullBear_X', returnPct: 5.1, totalTrades: 143, winRate: 52.0 },
      { rank: 10, displayName: 'CoinSurfer', returnPct: 3.7, totalTrades: 51, winRate: 50.9 },
    ];

    res.json({ success: true, data: mockTraders });
  } catch (err) {
    logger.error('Paper leaderboard error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /signals — Strategy performance from signals table
router.get('/signals', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
         s.strategy,
         COUNT(*)::int as total_signals,
         ROUND(AVG(s.confidence)::numeric, 2) as avg_confidence,
         COUNT(CASE WHEN s.result_pnl > 0 THEN 1 END)::int as wins,
         COUNT(CASE WHEN s.result_pnl IS NOT NULL THEN 1 END)::int as closed
       FROM signals s
       GROUP BY s.strategy
       ORDER BY COUNT(CASE WHEN s.result_pnl > 0 THEN 1 END)::float / NULLIF(COUNT(CASE WHEN s.result_pnl IS NOT NULL THEN 1 END), 0) DESC NULLS LAST`
    );

    const strategies = result.rows.map((row: {
      strategy: string;
      total_signals: number;
      avg_confidence: string;
      wins: number;
      closed: number;
    }) => ({
      strategy: row.strategy,
      totalSignals: row.total_signals,
      avgConfidence: parseFloat(row.avg_confidence) || 0,
      winRate: row.closed > 0 ? Math.round((row.wins / row.closed) * 10000) / 100 : 0,
      wins: row.wins,
      closed: row.closed,
    }));

    res.json({ success: true, data: strategies });
  } catch (err) {
    logger.error('Signal leaderboard error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
