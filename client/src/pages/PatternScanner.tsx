import React, { useEffect, useState, useCallback } from 'react';
import { Eye, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';

interface PatternData {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  index: number;
  description: string;
}

interface PatternResponse {
  symbol: string;
  timeframe: string;
  patterns: PatternData[];
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

const TYPE_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  bullish: { bg: 'bg-green-500/20', text: 'text-green-400', icon: TrendingUp },
  bearish: { bg: 'bg-red-500/20', text: 'text-red-400', icon: TrendingDown },
  neutral: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: Minus },
};

const PatternScanner: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [data, setData] = useState<PatternResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/analysis/patterns/${symbol}?timeframe=${timeframe}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setLastUpdated(new Date());
      } else {
        setError(json.error || 'Failed to load pattern data');
        setData(null);
      }
    } catch {
      setError('Failed to load pattern data');
      setData(null);
    }
    setLoading(false);
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const patterns = data?.patterns || [];
  const bullishCount = patterns.filter((p) => p.type === 'bullish').length;
  const bearishCount = patterns.filter((p) => p.type === 'bearish').length;
  const neutralCount = patterns.filter((p) => p.type === 'neutral').length;

  const mostCommonType = bullishCount >= bearishCount && bullishCount >= neutralCount
    ? 'bullish'
    : bearishCount >= neutralCount
      ? 'bearish'
      : 'neutral';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Eye className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Pattern Scanner</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4 text-muted-foreground', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Patterns</p>
          <p className="text-2xl font-bold text-foreground">{patterns.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Bullish</p>
          <p className="text-2xl font-bold text-green-400">{bullishCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Bearish</p>
          <p className="text-2xl font-bold text-red-400">{bearishCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Dominant Signal</p>
          <p className={cn('text-2xl font-bold capitalize', TYPE_STYLES[mostCommonType].text)}>
            {mostCommonType}
          </p>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()} (auto-refresh every 30s)
        </p>
      )}

      {/* Patterns List */}
      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-muted-foreground text-sm">Scanning for patterns...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      ) : patterns.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No patterns detected for {symbol} on {timeframe} timeframe.</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different timeframe or symbol.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {patterns.map((pattern, idx) => {
            const style = TYPE_STYLES[pattern.type];
            const Icon = style.icon;
            return (
              <div key={`${pattern.name}-${pattern.index}-${idx}`} className="rounded-xl border border-border bg-card p-4 space-y-3">
                {/* Pattern header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-4 h-4', style.text)} />
                    <span className="font-bold text-foreground">{pattern.name}</span>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded text-xs font-semibold capitalize', style.bg, style.text)}>
                    {pattern.type}
                  </span>
                </div>

                {/* Confidence bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Confidence</span>
                    <span className="text-xs font-bold text-foreground">{pattern.confidence}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        pattern.confidence >= 70 ? 'bg-green-500' :
                          pattern.confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      )}
                      style={{ width: `${pattern.confidence}%` }}
                    />
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed">{pattern.description}</p>

                {/* Candle index */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Candle #{pattern.index}
                  </span>
                  <a
                    href={`/chart/${symbol}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View on Chart
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PatternScanner;
