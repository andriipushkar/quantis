import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart, Info } from 'lucide-react';
import { getMarketProfile, type MarketProfileData } from '@/services/api';
import { cn } from '@/utils/cn';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT'];

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

const MarketProfile: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
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

    // Clear
    ctx.clearRect(0, 0, w, h);

    const levels = data.volumeProfile;
    const maxVol = Math.max(...levels.map((l) => l.volume));
    const barHeight = chartH / levels.length;

    // Value area shading
    const vaLowIdx = levels.findIndex((l) => l.price >= data.vaLow);
    const vaHighIdx = levels.findIndex((l) => l.price >= data.vaHigh);
    const vaStartY = padding.top + (levels.length - 1 - Math.max(vaHighIdx, vaLowIdx)) * barHeight;
    const vaEndY = padding.top + (levels.length - Math.min(vaHighIdx, vaLowIdx)) * barHeight;

    ctx.fillStyle = 'rgba(201, 168, 76, 0.06)';
    ctx.fillRect(padding.left, vaStartY, chartW, vaEndY - vaStartY);

    // Draw bars
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

      // Price label
      ctx.fillStyle = isPOC ? '#c9a84c' : '#8888a0';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(level.price.toLocaleString(undefined, { maximumFractionDigits: 2 }), padding.left - 8, y + barHeight / 2 + 4);

      // Volume percentage on the bar
      if (barW > 40) {
        ctx.fillStyle = isPOC ? '#000' : '#e0e0e8';
        ctx.textAlign = 'left';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${level.pct.toFixed(1)}%`, padding.left + barW - 36, y + barHeight / 2 + 4);
      }
    }

    // POC line
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

    // Volume axis label
    ctx.fillStyle = '#8888a0';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Volume', padding.left + chartW / 2, h - 5);
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <BarChart className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  const shape = data ? shapeDescriptions[data.distributionShape] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <BarChart className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Market Profile</h1>
        </div>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>{s.replace('USDT', '/USDT')}</option>
          ))}
        </select>
      </div>

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

export default MarketProfile;
