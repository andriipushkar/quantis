import React, { useEffect, useState, useCallback } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';

interface WyckoffEvent {
  name: string;
  type: string;
  index: number;
  price: number;
}

interface WyckoffData {
  symbol: string;
  phase: string;
  confidence: number;
  description: string;
  events: WyckoffEvent[];
  volumeAnalysis: { upVolume: number; downVolume: number; ratio: number };
  tradingImplication: string;
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

const PHASE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  accumulation: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  markup: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  distribution: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  markdown: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  unknown: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
};

const EVENT_LABELS: Record<string, string> = {
  SC: 'Sharp drop with high volume spike. Indicates capitulation selling.',
  AR: 'Quick bounce after the selling climax. Defines the upper range.',
  spring: 'False breakout below support with quick recovery. Bullish signal.',
  SOS: 'Breakout above resistance with strong volume. Confirms demand.',
};

const WyckoffPhase: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [data, setData] = useState<WyckoffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/analysis/wyckoff/${symbol}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load Wyckoff data');
        setData(null);
      }
    } catch {
      setError('Failed to load Wyckoff data');
      setData(null);
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const phaseStyle = data ? (PHASE_STYLES[data.phase] || PHASE_STYLES.unknown) : PHASE_STYLES.unknown;

  const formatVolume = (v: number): string => {
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Layers className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Wyckoff Phase</h1>
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
          <span className="text-muted-foreground text-sm">Analyzing Wyckoff structure...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      ) : data ? (
        <>
          {/* Phase Badge (Large) */}
          <div className={cn('rounded-xl border p-6 text-center', phaseStyle.border, phaseStyle.bg)}>
            <p className="text-xs text-muted-foreground mb-2">Current Phase</p>
            <p className={cn('text-4xl font-bold capitalize', phaseStyle.text)}>{data.phase}</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">Confidence:</span>
              <span className="text-sm font-bold text-foreground">{data.confidence}%</span>
            </div>
            <div className="mt-2 max-w-xs mx-auto h-2 rounded-full bg-black/20 overflow-hidden">
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

          {/* Description */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{data.description}</p>
          </div>

          {/* Volume Analysis */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Volume Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Up Volume</p>
                <p className="text-lg font-bold text-green-400">{formatVolume(data.volumeAnalysis.upVolume)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Down Volume</p>
                <p className="text-lg font-bold text-red-400">{formatVolume(data.volumeAnalysis.downVolume)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Up/Down Ratio</p>
                <p className={cn('text-lg font-bold', data.volumeAnalysis.ratio > 1 ? 'text-green-400' : 'text-red-400')}>
                  {data.volumeAnalysis.ratio}x
                </p>
              </div>
            </div>
            {/* Volume Bar Comparison */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16">Buyers</span>
                <div className="flex-1 h-5 rounded bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded bg-green-500/70"
                    style={{
                      width: `${data.volumeAnalysis.upVolume + data.volumeAnalysis.downVolume > 0
                        ? (data.volumeAnalysis.upVolume / (data.volumeAnalysis.upVolume + data.volumeAnalysis.downVolume)) * 100
                        : 50}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16">Sellers</span>
                <div className="flex-1 h-5 rounded bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded bg-red-500/70"
                    style={{
                      width: `${data.volumeAnalysis.upVolume + data.volumeAnalysis.downVolume > 0
                        ? (data.volumeAnalysis.downVolume / (data.volumeAnalysis.upVolume + data.volumeAnalysis.downVolume)) * 100
                        : 50}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Detected Events */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Detected Events</h3>
            {data.events.length === 0 ? (
              <p className="text-xs text-muted-foreground">No key Wyckoff events detected in the current window.</p>
            ) : (
              <div className="space-y-3">
                {data.events.map((event, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-secondary">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{event.type}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{event.name}</span>
                        <span className="text-xs text-muted-foreground">@ ${event.price.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {EVENT_LABELS[event.type] || `Detected at candle #${event.index}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trading Implication */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <h3 className="text-sm font-semibold text-primary mb-2">Trading Implication</h3>
            <p className="text-sm text-foreground leading-relaxed">{data.tradingImplication}</p>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default WyckoffPhase;
