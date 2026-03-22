/**
 * Tax Reporting — Unit Tests
 *
 * Tests the pure business logic: holding period calculation, gain/loss
 * classification, cost basis aggregation, report building, CSV export,
 * and asset-level summaries.
 */

// ---------------------------------------------------------------------------
// Types mirrored from routes/tax.ts
// ---------------------------------------------------------------------------

interface TaxTrade {
  pair: string;
  direction: string;
  entry: number;
  exit: number;
  pnl: number;
  pnlPct: number;
  date: string;
  holdingPeriod: string;
}

interface AssetSummary {
  symbol: string;
  totalPnl: number;
  tradeCount: number;
}

interface TaxReport {
  year: number;
  totalGains: number;
  totalLosses: number;
  netPnl: number;
  shortTermGains: number;
  longTermGains: number;
  totalTrades: number;
  trades: TaxTrade[];
  byAsset: AssetSummary[];
}

// ---------------------------------------------------------------------------
// Helpers — exact copies from routes/tax.ts
// ---------------------------------------------------------------------------

/** Compute a human-readable holding period between two ISO date strings. */
function holdingPeriod(openedAt: string, closedAt: string): string {
  const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  if (ms < 0) return '0d';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours}h`;
  }
  if (days < 365) return `${days}d`;
  const years = Math.floor(days / 365);
  const remaining = days % 365;
  return `${years}y ${remaining}d`;
}

/** Extract base symbol from pair string (mirrors route logic). */
function extractSymbol(pair: string): string {
  const base = pair.replace(/\/.*$/, '').replace(/USDT?$/, '');
  return base || pair;
}

/**
 * Build a tax report from an array of raw trade objects.
 * Mirrors POST /report logic from routes/tax.ts.
 */
function buildReportFromTrades(
  rawTrades: Array<{
    pnl?: number | string;
    pnlPct?: number | string;
    entry?: number | string;
    entryPrice?: number | string;
    exit?: number | string;
    exitPrice?: number | string;
    pair?: string;
    symbol?: string;
    direction?: string;
    side?: string;
    date?: string;
    closedAt?: string;
    createdAt?: string;
    holdingPeriod?: string;
    openedAt?: string;
  }>,
  year: number,
): TaxReport {
  const trades: TaxTrade[] = [];
  const assetMap = new Map<string, { totalPnl: number; tradeCount: number }>();
  let totalGains = 0;
  let totalLosses = 0;

  for (const t of rawTrades) {
    const pnl = parseFloat(String(t.pnl)) || 0;
    const pnlPct = parseFloat(String(t.pnlPct)) || 0;
    const entry = parseFloat(String(t.entry || t.entryPrice)) || 0;
    const exit = parseFloat(String(t.exit || t.exitPrice)) || 0;
    const pair = t.pair || t.symbol || 'UNKNOWN';
    const direction = t.direction || t.side || 'long';
    const date = t.date || t.closedAt || t.createdAt || new Date().toISOString();
    const hp = t.holdingPeriod || holdingPeriod(t.openedAt || date, t.closedAt || date);

    trades.push({ pair, direction, entry, exit, pnl, pnlPct, date, holdingPeriod: hp });

    if (pnl > 0) totalGains += pnl;
    else totalLosses += Math.abs(pnl);

    const symbol = extractSymbol(pair);
    const existing = assetMap.get(symbol);
    if (existing) {
      existing.totalPnl += pnl;
      existing.tradeCount += 1;
    } else {
      assetMap.set(symbol, { totalPnl: pnl, tradeCount: 1 });
    }
  }

  totalGains = Math.round(totalGains * 100) / 100;
  totalLosses = Math.round(totalLosses * 100) / 100;

  const byAsset: AssetSummary[] = Array.from(assetMap.entries()).map(([symbol, data]) => ({
    symbol,
    totalPnl: Math.round(data.totalPnl * 100) / 100,
    tradeCount: data.tradeCount,
  }));

  return {
    year,
    totalGains,
    totalLosses,
    netPnl: Math.round((totalGains - totalLosses) * 100) / 100,
    shortTermGains: totalGains, // MVP: all short-term
    longTermGains: 0,
    totalTrades: trades.length,
    trades,
    byAsset,
  };
}

/** Generate CSV string from report (mirrors GET /export). */
function generateCSV(report: TaxReport): string {
  const headers = ['Date', 'Pair', 'Direction', 'Entry Price', 'Exit Price', 'P&L USD', 'P&L %', 'Holding Period'];
  const rows = report.trades.map((t) => [
    t.date,
    t.pair,
    t.direction,
    t.entry.toFixed(2),
    t.exit.toFixed(2),
    t.pnl.toFixed(2),
    t.pnlPct.toFixed(2),
    t.holdingPeriod,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Tax — Holding Period Calculation', () => {
  test('same timestamp => 0h', () => {
    const ts = '2025-06-15T12:00:00Z';
    expect(holdingPeriod(ts, ts)).toBe('0h');
  });

  test('few hours => Xh', () => {
    expect(holdingPeriod('2025-06-15T08:00:00Z', '2025-06-15T14:00:00Z')).toBe('6h');
  });

  test('1 day', () => {
    expect(holdingPeriod('2025-06-15T00:00:00Z', '2025-06-16T00:00:00Z')).toBe('1d');
  });

  test('30 days', () => {
    expect(holdingPeriod('2025-06-01T00:00:00Z', '2025-07-01T00:00:00Z')).toBe('30d');
  });

  test('364 days is still short-term (<365)', () => {
    expect(holdingPeriod('2025-01-01T00:00:00Z', '2025-12-31T00:00:00Z')).toBe('364d');
  });

  test('365 days => 1y 0d (long-term threshold)', () => {
    expect(holdingPeriod('2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBe('1y 0d');
  });

  test('2 years 100 days', () => {
    // 2*365 + 100 = 830 days
    const start = new Date('2023-01-01T00:00:00Z');
    const end = new Date(start.getTime() + 830 * 24 * 60 * 60 * 1000);
    expect(holdingPeriod(start.toISOString(), end.toISOString())).toBe('2y 100d');
  });

  test('negative duration => 0d', () => {
    expect(holdingPeriod('2025-06-15T00:00:00Z', '2025-06-14T00:00:00Z')).toBe('0d');
  });
});

describe('Tax — Long-term vs Short-term Classification', () => {
  // The MVP treats all gains as short-term. We verify and also test the
  // holdingPeriod-based logic for future implementation.
  test('MVP: all gains classified as short-term', () => {
    const report = buildReportFromTrades(
      [{ pnl: 500, pair: 'BTCUSDT', entry: 100, exit: 150 }],
      2025,
    );
    expect(report.shortTermGains).toBe(500);
    expect(report.longTermGains).toBe(0);
  });

  test('holding < 365 days is short-term by holdingPeriod string', () => {
    const hp = holdingPeriod('2025-01-01T00:00:00Z', '2025-06-01T00:00:00Z');
    expect(hp.endsWith('d')).toBe(true);
    const days = parseInt(hp);
    expect(days).toBeLessThan(365);
  });

  test('holding >= 365 days is long-term by holdingPeriod string', () => {
    const hp = holdingPeriod('2024-01-01T00:00:00Z', '2025-06-01T00:00:00Z');
    expect(hp).toContain('y');
  });
});

describe('Tax — Realized Gain/Loss Computation', () => {
  test('single winning trade', () => {
    const report = buildReportFromTrades(
      [{ pnl: 250.55, pnlPct: 25.06, pair: 'BTCUSDT', direction: 'long', entry: 40000, exit: 50000, date: '2025-03-01' }],
      2025,
    );
    expect(report.totalGains).toBe(250.55);
    expect(report.totalLosses).toBe(0);
    expect(report.netPnl).toBe(250.55);
  });

  test('single losing trade', () => {
    const report = buildReportFromTrades(
      [{ pnl: -150.30, pnlPct: -15.03, pair: 'ETHUSDT', direction: 'long', entry: 3000, exit: 2500, date: '2025-04-01' }],
      2025,
    );
    expect(report.totalGains).toBe(0);
    expect(report.totalLosses).toBe(150.30);
    expect(report.netPnl).toBe(-150.30);
  });

  test('mixed gains and losses', () => {
    const report = buildReportFromTrades(
      [
        { pnl: 500, pair: 'BTCUSDT', entry: 100, exit: 150 },
        { pnl: -200, pair: 'ETHUSDT', entry: 100, exit: 80 },
        { pnl: 300, pair: 'SOLUSDT', entry: 50, exit: 80 },
        { pnl: -50, pair: 'DOTUSDT', entry: 30, exit: 25 },
      ],
      2025,
    );
    expect(report.totalGains).toBe(800);
    expect(report.totalLosses).toBe(250);
    expect(report.netPnl).toBe(550);
    expect(report.totalTrades).toBe(4);
  });

  test('zero PnL trade counted but neither gain nor loss', () => {
    const report = buildReportFromTrades(
      [{ pnl: 0, pair: 'BTCUSDT', entry: 100, exit: 100 }],
      2025,
    );
    expect(report.totalGains).toBe(0);
    expect(report.totalLosses).toBe(0);
    expect(report.netPnl).toBe(0);
    expect(report.totalTrades).toBe(1);
  });

  test('empty trades array produces empty report', () => {
    const report = buildReportFromTrades([], 2025);
    expect(report.totalGains).toBe(0);
    expect(report.totalLosses).toBe(0);
    expect(report.netPnl).toBe(0);
    expect(report.totalTrades).toBe(0);
    expect(report.byAsset).toHaveLength(0);
  });
});

describe('Tax — Symbol Extraction', () => {
  test('BTCUSDT => BTC', () => {
    expect(extractSymbol('BTCUSDT')).toBe('BTC');
  });

  test('ETHUSDT => ETH', () => {
    expect(extractSymbol('ETHUSDT')).toBe('ETH');
  });

  test('BTC/USDT => BTC', () => {
    expect(extractSymbol('BTC/USDT')).toBe('BTC');
  });

  test('ETH/USD => ETH', () => {
    expect(extractSymbol('ETH/USD')).toBe('ETH');
  });

  test('plain symbol with no suffix returns as-is', () => {
    expect(extractSymbol('BTC')).toBe('BTC');
  });

  test('UNKNOWN stays UNKNOWN', () => {
    expect(extractSymbol('UNKNOWN')).toBe('UNKNOWN');
  });

  test('SOLUSDT => SOL', () => {
    expect(extractSymbol('SOLUSDT')).toBe('SOL');
  });
});

describe('Tax — Asset-level Aggregation', () => {
  test('multiple trades for same asset are grouped', () => {
    const report = buildReportFromTrades(
      [
        { pnl: 100, pair: 'BTCUSDT', entry: 40000, exit: 41000 },
        { pnl: -30, pair: 'BTCUSDT', entry: 41000, exit: 40700 },
        { pnl: 50, pair: 'ETHUSDT', entry: 3000, exit: 3100 },
      ],
      2025,
    );
    expect(report.byAsset).toHaveLength(2);

    const btc = report.byAsset.find((a) => a.symbol === 'BTC');
    expect(btc).toBeDefined();
    expect(btc!.totalPnl).toBe(70);
    expect(btc!.tradeCount).toBe(2);

    const eth = report.byAsset.find((a) => a.symbol === 'ETH');
    expect(eth).toBeDefined();
    expect(eth!.totalPnl).toBe(50);
    expect(eth!.tradeCount).toBe(1);
  });

  test('negative totalPnl for losing asset', () => {
    const report = buildReportFromTrades(
      [
        { pnl: -100, pair: 'SOLUSDT', entry: 100, exit: 90 },
        { pnl: -50, pair: 'SOLUSDT', entry: 90, exit: 85 },
      ],
      2025,
    );
    const sol = report.byAsset.find((a) => a.symbol === 'SOL');
    expect(sol!.totalPnl).toBe(-150);
    expect(sol!.tradeCount).toBe(2);
  });
});

describe('Tax — Report Year Handling', () => {
  test('report uses the provided year', () => {
    const report = buildReportFromTrades([], 2024);
    expect(report.year).toBe(2024);
  });

  test('different years produce separate reports', () => {
    const r2024 = buildReportFromTrades([{ pnl: 100, pair: 'BTCUSDT' }], 2024);
    const r2025 = buildReportFromTrades([{ pnl: 200, pair: 'BTCUSDT' }], 2025);
    expect(r2024.year).toBe(2024);
    expect(r2025.year).toBe(2025);
    expect(r2024.netPnl).toBe(100);
    expect(r2025.netPnl).toBe(200);
  });
});

describe('Tax — Field Aliasing (entryPrice/exitPrice, symbol, side)', () => {
  test('entryPrice and exitPrice aliases work', () => {
    const report = buildReportFromTrades(
      [{ pnl: 100, entryPrice: 40000, exitPrice: 41000, pair: 'BTCUSDT' }],
      2025,
    );
    expect(report.trades[0].entry).toBe(40000);
    expect(report.trades[0].exit).toBe(41000);
  });

  test('symbol alias for pair', () => {
    const report = buildReportFromTrades(
      [{ pnl: 50, symbol: 'ETHUSDT', entry: 3000, exit: 3100 }],
      2025,
    );
    expect(report.trades[0].pair).toBe('ETHUSDT');
  });

  test('side alias for direction', () => {
    const report = buildReportFromTrades(
      [{ pnl: 50, side: 'short', pair: 'BTCUSDT', entry: 100, exit: 90 }],
      2025,
    );
    expect(report.trades[0].direction).toBe('short');
  });

  test('defaults when optional fields missing', () => {
    const report = buildReportFromTrades([{ pnl: 10 }], 2025);
    expect(report.trades[0].pair).toBe('UNKNOWN');
    expect(report.trades[0].direction).toBe('long');
    expect(report.trades[0].entry).toBe(0);
    expect(report.trades[0].exit).toBe(0);
  });
});

describe('Tax — CSV Export Generation', () => {
  test('CSV has correct headers', () => {
    const report = buildReportFromTrades([], 2025);
    const csv = generateCSV(report);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe('Date,Pair,Direction,Entry Price,Exit Price,P&L USD,P&L %,Holding Period');
  });

  test('CSV has one data row per trade', () => {
    const report = buildReportFromTrades(
      [
        { pnl: 100, pair: 'BTCUSDT', direction: 'long', entry: 40000, exit: 41000, date: '2025-03-01', holdingPeriod: '5d' },
        { pnl: -50, pair: 'ETHUSDT', direction: 'short', entry: 3000, exit: 3100, date: '2025-03-02', holdingPeriod: '2d' },
      ],
      2025,
    );
    const csv = generateCSV(report);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  test('CSV data row has correct format', () => {
    const report = buildReportFromTrades(
      [{ pnl: 100.5, pnlPct: 10.05, pair: 'BTCUSDT', direction: 'long', entry: 40000, exit: 41000, date: '2025-03-01', holdingPeriod: '5d' }],
      2025,
    );
    const csv = generateCSV(report);
    const dataRow = csv.split('\n')[1];
    expect(dataRow).toBe('2025-03-01,BTCUSDT,long,40000.00,41000.00,100.50,10.05,5d');
  });

  test('empty trades produces header only', () => {
    const report = buildReportFromTrades([], 2025);
    const csv = generateCSV(report);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
  });
});

describe('Tax — Rounding Precision', () => {
  test('totalGains rounded to 2 decimal places', () => {
    const report = buildReportFromTrades(
      [
        { pnl: 33.333, pair: 'BTCUSDT' },
        { pnl: 33.333, pair: 'ETHUSDT' },
        { pnl: 33.334, pair: 'SOLUSDT' },
      ],
      2025,
    );
    expect(report.totalGains).toBe(100);
  });

  test('totalLosses rounded to 2 decimal places', () => {
    const report = buildReportFromTrades(
      [{ pnl: -33.335, pair: 'BTCUSDT' }, { pnl: -66.665, pair: 'ETHUSDT' }],
      2025,
    );
    expect(report.totalLosses).toBe(100);
  });

  test('netPnl = totalGains - totalLosses (rounded)', () => {
    const report = buildReportFromTrades(
      [
        { pnl: 150.123, pair: 'BTCUSDT' },
        { pnl: -50.456, pair: 'ETHUSDT' },
      ],
      2025,
    );
    expect(report.netPnl).toBe(
      Math.round((report.totalGains - report.totalLosses) * 100) / 100,
    );
  });
});
