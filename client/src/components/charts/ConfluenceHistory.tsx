import React, { useEffect, useRef, useMemo } from 'react';
import { cn } from '@/utils/cn';

interface ScorePoint {
  time: string;
  score: number;
  label?: string;
  trend_score?: number;
  momentum_score?: number;
  signals_score?: number;
  sentiment_score?: number;
  volume_score?: number;
}

interface PricePoint {
  time: string;
  price: number;
}

interface ConfluenceHistoryProps {
  symbol: string;
  scores: ScorePoint[];
  prices: PricePoint[];
  hours: number;
  className?: string;
}

const SCORE_COLORS = {
  strongBuy: '#0ECB81',
  buy: '#3DB68A',
  neutral: '#848E9C',
  sell: '#D9534F',
  strongSell: '#F6465D',
};

function scoreToColor(score: number): string {
  if (score >= 75) return SCORE_COLORS.strongBuy;
  if (score >= 60) return SCORE_COLORS.buy;
  if (score >= 40) return SCORE_COLORS.neutral;
  if (score >= 25) return SCORE_COLORS.sell;
  return SCORE_COLORS.strongSell;
}

function formatTime(iso: string, hours: number): string {
  const d = new Date(iso);
  if (hours <= 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const ConfluenceHistory: React.FC<ConfluenceHistoryProps> = ({
  symbol,
  scores,
  prices,
  hours,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stats = useMemo(() => {
    if (scores.length === 0) return null;
    const vals = scores.map((s) => s.score);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const current = vals[vals.length - 1];

    // Count how many times high scores (>70) preceded price rises
    let correctCalls = 0;
    let totalCalls = 0;
    for (let i = 0; i < scores.length - 5; i++) {
      if (scores[i].score >= 70 || scores[i].score <= 30) {
        totalCalls++;
        const priceAtSignal = findClosestPrice(scores[i].time, prices);
        const priceLater = findClosestPrice(scores[Math.min(i + 5, scores.length - 1)].time, prices);
        if (priceAtSignal && priceLater) {
          const bullish = scores[i].score >= 70;
          const priceRose = priceLater > priceAtSignal;
          if ((bullish && priceRose) || (!bullish && !priceRose)) correctCalls++;
        }
      }
    }
    const accuracy = totalCalls > 0 ? Math.round((correctCalls / totalCalls) * 100) : null;

    return { avg: Math.round(avg), min, max, current, accuracy, totalCalls };
  }, [scores, prices]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || scores.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const PAD = { top: 10, right: 50, bottom: 20, left: 35 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Time range
    const timeMin = new Date(scores[0].time).getTime();
    const timeMax = new Date(scores[scores.length - 1].time).getTime();
    const timeRange = timeMax - timeMin || 1;

    // Score Y-axis: 0-100
    const toX = (t: string) => PAD.left + ((new Date(t).getTime() - timeMin) / timeRange) * chartW;
    const scoreToY = (s: number) => PAD.top + ((100 - s) / 100) * chartH;

    // Draw zone backgrounds
    const zones = [
      { from: 75, to: 100, color: 'rgba(14,203,129,0.06)' },
      { from: 60, to: 75, color: 'rgba(14,203,129,0.03)' },
      { from: 25, to: 40, color: 'rgba(246,70,93,0.03)' },
      { from: 0, to: 25, color: 'rgba(246,70,93,0.06)' },
    ];
    for (const z of zones) {
      ctx.fillStyle = z.color;
      ctx.fillRect(PAD.left, scoreToY(z.to), chartW, scoreToY(z.from) - scoreToY(z.to));
    }

    // Draw horizontal guides at 25, 50, 75
    ctx.strokeStyle = 'rgba(132,142,156,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const level of [25, 50, 75]) {
      const y = scoreToY(level);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw price line (right Y-axis) if available
    if (prices.length >= 2) {
      const priceVals = prices.map((p) => p.price);
      const priceMin = Math.min(...priceVals);
      const priceMax = Math.max(...priceVals);
      const priceRange = priceMax - priceMin || 1;
      const priceToY = (p: number) => PAD.top + ((priceMax - p) / priceRange) * chartH;

      ctx.strokeStyle = 'rgba(201,168,76,0.4)'; // gold/primary
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (const p of prices) {
        const x = toX(p.time);
        const y = priceToY(p.price);
        if (x < PAD.left || x > PAD.left + chartW) continue;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Price axis labels (right side)
      ctx.fillStyle = 'rgba(201,168,76,0.5)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`$${priceMax.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, PAD.left + chartW + 4, PAD.top + 10);
      ctx.fillText(`$${priceMin.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, PAD.left + chartW + 4, PAD.top + chartH);
    }

    // Draw score area fill
    ctx.beginPath();
    ctx.moveTo(toX(scores[0].time), scoreToY(0));
    for (const s of scores) {
      ctx.lineTo(toX(s.time), scoreToY(s.score));
    }
    ctx.lineTo(toX(scores[scores.length - 1].time), scoreToY(0));
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
    gradient.addColorStop(0, 'rgba(14,203,129,0.15)');
    gradient.addColorStop(0.5, 'rgba(132,142,156,0.05)');
    gradient.addColorStop(1, 'rgba(246,70,93,0.15)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw score line with color segments
    ctx.lineWidth = 2;
    for (let i = 1; i < scores.length; i++) {
      ctx.strokeStyle = scoreToColor(scores[i].score);
      ctx.beginPath();
      ctx.moveTo(toX(scores[i - 1].time), scoreToY(scores[i - 1].score));
      ctx.lineTo(toX(scores[i].time), scoreToY(scores[i].score));
      ctx.stroke();
    }

    // Current score dot
    const last = scores[scores.length - 1];
    const lastX = toX(last.time);
    const lastY = scoreToY(last.score);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = scoreToColor(last.score);
    ctx.fill();
    ctx.strokeStyle = '#0B0E11';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Y-axis labels (left — score)
    ctx.fillStyle = '#848E9C';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (const level of [0, 25, 50, 75, 100]) {
      ctx.fillText(String(level), PAD.left - 4, scoreToY(level) + 3);
    }

    // X-axis time labels
    ctx.textAlign = 'center';
    const labelCount = Math.min(6, scores.length);
    const step = Math.floor(scores.length / labelCount);
    for (let i = 0; i < scores.length; i += step) {
      const x = toX(scores[i].time);
      ctx.fillText(formatTime(scores[i].time, hours), x, H - 4);
    }
  }, [scores, prices, hours]);

  if (scores.length < 2) {
    return (
      <div className={cn('bg-card border border-border rounded-xl p-6 text-center', className)}>
        <p className="text-muted-foreground text-sm">
          Collecting confluence history for {symbol}... Data will appear after a few analysis cycles.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('bg-card border border-border rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Confluence Backtest
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-semibold text-foreground">{symbol}</span>
            <span className="text-xs text-muted-foreground">Last {hours}h</span>
          </div>
        </div>

        {stats && (
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <div className="text-muted-foreground">Avg</div>
              <div className="font-mono font-semibold" style={{ color: scoreToColor(stats.avg) }}>
                {stats.avg}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Range</div>
              <div className="font-mono font-semibold text-foreground">
                {stats.min}–{stats.max}
              </div>
            </div>
            {stats.accuracy !== null && (
              <div className="text-center">
                <div className="text-muted-foreground">Accuracy</div>
                <div className={cn(
                  'font-mono font-semibold',
                  stats.accuracy >= 60 ? 'text-success' : stats.accuracy >= 45 ? 'text-primary' : 'text-danger'
                )}>
                  {stats.accuracy}%
                  <span className="text-muted-foreground font-normal ml-0.5">
                    ({stats.totalCalls})
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 text-[10px] text-muted-foreground border-b border-border">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 rounded" style={{ background: 'rgba(201,168,76,0.5)' }} />
          Price
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 rounded bg-success" />
          Buy zone (&gt;60)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 rounded bg-danger" />
          Sell zone (&lt;40)
        </span>
      </div>

      {/* Canvas chart */}
      <div className="px-2 py-2">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: '220px' }}
        />
      </div>
    </div>
  );
};

function findClosestPrice(time: string, prices: PricePoint[]): number | null {
  if (prices.length === 0) return null;
  const target = new Date(time).getTime();
  let closest = prices[0];
  let minDiff = Math.abs(new Date(prices[0].time).getTime() - target);
  for (const p of prices) {
    const diff = Math.abs(new Date(p.time).getTime() - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = p;
    }
  }
  return closest.price;
}

export default ConfluenceHistory;
