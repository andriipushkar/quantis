/**
 * Trading Journal — Unit Tests
 *
 * Tests the pure business logic: PnL calculations, win rate, profit factor,
 * stats aggregation, emotional state tracking, and CRUD operations.
 */

// ---------------------------------------------------------------------------
// Types and helpers mirrored from routes/journal.ts
// ---------------------------------------------------------------------------

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

const VALID_EMOTIONS: EmotionalState[] = ['calm', 'fomo', 'revenge', 'greedy', 'fearful'];
const VALID_DIRECTIONS: Direction[] = ['long', 'short'];

/** Exact copy of calculatePnL from routes/journal.ts */
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

/** Stats aggregation mirrored from GET /stats */
function computeStats(entries: JournalEntry[]) {
  const closedTrades = entries.filter((e) => e.exitPrice !== null && e.pnl !== null);
  const totalTrades = closedTrades.length;

  if (totalTrades === 0) {
    return {
      totalTrades: entries.length,
      closedTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      profitFactor: 0,
    };
  }

  const wins = closedTrades.filter((t) => t.pnl! > 0);
  const losses = closedTrades.filter((t) => t.pnl! < 0);

  const winRate = Math.round((wins.length / totalTrades) * 10000) / 100;
  const avgWin =
    wins.length > 0
      ? Math.round((wins.reduce((s, t) => s + t.pnl!, 0) / wins.length) * 100) / 100
      : 0;
  const avgLoss =
    losses.length > 0
      ? Math.round((losses.reduce((s, t) => s + t.pnl!, 0) / losses.length) * 100) / 100
      : 0;

  const totalWins = wins.reduce((s, t) => s + t.pnl!, 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnl!, 0));
  const profitFactor =
    totalLosses > 0
      ? Math.round((totalWins / totalLosses) * 100) / 100
      : totalWins > 0
        ? Infinity
        : 0;

  const allPnls = closedTrades.map((t) => t.pnl!);
  const bestTrade = Math.max(...allPnls);
  const worstTrade = Math.min(...allPnls);

  return {
    totalTrades: entries.length,
    closedTrades: totalTrades,
    winRate,
    avgWin,
    avgLoss,
    bestTrade,
    worstTrade,
    profitFactor,
  };
}

// ---------------------------------------------------------------------------
// Journal store helper
// ---------------------------------------------------------------------------

let idCounter = 0;
function makeEntry(overrides: Partial<JournalEntry> & Pick<JournalEntry, 'pair' | 'direction' | 'entryPrice' | 'size'>): JournalEntry {
  idCounter++;
  const base: JournalEntry = {
    id: `j_test_${idCounter}`,
    pair: overrides.pair,
    direction: overrides.direction,
    entryPrice: overrides.entryPrice,
    exitPrice: overrides.exitPrice ?? null,
    size: overrides.size,
    strategy: overrides.strategy ?? null,
    emotional_state: overrides.emotional_state ?? null,
    notes: overrides.notes ?? null,
    confidence: overrides.confidence ?? null,
    timeframe: overrides.timeframe ?? null,
    pnl: null,
    pnlPct: null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };

  if (base.exitPrice !== null && base.exitPrice > 0) {
    const calc = calculatePnL({ direction: base.direction, entryPrice: base.entryPrice, exitPrice: base.exitPrice, size: base.size });
    base.pnl = calc.pnl;
    base.pnlPct = calc.pnlPct;
  }

  return base;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Journal — PnL Calculation (Long)', () => {
  test('profitable long trade: (exit - entry) * quantity', () => {
    const result = calculatePnL({ direction: 'long', entryPrice: 100, exitPrice: 120, size: 1000 });
    // quantity = 1000/100 = 10, pnl = (120 - 100) * 10 = 200
    expect(result.pnl).toBe(200);
    expect(result.pnlPct).toBe(20);
  });

  test('losing long trade', () => {
    const result = calculatePnL({ direction: 'long', entryPrice: 100, exitPrice: 80, size: 1000 });
    // quantity = 10, pnl = (80 - 100) * 10 = -200
    expect(result.pnl).toBe(-200);
    expect(result.pnlPct).toBe(-20);
  });

  test('break-even long trade', () => {
    const result = calculatePnL({ direction: 'long', entryPrice: 100, exitPrice: 100, size: 500 });
    expect(result.pnl).toBe(0);
    expect(result.pnlPct).toBe(0);
  });
});

describe('Journal — PnL Calculation (Short)', () => {
  test('profitable short trade: (entry - exit) * quantity', () => {
    const result = calculatePnL({ direction: 'short', entryPrice: 100, exitPrice: 80, size: 1000 });
    // quantity = 10, pnl = (100 - 80) * 10 = 200
    expect(result.pnl).toBe(200);
    expect(result.pnlPct).toBe(20);
  });

  test('losing short trade', () => {
    const result = calculatePnL({ direction: 'short', entryPrice: 100, exitPrice: 120, size: 1000 });
    expect(result.pnl).toBe(-200);
    expect(result.pnlPct).toBe(-20);
  });

  test('break-even short trade', () => {
    const result = calculatePnL({ direction: 'short', entryPrice: 50, exitPrice: 50, size: 500 });
    expect(result.pnl).toBe(0);
    expect(result.pnlPct).toBe(0);
  });
});

describe('Journal — PnL Percentage', () => {
  test('pnlPct = (pnl / size) * 100', () => {
    const result = calculatePnL({ direction: 'long', entryPrice: 200, exitPrice: 220, size: 2000 });
    // quantity = 2000/200 = 10, pnl = 20 * 10 = 200, pnlPct = (200/2000)*100 = 10%
    expect(result.pnlPct).toBe(10);
  });

  test('small fractional pnlPct is rounded to 2 decimals', () => {
    const result = calculatePnL({ direction: 'long', entryPrice: 100, exitPrice: 100.33, size: 300 });
    // quantity = 3, pnl = 0.33*3 = 0.99, pnlPct = (0.99/300)*100 = 0.33
    expect(result.pnl).toBe(0.99);
    expect(result.pnlPct).toBe(0.33);
  });
});

describe('Journal — Win Rate', () => {
  test('all winners => 100%', () => {
    const entries = [
      makeEntry({ pair: 'BTCUSDT', direction: 'long', entryPrice: 100, exitPrice: 120, size: 1000 }),
      makeEntry({ pair: 'ETHUSDT', direction: 'long', entryPrice: 50, exitPrice: 60, size: 500 }),
    ];
    const stats = computeStats(entries);
    expect(stats.winRate).toBe(100);
  });

  test('all losers => 0%', () => {
    const entries = [
      makeEntry({ pair: 'BTCUSDT', direction: 'long', entryPrice: 100, exitPrice: 80, size: 1000 }),
      makeEntry({ pair: 'ETHUSDT', direction: 'short', entryPrice: 50, exitPrice: 60, size: 500 }),
    ];
    const stats = computeStats(entries);
    expect(stats.winRate).toBe(0);
  });

  test('mixed: 2 wins, 1 loss => 66.67%', () => {
    const entries = [
      makeEntry({ pair: 'BTCUSDT', direction: 'long', entryPrice: 100, exitPrice: 120, size: 1000 }),
      makeEntry({ pair: 'ETHUSDT', direction: 'long', entryPrice: 50, exitPrice: 55, size: 500 }),
      makeEntry({ pair: 'SOLUSDT', direction: 'long', entryPrice: 30, exitPrice: 25, size: 300 }),
    ];
    const stats = computeStats(entries);
    expect(stats.winRate).toBe(66.67);
  });

  test('no closed trades => 0%', () => {
    const entries = [
      makeEntry({ pair: 'BTCUSDT', direction: 'long', entryPrice: 100, size: 1000 }),
    ];
    const stats = computeStats(entries);
    expect(stats.winRate).toBe(0);
    expect(stats.closedTrades).toBe(0);
    expect(stats.totalTrades).toBe(1);
  });
});

describe('Journal — Profit Factor', () => {
  test('profit factor = gross wins / gross losses', () => {
    const entries = [
      makeEntry({ pair: 'BTCUSDT', direction: 'long', entryPrice: 100, exitPrice: 150, size: 1000 }), // +500
      makeEntry({ pair: 'ETHUSDT', direction: 'long', entryPrice: 100, exitPrice: 75, size: 1000 }),  // -250
    ];
    const stats = computeStats(entries);
    // totalWins = 500, totalLosses = 250, factor = 2
    expect(stats.profitFactor).toBe(2);
  });

  test('no losses => Infinity', () => {
    const entries = [
      makeEntry({ pair: 'BTCUSDT', direction: 'long', entryPrice: 100, exitPrice: 120, size: 1000 }),
    ];
    const stats = computeStats(entries);
    expect(stats.profitFactor).toBe(Infinity);
  });

  test('no wins and no losses (break-even trades not counted) => 0', () => {
    const entries = [
      makeEntry({ pair: 'BTCUSDT', direction: 'long', entryPrice: 100, exitPrice: 100, size: 1000 }),
    ];
    const stats = computeStats(entries);
    // pnl = 0, not a win, not a loss => totalWins=0, totalLosses=0 => 0
    expect(stats.profitFactor).toBe(0);
  });

  test('profit factor < 1 when losses > wins', () => {
    const entries = [
      makeEntry({ pair: 'BTCUSDT', direction: 'long', entryPrice: 100, exitPrice: 110, size: 1000 }), // +100
      makeEntry({ pair: 'ETHUSDT', direction: 'long', entryPrice: 100, exitPrice: 70, size: 1000 }),  // -300
    ];
    const stats = computeStats(entries);
    expect(stats.profitFactor).toBeLessThan(1);
    // 100 / 300 = 0.33
    expect(stats.profitFactor).toBe(0.33);
  });
});

describe('Journal — Stats Aggregation', () => {
  const entries = [
    makeEntry({ pair: 'BTCUSDT', direction: 'long', entryPrice: 100, exitPrice: 150, size: 1000 }), // +500
    makeEntry({ pair: 'ETHUSDT', direction: 'short', entryPrice: 100, exitPrice: 80, size: 1000 }),  // +200
    makeEntry({ pair: 'SOLUSDT', direction: 'long', entryPrice: 100, exitPrice: 90, size: 1000 }),   // -100
    makeEntry({ pair: 'DOTUSDT', direction: 'long', entryPrice: 100, size: 1000 }),                   // open
  ];

  let stats: ReturnType<typeof computeStats>;
  beforeAll(() => {
    stats = computeStats(entries);
  });

  test('totalTrades includes open positions', () => {
    expect(stats.totalTrades).toBe(4);
  });

  test('closedTrades excludes open positions', () => {
    expect(stats.closedTrades).toBe(3);
  });

  test('bestTrade is maximum PnL', () => {
    expect(stats.bestTrade).toBe(500);
  });

  test('worstTrade is minimum PnL', () => {
    expect(stats.worstTrade).toBe(-100);
  });

  test('avgWin is average of positive PnLs', () => {
    // wins: 500, 200 => avg = 350
    expect(stats.avgWin).toBe(350);
  });

  test('avgLoss is average of negative PnLs', () => {
    // losses: -100 => avg = -100
    expect(stats.avgLoss).toBe(-100);
  });

  test('winRate for 2/3 closed = 66.67%', () => {
    expect(stats.winRate).toBe(66.67);
  });
});

describe('Journal — Entry Creation', () => {
  test('creates entry with all required fields', () => {
    const entry = makeEntry({
      pair: 'btcusdt',
      direction: 'long',
      entryPrice: 50000,
      size: 1000,
    });
    expect(entry.pair).toBe('btcusdt'); // route uppercases but our helper does not
    expect(entry.direction).toBe('long');
    expect(entry.entryPrice).toBe(50000);
    expect(entry.size).toBe(1000);
    expect(entry.exitPrice).toBeNull();
    expect(entry.pnl).toBeNull();
    expect(entry.pnlPct).toBeNull();
    expect(entry.id).toBeDefined();
    expect(entry.createdAt).toBeDefined();
  });

  test('computes PnL when exitPrice is provided', () => {
    const entry = makeEntry({
      pair: 'ETHUSDT',
      direction: 'long',
      entryPrice: 2000,
      exitPrice: 2200,
      size: 4000,
    });
    expect(entry.pnl).not.toBeNull();
    expect(entry.pnlPct).not.toBeNull();
    // quantity = 4000/2000 = 2, pnl = (2200-2000)*2 = 400
    expect(entry.pnl).toBe(400);
    expect(entry.pnlPct).toBe(10);
  });

  test('optional fields default to null', () => {
    const entry = makeEntry({
      pair: 'SOLUSDT',
      direction: 'short',
      entryPrice: 100,
      size: 500,
    });
    expect(entry.strategy).toBeNull();
    expect(entry.emotional_state).toBeNull();
    expect(entry.notes).toBeNull();
    expect(entry.confidence).toBeNull();
    expect(entry.timeframe).toBeNull();
  });

  test('preserves optional fields when provided', () => {
    const entry = makeEntry({
      pair: 'BTCUSDT',
      direction: 'long',
      entryPrice: 60000,
      size: 3000,
      strategy: 'breakout',
      emotional_state: 'calm',
      notes: 'Strong support bounce',
      confidence: 4,
      timeframe: '4h',
    });
    expect(entry.strategy).toBe('breakout');
    expect(entry.emotional_state).toBe('calm');
    expect(entry.notes).toBe('Strong support bounce');
    expect(entry.confidence).toBe(4);
    expect(entry.timeframe).toBe('4h');
  });
});

describe('Journal — Emotional State Tracking', () => {
  test('all valid emotional states are accepted', () => {
    for (const emotion of VALID_EMOTIONS) {
      expect(VALID_EMOTIONS).toContain(emotion);
      const entry = makeEntry({
        pair: 'BTCUSDT',
        direction: 'long',
        entryPrice: 100,
        size: 100,
        emotional_state: emotion,
      });
      expect(entry.emotional_state).toBe(emotion);
    }
  });

  test('invalid emotional state is detectable', () => {
    const invalid = 'excited';
    expect(VALID_EMOTIONS.includes(invalid as EmotionalState)).toBe(false);
  });

  test('emotional state tracking across multiple trades', () => {
    const entries = [
      makeEntry({ pair: 'BTCUSDT', direction: 'long', entryPrice: 100, exitPrice: 120, size: 1000, emotional_state: 'calm' }),
      makeEntry({ pair: 'ETHUSDT', direction: 'long', entryPrice: 100, exitPrice: 80, size: 1000, emotional_state: 'fomo' }),
      makeEntry({ pair: 'SOLUSDT', direction: 'long', entryPrice: 100, exitPrice: 70, size: 1000, emotional_state: 'revenge' }),
      makeEntry({ pair: 'DOTUSDT', direction: 'long', entryPrice: 100, exitPrice: 110, size: 1000, emotional_state: 'calm' }),
    ];

    const calmTrades = entries.filter((e) => e.emotional_state === 'calm');
    const fomoTrades = entries.filter((e) => e.emotional_state === 'fomo');
    const revengeTrades = entries.filter((e) => e.emotional_state === 'revenge');

    // Calm trades are winners
    expect(calmTrades.every((t) => t.pnl! > 0)).toBe(true);
    // FOMO and revenge trades are losers
    expect(fomoTrades.every((t) => t.pnl! < 0)).toBe(true);
    expect(revengeTrades.every((t) => t.pnl! < 0)).toBe(true);
  });
});

describe('Journal — Direction Validation', () => {
  test('valid directions are long and short', () => {
    expect(VALID_DIRECTIONS).toEqual(['long', 'short']);
  });

  test('invalid direction is detectable', () => {
    expect(VALID_DIRECTIONS.includes('market' as Direction)).toBe(false);
  });
});

describe('Journal — Edge Cases', () => {
  test('very small trade size', () => {
    const result = calculatePnL({ direction: 'long', entryPrice: 50000, exitPrice: 51000, size: 10 });
    // quantity = 10/50000 = 0.0002, pnl = 1000 * 0.0002 = 0.2
    expect(result.pnl).toBe(0.2);
  });

  test('large trade values', () => {
    const result = calculatePnL({ direction: 'long', entryPrice: 50000, exitPrice: 55000, size: 1000000 });
    // quantity = 20, pnl = 5000 * 20 = 100000
    expect(result.pnl).toBe(100000);
    expect(result.pnlPct).toBe(10);
  });

  test('stats with empty entries array', () => {
    const stats = computeStats([]);
    expect(stats.totalTrades).toBe(0);
    expect(stats.closedTrades).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.profitFactor).toBe(0);
  });
});
