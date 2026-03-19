import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getScreener, type ScreenerItem } from '@/services/api';
import { cn } from '@/utils/cn';
import { Activity } from 'lucide-react';

type ColorMode = 'change' | 'rsi';

function getChangeColor(change: number): string {
  if (change >= 5) return 'bg-green-600';
  if (change >= 3) return 'bg-green-600/80';
  if (change >= 1) return 'bg-green-600/60';
  if (change >= 0) return 'bg-green-600/30';
  if (change >= -1) return 'bg-red-600/30';
  if (change >= -3) return 'bg-red-600/60';
  if (change >= -5) return 'bg-red-600/80';
  return 'bg-red-600';
}

function getRsiColor(rsi: number): string {
  if (rsi >= 70) return 'bg-red-600';
  if (rsi >= 60) return 'bg-red-600/60';
  if (rsi >= 40) return 'bg-yellow-600/40';
  if (rsi >= 30) return 'bg-green-600/60';
  return 'bg-green-600';
}

function stripQuote(symbol: string): string {
  return symbol.replace(/USDT$/, '');
}

const Heatmap: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('change');

  const fetchData = useCallback(async () => {
    try {
      const data = await getScreener({ sort: 'volume', order: 'desc' });
      setItems(data);
      setError(null);
    } catch {
      setError('Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Compute block sizes based on volume (relative sizing)
  const totalVolume = items.reduce((sum, item) => sum + item.volume, 0);

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
          <span className="text-muted-foreground text-sm">Loading heatmap...</span>
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
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

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-foreground">Market Heatmap</h1>
        <div className="flex items-center gap-2">
          {/* Time period */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 text-primary border border-primary/25">
              24H
            </button>
          </div>
          {/* Color mode */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            <button
              onClick={() => setColorMode('change')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                colorMode === 'change'
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              Price Change
            </button>
            <button
              onClick={() => setColorMode('rsi')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                colorMode === 'rsi'
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              RSI
            </button>
          </div>
        </div>
      </div>

      {/* Treemap grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 auto-rows-auto">
        {items.map((item) => {
          // Compute relative size: span more cells for higher volume
          const volumeRatio = totalVolume > 0 ? item.volume / totalVolume : 0;
          // Top items get larger blocks
          const isLarge = volumeRatio > 0.1;
          const isMedium = volumeRatio > 0.03 && !isLarge;

          const bgColor = colorMode === 'change'
            ? getChangeColor(item.change24h)
            : getRsiColor(item.rsi);

          const displayValue = colorMode === 'change'
            ? `${item.change24h >= 0 ? '+' : ''}${item.change24h.toFixed(2)}%`
            : `RSI ${item.rsi.toFixed(0)}`;

          return (
            <button
              key={item.symbol}
              onClick={() => navigate(`/chart/${item.symbol}`)}
              className={cn(
                'relative rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-primary/50',
                bgColor,
                isLarge ? 'col-span-2 row-span-2 min-h-[120px]' : isMedium ? 'col-span-2 min-h-[80px]' : 'min-h-[60px]'
              )}
            >
              <span className={cn(
                'font-bold text-white drop-shadow-sm',
                isLarge ? 'text-base' : 'text-xs'
              )}>
                {stripQuote(item.symbol)}
              </span>
              <span className={cn(
                'font-mono text-white/90 drop-shadow-sm',
                isLarge ? 'text-sm' : 'text-[10px]'
              )}>
                {displayValue}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Heatmap;
