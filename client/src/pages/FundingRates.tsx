import React, { useState, useEffect, useCallback } from 'react';
import { Percent, ArrowUp, ArrowDown, Minus, Clock } from 'lucide-react';
import { getFundingRates, type FundingRateData } from '@/services/api';
import { cn } from '@/utils/cn';

function formatRate(rate: number): string {
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${(rate * 100).toFixed(4)}%`;
}

function getCountdown(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function PredictionIcon({ prediction }: { prediction: string }) {
  switch (prediction) {
    case 'up':
      return <ArrowUp className="w-4 h-4 text-red-400" />;
    case 'down':
      return <ArrowDown className="w-4 h-4 text-green-400" />;
    default:
      return <Minus className="w-4 h-4 text-muted-foreground" />;
  }
}

const FundingRates: React.FC = () => {
  const [data, setData] = useState<FundingRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const result = await getFundingRates();
      setData(result);
      setLastChecked(new Date());
      setError(null);
    } catch {
      setError('Failed to fetch funding rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update countdowns every second
  useEffect(() => {
    if (data.length === 0) return;
    const tick = () => {
      const c: Record<string, string> = {};
      for (const item of data) {
        c[`${item.exchange}:${item.symbol}`] = getCountdown(item.nextFunding);
      }
      setCountdowns(c);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data]);

  // Summary stats
  const avgRate = data.length > 0
    ? data.reduce((sum, d) => sum + d.rate, 0) / data.length
    : 0;
  const mostExtreme = data.length > 0
    ? data.reduce((prev, curr) => Math.abs(curr.rate) > Math.abs(prev.rate) ? curr : prev, data[0])
    : null;

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Percent className="w-8 h-8 text-primary animate-pulse" />
          <span className="text-muted-foreground text-sm">Loading funding rates...</span>
        </div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Percent className="w-8 h-8 text-danger" />
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
          <Percent className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Funding Rates</h1>
        </div>
        {lastChecked && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Average Funding Rate</p>
          <p className={cn(
            'text-lg font-bold font-mono',
            avgRate > 0 ? 'text-red-400' : avgRate < 0 ? 'text-green-400' : 'text-foreground'
          )}>
            {formatRate(avgRate)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Most Extreme</p>
          {mostExtreme ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{mostExtreme.symbol}</span>
              <span className={cn(
                'text-lg font-bold font-mono',
                mostExtreme.rate > 0 ? 'text-red-400' : 'text-green-400'
              )}>
                {formatRate(mostExtreme.rate)}
              </span>
              <span className="text-xs text-muted-foreground capitalize">({mostExtreme.exchange})</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">N/A</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Symbol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exchange</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Rate</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Annualized</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Funding</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prediction</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => {
                const isExtreme = Math.abs(item.rate) > 0.0005; // > 0.05%
                return (
                  <tr
                    key={`${item.exchange}:${item.symbol}`}
                    className={cn(
                      'border-b border-border/50 hover:bg-secondary/20 transition-colors',
                      isExtreme && 'bg-yellow-500/5'
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">{item.symbol}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground capitalize">{item.exchange}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'font-mono font-semibold',
                        item.rate > 0 ? 'text-red-400' : item.rate < 0 ? 'text-green-400' : 'text-muted-foreground'
                      )}>
                        {formatRate(item.rate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'font-mono',
                        item.annualized > 0 ? 'text-red-400' : item.annualized < 0 ? 'text-green-400' : 'text-muted-foreground'
                      )}>
                        {item.annualized > 0 ? '+' : ''}{item.annualized.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-muted-foreground">
                        {countdowns[`${item.exchange}:${item.symbol}`] || '--:--:--'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <PredictionIcon prediction={item.prediction} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No funding rate data available
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

export default FundingRates;
