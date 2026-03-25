import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Network, Star, AlertTriangle, Users, Code, Info, Activity, ArrowRightLeft, BarChart3 } from 'lucide-react';
import { cn } from '@/utils/cn';

// =============================================================================
// Types
// =============================================================================

interface Project {
  symbol: string;
  name: string;
  weeklyCommits: number;
  activeDevs: number;
  stars: number;
  openIssues: number;
  lastRelease: string;
  devScore: number;
}

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

// =============================================================================
// Constants
// =============================================================================

const NETWORK_SYMBOLS = ['BTC', 'ETH', 'SOL'];

const TABS = [
  { key: 'dev-activity', label: 'Dev Activity' },
  { key: 'network-metrics', label: 'Network Metrics' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// =============================================================================
// Helpers
// =============================================================================

function scoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-yellow-500';
  return 'text-danger';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-success';
  if (score >= 60) return 'bg-primary';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-danger';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

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

// =============================================================================
// Dev Activity Tab
// =============================================================================

const DevActivityTab: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/market/dev-activity');
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || 'Failed to load data');
        } else {
          setProjects(json.data?.projects ?? []);
        }
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}

      {!loading && projects.length > 0 && (
        <>
          {/* Project cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => (
              <div key={p.symbol} className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-foreground font-semibold text-lg">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">{p.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-2xl font-bold', scoreColor(p.devScore))}>{p.devScore}</p>
                    <p className={cn('text-xs font-semibold', scoreColor(p.devScore))}>{scoreLabel(p.devScore)}</p>
                  </div>
                </div>

                {/* Score gauge */}
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', scoreBg(p.devScore))}
                    style={{ width: `${p.devScore}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Commits/wk</span>
                    <span className="ml-auto font-mono font-semibold text-foreground">{p.weeklyCommits}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Devs</span>
                    <span className="ml-auto font-mono font-semibold text-foreground">{p.activeDevs}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Stars</span>
                    <span className="ml-auto font-mono font-semibold text-foreground">{(p.stars / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Issues</span>
                    <span className="ml-auto font-mono font-semibold text-foreground">{p.openIssues}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Last release: {p.lastRelease}</p>

                {p.devScore < 40 && (
                  <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Low development activity warning
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-foreground font-semibold">Comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs border-b border-border">
                    <th className="px-4 py-3 text-left font-medium">Project</th>
                    <th className="px-4 py-3 text-right font-medium">Dev Score</th>
                    <th className="px-4 py-3 text-right font-medium">Commits/wk</th>
                    <th className="px-4 py-3 text-right font-medium">Active Devs</th>
                    <th className="px-4 py-3 text-right font-medium">Stars</th>
                    <th className="px-4 py-3 text-right font-medium">Open Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {projects
                    .sort((a, b) => b.devScore - a.devScore)
                    .map((p) => (
                      <tr key={p.symbol} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-foreground">{p.name} <span className="text-muted-foreground font-normal">({p.symbol})</span></td>
                        <td className={cn('px-4 py-2.5 text-right font-mono font-bold', scoreColor(p.devScore))}>{p.devScore}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{p.weeklyCommits}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{p.activeDevs}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{p.stars.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{p.openIssues}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5" />
            Data refreshed every 30 minutes. Metrics are simulated for demonstration.
          </div>
        </>
      )}
    </div>
  );
};

// =============================================================================
// Network Metrics Tab
// =============================================================================

const NetworkMetricsTab: React.FC<{ symbol: string; onSymbolChange: (s: string) => void }> = ({ symbol, onSymbolChange }) => {
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
    <div className="space-y-6">
      {/* Network symbol selector */}
      <div className="flex items-center gap-2">
        {NETWORK_SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => onSymbolChange(s)}
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
              <div className="relative w-20 h-20 sm:w-24 sm:h-24">
                <svg className="w-20 h-20 sm:w-24 sm:h-24 -rotate-90" viewBox="0 0 100 100">
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

// =============================================================================
// Main Page
// =============================================================================

export default function OnChain() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [networkSymbol, setNetworkSymbol] = useState('BTC');

  const activeTab = (searchParams.get('tab') as TabKey) || 'dev-activity';

  const setTab = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Network className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">On-Chain Analytics</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">DEMO</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/50 border border-border w-fit max-w-full overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors border',
              activeTab === tab.key
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary border-transparent'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dev-activity' && <DevActivityTab />}
      {activeTab === 'network-metrics' && (
        <NetworkMetricsTab symbol={networkSymbol} onSymbolChange={setNetworkSymbol} />
      )}
    </div>
  );
}
