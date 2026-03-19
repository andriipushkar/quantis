import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Clock, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { getOpenInterest, type OpenInterestData } from '@/services/api';
import { cn } from '@/utils/cn';

function formatUsd(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function hasDivergence(item: OpenInterestData): 'bullish_div' | 'bearish_div' | null {
  // Price up but OI down = bearish divergence (longs closing, potential reversal)
  if (item.priceChange24h > 1 && item.oiChangePercent < -2) return 'bearish_div';
  // Price down but OI up = bearish (new shorts opening)
  if (item.priceChange24h < -1 && item.oiChangePercent > 2) return 'bearish_div';
  // Price up and OI up = healthy bullish (new longs)
  // Price down and OI down = bearish closing
  return null;
}

type SortField = 'openInterest' | 'oiChangePercent' | 'volume' | 'oiVolumeRatio';

const OpenInterest: React.FC = () => {
  const [data, setData] = useState<OpenInterestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>('openInterest');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const result = await getOpenInterest();
      setData(result);
      setLastChecked(new Date());
      setError(null);
    } catch {
      setError('Failed to fetch open interest data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const mul = sortAsc ? 1 : -1;
    return (a[sortField] - b[sortField]) * mul;
  });

  // Summary
  const totalOi = data.reduce((sum, d) => sum + d.openInterest, 0);
  const totalOiChange = data.reduce((sum, d) => sum + d.oiChange24h, 0);
  const totalOiChangePct = totalOi > 0 ? (totalOiChange / (totalOi - totalOiChange)) * 100 : 0;
  const divergences = data.filter((d) => hasDivergence(d) !== null);

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary animate-pulse" />
          <span className="text-muted-foreground text-sm">Loading open interest...</span>
        </div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center">
          <BarChart3 className="w-8 h-8 text-danger" />
          <span className="text-muted-foreground text-sm">{error}</span>
          <button
            onClick={fetchData}
            className="mt-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Open Interest</h1>
        </div>
        {lastChecked && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated: {lastChecked.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Open Interest</p>
          <p className="text-lg font-bold text-foreground">{formatUsd(totalOi)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">24H OI Change</p>
          <div className="flex items-center gap-2">
            <p className={cn(
              'text-lg font-bold font-mono',
              totalOiChangePct > 0 ? 'text-green-400' : totalOiChangePct < 0 ? 'text-red-400' : 'text-foreground'
            )}>
              {totalOiChangePct > 0 ? '+' : ''}{totalOiChangePct.toFixed(2)}%
            </p>
            <span className="text-xs text-muted-foreground">({formatUsd(Math.abs(totalOiChange))})</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Divergences Detected</p>
          <div className="flex items-center gap-2">
            {divergences.length > 0 ? (
              <>
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <p className="text-lg font-bold text-yellow-400">{divergences.length}</p>
              </>
            ) : (
              <p className="text-lg font-bold text-muted-foreground">0</p>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Symbol
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('openInterest')}
                >
                  Open Interest {sortField === 'openInterest' && (sortAsc ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('oiChangePercent')}
                >
                  24H Change {sortField === 'oiChangePercent' && (sortAsc ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('volume')}
                >
                  Volume {sortField === 'volume' && (sortAsc ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort('oiVolumeRatio')}
                >
                  OI/Vol Ratio {sortField === 'oiVolumeRatio' && (sortAsc ? '\u2191' : '\u2193')}
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Signal
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item) => {
                const div = hasDivergence(item);
                return (
                  <tr
                    key={`${item.exchange}:${item.symbol}`}
                    className={cn(
                      'border-b border-border/50 hover:bg-secondary/20 transition-colors',
                      div && 'bg-yellow-500/5'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-semibold text-foreground">{item.symbol}</span>
                        <span className="text-xs text-muted-foreground ml-2 capitalize">{item.exchange}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono font-semibold text-foreground">
                        {formatUsd(item.openInterest)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.oiChangePercent > 0 ? (
                          <ArrowUp className="w-3.5 h-3.5 text-green-400" />
                        ) : item.oiChangePercent < 0 ? (
                          <ArrowDown className="w-3.5 h-3.5 text-red-400" />
                        ) : null}
                        <span className={cn(
                          'font-mono font-semibold',
                          item.oiChangePercent > 0 ? 'text-green-400' : item.oiChangePercent < 0 ? 'text-red-400' : 'text-muted-foreground'
                        )}>
                          {item.oiChangePercent > 0 ? '+' : ''}{item.oiChangePercent.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-muted-foreground">
                        {formatUsd(item.volume)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'font-mono',
                        item.oiVolumeRatio > 10 ? 'text-yellow-400 font-semibold' : 'text-muted-foreground'
                      )}>
                        {item.oiVolumeRatio.toFixed(2)}x
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {div ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          Divergence
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No open interest data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OpenInterest;
