import React, { useState, useEffect, useCallback } from 'react';
import { Network, Activity, Users, ArrowRightLeft, BarChart3, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface MetricData {
  dailyActiveAddresses: number;
  txCount: number;
  transferValueUsd: number;
  nvtRatio: number;
  metcalfeRatio: number;
  newAddresses: number;
  giniCoefficient: number;
}

interface NetworkData {
  symbol: string;
  metrics: MetricData;
  healthScore: number;
  interpretation: string;
}

const SYMBOLS = ['BTC', 'ETH', 'SOL'];

function formatLarge(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toString();
}

function healthColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-yellow-500';
  return 'text-danger';
}

function healthBg(score: number): string {
  if (score >= 80) return 'bg-success';
  if (score >= 60) return 'bg-primary';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-danger';
}

const NetworkMetrics: React.FC = () => {
  const [symbol, setSymbol] = useState('BTC');
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/market/network-metrics/${encodeURIComponent(sym)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load data');
        setData(null);
      } else {
        setData(json.data);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(symbol);
  }, [symbol, fetchData]);

  const metrics = data?.metrics;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Network className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Network Value Metrics</h1>
          <p className="text-sm text-muted-foreground">On-chain health and valuation metrics</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                symbol === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}

      {data && metrics && !loading && (
        <>
          {/* Health Score */}
          <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-6">
            <div className="flex-shrink-0">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${data.healthScore * 2.64} 264`}
                    className={healthBg(data.healthScore).replace('bg-', 'stroke-')}
                    style={{ stroke: data.healthScore >= 80 ? '#22c55e' : data.healthScore >= 60 ? 'hsl(var(--primary))' : data.healthScore >= 40 ? '#eab308' : '#ef4444' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn('text-2xl font-bold', healthColor(data.healthScore))}>{data.healthScore}</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground mb-1">Health Score: {data.healthScore}/100</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.interpretation}</p>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Daily Active Addresses</span>
              </div>
              <p className="text-xl font-bold font-mono text-foreground">{formatLarge(metrics.dailyActiveAddresses)}</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Transaction Count</span>
              </div>
              <p className="text-xl font-bold font-mono text-foreground">{formatLarge(metrics.txCount)}</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Transfer Value (24h)</span>
              </div>
              <p className="text-xl font-bold font-mono text-foreground">{formatLarge(metrics.transferValueUsd)}</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">NVT Ratio</span>
              </div>
              <p className="text-xl font-bold font-mono text-foreground">{metrics.nvtRatio}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.nvtRatio > 50 ? 'High - potentially overvalued' : metrics.nvtRatio < 25 ? 'Low - heavily utilized' : 'Moderate range'}
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Network className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Metcalfe Ratio</span>
              </div>
              <p className="text-xl font-bold font-mono text-foreground">{metrics.metcalfeRatio.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.metcalfeRatio > 1.5 ? 'Above fair value by network size' : metrics.metcalfeRatio < 0.8 ? 'Below fair value by network size' : 'Near fair value'}
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Gini Coefficient</span>
              </div>
              <p className="text-xl font-bold font-mono text-foreground">{metrics.giniCoefficient.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.giniCoefficient > 0.7 ? 'High concentration (whale-heavy)' : metrics.giniCoefficient > 0.5 ? 'Moderate concentration' : 'Well distributed'}
              </p>
            </div>
          </div>

          {/* New addresses */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">New Addresses (24h)</p>
              <p className="text-lg font-bold font-mono text-foreground">{formatLarge(metrics.newAddresses)}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5" />
              Data refreshed every 30 minutes
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NetworkMetrics;
