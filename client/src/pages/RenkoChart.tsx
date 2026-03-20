import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Brick {
  price: number;
  type: 'up' | 'down';
  index: number;
}

interface RenkoData {
  symbol: string;
  brickSize: number;
  bricks: Brick[];
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT',
];

const RenkoChart: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [data, setData] = useState<RenkoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/market/renko/${encodeURIComponent(sym)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load Renko data');
        setData(null);
      } else {
        setData(json.data);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(symbol);
  }, [symbol, fetchData]);

  // Draw Renko chart on canvas
  useEffect(() => {
    if (!data || !canvasRef.current || data.bricks.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    const bricks = data.bricks;
    const brickSize = data.brickSize;

    // Calculate price range
    const prices = bricks.map((b) => b.price);
    const minPrice = Math.min(...prices) - brickSize;
    const maxPrice = Math.max(...prices) + brickSize;

    const pad = { top: 20, right: 60, bottom: 20, left: 20 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const brickW = Math.max(4, Math.min(20, plotW / bricks.length));
    const priceRange = maxPrice - minPrice;

    const yScale = (p: number) => pad.top + plotH - ((p - minPrice) / priceRange) * plotH;
    const brickH = (brickSize / priceRange) * plotH;

    const computedStyle = getComputedStyle(document.documentElement);
    const borderColor = computedStyle.getPropertyValue('--border').trim();
    const mutedColor = computedStyle.getPropertyValue('--muted-foreground').trim();

    // Grid lines
    ctx.strokeStyle = `hsl(${borderColor})`;
    ctx.lineWidth = 0.5;
    const priceStep = brickSize * Math.max(1, Math.ceil(5 / ((plotH / priceRange) * brickSize / 30)));
    const startPrice = Math.ceil(minPrice / priceStep) * priceStep;
    ctx.font = '10px sans-serif';
    ctx.fillStyle = `hsl(${mutedColor})`;
    ctx.textAlign = 'left';
    for (let p = startPrice; p <= maxPrice; p += priceStep) {
      const y = yScale(p);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.fillText(p >= 1000 ? `${(p / 1000).toFixed(1)}k` : p.toFixed(2), W - pad.right + 4, y + 3);
    }

    // Draw bricks
    const startX = pad.left + Math.max(0, (plotW - bricks.length * brickW) / 2);
    bricks.forEach((brick, i) => {
      const x = startX + i * brickW;
      const topPrice = brick.type === 'up' ? brick.price : brick.price + brickSize;
      const y = yScale(topPrice);

      ctx.fillStyle = brick.type === 'up' ? '#22c55e' : '#ef4444';
      ctx.strokeStyle = brick.type === 'up' ? '#16a34a' : '#dc2626';
      ctx.lineWidth = 1;

      ctx.fillRect(x + 1, y, brickW - 2, brickH);
      ctx.strokeRect(x + 1, y, brickW - 2, brickH);
    });
  }, [data]);

  // Trend summary from last 5 bricks
  const last5 = data?.bricks.slice(-5) || [];
  const upCount = last5.filter((b) => b.type === 'up').length;
  const downCount = last5.filter((b) => b.type === 'down').length;
  const trendLabel = upCount > downCount ? 'Bullish' : downCount > upCount ? 'Bearish' : 'Neutral';
  const trendColor = upCount > downCount ? 'text-success' : downCount > upCount ? 'text-danger' : 'text-muted-foreground';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Box className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Renko Chart</h1>
          <p className="text-sm text-muted-foreground">Non-time-based price chart using fixed brick sizes</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                symbol === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {s.replace('USDT', '')}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Info bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Brick Size</p>
              <p className="text-lg font-bold font-mono text-foreground">
                {data.brickSize >= 1 ? `$${data.brickSize.toLocaleString()}` : `$${data.brickSize.toFixed(4)}`}
              </p>
              <p className="text-xs text-muted-foreground">ATR/2 based</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Bricks</p>
              <p className="text-lg font-bold font-mono text-foreground">{data.bricks.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Trend (Last 5)</p>
              <p className={cn('text-lg font-bold flex items-center gap-2', trendColor)}>
                {upCount > downCount && <TrendingUp className="w-5 h-5" />}
                {downCount > upCount && <TrendingDown className="w-5 h-5" />}
                {trendLabel}
              </p>
              <p className="text-xs text-muted-foreground">
                {last5.map((b) => (b.type === 'up' ? '+' : '-')).join(' ')}
              </p>
            </div>
          </div>

          {/* Renko canvas */}
          <div className="bg-card border border-border rounded-xl p-4">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: 400 }}
            />
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
              Up brick
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
              Down brick
            </span>
            <span className="flex items-center gap-1.5 ml-auto">
              <Info className="w-3.5 h-3.5" />
              Cached for 5 minutes
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default RenkoChart;
