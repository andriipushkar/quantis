import React, { useEffect, useState, useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';
import { TradingChart, type OHLCVData } from '@/components/charts/TradingChart';
import { getOHLCV, getPairs, type TradingPair } from '@/services/api';
import { cn } from '@/utils/cn';

/* ── Constants ─────────────────────────────────────────────────── */

const DEFAULT_PANELS: { pair: string; timeframe: string }[] = [
  { pair: 'BTCUSDT', timeframe: '1m' },
  { pair: 'ETHUSDT', timeframe: '1m' },
  { pair: 'SOLUSDT', timeframe: '1m' },
  { pair: 'BNBUSDT', timeframe: '1m' },
];

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

/* ── Chart Panel ───────────────────────────────────────────────── */

interface ChartPanelProps {
  defaultPair: string;
  defaultTimeframe: string;
  pairs: TradingPair[];
}

const ChartPanel: React.FC<ChartPanelProps> = React.memo(({ defaultPair, defaultTimeframe, pairs }) => {
  const [pair, setPair] = useState(defaultPair);
  const [timeframe, setTimeframe] = useState(defaultTimeframe);
  const [candles, setCandles] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCandles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOHLCV(pair, timeframe, 200);
      // Sanitize: fix high/low and deduplicate timestamps
      const seen = new Map<number, OHLCVData>();
      for (const c of data) {
        seen.set(c.time, {
          time: c.time,
          open: c.open,
          high: Math.max(c.high, c.open, c.close),
          low: Math.min(c.low, c.open, c.close),
          close: c.close,
          volume: c.volume,
        });
      }
      setCandles(Array.from(seen.values()).sort((a, b) => a.time - b.time));
    } catch {
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }, [pair, timeframe]);

  useEffect(() => {
    fetchCandles();
    const interval = setInterval(fetchCandles, 15000);
    return () => clearInterval(interval);
  }, [fetchCandles]);

  // Build unique pair list from available pairs
  const pairOptions = pairs.length > 0
    ? [...new Set(pairs.map((p) => p.symbol))].sort()
    : [pair];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30">
        <select
          value={pair}
          onChange={(e) => setPair(e.target.value)}
          className="h-7 px-2 rounded-md bg-card border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 max-w-[130px]"
        >
          {pairOptions.map((p) => (
            <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'px-2 py-0.5 rounded text-xs font-medium transition-colors',
                tf === timeframe
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 relative">
        {loading && candles.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-muted-foreground text-sm animate-pulse">Loading...</span>
          </div>
        ) : (
          <TradingChart
            symbol={pair}
            timeframe={timeframe}
            data={candles}
            className="w-full h-full"
          />
        )}
      </div>
    </div>
  );
});

ChartPanel.displayName = 'ChartPanel';

/* ── MultiChart Page ───────────────────────────────────────────── */

const MultiChart: React.FC = () => {
  const [pairs, setPairs] = useState<TradingPair[]>([]);

  useEffect(() => {
    getPairs()
      .then(setPairs)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <LayoutGrid className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Multi-Chart</h1>
          <p className="text-xs text-muted-foreground">Monitor multiple pairs simultaneously</p>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 180px)' }}>
        {DEFAULT_PANELS.map((panel) => (
          <div key={`${panel.pair}-${panel.timeframe}`} className="min-h-[300px]">
            <ChartPanel
              defaultPair={panel.pair}
              defaultTimeframe={panel.timeframe}
              pairs={pairs}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiChart;
