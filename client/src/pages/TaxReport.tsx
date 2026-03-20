import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Download, TrendingUp, TrendingDown, BarChart3, ArrowUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/auth';

/* ---------- Types ---------- */

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

interface TaxReportData {
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

/* ---------- Helpers ---------- */

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

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ---------- Component ---------- */

const TAX_METHODS = [
  { id: 'fifo', label: 'FIFO', enabled: true },
  { id: 'lifo', label: 'LIFO', enabled: false },
  { id: 'hifo', label: 'HIFO', enabled: false },
];

const YEARS = [2026, 2025];

const TaxReport: React.FC = () => {
  const [report, setReport] = useState<TaxReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [taxMethod, setTaxMethod] = useState('fifo');

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);

  const fetchReport = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      // Fetch paper trading history + journal entries, then aggregate
      const [paperRes, journalRes] = await Promise.all([
        fetch('/api/v1/paper/history', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/journal', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const paperJson = await paperRes.json();
      const journalJson = await journalRes.json();

      const paperTrades = (paperJson.success ? paperJson.data : []) as Array<Record<string, unknown>>;
      const journalEntries = (journalJson.success ? journalJson.data : []) as Array<Record<string, unknown>>;

      // Normalize into a common trade shape
      const allTrades: TaxTrade[] = [];

      for (const t of paperTrades) {
        const closedAt = t.closedAt as string;
        const openedAt = t.openedAt as string;
        if (!closedAt) continue;

        const closedYear = new Date(closedAt).getFullYear();
        if (closedYear !== selectedYear) continue;

        const pnl = (t.pnl as number) || 0;
        const entryPrice = (t.entryPrice as number) || 0;
        const exitPrice = (t.exitPrice as number) || 0;
        const amount = (t.amount as number) || 1;
        const pnlPct = amount > 0 ? (pnl / amount) * 100 : 0;

        allTrades.push({
          pair: (t.symbol as string) || 'UNKNOWN',
          direction: (t.side as string) || 'buy',
          entry: entryPrice,
          exit: exitPrice,
          pnl,
          pnlPct: Math.round(pnlPct * 100) / 100,
          date: closedAt,
          holdingPeriod: holdingPeriod(openedAt || closedAt, closedAt),
        });
      }

      for (const e of journalEntries) {
        const exitPrice = e.exitPrice as number | null;
        if (exitPrice === null || exitPrice === undefined) continue;

        const createdAt = e.createdAt as string;
        const entryYear = new Date(createdAt).getFullYear();
        if (entryYear !== selectedYear) continue;

        const pnl = (e.pnl as number) || 0;
        const pnlPct = (e.pnlPct as number) || 0;

        allTrades.push({
          pair: (e.pair as string) || 'UNKNOWN',
          direction: (e.direction as string) || 'long',
          entry: (e.entryPrice as number) || 0,
          exit: exitPrice,
          pnl,
          pnlPct,
          date: createdAt,
          holdingPeriod: holdingPeriod(createdAt, e.updatedAt as string || createdAt),
        });
      }

      // Aggregate
      let totalGains = 0;
      let totalLosses = 0;
      const assetMap = new Map<string, { totalPnl: number; tradeCount: number }>();

      for (const t of allTrades) {
        if (t.pnl > 0) totalGains += t.pnl;
        else totalLosses += Math.abs(t.pnl);

        const base = t.pair.replace(/\/.*$/, '').replace(/USDT?$/, '');
        const symbol = base || t.pair;
        const existing = assetMap.get(symbol);
        if (existing) {
          existing.totalPnl += t.pnl;
          existing.tradeCount += 1;
        } else {
          assetMap.set(symbol, { totalPnl: t.pnl, tradeCount: 1 });
        }
      }

      totalGains = Math.round(totalGains * 100) / 100;
      totalLosses = Math.round(totalLosses * 100) / 100;

      const byAsset: AssetSummary[] = Array.from(assetMap.entries())
        .map(([symbol, data]) => ({
          symbol,
          totalPnl: Math.round(data.totalPnl * 100) / 100,
          tradeCount: data.tradeCount,
        }))
        .sort((a, b) => b.tradeCount - a.tradeCount);

      setReport({
        year: selectedYear,
        totalGains,
        totalLosses,
        netPnl: Math.round((totalGains - totalLosses) * 100) / 100,
        shortTermGains: totalGains,
        longTermGains: 0,
        totalTrades: allTrades.length,
        trades: allTrades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        byAsset,
      });
    } catch {
      // On error, set an empty report
      setReport({
        year: selectedYear,
        totalGains: 0,
        totalLosses: 0,
        netPnl: 0,
        shortTermGains: 0,
        longTermGains: 0,
        totalTrades: 0,
        trades: [],
        byAsset: [],
      });
    }

    setLoading(false);
  }, [token, selectedYear]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetchReport();
  }, [isAuthenticated, fetchReport]);

  const handleExportCsv = () => {
    if (!report || report.trades.length === 0) return;

    const headers = ['Date', 'Pair', 'Direction', 'Entry Price', 'Exit Price', 'P&L USD', 'P&L %', 'Holding Period'];
    const rows = report.trades.map((t) =>
      [formatDate(t.date), t.pair, t.direction, t.entry.toFixed(2), t.exit.toFixed(2), t.pnl.toFixed(2), t.pnlPct.toFixed(2), t.holdingPeriod].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantis-tax-report-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Please log in to view your tax report.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tax Report</h1>
            <p className="text-sm text-muted-foreground">Estimated tax summary from paper trades &amp; journal entries</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Year Selector */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  selectedYear === y
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Tax Method Selector */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {TAX_METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => m.enabled && setTaxMethod(m.id)}
                disabled={!m.enabled}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  taxMethod === m.id
                    ? 'bg-background text-foreground shadow-sm'
                    : m.enabled
                      ? 'text-muted-foreground hover:text-foreground'
                      : 'text-muted-foreground/40 cursor-not-allowed'
                )}
                title={!m.enabled ? 'Coming soon' : undefined}
              >
                {m.label}
                {!m.enabled && <span className="ml-1 text-[10px] opacity-60">soon</span>}
              </button>
            ))}
          </div>

          {/* Export Buttons */}
          <button
            onClick={handleExportCsv}
            disabled={!report || report.trades.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-sm font-medium cursor-not-allowed opacity-50"
            title="PDF export coming soon"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <span className="text-muted-foreground text-sm">Generating report...</span>
          </div>
        </div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Gains"
              value={formatCurrency(report.totalGains)}
              icon={TrendingUp}
              variant="gain"
            />
            <SummaryCard
              label="Total Losses"
              value={formatCurrency(report.totalLosses)}
              icon={TrendingDown}
              variant="loss"
            />
            <SummaryCard
              label="Net P&L"
              value={formatCurrency(report.netPnl)}
              icon={BarChart3}
              variant={report.netPnl >= 0 ? 'gain' : 'loss'}
            />
            <SummaryCard
              label="Total Trades"
              value={report.totalTrades.toString()}
              icon={ArrowUpDown}
              variant="neutral"
            />
          </div>

          {/* By Asset Breakdown */}
          {report.byAsset.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-semibold text-foreground mb-4">By Asset</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-left border-b border-border">
                      <th className="pb-3 font-medium">Symbol</th>
                      <th className="pb-3 font-medium text-right">Total P&amp;L</th>
                      <th className="pb-3 font-medium text-right">Trade Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byAsset.map((a) => (
                      <tr key={a.symbol} className="border-b border-border/50 last:border-0">
                        <td className="py-3 font-medium text-foreground">{a.symbol}</td>
                        <td className={cn('py-3 text-right font-mono', a.totalPnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                          {formatCurrency(a.totalPnl)}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">{a.tradeCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trade History Table */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">Trade History</h2>
            {report.trades.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                No closed trades found for {selectedYear}. Close positions in Paper Trading or add entries in your Journal to see data here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-left border-b border-border">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Pair</th>
                      <th className="pb-3 font-medium">Direction</th>
                      <th className="pb-3 font-medium text-right">Entry</th>
                      <th className="pb-3 font-medium text-right">Exit</th>
                      <th className="pb-3 font-medium text-right">P&amp;L</th>
                      <th className="pb-3 font-medium text-right">%</th>
                      <th className="pb-3 font-medium text-right">Holding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.trades.map((t, idx) => (
                      <tr key={idx} className="border-b border-border/50 last:border-0">
                        <td className="py-3 text-muted-foreground">{formatDate(t.date)}</td>
                        <td className="py-3 font-medium text-foreground">{t.pair}</td>
                        <td className="py-3">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-semibold uppercase',
                              t.direction === 'long' || t.direction === 'buy'
                                ? 'bg-green-500/10 text-green-500'
                                : 'bg-red-500/10 text-red-500'
                            )}
                          >
                            {t.direction}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono text-foreground">{formatCurrency(t.entry)}</td>
                        <td className="py-3 text-right font-mono text-foreground">{formatCurrency(t.exit)}</td>
                        <td className={cn('py-3 text-right font-mono', t.pnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                          {t.pnl >= 0 ? '+' : ''}{formatCurrency(t.pnl)}
                        </td>
                        <td className={cn('py-3 text-right font-mono', t.pnlPct >= 0 ? 'text-green-500' : 'text-red-500')}>
                          {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                        </td>
                        <td className="py-3 text-right text-muted-foreground">{t.holdingPeriod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="bg-secondary/50 border border-border rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">
              This is an estimate based on your paper trading and journal data. Consult a tax professional for actual tax filing.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
};

/* ---------- Summary Card ---------- */

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  variant: 'gain' | 'loss' | 'neutral';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, icon: Icon, variant }) => {
  const colorClasses = {
    gain: 'text-green-500',
    loss: 'text-red-500',
    neutral: 'text-foreground',
  };

  const bgClasses = {
    gain: 'bg-green-500/10',
    loss: 'bg-red-500/10',
    neutral: 'bg-primary/10',
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bgClasses[variant])}>
          <Icon className={cn('w-4 h-4', colorClasses[variant])} />
        </div>
      </div>
      <p className={cn('text-2xl font-bold', colorClasses[variant])}>{value}</p>
    </div>
  );
};

export default TaxReport;
