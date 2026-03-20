import React, { useEffect, useState, useCallback } from 'react';
import { Hexagon, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/utils/cn';

interface HarmonicPattern {
  name: string;
  type: 'bullish' | 'bearish';
  points: {
    X: { price: number; index: number };
    A: { price: number; index: number };
    B: { price: number; index: number };
    C: { price: number; index: number };
    D: { price: number; index: number };
  };
  ratios: { AB_XA: number; BC_AB: number; CD_BC: number; AD_XA: number };
  confidence: number;
  prz: { low: number; high: number };
  description: string;
}

interface HarmonicData {
  symbol: string;
  patterns: HarmonicPattern[];
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

const HarmonicPatterns: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [data, setData] = useState<HarmonicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/analysis/harmonics/${symbol}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load harmonic data');
        setData(null);
      }
    } catch {
      setError('Failed to load harmonic data');
      setData(null);
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const patterns = data?.patterns || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Hexagon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Harmonic Patterns</h1>
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

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Patterns Found</p>
          <p className="text-2xl font-bold text-foreground">{patterns.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Bullish</p>
          <p className="text-2xl font-bold text-green-400">{patterns.filter((p) => p.type === 'bullish').length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Bearish</p>
          <p className="text-2xl font-bold text-red-400">{patterns.filter((p) => p.type === 'bearish').length}</p>
        </div>
      </div>

      {/* Patterns */}
      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-muted-foreground text-sm">Scanning for harmonic patterns...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      ) : patterns.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Hexagon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">No harmonic patterns found for {symbol}.</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different symbol or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {patterns.map((pattern, idx) => {
            const isBullish = pattern.type === 'bullish';
            const TypeIcon = isBullish ? TrendingUp : TrendingDown;

            return (
              <div key={idx} className="rounded-xl border border-border bg-card p-5 space-y-4">
                {/* Pattern Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hexagon className="w-5 h-5 text-primary" />
                    <span className="text-lg font-bold text-foreground">{pattern.name}</span>
                  </div>
                  <span className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
                    isBullish ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  )}>
                    <TypeIcon className="w-3 h-3" />
                    {pattern.type}
                  </span>
                </div>

                {/* XABCD Points */}
                <div className="grid grid-cols-5 gap-2">
                  {(['X', 'A', 'B', 'C', 'D'] as const).map((pt) => (
                    <div key={pt} className="text-center px-1 py-2 rounded-lg bg-secondary">
                      <p className="text-xs text-muted-foreground font-medium">{pt}</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">${pattern.points[pt].price.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Ratios */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex justify-between px-2 py-1.5 rounded bg-secondary text-xs">
                    <span className="text-muted-foreground">AB/XA</span>
                    <span className="font-bold text-foreground">{pattern.ratios.AB_XA}</span>
                  </div>
                  <div className="flex justify-between px-2 py-1.5 rounded bg-secondary text-xs">
                    <span className="text-muted-foreground">BC/AB</span>
                    <span className="font-bold text-foreground">{pattern.ratios.BC_AB}</span>
                  </div>
                  <div className="flex justify-between px-2 py-1.5 rounded bg-secondary text-xs">
                    <span className="text-muted-foreground">CD/BC</span>
                    <span className="font-bold text-foreground">{pattern.ratios.CD_BC}</span>
                  </div>
                  <div className="flex justify-between px-2 py-1.5 rounded bg-secondary text-xs">
                    <span className="text-muted-foreground">AD/XA</span>
                    <span className="font-bold text-foreground">{pattern.ratios.AD_XA}</span>
                  </div>
                </div>

                {/* PRZ */}
                <div className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Potential Reversal Zone (PRZ)</p>
                  <p className="text-sm font-bold text-primary">
                    ${pattern.prz.low.toLocaleString()} - ${pattern.prz.high.toLocaleString()}
                  </p>
                </div>

                {/* Confidence */}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HarmonicPatterns;
