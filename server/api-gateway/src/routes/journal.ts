import { Router, Response } from 'express';
import logger from '../config/logger.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

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

// --- In-memory store per user ---

const journals = new Map<string, Map<string, JournalEntry>>();

function getUserJournal(userId: string): Map<string, JournalEntry> {
  if (!journals.has(userId)) {
    journals.set(userId, new Map());
  }
  return journals.get(userId)!;
}

function generateId(): string {
  return `j_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
const VALID_DIRECTIONS: Direction[] = ['long', 'short'];

// --- Routes ---

router.use(authenticate);

// GET /stats — Aggregated stats
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const journal = getUserJournal(req.user!.id);
    const entries = Array.from(journal.values());

    const closedTrades = entries.filter((e) => e.exitPrice !== null && e.pnl !== null);
    const totalTrades = closedTrades.length;

    if (totalTrades === 0) {
      res.json({
        success: true,
        data: {
          totalTrades: entries.length,
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

    const wins = closedTrades.filter((t) => t.pnl! > 0);
    const losses = closedTrades.filter((t) => t.pnl! < 0);

    const winRate = Math.round((wins.length / totalTrades) * 10000) / 100;
    const avgWin = wins.length > 0
      ? Math.round((wins.reduce((s, t) => s + t.pnl!, 0) / wins.length) * 100) / 100
      : 0;
    const avgLoss = losses.length > 0
      ? Math.round((losses.reduce((s, t) => s + t.pnl!, 0) / losses.length) * 100) / 100
      : 0;

    const totalWins = wins.reduce((s, t) => s + t.pnl!, 0);
    const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnl!, 0));
    const profitFactor = totalLosses > 0
      ? Math.round((totalWins / totalLosses) * 100) / 100
      : totalWins > 0 ? Infinity : 0;

    const allPnls = closedTrades.map((t) => t.pnl!);
    const bestTrade = Math.max(...allPnls);
    const worstTrade = Math.min(...allPnls);

    res.json({
      success: true,
      data: {
        totalTrades: entries.length,
        closedTrades: totalTrades,
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
    const journal = getUserJournal(req.user!.id);
    const entries = Array.from(journal.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ success: true, data: entries });
  } catch (err) {
    logger.error('Journal list error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST / — Add journal entry
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pair, direction, entryPrice, exitPrice, size, strategy, emotional_state, notes, confidence, timeframe } = req.body;

    if (!pair || !direction || entryPrice === undefined || !size) {
      res.status(400).json({ success: false, error: 'pair, direction, entryPrice, and size are required' });
      return;
    }

    if (!VALID_DIRECTIONS.includes(direction)) {
      res.status(400).json({ success: false, error: 'direction must be "long" or "short"' });
      return;
    }

    const parsedEntry = parseFloat(entryPrice);
    const parsedSize = parseFloat(size);
    if (isNaN(parsedEntry) || parsedEntry <= 0 || isNaN(parsedSize) || parsedSize <= 0) {
      res.status(400).json({ success: false, error: 'entryPrice and size must be positive numbers' });
      return;
    }

    if (emotional_state && !VALID_EMOTIONS.includes(emotional_state)) {
      res.status(400).json({ success: false, error: `emotional_state must be one of: ${VALID_EMOTIONS.join(', ')}` });
      return;
    }

    if (confidence !== undefined && (confidence < 1 || confidence > 5)) {
      res.status(400).json({ success: false, error: 'confidence must be between 1 and 5' });
      return;
    }

    let pnl: number | null = null;
    let pnlPct: number | null = null;
    const parsedExit = exitPrice !== undefined && exitPrice !== null ? parseFloat(exitPrice) : null;

    if (parsedExit !== null && !isNaN(parsedExit) && parsedExit > 0) {
      const calc = calculatePnL({ direction, entryPrice: parsedEntry, exitPrice: parsedExit, size: parsedSize });
      pnl = calc.pnl;
      pnlPct = calc.pnlPct;
    }

    const id = generateId();
    const now = new Date().toISOString();

    const entry: JournalEntry = {
      id,
      pair: pair.toUpperCase(),
      direction,
      entryPrice: parsedEntry,
      exitPrice: parsedExit,
      size: parsedSize,
      strategy: strategy || null,
      emotional_state: emotional_state || null,
      notes: notes || null,
      confidence: confidence ?? null,
      timeframe: timeframe || null,
      pnl,
      pnlPct,
      createdAt: now,
      updatedAt: now,
    };

    const journal = getUserJournal(req.user!.id);
    journal.set(id, entry);

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    logger.error('Journal create error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /:id — Update entry
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const journal = getUserJournal(req.user!.id);
    const entry = journal.get(req.params.id);

    if (!entry) {
      res.status(404).json({ success: false, error: 'Journal entry not found' });
      return;
    }

    const { exitPrice, notes, strategy, emotional_state, confidence, timeframe } = req.body;

    if (exitPrice !== undefined) {
      const parsedExit = parseFloat(exitPrice);
      if (!isNaN(parsedExit) && parsedExit > 0) {
        entry.exitPrice = parsedExit;
        const calc = calculatePnL({
          direction: entry.direction,
          entryPrice: entry.entryPrice,
          exitPrice: parsedExit,
          size: entry.size,
        });
        entry.pnl = calc.pnl;
        entry.pnlPct = calc.pnlPct;
      }
    }

    if (notes !== undefined) entry.notes = notes;
    if (strategy !== undefined) entry.strategy = strategy;
    if (emotional_state !== undefined) {
      if (emotional_state && !VALID_EMOTIONS.includes(emotional_state)) {
        res.status(400).json({ success: false, error: `emotional_state must be one of: ${VALID_EMOTIONS.join(', ')}` });
        return;
      }
      entry.emotional_state = emotional_state;
    }
    if (confidence !== undefined) {
      if (confidence !== null && (confidence < 1 || confidence > 5)) {
        res.status(400).json({ success: false, error: 'confidence must be between 1 and 5' });
        return;
      }
      entry.confidence = confidence;
    }
    if (timeframe !== undefined) entry.timeframe = timeframe;

    entry.updatedAt = new Date().toISOString();
    journal.set(entry.id, entry);

    res.json({ success: true, data: entry });
  } catch (err) {
    logger.error('Journal update error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /:id — Delete entry
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const journal = getUserJournal(req.user!.id);

    if (!journal.has(req.params.id)) {
      res.status(404).json({ success: false, error: 'Journal entry not found' });
      return;
    }

    journal.delete(req.params.id);
    res.json({ success: true, message: 'Entry deleted' });
  } catch (err) {
    logger.error('Journal delete error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
