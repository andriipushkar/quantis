import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
import { getTickers, getOHLCV, type TickerData } from '@/services/api';
import { useMarketStore } from '@/stores/market';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function stripQuote(symbol: string): string {
  return symbol.replace(/USDT$/, '');
}

// ---------------------------------------------------------------------------
// BTC Mini Chart (canvas line chart)
// ---------------------------------------------------------------------------

const BtcMiniChart: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchChart() {
      try {
        const candles = await getOHLCV('BTCUSDT', '1m', 60);
        if (cancelled || !canvasRef.current) return;

        const closes = candles.map((c) => c.close);
        if (closes.length === 0) {
          setError('No chart data');
          setLoading(false);
          return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // High-DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;
        const pad = 4;

        const min = Math.min(...closes);
        const max = Math.max(...closes);
        const range = max - min || 1;

        // Determine color from trend
        const isUp = closes[closes.length - 1] >= closes[0];
        const lineColor = isUp
          ? getComputedStyle(document.documentElement).getPropertyValue('--color-success').trim() || '#22c55e'
          : getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim() || '#ef4444';

        ctx.clearRect(0, 0, w, h);

        // Draw line
        ctx.beginPath();
        closes.forEach((c, i) => {
          const x = pad + (i / (closes.length - 1)) * (w - pad * 2);
          const y = h - pad - ((c - min) / range) * (h - pad * 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Fill gradient under line
        const lastX = pad + ((closes.length - 1) / (closes.length - 1)) * (w - pad * 2);
        ctx.lineTo(lastX, h);
        ctx.lineTo(pad, h);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, isUp ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Failed to load chart');
          setLoading(false);
        }
      }
    }

    fetchChart();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="relative h-40">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-muted-foreground text-sm animate-pulse">Loading chart...</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: loading ? 'none' : 'block' }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const updateTickers = useMarketStore((s) => s.updateTickers);
  const tickers = useMarketStore((s) => s.tickers);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tickers and poll every 5s
  const fetchAndStore = useCallback(async () => {
    try {
      const data = await getTickers();
      updateTickers(data);
      setError(null);
    } catch {
      setError('Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  }, [updateTickers]);

  useEffect(() => {
    fetchAndStore();
    const interval = setInterval(fetchAndStore, 5000);
    return () => clearInterval(interval);
  }, [fetchAndStore]);

  // Derived data
  const tickerList: TickerData[] = Array.from(tickers.values());
  const sorted = [...tickerList].sort((a, b) => b.volume - a.volume);
  const watchlist = sorted.slice(0, 10);

  const sortedByChange = [...tickerList].sort((a, b) => b.change24h - a.change24h);
  const topGainers = sortedByChange.slice(0, 5);
  const topLosers = [...tickerList].sort((a, b) => a.change24h - b.change24h).slice(0, 5);

  const btcTicker = tickers.get('BTCUSDT');

  // ------ Loading state ------
  if (loading && tickerList.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
          <span className="text-muted-foreground text-sm">Loading market data...</span>
        </div>
      </div>
    );
  }

  // ------ Error state (no data at all) ------
  if (error && tickerList.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Activity className="w-8 h-8 text-danger" />
          <span className="text-muted-foreground text-sm">{error}</span>
          <button
            onClick={fetchAndStore}
            className="mt-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Watchlist Strip ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Watchlist
          </h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border">
          <div className="flex gap-3 pb-2 min-w-max">
            {watchlist.map((t) => {
              const isPositive = t.change24h >= 0;
              return (
                <button
                  key={t.symbol}
                  onClick={() => navigate(`/chart/${t.symbol}`)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all',
                    'bg-card border-border hover:border-primary/50 hover:shadow-sm',
                    'cursor-pointer select-none shrink-0'
                  )}
                >
                  <span className="text-sm font-semibold text-foreground">
                    {stripQuote(t.symbol)}
                  </span>
                  <span className="text-sm font-mono text-foreground">
                    {formatPrice(t.price)}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-mono font-medium',
                      isPositive ? 'text-success' : 'text-danger'
                    )}
                  >
                    {formatChange(t.change24h)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Card Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Market Overview */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Market Overview
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">BTC Price</p>
              <p className="text-2xl font-bold font-mono text-foreground">
                {btcTicker ? formatPrice(btcTicker.price) : '—'}
              </p>
              {btcTicker && (
                <span
                  className={cn(
                    'text-sm font-mono font-medium',
                    btcTicker.change24h >= 0 ? 'text-success' : 'text-danger'
                  )}
                >
                  {formatChange(btcTicker.change24h)}
                </span>
              )}
            </div>
            <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Tracked Pairs</p>
                <p className="text-lg font-semibold text-foreground">{tickerList.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">BTC Dominance</p>
                <p className="text-lg font-semibold text-foreground">—</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Gainers */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-success" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Top Gainers
            </h3>
          </div>
          <div className="space-y-2">
            {topGainers.map((t) => (
              <button
                key={t.symbol}
                onClick={() => navigate(`/chart/${t.symbol}`)}
                className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">
                  {stripQuote(t.symbol)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground">
                    {formatPrice(t.price)}
                  </span>
                  <span className="text-sm font-mono font-medium text-success min-w-[70px] text-right">
                    {formatChange(t.change24h)}
                  </span>
                </div>
              </button>
            ))}
            {topGainers.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No data</p>
            )}
          </div>
        </div>

        {/* Top Losers */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-danger" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Top Losers
            </h3>
          </div>
          <div className="space-y-2">
            {topLosers.map((t) => (
              <button
                key={t.symbol}
                onClick={() => navigate(`/chart/${t.symbol}`)}
                className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">
                  {stripQuote(t.symbol)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground">
                    {formatPrice(t.price)}
                  </span>
                  <span className="text-sm font-mono font-medium text-danger min-w-[70px] text-right">
                    {formatChange(t.change24h)}
                  </span>
                </div>
              </button>
            ))}
            {topLosers.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No data</p>
            )}
          </div>
        </div>

        {/* BTC Mini Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              BTC 1m Chart
            </h3>
          </div>
          <BtcMiniChart />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
