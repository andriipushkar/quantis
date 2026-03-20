import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BarChart4, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';

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

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

const OrderFlow: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
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

    // Draw zero line if applicable
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

    // Draw line
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

    // Fill gradient under the line
    const lastX = w - 10;
    const lastY = h - ((deltas[deltas.length - 1] - minD) / rangeD) * (h - 20) - 10;
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart4 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Order Flow</h1>
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

export default OrderFlow;
