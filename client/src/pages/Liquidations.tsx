import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Flame, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface LiquidationLevel {
  price: number;
  side: 'long' | 'short';
  volume: number;
  distance_pct: number;
}

interface LiquidationData {
  symbol: string;
  currentPrice: number;
  levels: LiquidationLevel[];
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

function formatUsd(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toFixed(2)}`;
  if (value >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

const Liquidations: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [data, setData] = useState<LiquidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/market/liquidations/${symbol}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load liquidation data');
        setData(null);
      }
    } catch {
      setError('Failed to load liquidation data');
      setData(null);
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Draw the heatmap on canvas
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    const levels = data.levels;
    const maxVolume = Math.max(...levels.map((l) => l.volume));
    const barHeight = Math.max(16, Math.floor((height - 40) / levels.length) - 2);
    const centerX = width / 2;
    const maxBarWidth = centerX - 100;
    const labelWidth = 90;

    // Title labels
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';

    // Draw "Long Liquidations" and "Short Liquidations" headers
    const computedStyle = getComputedStyle(document.documentElement);
    const mutedColor = computedStyle.getPropertyValue('--muted-foreground').trim() || '#888';
    const fgColor = computedStyle.getPropertyValue('--foreground').trim() || '#fff';

    ctx.fillStyle = mutedColor;
    ctx.fillText('Long Liquidations', centerX / 2, 16);
    ctx.fillText('Short Liquidations', centerX + centerX / 2, 16);

    // Draw center line
    ctx.strokeStyle = mutedColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX, 24);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw bars
    const startY = 28;
    levels.forEach((level, i) => {
      const y = startY + i * (barHeight + 2);
      const barWidth = maxVolume > 0 ? (level.volume / maxVolume) * maxBarWidth : 0;

      if (level.side === 'long') {
        // Red bars going left from center
        const gradient = ctx.createLinearGradient(centerX - barWidth, y, centerX, y);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - barWidth, y, barWidth, barHeight);

        // Volume label on left
        ctx.fillStyle = 'rgb(239, 68, 68)';
        ctx.textAlign = 'right';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText(formatUsd(level.volume), centerX - barWidth - 4, y + barHeight / 2 + 4);
      } else {
        // Green bars going right from center
        const gradient = ctx.createLinearGradient(centerX, y, centerX + barWidth, y);
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.8)');
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0.3)');
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX, y, barWidth, barHeight);

        // Volume label on right
        ctx.fillStyle = 'rgb(34, 197, 94)';
        ctx.textAlign = 'left';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText(formatUsd(level.volume), centerX + barWidth + 4, y + barHeight / 2 + 4);
      }

      // Price label on y-axis (far left for longs, far right for shorts)
      ctx.fillStyle = fgColor;
      ctx.font = '11px system-ui, sans-serif';
      if (level.side === 'long') {
        ctx.textAlign = 'left';
        ctx.fillText(formatPrice(level.price), 4, y + barHeight / 2 + 4);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(formatPrice(level.price), width - 4, y + barHeight / 2 + 4);
      }
    });

    // Draw current price indicator
    const currentPriceY = startY + 10 * (barHeight + 2) - (barHeight + 2) / 2;
    ctx.fillStyle = 'rgb(234, 179, 8)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Current: ${formatPrice(data.currentPrice)}`, centerX, currentPriceY + 4);
  }, [data]);

  // Compute summary stats
  const longLevels = data?.levels.filter((l) => l.side === 'long') || [];
  const shortLevels = data?.levels.filter((l) => l.side === 'short') || [];
  const totalLongVol = longLevels.reduce((s, l) => s + l.volume, 0);
  const totalShortVol = shortLevels.reduce((s, l) => s + l.volume, 0);

  // Find nearest cluster (level with highest volume within 2% of current price)
  const nearLevels = data?.levels.filter((l) => Math.abs(l.distance_pct) <= 2) || [];
  const nearestCluster = nearLevels.length > 0
    ? nearLevels.reduce((max, l) => l.volume > max.volume ? l : max, nearLevels[0])
    : null;

  const hasCascadeWarning = nearestCluster && nearestCluster.volume > 10_000_000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flame className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Liquidation Heatmap</h1>
        </div>
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

      {/* Cascade Warning */}
      {hasCascadeWarning && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Cascade Warning</p>
            <p className="text-xs text-muted-foreground">
              Large liquidation cluster of {formatUsd(nearestCluster!.volume)} ({nearestCluster!.side} positions) within 2% of current price at {formatPrice(nearestCluster!.price)}.
              This could trigger a liquidation cascade.
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Long Liquidation Volume</p>
            <p className="text-xl font-bold text-red-400">{formatUsd(totalLongVol)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Short Liquidation Volume</p>
            <p className="text-xl font-bold text-green-400">{formatUsd(totalShortVol)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Nearest Cluster</p>
            {nearestCluster ? (
              <p className="text-xl font-bold text-foreground">
                {formatPrice(nearestCluster.price)}{' '}
                <span className={cn('text-sm', nearestCluster.side === 'long' ? 'text-red-400' : 'text-green-400')}>
                  ({nearestCluster.side}) {formatUsd(nearestCluster.volume)}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No clusters near price</p>
            )}
          </div>
        </div>
      )}

      {/* Canvas Chart */}
      <div className="rounded-xl border border-border bg-card p-4">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <span className="text-muted-foreground text-sm">Loading liquidation data...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-96">
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ height: '500px' }}
          />
        )}
      </div>
    </div>
  );
};

export default Liquidations;
