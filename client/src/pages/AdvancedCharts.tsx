import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart2, Box, BarChart, BarChart4, RefreshCw, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { getMarketProfile, type MarketProfileData } from '@/services/api';
import { cn } from '@/utils/cn';

// =============================================================================
// Types
// =============================================================================

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

interface FootprintLevel {
  price: number;
  buyVol: number;
  sellVol: number;
  delta: number;
}

interface FootprintCandle {
  time: string;
  levels: FootprintLevel[];
}

interface OrderFlowData {
  symbol: string;
  candles: FootprintCandle[];
  cumulativeDelta: number[];
  summary: {
    totalBuys: number;
    totalSells: number;
    netDelta: number;
    dominantSide: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

const TABS = [
  { key: 'renko', label: 'Renko' },
  { key: 'market-profile', label: 'Market Profile' },
  { key: 'order-flow', label: 'Order Flow' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const shapeDescriptions: Record<string, { label: string; color: string; text: string }> = {
  normal: {
    label: 'Normal',
    color: 'bg-blue-500/20 text-blue-400',
    text: 'Volume is concentrated in the middle of the range, indicating a balanced auction. The market is in equilibrium and may continue to trade within the value area.',
  },
  'p-shape': {
    label: 'P-Shape',
    color: 'bg-green-500/20 text-green-400',
    text: 'Volume is concentrated at the upper part of the range. This often occurs during short-covering rallies or bullish breakouts. The market may continue higher or consolidate at these levels.',
  },
  'b-shape': {
    label: 'B-Shape',
    color: 'bg-red-500/20 text-red-400',
    text: 'Volume is concentrated at the lower part of the range. This often occurs during long liquidation or bearish breakdowns. The market may continue lower or find support at these levels.',
  },
};

// =============================================================================
// Renko Tab
// =============================================================================

const RenkoTab: React.FC<{ symbol: string }> = ({ symbol }) => {
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

  const last5 = data?.bricks?.slice(-5) || [];
  const upCount = last5.filter((b) => b.type === 'up').length;
  const downCount = last5.filter((b) => b.type === 'down').length;
  const trendLabel = upCount > downCount ? 'Bullish' : downCount > upCount ? 'Bearish' : 'Neutral';
  const trendColor = upCount > downCount ? 'text-success' : downCount > upCount ? 'text-danger' : 'text-muted-foreground';

  return (
    <div className="space-y-6">
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

// =============================================================================
// Market Profile Tab
// =============================================================================

const MarketProfileTab: React.FC<{ symbol: string }> = ({ symbol }) => {
  const [data, setData] = useState<MarketProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMarketProfile(symbol);
      setData(result);
    } catch {
      setError('Failed to load market profile data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Draw volume profile on canvas
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

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, bottom: 30, left: 80, right: 20 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const levels = data.volumeProfile;
    const maxVol = Math.max(...levels.map((l) => l.volume));
    const barHeight = chartH / levels.length;

    const vaLowIdx = levels.findIndex((l) => l.price >= data.vaLow);
    const vaHighIdx = levels.findIndex((l) => l.price >= data.vaHigh);
    const vaStartY = padding.top + (levels.length - 1 - Math.max(vaHighIdx, vaLowIdx)) * barHeight;
    const vaEndY = padding.top + (levels.length - Math.min(vaHighIdx, vaLowIdx)) * barHeight;

    ctx.fillStyle = 'rgba(201, 168, 76, 0.06)';
    ctx.fillRect(padding.left, vaStartY, chartW, vaEndY - vaStartY);

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const barW = maxVol > 0 ? (level.volume / maxVol) * chartW : 0;
      const y = padding.top + (levels.length - 1 - i) * barHeight;

      const isPOC = Math.abs(level.price - data.poc) < 0.01 * data.poc;
      const isVA = level.price >= data.vaLow && level.price <= data.vaHigh;

      if (isPOC) {
        ctx.fillStyle = 'rgba(201, 168, 76, 0.9)';
      } else if (isVA) {
        ctx.fillStyle = 'rgba(201, 168, 76, 0.35)';
      } else {
        ctx.fillStyle = 'rgba(136, 136, 160, 0.25)';
      }

      ctx.fillRect(padding.left, y + 2, barW, barHeight - 4);

      ctx.fillStyle = isPOC ? '#c9a84c' : '#8888a0';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(level.price.toLocaleString(undefined, { maximumFractionDigits: 2 }), padding.left - 8, y + barHeight / 2 + 4);

      if (barW > 40) {
        ctx.fillStyle = isPOC ? '#000' : '#e0e0e8';
        ctx.textAlign = 'left';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${level.pct.toFixed(1)}%`, padding.left + barW - 36, y + barHeight / 2 + 4);
      }
    }

    const pocIdx = levels.findIndex((l) => Math.abs(l.price - data.poc) < 0.01 * data.poc);
    if (pocIdx >= 0) {
      const pocY = padding.top + (levels.length - 1 - pocIdx) * barHeight + barHeight / 2;
      ctx.strokeStyle = '#c9a84c';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, pocY);
      ctx.lineTo(w - padding.right, pocY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#c9a84c';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('POC', w - padding.right, pocY - 4);
    }

    ctx.fillStyle = '#8888a0';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Volume', padding.left + chartW / 2, h - 5);
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <BarChart className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  const shape = data ? shapeDescriptions[data.distributionShape] : null;

  return (
    <div className="space-y-6">
      {error || !data ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <BarChart className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">{error || 'No data available'}</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">POC</p>
              <p className="text-lg font-bold text-primary font-mono">${data.poc.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">VA High</p>
              <p className="text-lg font-bold text-foreground font-mono">${data.vaHigh.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">VA Low</p>
              <p className="text-lg font-bold text-foreground font-mono">${data.vaLow.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Distribution</p>
              {shape && (
                <span className={cn('inline-block px-2 py-0.5 rounded text-sm font-semibold mt-1', shape.color)}>
                  {shape.label}
                </span>
              )}
            </div>
          </div>

          {/* Volume Profile Chart */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Volume Profile</h2>
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: '400px' }}
            />
            <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(201, 168, 76, 0.9)' }} />
                POC (Point of Control)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(201, 168, 76, 0.35)' }} />
                Value Area (70%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(136, 136, 160, 0.25)' }} />
                Outside VA
              </span>
            </div>
          </div>

          {/* Interpretation */}
          {shape && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    {shape.label} Distribution Interpretation
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{shape.text}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// =============================================================================
// Order Flow Tab
// =============================================================================

const OrderFlowTab: React.FC<{ symbol: string }> = ({ symbol }) => {
  const [data, setData] = useState<OrderFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/market/orderflow/${symbol}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load order flow data');
        setData(null);
      }
    } catch {
      setError('Failed to load order flow data');
      setData(null);
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Draw cumulative delta chart
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
    const w = rect.width;
    const h = rect.height;

    const deltas = data.cumulativeDelta;
    if (deltas.length === 0) return;

    const minD = Math.min(...deltas);
    const maxD = Math.max(...deltas);
    const rangeD = maxD - minD || 1;

    ctx.clearRect(0, 0, w, h);

    const zeroY = h - ((0 - minD) / rangeD) * (h - 20) - 10;
    if (minD < 0 && maxD > 0) {
      ctx.strokeStyle = 'rgba(128,128,128,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(w, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.strokeStyle = deltas[deltas.length - 1] >= 0 ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 2;

    for (let i = 0; i < deltas.length; i++) {
      const x = (i / (deltas.length - 1)) * (w - 20) + 10;
      const y = h - ((deltas[i] - minD) / rangeD) * (h - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const lastX = w - 10;
    ctx.lineTo(lastX, h - 10);
    ctx.lineTo(10, h - 10);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    const color = deltas[deltas.length - 1] >= 0 ? '34,197,94' : '239,68,68';
    gradient.addColorStop(0, `rgba(${color},0.3)`);
    gradient.addColorStop(1, `rgba(${color},0.02)`);
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [data]);

  const formatVol = (v: number): string => {
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toFixed(0);
  };

  const dominantColor = data?.summary.dominantSide === 'buyers' ? 'text-green-400' :
    data?.summary.dominantSide === 'sellers' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="space-y-6">
      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-muted-foreground text-sm">Loading order flow data...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      ) : data ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Buys</p>
              <p className="text-xl font-bold text-green-400">{formatVol(data.summary.totalBuys)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Sells</p>
              <p className="text-xl font-bold text-red-400">{formatVol(data.summary.totalSells)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Net Delta</p>
              <p className={cn('text-xl font-bold', data.summary.netDelta >= 0 ? 'text-green-400' : 'text-red-400')}>
                {data.summary.netDelta >= 0 ? '+' : ''}{formatVol(data.summary.netDelta)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Dominant Side</p>
              <p className={cn('text-xl font-bold capitalize', dominantColor)}>{data.summary.dominantSide}</p>
            </div>
          </div>

          {/* Cumulative Delta Chart */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Cumulative Delta</h3>
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: '160px' }}
            />
          </div>

          {/* Footprint Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Footprint Data</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Bid/ask volume at price levels per candle</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Time</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Price</th>
                    <th className="text-right px-3 py-2 text-green-400 font-medium">Buys</th>
                    <th className="text-right px-3 py-2 text-red-400 font-medium">Sells</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {data.candles.slice(-10).map((candle, ci) => (
                    <React.Fragment key={ci}>
                      {candle.levels.map((level, li) => {
                        const maxDelta = Math.max(...candle.levels.map((l) => Math.abs(l.delta)));
                        const intensity = maxDelta > 0 ? Math.abs(level.delta) / maxDelta : 0;
                        const isBuyDominant = level.delta > 0;

                        return (
                          <tr
                            key={`${ci}-${li}`}
                            className={cn(
                              'border-b border-border/50',
                              isBuyDominant
                                ? `bg-green-500/${Math.round(intensity * 15) + 5}`
                                : `bg-red-500/${Math.round(intensity * 15) + 5}`
                            )}
                            style={{
                              backgroundColor: isBuyDominant
                                ? `rgba(34,197,94,${intensity * 0.15 + 0.02})`
                                : `rgba(239,68,68,${intensity * 0.15 + 0.02})`,
                            }}
                          >
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {li === 0 ? new Date(candle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </td>
                            <td className="px-3 py-1.5 text-foreground font-medium">${level.price.toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right text-green-400">{formatVol(level.buyVol)}</td>
                            <td className="px-3 py-1.5 text-right text-red-400">{formatVol(level.sellVol)}</td>
                            <td className={cn('px-3 py-1.5 text-right font-bold', level.delta >= 0 ? 'text-green-400' : 'text-red-400')}>
                              {level.delta >= 0 ? '+' : ''}{formatVol(level.delta)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

// =============================================================================
// Main Page
// =============================================================================

export default function AdvancedCharts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [symbol, setSymbol] = useState('BTCUSDT');

  const activeTab = (searchParams.get('tab') as TabKey) || 'renko';

  const setTab = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Advanced Charts</h1>
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/15 text-primary border border-primary/20">
            INSTITUTIONAL
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
      {activeTab === 'renko' && <RenkoTab symbol={symbol} />}
      {activeTab === 'market-profile' && <MarketProfileTab symbol={symbol} />}
      {activeTab === 'order-flow' && <OrderFlowTab symbol={symbol} />}
    </div>
  );
}
