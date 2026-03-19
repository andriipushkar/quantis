import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WhaleTransaction {
  symbol: string;
  exchange: string;
  type: 'exchange_inflow' | 'exchange_outflow' | 'transfer';
  amount_usd: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUSD(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
}

const TYPE_CONFIG: Record<
  WhaleTransaction['type'],
  { label: string; className: string; description: string }
> = {
  exchange_inflow: {
    label: 'Inflow',
    className: 'bg-danger/15 text-danger border border-danger/25',
    description: 'Tokens moved to exchange (potential sell pressure)',
  },
  exchange_outflow: {
    label: 'Outflow',
    className: 'bg-success/15 text-success border border-success/25',
    description: 'Tokens withdrawn from exchange (potential accumulation)',
  },
  transfer: {
    label: 'Transfer',
    className: 'bg-muted text-muted-foreground border border-border',
    description: 'Large wallet-to-wallet transfer',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WhaleAlert: React.FC = () => {
  const [alerts, setAlerts] = useState<WhaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/whales');
      if (!res.ok) throw new Error('Failed to fetch whale alerts');
      const json = await res.json();
      setAlerts(json.data ?? []);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30_000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Summary stats
  const summary = useMemo(() => {
    if (alerts.length === 0) {
      return { total: 0, biggest: null as WhaleTransaction | null, mostActive: '-' };
    }

    const biggest = alerts.reduce((a, b) => (b.amount_usd > a.amount_usd ? b : a), alerts[0]);

    // Most active pair
    const pairCounts: Record<string, number> = {};
    for (const a of alerts) {
      pairCounts[a.symbol] = (pairCounts[a.symbol] ?? 0) + 1;
    }
    const mostActive = Object.entries(pairCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

    return { total: alerts.length, biggest, mostActive };
  }, [alerts]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">Whale</span> Alert Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Large volume spike detection across trading pairs
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Total Alerts
          </p>
          <p className="text-2xl font-bold text-foreground">{summary.total}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Biggest Transaction
          </p>
          <p className="text-2xl font-bold text-foreground">
            {summary.biggest ? formatUSD(summary.biggest.amount_usd) : '-'}
          </p>
          {summary.biggest && (
            <p className="text-xs text-muted-foreground mt-1">{summary.biggest.symbol}</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Most Active Pair
          </p>
          <p className="text-2xl font-bold text-foreground">{summary.mostActive}</p>
        </div>
      </div>

      {/* Last refresh */}
      <p className="text-xs text-muted-foreground">
        Last updated: {lastRefresh.toLocaleTimeString()} — auto-refreshes every 30s
      </p>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center animate-pulse">
              <span className="text-black font-bold text-lg">Q</span>
            </div>
            <span className="text-muted-foreground text-sm">Scanning for whale activity...</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-danger text-sm">{error}</p>
            <button
              onClick={fetchAlerts}
              className="mt-3 text-primary text-sm hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex items-center justify-center h-64 bg-card border border-border rounded-xl">
          <div className="text-center">
            <p className="text-4xl mb-3" aria-hidden="true">Whale</p>
            <p className="text-muted-foreground text-sm">
              No whale activity detected at the moment.
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Alerts appear when volume spikes exceed 3x the average.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span></span>
            <span>Type</span>
            <span>Symbol</span>
            <span>Amount (USD)</span>
            <span>Exchange</span>
            <span>Time</span>
          </div>

          {/* Rows */}
          {alerts.map((alert, index) => {
            const config = TYPE_CONFIG[alert.type];
            return (
              <div
                key={`${alert.symbol}-${alert.type}-${index}`}
                className={cn(
                  'grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-3.5 items-center text-sm transition-colors',
                  index % 2 === 0 ? 'bg-card' : 'bg-secondary/30',
                  'hover:bg-secondary/60'
                )}
              >
                {/* Whale icon (text-based) */}
                <span className="text-base" aria-label="Whale alert" title={config.description}>
                  [W]
                </span>

                {/* Type badge */}
                <div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold',
                      config.className
                    )}
                  >
                    {config.label}
                  </span>
                </div>

                {/* Symbol */}
                <span className="font-semibold text-foreground">{alert.symbol}</span>

                {/* Amount */}
                <span
                  className={cn(
                    'font-bold tabular-nums',
                    alert.type === 'exchange_inflow'
                      ? 'text-danger'
                      : alert.type === 'exchange_outflow'
                        ? 'text-success'
                        : 'text-foreground'
                  )}
                >
                  {formatUSD(alert.amount_usd)}
                </span>

                {/* Exchange */}
                <span className="text-muted-foreground capitalize">{alert.exchange}</span>

                {/* Time */}
                <span className="text-muted-foreground text-xs">{timeAgo(alert.timestamp)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WhaleAlert;
