import React, { useEffect, useState, useCallback } from 'react';
import { Waves, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';

interface WavePoint {
  label: string;
  price: number;
  index: number;
  time: string;
}

interface ElliottData {
  symbol: string;
  waves: WavePoint[];
  pattern: 'impulse' | 'correction' | 'none';
  confidence: number;
  description: string;
  fibTargets: { wave3Target?: number; wave5Target?: number };
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

const PATTERN_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  impulse: { bg: 'bg-green-500/20', text: 'text-green-400', icon: TrendingUp },
  correction: { bg: 'bg-red-500/20', text: 'text-red-400', icon: TrendingDown },
  none: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: Minus },
};

const ElliottWave: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [data, setData] = useState<ElliottData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/analysis/elliott/${symbol}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load Elliott Wave data');
        setData(null);
      }
    } catch {
      setError('Failed to load Elliott Wave data');
      setData(null);
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const patternStyle = data ? PATTERN_STYLES[data.pattern] : PATTERN_STYLES.none;
  const PatternIcon = patternStyle.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Waves className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Elliott Wave</h1>
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
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4 text-muted-foreground', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-muted-foreground text-sm">Analyzing wave structure...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      ) : data ? (
        <>
          {/* Pattern Badge & Confidence */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground mb-2">Pattern Type</p>
              <div className="flex items-center gap-2">
                <PatternIcon className={cn('w-5 h-5', patternStyle.text)} />
                <span className={cn('text-xl font-bold capitalize', patternStyle.text)}>{data.pattern}</span>
              </div>
              <span className={cn('inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold', patternStyle.bg, patternStyle.text)}>
                {data.pattern === 'impulse' ? '5-Wave Impulse' : data.pattern === 'correction' ? 'ABC Correction' : 'No Pattern'}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground mb-2">Confidence</p>
              <p className="text-2xl font-bold text-foreground">{data.confidence}%</p>
              <div className="mt-2 h-3 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    data.confidence >= 70 ? 'bg-green-500' :
                      data.confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                  style={{ width: `${data.confidence}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs text-muted-foreground mb-2">Wave Count</p>
              <p className="text-2xl font-bold text-foreground">{data.waves.length} points</p>
              <p className="text-xs text-muted-foreground mt-1">{symbol}</p>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{data.description}</p>
          </div>

          {/* Fibonacci Targets */}
          {(data.fibTargets.wave3Target || data.fibTargets.wave5Target) && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Fibonacci Targets</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.fibTargets.wave3Target && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary">
                    <span className="text-xs text-muted-foreground">Wave 3 Target (1.618x)</span>
                    <span className="text-sm font-bold text-primary">${data.fibTargets.wave3Target.toLocaleString()}</span>
                  </div>
                )}
                {data.fibTargets.wave5Target && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary">
                    <span className="text-xs text-muted-foreground">Wave 5 Target (0.618x W3)</span>
                    <span className="text-sm font-bold text-primary">${data.fibTargets.wave5Target.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wave Points */}
          {data.waves.length > 0 ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Wave Points</h3>
              </div>
              <div className="divide-y divide-border">
                {data.waves.map((w, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                        data.pattern === 'impulse' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      )}>
                        {w.label}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">${w.price.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Candle #{w.index}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(w.time).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">No wave structure detected for {symbol}.</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different symbol or wait for more price action.</p>
            </div>
          )}

          {/* View on Chart */}
          <div className="flex justify-end">
            <a
              href={`/chart/${symbol}`}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              View on Chart
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default ElliottWave;
