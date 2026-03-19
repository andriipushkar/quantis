import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface HourlyData {
  hour: number;
  avgReturn: number;
  winRate: number;
  count: number;
}

interface DailyData {
  day: string;
  avgReturn: number;
  winRate: number;
  count: number;
}

interface SeasonalityData {
  symbol: string;
  hourly: HourlyData[];
  daily: DailyData[];
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
];

function getHeatmapColor(value: number): string {
  // Normalize returns to color
  if (value > 0.05) return 'bg-green-600 text-white';
  if (value > 0.02) return 'bg-green-500/80 text-white';
  if (value > 0.005) return 'bg-green-400/50 text-foreground';
  if (value > -0.005) return 'bg-secondary text-muted-foreground';
  if (value > -0.02) return 'bg-red-400/50 text-foreground';
  if (value > -0.05) return 'bg-red-500/80 text-white';
  return 'bg-red-600 text-white';
}

function getBarColor(value: number): string {
  return value >= 0 ? 'bg-green-500' : 'bg-red-500';
}

const Seasonality: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [data, setData] = useState<SeasonalityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/market/seasonality/${encodeURIComponent(sym)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load seasonality data');
        setData(null);
      } else {
        setData(json.data);
      }
    } catch {
      setError('Network error. Please try again.');
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(symbol);
  }, [symbol, fetchData]);

  // Compute max absolute return for daily chart scaling
  const maxDailyReturn = data
    ? Math.max(...data.daily.map((d) => Math.abs(d.avgReturn)), 0.001)
    : 1;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Seasonality Analytics</h1>
            <p className="text-sm text-muted-foreground">Discover time-based performance patterns</p>
          </div>
        </div>

        {/* Symbol Selector */}
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center animate-pulse">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <span className="ml-3 text-sm text-muted-foreground">Loading seasonality data...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Hourly Heatmap */}
          <div className="bg-secondary rounded-xl border border-border p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Hourly Performance Heatmap (UTC)</h2>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-24 gap-1 min-w-[600px]" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
                {/* Hour labels */}
                {data.hourly.map((h) => (
                  <div key={`label-${h.hour}`} className="text-center text-xs text-muted-foreground pb-1">
                    {h.hour.toString().padStart(2, '0')}
                  </div>
                ))}
                {/* Heatmap cells */}
                {data.hourly.map((h) => (
                  <div
                    key={`cell-${h.hour}`}
                    className={cn(
                      'rounded p-2 text-center transition-all hover:ring-1 hover:ring-primary/50 cursor-default',
                      getHeatmapColor(h.avgReturn)
                    )}
                    title={`Hour ${h.hour}: Avg Return ${h.avgReturn.toFixed(4)}%, Win Rate ${h.winRate}%, Samples: ${h.count}`}
                  >
                    <div className="text-xs font-semibold">
                      {h.avgReturn > 0 ? '+' : ''}{h.avgReturn.toFixed(3)}%
                    </div>
                  </div>
                ))}
                {/* Win rate row */}
                {data.hourly.map((h) => (
                  <div key={`wr-${h.hour}`} className="text-center text-xs text-muted-foreground pt-1">
                    {h.winRate.toFixed(0)}%
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <span>Avg Return per candle</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-600" />
                <span>Negative</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-secondary border border-border" />
                <span>Neutral</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-600" />
                <span>Positive</span>
              </div>
            </div>
          </div>

          {/* Day of Week Chart */}
          <div className="bg-secondary rounded-xl border border-border p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Day of Week Performance</h2>
            <div className="space-y-3">
              {data.daily.map((d) => {
                const barWidth = maxDailyReturn > 0 ? (Math.abs(d.avgReturn) / maxDailyReturn) * 100 : 0;
                return (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground w-10">{d.day}</span>
                    <div className="flex-1 flex items-center h-8">
                      {/* Center line concept: bars go left for negative, right for positive */}
                      <div className="relative w-full h-6 bg-background rounded overflow-hidden">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-1/2 h-full relative">
                            {d.avgReturn < 0 && (
                              <div
                                className={cn('absolute right-0 h-full rounded-l', getBarColor(d.avgReturn))}
                                style={{ width: `${barWidth}%` }}
                              />
                            )}
                          </div>
                          <div className="w-px h-full bg-border flex-shrink-0" />
                          <div className="w-1/2 h-full relative">
                            {d.avgReturn >= 0 && (
                              <div
                                className={cn('absolute left-0 h-full rounded-r', getBarColor(d.avgReturn))}
                                style={{ width: `${barWidth}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <span className={cn('text-sm font-semibold', d.avgReturn >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {d.avgReturn >= 0 ? '+' : ''}{d.avgReturn.toFixed(4)}%
                      </span>
                    </div>
                    <div className="text-right min-w-[60px]">
                      <span className="text-xs text-muted-foreground">
                        WR: {d.winRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-secondary rounded-xl border border-border p-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">About Seasonality Analysis</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Seasonality analysis examines historical price data to identify recurring patterns based on time of day
                  and day of the week. These patterns can help traders identify potentially favorable times to enter or exit
                  positions. However, past performance does not guarantee future results. Seasonality patterns can change
                  over time and should be used as one of many tools in your trading toolkit, not as a standalone strategy.
                  Always combine seasonality insights with other technical and fundamental analysis.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Seasonality;
