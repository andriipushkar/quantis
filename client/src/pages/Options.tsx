import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart3, TrendingUp, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ChainRow {
  strike: number;
  callPrice: number;
  putPrice: number;
  callIV: number;
  putIV: number;
  callDelta: number;
  putDelta: number;
  callGamma: number;
  callTheta: number;
  callOI: number;
  putOI: number;
  callVolume: number;
  putVolume: number;
}

interface OptionsData {
  symbol: string;
  currentPrice: number;
  expiryDate: string;
  chain: ChainRow[];
  maxPain: number;
  putCallRatio: number;
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

const Options: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [data, setData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchData = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/market/options/${encodeURIComponent(sym)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load options data');
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

  // Draw IV smile chart
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
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    const strikes = data.chain.map((r) => r.strike);
    const callIVs = data.chain.map((r) => r.callIV);
    const putIVs = data.chain.map((r) => r.putIV);
    const allIVs = [...callIVs, ...putIVs];
    const minIV = Math.min(...allIVs) - 2;
    const maxIV = Math.max(...allIVs) + 2;
    const minStrike = strikes[0];
    const maxStrike = strikes[strikes.length - 1];

    const pad = { top: 20, right: 20, bottom: 30, left: 50 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const xScale = (s: number) => pad.left + ((s - minStrike) / (maxStrike - minStrike)) * plotW;
    const yScale = (iv: number) => pad.top + plotH - ((iv - minIV) / (maxIV - minIV)) * plotH;

    // Grid
    const computedStyle = getComputedStyle(document.documentElement);
    const borderColor = computedStyle.getPropertyValue('--border').trim();
    const mutedColor = computedStyle.getPropertyValue('--muted-foreground').trim();

    ctx.strokeStyle = `hsl(${borderColor})`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      const ivLabel = (maxIV - ((maxIV - minIV) / 4) * i).toFixed(1);
      ctx.fillStyle = `hsl(${mutedColor})`;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${ivLabel}%`, pad.left - 6, y + 4);
    }

    // Strike labels
    ctx.textAlign = 'center';
    for (let i = 0; i < strikes.length; i += 2) {
      const x = xScale(strikes[i]);
      ctx.fillStyle = `hsl(${mutedColor})`;
      ctx.fillText(strikes[i].toLocaleString(), x, H - 8);
    }

    // Call IV line (green)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    strikes.forEach((s, i) => {
      const x = xScale(s);
      const y = yScale(callIVs[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Put IV line (red)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    strikes.forEach((s, i) => {
      const x = xScale(s);
      const y = yScale(putIVs[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ATM line
    const atmX = xScale(data.currentPrice);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(atmX, pad.top);
    ctx.lineTo(atmX, H - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#22c55e';
    ctx.fillText('Call IV', W - pad.right - 70, pad.top + 12);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('Put IV', W - pad.right - 20, pad.top + 12);
  }, [data]);

  const atmStrike = data
    ? data.chain.reduce((best, row) =>
        Math.abs(row.strike - data.currentPrice) < Math.abs(best.strike - data.currentPrice) ? row : best
      ).strike
    : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Options Analytics</h1>
          <p className="text-sm text-muted-foreground">Simulated options chain with Greeks, IV smile, and Max Pain</p>
        </div>

        {/* Symbol selector */}
        <div className="ml-auto flex items-center gap-2">
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
          {/* Top badges */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Current Price</p>
              <p className="text-xl font-bold font-mono text-foreground">${data.currentPrice.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Max Pain</p>
              <p className="text-xl font-bold font-mono text-primary">${data.maxPain.toLocaleString()}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Put/Call Ratio</p>
              <p className={cn(
                'text-xl font-bold font-mono',
                data.putCallRatio > 1 ? 'text-danger' : data.putCallRatio < 0.7 ? 'text-success' : 'text-foreground'
              )}>
                {data.putCallRatio.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.putCallRatio > 1 ? 'Bearish bias' : data.putCallRatio < 0.7 ? 'Bullish bias' : 'Neutral'}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Expiry</p>
              <p className="text-xl font-bold font-mono text-foreground">{data.expiryDate}</p>
            </div>
          </div>

          {/* Max Pain bar chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-foreground font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Max Pain Distribution
            </h2>
            <div className="flex items-end gap-1 h-32">
              {data.chain.map((row) => {
                const totalOI = row.callOI + row.putOI;
                const maxOI = Math.max(...data.chain.map((r) => r.callOI + r.putOI));
                const height = maxOI > 0 ? (totalOI / maxOI) * 100 : 0;
                const isMaxPain = row.strike === data.maxPain;
                return (
                  <div key={row.strike} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        isMaxPain ? 'bg-primary' : 'bg-muted-foreground/30'
                      )}
                      style={{ height: `${height}%`, minHeight: 2 }}
                    />
                    <span className={cn(
                      'text-[9px] font-mono',
                      isMaxPain ? 'text-primary font-bold' : 'text-muted-foreground'
                    )}>
                      {row.strike >= 10000 ? `${(row.strike / 1000).toFixed(0)}k` : row.strike}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Options Chain Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-foreground font-semibold">Options Chain</h2>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Simulated data
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs border-b border-border">
                    <th colSpan={4} className="px-2 py-2 text-center text-success font-semibold border-r border-border/50">CALLS</th>
                    <th className="px-2 py-2 text-center font-semibold text-foreground">Strike</th>
                    <th colSpan={4} className="px-2 py-2 text-center text-danger font-semibold border-l border-border/50">PUTS</th>
                  </tr>
                  <tr className="text-muted-foreground text-[11px] border-b border-border">
                    <th className="px-2 py-1.5 text-right font-medium">Price</th>
                    <th className="px-2 py-1.5 text-right font-medium">IV %</th>
                    <th className="px-2 py-1.5 text-right font-medium">Delta</th>
                    <th className="px-2 py-1.5 text-right font-medium border-r border-border/50">OI</th>
                    <th className="px-2 py-1.5 text-center font-medium" />
                    <th className="px-2 py-1.5 text-right font-medium border-l border-border/50">OI</th>
                    <th className="px-2 py-1.5 text-right font-medium">Delta</th>
                    <th className="px-2 py-1.5 text-right font-medium">IV %</th>
                    <th className="px-2 py-1.5 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {data.chain.map((row) => {
                    const isATM = row.strike === atmStrike;
                    return (
                      <tr
                        key={row.strike}
                        className={cn(
                          'border-b border-border/50 transition-colors',
                          isATM
                            ? 'bg-primary/10 border-primary/30'
                            : 'hover:bg-secondary/50'
                        )}
                      >
                        <td className="px-2 py-2 text-right font-mono text-success text-xs">${row.callPrice.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground">{row.callIV.toFixed(1)}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground">{row.callDelta.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground border-r border-border/50">{row.callOI.toLocaleString()}</td>
                        <td className={cn(
                          'px-3 py-2 text-center font-mono font-semibold text-xs',
                          isATM ? 'text-primary' : 'text-foreground'
                        )}>
                          ${row.strike.toLocaleString()}
                          {isATM && <span className="ml-1 text-[9px] text-primary">ATM</span>}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground border-l border-border/50">{row.putOI.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground">{row.putDelta.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground">{row.putIV.toFixed(1)}</td>
                        <td className="px-2 py-2 text-right font-mono text-danger text-xs">${row.putPrice.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* IV Smile Chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-foreground font-semibold mb-3">IV Smile</h2>
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: 200 }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default Options;
