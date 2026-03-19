import React, { useState, useEffect, useCallback } from 'react';
import { Activity, ArrowUp, ArrowDown, BarChart2, TrendingUp, Clock, Info } from 'lucide-react';
import { getMarketBreadth, type MarketBreadthData } from '@/services/api';
import { cn } from '@/utils/cn';

function gaugeColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 55) return 'text-emerald-400';
  if (score >= 45) return 'text-yellow-400';
  if (score >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function gaugeTrackColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 55) return 'bg-emerald-500';
  if (score >= 45) return 'bg-yellow-500';
  if (score >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

function getInterpretation(data: MarketBreadthData): string {
  if (data.score >= 70) {
    return 'The market shows strong bullish breadth. A majority of pairs are advancing with prices above their short-term moving averages. This suggests broad-based buying pressure and healthy market participation. Consider trend-following strategies.';
  }
  if (data.score >= 55) {
    return 'Market breadth is moderately bullish. More pairs are advancing than declining, but momentum is not yet extreme. The market has a positive bias but watch for potential rotation.';
  }
  if (data.score >= 45) {
    return 'Market breadth is neutral. The market lacks clear directional conviction with a roughly equal number of advancing and declining pairs. This environment favors range-bound and mean-reversion strategies.';
  }
  if (data.score >= 30) {
    return 'Market breadth is moderately bearish. More pairs are declining than advancing, suggesting weakening buying interest. Consider reducing exposure and tightening risk management.';
  }
  return 'Market breadth is weak and bearish. Most pairs are declining with prices below their short-term averages. This indicates broad selling pressure. Defensive positioning and hedging strategies are recommended.';
}

const MarketBreadth: React.FC = () => {
  const [data, setData] = useState<MarketBreadthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getMarketBreadth();
      setData(result);
      setLastChecked(new Date());
      setError(null);
    } catch {
      setError('Failed to fetch market breadth data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
          <span className="text-muted-foreground text-sm">Loading market breadth...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Activity className="w-8 h-8 text-danger" />
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

  if (!data) return null;

  const totalPairs = data.advancing + data.declining;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Market Breadth</h1>
        </div>
        {lastChecked && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated: {lastChecked.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Breadth Score Gauge */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col items-center">
          <p className="text-sm text-muted-foreground mb-3">Breadth Score</p>
          <div className="relative w-40 h-40 mb-3">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-secondary"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(data.score / 100) * 314} 314`}
                className={gaugeTrackColor(data.score)}
                style={{ stroke: 'currentColor' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-3xl font-bold', gaugeColor(data.score))}>
                {data.score}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <span className={cn('text-sm font-semibold', gaugeColor(data.score))}>
            {data.label}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Advancing / Declining */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUp className="w-4 h-4 text-green-400" />
            <p className="text-xs text-muted-foreground">Advancing</p>
          </div>
          <p className="text-xl font-bold text-green-400">{data.advancing}</p>
          {totalPairs > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {((data.advancing / totalPairs) * 100).toFixed(1)}% of pairs
            </p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDown className="w-4 h-4 text-red-400" />
            <p className="text-xs text-muted-foreground">Declining</p>
          </div>
          <p className="text-xl font-bold text-red-400">{data.declining}</p>
          {totalPairs > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {((data.declining / totalPairs) * 100).toFixed(1)}% of pairs
            </p>
          )}
        </div>

        {/* % Above SMA20 */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">Above SMA20</p>
          </div>
          <p className={cn(
            'text-xl font-bold',
            data.pctAboveSma > 60 ? 'text-green-400' : data.pctAboveSma < 40 ? 'text-red-400' : 'text-foreground'
          )}>
            {data.pctAboveSma.toFixed(1)}%
          </p>
        </div>

        {/* Avg RSI */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">Avg RSI</p>
          </div>
          <p className={cn(
            'text-xl font-bold font-mono',
            data.avgRsi > 70 ? 'text-red-400' : data.avgRsi < 30 ? 'text-green-400' : 'text-foreground'
          )}>
            {data.avgRsi.toFixed(1)}
          </p>
        </div>

        {/* New Highs / Lows */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">Highs / Lows</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-green-400">{data.newHighs}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-xl font-bold text-red-400">{data.newLows}</span>
          </div>
        </div>
      </div>

      {/* Breadth Line */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground mb-2">Breadth Line (Adv - Dec)</p>
        <p className={cn(
          'text-2xl font-bold font-mono',
          data.breadthLine > 0 ? 'text-green-400' : data.breadthLine < 0 ? 'text-red-400' : 'text-foreground'
        )}>
          {data.breadthLine > 0 ? '+' : ''}{data.breadthLine}
        </p>
      </div>

      {/* Interpretation */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Market Interpretation</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {getInterpretation(data)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketBreadth;
