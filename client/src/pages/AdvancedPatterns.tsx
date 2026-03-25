import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, RefreshCw, Waves, Hexagon, Layers, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// Constants
// =============================================================================

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

const TABS = [
  { key: 'elliott', label: 'Elliott Wave' },
  { key: 'harmonic', label: 'Harmonic Patterns' },
  { key: 'wyckoff', label: 'Wyckoff Phase' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const PATTERN_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  impulse: { bg: 'bg-green-500/20', text: 'text-green-400', icon: TrendingUp },
  correction: { bg: 'bg-red-500/20', text: 'text-red-400', icon: TrendingDown },
  none: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: Minus },
};

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

// =============================================================================
// Elliott Wave Tab
// =============================================================================

const ElliottWaveTab: React.FC<{ symbol: string }> = ({ symbol }) => {
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

// =============================================================================
// Harmonic Patterns Tab
// =============================================================================

const HarmonicPatternsTab: React.FC<{ symbol: string }> = ({ symbol }) => {
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

// =============================================================================
// Wyckoff Phase Tab
// =============================================================================

const WyckoffPhaseTab: React.FC<{ symbol: string }> = ({ symbol }) => {
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

// =============================================================================
// Main Page
// =============================================================================

export default function AdvancedPatterns() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [symbol, setSymbol] = useState('BTCUSDT');

  const activeTab = (searchParams.get('tab') as TabKey) || 'elliott';

  const setTab = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Eye className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Advanced Patterns</h1>
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/15 text-primary border border-primary/20">
            PRO
          </span>
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
      {activeTab === 'elliott' && <ElliottWaveTab symbol={symbol} />}
      {activeTab === 'harmonic' && <HarmonicPatternsTab symbol={symbol} />}
      {activeTab === 'wyckoff' && <WyckoffPhaseTab symbol={symbol} />}
    </div>
  );
}
