import React, { useEffect, useState } from 'react';
import { Crosshair, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ConfluenceZone {
  price: number;
  sources: string[];
  count: number;
  strength: 'weak' | 'moderate' | 'strong' | 'extreme';
  distancePercent: number;
}

interface ConfluenceData {
  symbol: string;
  currentPrice: number;
  rsi: number;
  zones: ConfluenceZone[];
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

const STRENGTH_STYLES: Record<string, { bg: string; text: string; border: string; markerBg: string }> = {
  weak: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', markerBg: 'bg-slate-500' },
  moderate: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', markerBg: 'bg-amber-500' },
  strong: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', markerBg: 'bg-orange-500' },
  extreme: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', markerBg: 'bg-red-500' },
};

const Confluence: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [data, setData] = useState<ConfluenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/v1/market/confluence/${symbol}`);
        const json = await res.json();
        if (json.success && json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
          setData(json.data);
        } else if (!json.success) {
          setError(json.error || 'Failed to load confluence data');
          setData(null);
        }
      } catch {
        setError('Failed to load confluence data');
        setData(null);
      }
      setLoading(false);
    };
    fetchData();
  }, [symbol]);

  // Build visual price ladder data
  const zones = data?.zones ?? [];
  const aboveZones = zones.filter((z) => z.distancePercent > 0.05).slice(0, 8);
  const belowZones = zones.filter((z) => z.distancePercent < -0.05).slice(0, 8);
  const atPrice = zones.filter((z) => Math.abs(z.distancePercent) <= 0.05);

  // Sort for ladder: above descending, below ascending
  aboveZones.sort((a, b) => b.distancePercent - a.distancePercent);
  belowZones.sort((a, b) => a.distancePercent - b.distancePercent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crosshair className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Confluence Map</h1>
        </div>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center animate-pulse">
            <span className="text-black font-bold text-sm">Q</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-muted-foreground text-sm">{error}</div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Main: Zones list */}
          <div className="space-y-4">
            {/* Current Price */}
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Current Price</p>
                  <p className="text-2xl font-bold text-foreground">
                    ${data.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">RSI (14)</p>
                  <p
                    className={cn(
                      'text-lg font-bold',
                      data.rsi >= 70 ? 'text-red-400' : data.rsi <= 30 ? 'text-emerald-400' : 'text-foreground'
                    )}
                  >
                    {data.rsi}
                  </p>
                </div>
              </div>
            </div>

            {/* Zones table */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">
                Confluence Zones ({data.zones.length})
              </h2>
              {data.zones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No confluence zones detected.</p>
              ) : (
                data.zones.map((zone, idx) => {
                  const style = STRENGTH_STYLES[zone.strength];
                  const isAbove = zone.distancePercent > 0;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'p-3 rounded-lg border transition-colors',
                        style.border,
                        style.bg
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-foreground">
                            ${zone.price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: zone.price < 1 ? 6 : 2,
                            })}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase',
                              style.bg,
                              style.text
                            )}
                          >
                            {zone.strength} ({zone.count})
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          {isAbove ? (
                            <ArrowUp className="w-3 h-3 text-red-400" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-emerald-400" />
                          )}
                          <span
                            className={cn(
                              'font-medium',
                              isAbove ? 'text-red-400' : 'text-emerald-400'
                            )}
                          >
                            {zone.distancePercent >= 0 ? '+' : ''}{zone.distancePercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {zone.sources.map((source) => (
                          <span
                            key={source}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Visual Price Ladder */}
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">Price Ladder</h3>

            <div className="space-y-1">
              {/* Above current price */}
              {aboveZones.map((zone, idx) => {
                const style = STRENGTH_STYLES[zone.strength];
                const barWidth = Math.min(100, zone.count * 25);
                return (
                  <div key={`above-${idx}`} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-right font-mono text-red-400 truncate">
                      {zone.price < 1
                        ? zone.price.toFixed(6)
                        : zone.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <div className="flex-1 flex items-center">
                      <div
                        className={cn('h-3 rounded-sm', style.markerBg)}
                        style={{ width: `${barWidth}%`, opacity: 0.6 + zone.count * 0.1 }}
                      />
                    </div>
                    <span className="w-4 text-center text-muted-foreground font-mono">{zone.count}</span>
                  </div>
                );
              })}

              {/* At price / Current */}
              <div className="flex items-center gap-2 text-xs py-1 border-y border-primary/30 my-1">
                <span className="w-20 text-right font-mono text-primary font-bold truncate">
                  {data.currentPrice < 1
                    ? data.currentPrice.toFixed(6)
                    : data.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <div className="flex-1 flex items-center">
                  <div className="h-4 w-full bg-primary/20 rounded-sm flex items-center justify-center">
                    <span className="text-[9px] text-primary font-semibold">CURRENT</span>
                  </div>
                </div>
                <span className="w-4 text-center text-primary font-mono font-bold">
                  {atPrice.reduce((sum, z) => sum + z.count, 0) || '-'}
                </span>
              </div>

              {/* Below current price */}
              {belowZones.map((zone, idx) => {
                const style = STRENGTH_STYLES[zone.strength];
                const barWidth = Math.min(100, zone.count * 25);
                return (
                  <div key={`below-${idx}`} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-right font-mono text-emerald-400 truncate">
                      {zone.price < 1
                        ? zone.price.toFixed(6)
                        : zone.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <div className="flex-1 flex items-center">
                      <div
                        className={cn('h-3 rounded-sm', style.markerBg)}
                        style={{ width: `${barWidth}%`, opacity: 0.6 + zone.count * 0.1 }}
                      />
                    </div>
                    <span className="w-4 text-center text-muted-foreground font-mono">{zone.count}</span>
                  </div>
                );
              })}

              {aboveZones.length === 0 && belowZones.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No zones to display in the ladder.
                </p>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-border space-y-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1.5">Strength</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STRENGTH_STYLES).map(([key, style]) => (
                  <div key={key} className="flex items-center gap-1">
                    <div className={cn('w-2.5 h-2.5 rounded-sm', style.markerBg)} />
                    <span className="text-[10px] text-muted-foreground capitalize">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Confluence;
