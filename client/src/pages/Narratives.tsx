import React, { useState, useEffect, useCallback } from 'react';
import { Layers, ArrowUpRight, ArrowDownRight, Minus, Clock, TrendingUp } from 'lucide-react';
import { getNarratives, type NarrativeData } from '@/services/api';
import { cn } from '@/utils/cn';

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'rising':
      return <ArrowUpRight className="w-4 h-4 text-green-400" />;
    case 'falling':
      return <ArrowDownRight className="w-4 h-4 text-red-400" />;
    default:
      return <Minus className="w-4 h-4 text-muted-foreground" />;
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  if (score >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 70) return 'bg-green-500/10 border-green-500/20';
  if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/20';
  if (score >= 30) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

const Narratives: React.FC = () => {
  const [data, setData] = useState<NarrativeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getNarratives();
      setData(result);
      setLastChecked(new Date());
      setError(null);
    } catch {
      setError('Failed to fetch narrative data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Layers className="w-8 h-8 text-primary animate-pulse" />
          <span className="text-muted-foreground text-sm">Loading narratives...</span>
        </div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Layers className="w-8 h-8 text-danger" />
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
          <Layers className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Narrative Tracker</h1>
        </div>
        {lastChecked && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated: {lastChecked.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Sector Rotation Note */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Sector Rotation</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Narrative tracking helps identify which crypto sectors are gaining momentum. Capital tends to rotate
              between sectors — when one narrative cools off, funds often flow into emerging themes. Use this to
              spot early rotation signals and position ahead of sector momentum.
            </p>
          </div>
        </div>
      </div>

      {/* Narrative Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((narrative) => (
          <div
            key={narrative.name}
            className={cn(
              'bg-card border rounded-xl p-5 transition-all duration-200 hover:shadow-lg',
              scoreBg(narrative.score)
            )}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">{narrative.name}</h3>
                <TrendIcon trend={narrative.trend} />
              </div>
              <div className={cn(
                'px-3 py-1 rounded-full text-sm font-bold',
                scoreColor(narrative.score)
              )}>
                {narrative.score}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Avg Change</p>
                <p className={cn(
                  'text-sm font-semibold font-mono',
                  narrative.avgChange > 0 ? 'text-green-400' : narrative.avgChange < 0 ? 'text-red-400' : 'text-foreground'
                )}>
                  {narrative.avgChange > 0 ? '+' : ''}{narrative.avgChange.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Volume</p>
                <p className="text-sm font-semibold text-foreground">{formatVolume(narrative.avgVolume)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg RSI</p>
                <p className={cn(
                  'text-sm font-semibold font-mono',
                  narrative.avgRsi > 70 ? 'text-red-400' : narrative.avgRsi < 30 ? 'text-green-400' : 'text-foreground'
                )}>
                  {narrative.avgRsi.toFixed(1)}
                </p>
              </div>
            </div>

            {/* Token List */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Tokens</p>
              {narrative.tokens.map((token) => (
                <div
                  key={token.symbol}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-secondary/30"
                >
                  <span className="text-sm font-medium text-foreground">
                    {token.symbol.replace('USDT', '')}
                  </span>
                  <span className={cn(
                    'text-xs font-mono font-semibold',
                    token.change24h > 0 ? 'text-green-400' : token.change24h < 0 ? 'text-red-400' : 'text-muted-foreground'
                  )}>
                    {token.change24h > 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                  </span>
                </div>
              ))}
              {narrative.tokens.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No ticker data available</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">No narrative data available</p>
        </div>
      )}
    </div>
  );
};

export default Narratives;
