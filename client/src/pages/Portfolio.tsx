import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Link as LinkIcon,
  Shield,
  Eye,
  Download,
  RefreshCw,
  Target,
  BarChart3,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { cn } from '@/utils/cn';
import { getTickers, type TickerData } from '@/services/api';
import { useMarketStore } from '@/stores/market';
import { useToastStore } from '@/stores/toast';

/* ── Demo holdings ─────────────────────────────────────────────── */
const DEMO_HOLDINGS = [
  { asset: 'BTC', symbol: 'BTCUSDT', amount: 0.5, color: '#F7931A' },
  { asset: 'ETH', symbol: 'ETHUSDT', amount: 3.0, color: '#627EEA' },
  { asset: 'SOL', symbol: 'SOLUSDT', amount: 10, color: '#9945FF' },
  { asset: 'BNB', symbol: 'BNBUSDT', amount: 2, color: '#F3BA2F' },
];

/* ── Exchange cards data ──────────────────────────────────────── */
const EXCHANGES = [
  { name: 'Binance', initials: 'BN', accent: '#F3BA2F' },
  { name: 'Bybit', initials: 'BY', accent: '#F7A600' },
  { name: 'OKX', initials: 'OK', accent: '#FFFFFF' },
];

/* ── Analytics Types ─────────────────────────────────────────── */
interface PortfolioAnalytics {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalPnl: number;
  bestTrade: { symbol: string; pnl: number } | null;
  worstTrade: { symbol: string; pnl: number } | null;
  equityCurve: { date: string; equity: number }[];
  monthlyReturns: { month: string; pnl: number }[];
}

/* ── Pie Chart (Canvas) ──────────────────────────────────────── */
interface PieSlice {
  label: string;
  value: number;
  color: string;
  pct: number;
}

const AllocationPieChart: React.FC<{ slices: PieSlice[] }> = ({ slices }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || slices.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = 80;
    const innerRadius = 50;

    let startAngle = -Math.PI / 2;

    slices.forEach((slice) => {
      const sweepAngle = (slice.pct / 100) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + sweepAngle);
      ctx.arc(cx, cy, innerRadius, startAngle + sweepAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();
      startAngle += sweepAngle;
    });

    // Center hole background
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = 'transparent';
    ctx.fill();
  }, [slices]);

  return <canvas ref={canvasRef} className="mx-auto" />;
};

/* ── Equity Curve Chart (Canvas) ─────────────────────────────── */
const EquityCurveChart: React.FC<{ data: { date: string; equity: number }[] }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth ?? 600;
    const height = 200;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 20, bottom: 30, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const equities = data.map((d) => d.equity);
    const minEquity = Math.min(...equities) * 0.98;
    const maxEquity = Math.max(...equities) * 1.02;
    const range = maxEquity - minEquity || 1;
    const baseline = 10000;

    const getX = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
    const getY = (val: number) => padding.top + (1 - (val - minEquity) / range) * chartH;

    // Grid lines
    ctx.strokeStyle = 'rgba(132, 142, 156, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      const val = maxEquity - (i / 4) * range;
      ctx.fillStyle = '#848E9C';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, padding.left - 8, y + 3);
    }

    // X-axis labels
    const labelCount = Math.min(data.length, 6);
    ctx.fillStyle = '#848E9C';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((i / (labelCount - 1)) * (data.length - 1));
      const d = data[idx];
      const x = getX(idx);
      ctx.fillText(d.date.slice(5), x, height - 5);
    }

    // Baseline ($10,000 line)
    if (baseline >= minEquity && baseline <= maxEquity) {
      const baseY = getY(baseline);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(132, 142, 156, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, baseY);
      ctx.lineTo(width - padding.right, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw filled area segments (green above baseline, red below)
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = getX(i);
      const x2 = getX(i + 1);
      const y1 = getY(data[i].equity);
      const y2 = getY(data[i + 1].equity);
      const bottomY = getY(minEquity);
      const aboveBaseline = data[i].equity >= baseline && data[i + 1].equity >= baseline;

      const fillColor = aboveBaseline ? 'rgba(14, 203, 129, 0.1)' : 'rgba(246, 70, 93, 0.1)';
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, bottomY);
      ctx.lineTo(x1, bottomY);
      ctx.closePath();
      ctx.fill();
    }

    // Draw line
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < data.length - 1; i++) {
      const x1 = getX(i);
      const x2 = getX(i + 1);
      const y1 = getY(data[i].equity);
      const y2 = getY(data[i + 1].equity);
      const aboveBaseline = data[i].equity >= baseline && data[i + 1].equity >= baseline;

      ctx.strokeStyle = aboveBaseline ? '#0ECB81' : '#F6465D';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }, [data]);

  return <canvas ref={canvasRef} className="w-full" />;
};

/* ── Helpers ──────────────────────────────────────────────────── */
function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

/* ── Performance Analytics Component ─────────────────────────── */
const PerformanceAnalytics: React.FC<{
  analytics: PortfolioAnalytics | null;
  analyticsLoading: boolean;
}> = ({ analytics, analyticsLoading }) => {
  const [open, setOpen] = useState(true);

  if (analyticsLoading) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 mb-4 group"
        >
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Performance Analytics
          </h2>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {open && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-center py-8">
                <Spinner size="lg" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (!analytics || analytics.totalTrades === 0) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 mb-4 group"
        >
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Performance Analytics
          </h2>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {open && (
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Activity className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Start paper trading to see analytics
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const winRateColor = analytics.winRate > 50 ? 'text-success' : 'text-danger';
  const profitFactorColor =
    analytics.profitFactor > 1.5
      ? 'text-success'
      : analytics.profitFactor >= 1
        ? 'text-yellow-400'
        : 'text-danger';
  const sharpeColor =
    analytics.sharpeRatio > 1
      ? 'text-success'
      : analytics.sharpeRatio >= 0.5
        ? 'text-yellow-400'
        : 'text-danger';
  const pnlColor = analytics.totalPnl >= 0 ? 'text-success' : 'text-danger';

  const stats = [
    {
      label: 'Total Trades',
      value: analytics.totalTrades.toString(),
      color: 'text-foreground',
    },
    {
      label: 'Win Rate',
      value: `${analytics.winRate.toFixed(1)}%`,
      color: winRateColor,
    },
    {
      label: 'Profit Factor',
      value: analytics.profitFactor.toFixed(2),
      color: profitFactorColor,
    },
    {
      label: 'Sharpe Ratio',
      value: analytics.sharpeRatio.toFixed(2),
      color: sharpeColor,
    },
    {
      label: 'Max Drawdown',
      value: `${analytics.maxDrawdown.toFixed(1)}%`,
      color: 'text-danger',
    },
    {
      label: 'Total P&L',
      value: `${analytics.totalPnl >= 0 ? '+' : ''}$${fmt(analytics.totalPnl)}`,
      color: pnlColor,
    },
    {
      label: 'Best Trade',
      value: analytics.bestTrade
        ? `${analytics.bestTrade.symbol} +$${fmt(analytics.bestTrade.pnl)}`
        : 'N/A',
      color: 'text-success',
    },
    {
      label: 'Worst Trade',
      value: analytics.worstTrade
        ? `${analytics.worstTrade.symbol} -$${fmt(Math.abs(analytics.worstTrade.pnl))}`
        : 'N/A',
      color: 'text-danger',
    },
  ];

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-4 group"
      >
        <BarChart3 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Performance Analytics
        </h2>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-6">
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    {stat.label}
                  </p>
                  <p className={cn('text-lg font-bold', stat.color)}>
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Equity Curve */}
          {analytics.equityCurve.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Equity Curve
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EquityCurveChart data={analytics.equityCurve} />
              </CardContent>
            </Card>
          )}

          {/* Monthly Returns */}
          {analytics.monthlyReturns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Monthly Returns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.monthlyReturns.map((mr) => {
                    const maxAbs = Math.max(
                      ...analytics.monthlyReturns.map((r) => Math.abs(r.pnl)),
                      1
                    );
                    const barWidth = Math.min((Math.abs(mr.pnl) / maxAbs) * 100, 100);
                    const isPositive = mr.pnl >= 0;

                    return (
                      <div key={mr.month} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-medium w-16 shrink-0">
                          {mr.month}
                        </span>
                        <div className="flex-1 h-5 relative">
                          <div
                            className={cn(
                              'h-full rounded-sm',
                              isPositive ? 'bg-success/20' : 'bg-danger/20'
                            )}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            'text-xs font-mono font-medium w-20 text-right shrink-0',
                            isPositive ? 'text-success' : 'text-danger'
                          )}
                        >
                          {isPositive ? '+' : ''}${fmt(mr.pnl)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Portfolio Page ───────────────────────────────────────────── */
const Portfolio: React.FC = () => {
  const { t: _t } = useTranslation();
  const storeTickers = useMarketStore((s) => s.tickers);
  const updateTickers = useMarketStore((s) => s.updateTickers);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Fetch tickers on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getTickers();
        if (!cancelled) updateTickers(data);
      } catch {
        // silent – we fall back to $0 values
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [updateTickers]);

  // Fetch analytics on mount
  useEffect(() => {
    let cancelled = false;
    const loadAnalytics = async () => {
      try {
        const token = getToken();
        const res = await fetch('/api/v1/portfolio/analytics', {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const json = await res.json();
        if (!cancelled && json.success && json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
          setAnalytics(json.data);
        }
      } catch {
        // silent – analytics section will show empty state
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    };
    loadAnalytics();
    return () => { cancelled = true; };
  }, []);

  // Build position rows from demo holdings + live ticker data
  const positions = useMemo(() => {
    return DEMO_HOLDINGS.map((h) => {
      const ticker: TickerData | undefined = storeTickers.get(h.symbol);
      const price = ticker?.price ?? 0;
      const change24h = ticker?.change24h ?? 0;
      const marketValue = price * h.amount;
      return { ...h, price, change24h, marketValue };
    });
  }, [storeTickers]);

  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

  const totalChange = useMemo(() => {
    // Estimate 24h change weighted by position value
    if (totalValue === 0) return { amount: 0, pct: 0 };
    let weightedPct = 0;
    positions.forEach((p) => {
      const weight = totalValue > 0 ? p.marketValue / totalValue : 0;
      weightedPct += p.change24h * weight;
    });
    return { amount: totalValue * (weightedPct / 100), pct: weightedPct };
  }, [positions, totalValue]);

  const pieSlices: PieSlice[] = useMemo(() => {
    if (totalValue === 0) return [];
    return positions.map((p) => ({
      label: p.asset,
      value: p.marketValue,
      color: p.color,
      pct: (p.marketValue / totalValue) * 100,
    }));
  }, [positions, totalValue]);

  const isPositive = totalChange.pct >= 0;

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Portfolio</h1>
            <p className="text-xs text-muted-foreground">Track your holdings across exchanges</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const headers = ['Asset', 'Holdings', 'Entry Price', 'Current Price', 'Market Value', '24H Change %', 'Allocation %'];
              const rows = positions.map((pos) => {
                const allocationPct = totalValue > 0 ? ((pos.marketValue / totalValue) * 100).toFixed(1) : '0.0';
                return [
                  pos.asset,
                  String(pos.amount),
                  fmt(pos.price),
                  fmt(pos.price),
                  fmt(pos.marketValue),
                  pos.change24h.toFixed(2),
                  allocationPct,
                ].join(',');
              });
              const csv = [headers.join(','), ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `quantis-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Eye className="w-3 h-3" />
            Demo Mode
          </span>
        </div>
      </div>

      {/* ── Portfolio summary bar ───────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-8 flex-wrap">
                {/* Total Value */}
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Total Value
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    ${fmt(totalValue)}
                  </p>
                </div>

                {/* 24H Change */}
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    24H Change
                  </p>
                  <div className="flex items-center gap-2">
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4 text-success" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-danger" />
                    )}
                    <span
                      className={cn(
                        'text-lg font-semibold',
                        isPositive ? 'text-success' : 'text-danger'
                      )}
                    >
                      {isPositive ? '+' : ''}${fmt(totalChange.amount)} ({isPositive ? '+' : ''}{totalChange.pct.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* # Assets */}
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Assets
                  </p>
                  <p className="text-lg font-semibold text-foreground">{positions.length}</p>
                </div>
              </div>

              <Button variant="secondary" className="shrink-0">
                <LinkIcon className="w-4 h-4 mr-2" />
                Connect Exchange
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Main grid: Allocation chart + Positions table ───── */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Allocation pie chart */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              {totalValue > 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <AllocationPieChart slices={pieSlices} />
                  {/* Legend */}
                  <div className="w-full space-y-2">
                    {pieSlices.map((s) => (
                      <div key={s.label} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="text-foreground font-medium">{s.label}</span>
                        </div>
                        <span className="text-muted-foreground">{s.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No allocation data available.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Positions table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-3 pr-4 font-medium">Asset</th>
                      <th className="text-right py-3 px-4 font-medium">Holdings</th>
                      <th className="text-right py-3 px-4 font-medium">Price</th>
                      <th className="text-right py-3 px-4 font-medium">Market Value</th>
                      <th className="text-right py-3 px-4 font-medium">24H Change</th>
                      <th className="text-right py-3 pl-4 font-medium">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => {
                      const allocationPct = totalValue > 0 ? (pos.marketValue / totalValue) * 100 : 0;
                      const posPositive = pos.change24h >= 0;
                      return (
                        <tr
                          key={pos.symbol}
                          className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black"
                                style={{ backgroundColor: pos.color }}
                              >
                                {pos.asset.slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{pos.asset}</p>
                                <p className="text-xs text-muted-foreground">{pos.symbol.replace('USDT', '/USDT')}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4 text-foreground font-medium">
                            {pos.amount}
                          </td>
                          <td className="text-right py-3 px-4 text-foreground">
                            ${fmt(pos.price)}
                          </td>
                          <td className="text-right py-3 px-4 text-foreground font-medium">
                            ${fmt(pos.marketValue)}
                          </td>
                          <td className={cn('text-right py-3 px-4 font-medium', posPositive ? 'text-success' : 'text-danger')}>
                            {posPositive ? '+' : ''}{pos.change24h.toFixed(2)}%
                          </td>
                          <td className="text-right py-3 pl-4">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(allocationPct, 100)}%`,
                                    backgroundColor: pos.color,
                                  }}
                                />
                              </div>
                              <span className="text-muted-foreground text-xs min-w-[3rem] text-right">
                                {allocationPct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Connect Exchange section ────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <LinkIcon className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Connect Exchange
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXCHANGES.map((ex) => (
            <Card key={ex.name}>
              <CardContent className="p-5 flex flex-col items-center gap-4">
                {/* Exchange logo placeholder */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold border border-border"
                  style={{ color: ex.accent, borderColor: `${ex.accent}33` }}
                >
                  {ex.initials}
                </div>
                <p className="text-foreground font-semibold">{ex.name}</p>
                <Button variant="outline" size="sm" disabled className="w-full">
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Read-only API keys only.</span>{' '}
            We never request withdrawal permissions. Your funds stay safe on the exchange.
          </p>
        </div>
      </div>

      {/* ── Performance Analytics Section ───────────────────────── */}
      <PerformanceAnalytics analytics={analytics} analyticsLoading={analyticsLoading} />

      {/* ── Rebalance Section ──────────────────────────────────── */}
      {!loading && totalValue > 0 && (
        <RebalanceSection positions={positions} totalValue={totalValue} />
      )}
    </div>
  );
};

/* ── Rebalance Section Component ─────────────────────────────── */

interface RebalanceSectionProps {
  positions: { asset: string; symbol: string; amount: number; price: number; change24h: number; marketValue: number; color: string }[];
  totalValue: number;
}

const DEFAULT_TARGETS: Record<string, number> = {
  BTC: 50,
  ETH: 30,
  SOL: 15,
  BNB: 5,
};

const RebalanceSection: React.FC<RebalanceSectionProps> = ({ positions, totalValue }) => {
  const { addToast } = useToastStore();
  const [targets, setTargets] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    positions.forEach((p) => {
      init[p.asset] = DEFAULT_TARGETS[p.asset] ?? Math.round((p.marketValue / totalValue) * 100);
    });
    return init;
  });

  const totalTarget = Object.values(targets).reduce((a, b) => a + b, 0);

  const suggestions = useMemo(() => {
    return positions.map((p) => {
      const currentPct = totalValue > 0 ? (p.marketValue / totalValue) * 100 : 0;
      const targetPct = targets[p.asset] ?? 0;
      const diff = targetPct - currentPct;
      const diffUsd = (diff / 100) * totalValue;
      return {
        asset: p.asset,
        color: p.color,
        currentPct,
        targetPct,
        diffUsd,
        action: diffUsd > 1 ? 'buy' as const : diffUsd < -1 ? 'sell' as const : 'hold' as const,
      };
    });
  }, [positions, targets, totalValue]);

  const handleTargetChange = (asset: string, val: string) => {
    const num = Math.max(0, Math.min(100, parseInt(val) || 0));
    setTargets((prev) => ({ ...prev, [asset]: num }));
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Portfolio Rebalance
        </h2>
      </div>

      <Card>
        <CardContent className="p-5 space-y-5">
          {/* Target Allocation Inputs */}
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Set your target allocation for each asset. Total should equal 100%.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {positions.map((p) => (
                <div key={p.asset} className="space-y-1">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.asset}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={targets[p.asset] ?? 0}
                      onChange={(e) => handleTargetChange(p.asset, e.target.value)}
                      className="w-full h-8 px-2 bg-secondary border border-border rounded-lg text-sm text-foreground text-center font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>
            {totalTarget !== 100 && (
              <p className={cn(
                'text-xs mt-2 font-medium',
                totalTarget > 100 ? 'text-danger' : 'text-yellow-400'
              )}>
                Total: {totalTarget}% (must equal 100%)
              </p>
            )}
          </div>

          {/* Current vs Target Bars */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-foreground">Current vs Target</p>
            {suggestions.map((s) => (
              <div key={s.asset} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium">{s.asset}</span>
                  <span className="text-muted-foreground">
                    {s.currentPct.toFixed(1)}% → {s.targetPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex gap-1 h-2">
                  {/* Current */}
                  <div className="flex-1 h-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full opacity-60"
                      style={{
                        width: `${Math.min(s.currentPct, 100)}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  </div>
                  {/* Target */}
                  <div className="flex-1 h-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(s.targetPct, 100)}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Current</span>
                  <span>Target</span>
                </div>
              </div>
            ))}
          </div>

          {/* Rebalance Suggestions */}
          {totalTarget === 100 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Rebalance Actions</p>
              <div className="space-y-1.5">
                {suggestions
                  .filter((s) => s.action !== 'hold')
                  .map((s) => (
                    <div
                      key={s.asset}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg border text-xs',
                        s.action === 'buy'
                          ? 'bg-success/10 border-success/20 text-success'
                          : 'bg-danger/10 border-danger/20 text-danger'
                      )}
                    >
                      <span className="font-medium">
                        {s.action === 'buy' ? 'Buy' : 'Sell'} {s.asset}
                      </span>
                      <span className="font-mono font-bold">
                        ${Math.abs(s.diffUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                {suggestions.every((s) => s.action === 'hold') && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Portfolio is already balanced within targets.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Auto-Rebalance Button */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => addToast('Coming soon — auto-rebalancing with exchange API', 'info')}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Auto-Rebalance
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Portfolio;
