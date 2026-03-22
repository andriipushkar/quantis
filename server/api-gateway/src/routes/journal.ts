import { Router, Response } from 'express';
import { query } from '../config/database.js';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, journalEntrySchema } from '../validators/index.js';

const router = Router();

// --- Types ---

type EmotionalState = 'calm' | 'fomo' | 'revenge' | 'greedy' | 'fearful';
type Direction = 'long' | 'short';

interface JournalEntry {
  id: string;
  pair: string;
  direction: Direction;
  entryPrice: number;
  exitPrice: number | null;
  size: number;
  strategy: string | null;
  emotional_state: EmotionalState | null;
  notes: string | null;
  confidence: number | null;
  timeframe: string | null;
  pnl: number | null;
  pnlPct: number | null;
  createdAt: string;
  updatedAt: string;
}

function calculatePnL(entry: { direction: Direction; entryPrice: number; exitPrice: number; size: number }) {
  const { direction, entryPrice, exitPrice, size } = entry;
  const quantity = size / entryPrice;
  let pnl: number;
  if (direction === 'long') {
    pnl = (exitPrice - entryPrice) * quantity;
  } else {
    pnl = (entryPrice - exitPrice) * quantity;
  }
  const pnlPct = (pnl / size) * 100;
  return {
    pnl: Math.round(pnl * 100) / 100,
    pnlPct: Math.round(pnlPct * 100) / 100,
  };
}

const VALID_EMOTIONS: EmotionalState[] = ['calm', 'fomo', 'revenge', 'greedy', 'fearful'];

function rowToEntry(r: Record<string, unknown>): JournalEntry {
  return {
    id: r.id as string,
    pair: r.pair as string,
    direction: r.direction as Direction,
    entryPrice: parseFloat(r.entry_price as string),
    exitPrice: r.exit_price != null ? parseFloat(r.exit_price as string) : null,
    size: parseFloat(r.size as string),
    strategy: (r.strategy as string) || null,
    emotional_state: (r.emotional_state as EmotionalState) || null,
    notes: (r.notes as string) || null,
    confidence: r.confidence != null ? Number(r.confidence) : null,
    timeframe: (r.timeframe as string) || null,
    pnl: r.pnl != null ? parseFloat(r.pnl as string) : null,
    pnlPct: r.pnl_pct != null ? parseFloat(r.pnl_pct as string) : null,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

// --- Routes ---

router.use(authenticate);

// GET /stats — Aggregated stats
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const totalResult = await query(
      `SELECT COUNT(*) AS total FROM journal_entries WHERE user_id = $1`,
      [userId]
    );
    const totalEntries = parseInt(totalResult.rows[0].total, 10);

    const statsResult = await query(
      `SELECT
         COUNT(*) AS closed_trades,
         COUNT(*) FILTER (WHERE pnl > 0) AS wins,
         COUNT(*) FILTER (WHERE pnl < 0) AS losses,
         COALESCE(AVG(pnl) FILTER (WHERE pnl > 0), 0) AS avg_win,
         COALESCE(AVG(pnl) FILTER (WHERE pnl < 0), 0) AS avg_loss,
         COALESCE(MAX(pnl), 0) AS best_trade,
         COALESCE(MIN(pnl), 0) AS worst_trade,
         COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0) AS total_wins,
         COALESCE(SUM(ABS(pnl)) FILTER (WHERE pnl < 0), 0) AS total_losses
       FROM journal_entries
       WHERE user_id = $1 AND exit_price IS NOT NULL AND pnl IS NOT NULL`,
      [userId]
    );

    const s = statsResult.rows[0];
    const closedTrades = parseInt(s.closed_trades, 10);

    if (closedTrades === 0) {
      res.json({
        success: true,
        data: {
          totalTrades: totalEntries,
          closedTrades: 0,
          winRate: 0,
          avgWin: 0,
          avgLoss: 0,
          bestTrade: 0,
          worstTrade: 0,
          profitFactor: 0,
        },
      });
      return;
    }

    const wins = parseInt(s.wins, 10);
    const winRate = Math.round((wins / closedTrades) * 10000) / 100;
    const avgWin = Math.round(parseFloat(s.avg_win) * 100) / 100;
    const avgLoss = Math.round(parseFloat(s.avg_loss) * 100) / 100;
    const bestTrade = parseFloat(s.best_trade);
    const worstTrade = parseFloat(s.worst_trade);
    const totalWins = parseFloat(s.total_wins);
    const totalLosses = parseFloat(s.total_losses);
    const profitFactor = totalLosses > 0
      ? Math.round((totalWins / totalLosses) * 100) / 100
      : totalWins > 0 ? Infinity : 0;

    res.json({
      success: true,
      data: {
        totalTrades: totalEntries,
        closedTrades,
        winRate,
        avgWin,
        avgLoss,
        bestTrade,
        worstTrade,
        profitFactor,
      },
    });
  } catch (err) {
    logger.error('Journal stats error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET / — List journal entries
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user!.id]
    );
    res.json({ success: true, data: result.rows.map(rowToEntry) });
  } catch (err) {
    logger.error('Journal list error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST / — Add journal entry
router.post('/', validateBody(journalEntrySchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pair, direction, entryPrice, exitPrice, size, strategy, emotional_state, notes, confidence, timeframe } = req.body;

    const parsedEntry = entryPrice;
    const parsedSize = size;
    const parsedExit = exitPrice ?? null;

    let pnl: number | null = null;
    let pnlPct: number | null = null;

    if (parsedExit !== null && parsedExit > 0) {
      const calc = calculatePnL({ direction, entryPrice: parsedEntry, exitPrice: parsedExit, size: parsedSize });
      pnl = calc.pnl;
      pnlPct = calc.pnlPct;
    }

    const result = await query(
      `INSERT INTO journal_entries (user_id, pair, direction, entry_price, exit_price, size, strategy, emotional_state, notes, confidence, timeframe, pnl, pnl_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        req.user!.id,
        pair.toUpperCase(),
        direction,
        parsedEntry,
        parsedExit,
        parsedSize,
        strategy || null,
        emotional_state || null,
        notes || null,
        confidence ?? null,
        timeframe || null,
        pnl,
        pnlPct,
      ]
    );

    res.status(201).json({ success: true, data: rowToEntry(result.rows[0]) });
  } catch (err) {
    logger.error('Journal create error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /:id — Update entry
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await query(
      `SELECT * FROM journal_entries WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Journal entry not found' });
      return;
    }

    const entry = existing.rows[0];
    const { exitPrice, notes, strategy, emotional_state, confidence, timeframe } = req.body;

    let newExitPrice = entry.exit_price;
    let newPnl = entry.pnl;
    let newPnlPct = entry.pnl_pct;
    let newNotes = entry.notes;
    let newStrategy = entry.strategy;
    let newEmotionalState = entry.emotional_state;
    let newConfidence = entry.confidence;
    let newTimeframe = entry.timeframe;

    if (exitPrice !== undefined) {
      const parsedExit = parseFloat(exitPrice);
      if (!isNaN(parsedExit) && parsedExit > 0) {
        newExitPrice = parsedExit;
        const calc = calculatePnL({
          direction: entry.direction,
          entryPrice: parseFloat(entry.entry_price),
          exitPrice: parsedExit,
          size: parseFloat(entry.size),
        });
        newPnl = calc.pnl;
        newPnlPct = calc.pnlPct;
      }
    }

    if (notes !== undefined) newNotes = notes;
    if (strategy !== undefined) newStrategy = strategy;
    if (emotional_state !== undefined) {
      if (emotional_state && !VALID_EMOTIONS.includes(emotional_state)) {
        res.status(400).json({ success: false, error: `emotional_state must be one of: ${VALID_EMOTIONS.join(', ')}` });
        return;
      }
      newEmotionalState = emotional_state;
    }
    if (confidence !== undefined) {
      if (confidence !== null && (confidence < 1 || confidence > 5)) {
        res.status(400).json({ success: false, error: 'confidence must be between 1 and 5' });
        return;
      }
      newConfidence = confidence;
    }
    if (timeframe !== undefined) newTimeframe = timeframe;

    const result = await query(
      `UPDATE journal_entries
       SET exit_price = $1, pnl = $2, pnl_pct = $3, notes = $4, strategy = $5,
           emotional_state = $6, confidence = $7, timeframe = $8, updated_at = NOW()
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [newExitPrice, newPnl, newPnlPct, newNotes, newStrategy, newEmotionalState, newConfidence, newTimeframe, req.params.id, req.user!.id]
    );

    res.json({ success: true, data: rowToEntry(result.rows[0]) });
  } catch (err) {
    logger.error('Journal update error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /:id — Delete entry
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `DELETE FROM journal_entries WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Journal entry not found' });
      return;
    }

    res.json({ success: true, message: 'Entry deleted' });
  } catch (err) {
    logger.error('Journal delete error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
