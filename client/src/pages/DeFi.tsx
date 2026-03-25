import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Coins, ArrowUp, ArrowDown, Filter, TrendingUp } from 'lucide-react';
import { getDeFiOverview, type DeFiData } from '@/services/api';
import { cn } from '@/utils/cn';

function formatTvl(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

type SortField = 'tvl' | 'apy' | 'riskRating' | 'tvlChange24h';

const CHAINS = ['All', 'Ethereum', 'Solana', 'BSC', 'Arbitrum', 'Multi'];

const chainColors: Record<string, string> = {
  Ethereum: 'bg-blue-500/20 text-blue-400',
  Solana: 'bg-purple-500/20 text-purple-400',
  BSC: 'bg-yellow-500/20 text-yellow-400',
  Arbitrum: 'bg-sky-500/20 text-sky-400',
  Multi: 'bg-emerald-500/20 text-emerald-400',
};

const categoryColors: Record<string, string> = {
  'Liquid Staking': 'bg-indigo-500/20 text-indigo-400',
  Lending: 'bg-green-500/20 text-green-400',
  DEX: 'bg-orange-500/20 text-orange-400',
  CDP: 'bg-pink-500/20 text-pink-400',
  Aggregator: 'bg-cyan-500/20 text-cyan-400',
  Derivatives: 'bg-red-500/20 text-red-400',
};

const DeFi: React.FC = () => {
  const [data, setData] = useState<DeFiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('tvl');
  const [sortAsc, setSortAsc] = useState(false);
  const [chainFilter, setChainFilter] = useState('All');

  const fetchData = useCallback(async () => {
    try {
      const result = await getDeFiOverview();
      setData(result);
      setError(null);
    } catch {
      setError('Failed to load DeFi data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredProtocols = useMemo(() => {
    if (!data) return [];
    let list = [...data.protocols];
    if (chainFilter !== 'All') {
      list = list.filter((p) => p.chain === chainFilter);
    }
    list.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [data, sortField, sortAsc, chainFilter]);

  const categoryBreakdown = useMemo(() => {
    if (!data) return [];
    const map: Record<string, number> = {};
    const filtered = chainFilter === 'All' ? data.protocols : data.protocols.filter((p) => p.chain === chainFilter);
    for (const p of filtered) {
      map[p.category] = (map[p.category] || 0) + p.tvl;
    }
    return Object.entries(map)
      .map(([category, tvl]) => ({ category, tvl }))
      .sort((a, b) => b.tvl - a.tvl);
  }, [data, chainFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Coins className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Coins className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">{error || 'No data available'}</p>
      </div>
    );
  }

  const SortHeader: React.FC<{ field: SortField; label: string }> = ({ field, label }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortField === field && (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Coins className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">DeFi TVL Tracker</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total TVL</p>
          <p className="text-2xl font-bold text-foreground">{formatTvl(data.totalTvl)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Protocols</p>
          <p className="text-2xl font-bold text-foreground">{data.protocolCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg APY</p>
          <p className="text-2xl font-bold text-primary">{(data.avgApy ?? 0).toFixed(1)}%</p>
        </div>
      </div>

      {/* Chain Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {CHAINS.map((chain) => (
          <button
            key={chain}
            onClick={() => setChainFilter(chain)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              chainFilter === chain
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            {chain}
          </button>
        ))}
      </div>

      {/* Protocol Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protocol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chain</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                <SortHeader field="tvl" label="TVL" />
                <SortHeader field="tvlChange24h" label="24h Change" />
                <SortHeader field="apy" label="APY" />
                <SortHeader field="riskRating" label="Risk" />
              </tr>
            </thead>
            <tbody>
              {filteredProtocols.map((p) => (
                <tr key={p.name} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-foreground">{p.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', chainColors[p.chain] || 'bg-secondary text-muted-foreground')}>
                      {p.chain}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', categoryColors[p.category] || 'bg-secondary text-muted-foreground')}>
                      {p.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-foreground">{formatTvl(p.tvl)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-sm font-medium', (p.tvlChange24h ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {(p.tvlChange24h ?? 0) >= 0 ? '+' : ''}{(p.tvlChange24h ?? 0).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-sm font-medium', (p.apy ?? 0) > 0 ? 'text-primary' : 'text-muted-foreground')}>
                      {(p.apy ?? 0) > 0 ? `${(p.apy ?? 0).toFixed(1)}%` : '--'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span
                          key={i}
                          className={cn(
                            'w-2 h-2 rounded-full',
                            i < (p.riskRating ?? 3) ? 'bg-primary' : 'bg-secondary'
                          )}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">TVL by Category</h2>
        </div>
        <div className="space-y-3">
          {categoryBreakdown.map((cat) => {
            const totalFiltered = categoryBreakdown.reduce((s, c) => s + c.tvl, 0);
            const pct = totalFiltered > 0 ? (cat.tvl / totalFiltered) * 100 : 0;
            return (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{cat.category}</span>
                  <span className="text-xs text-muted-foreground">{formatTvl(cat.tvl)} ({pct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DeFi;
