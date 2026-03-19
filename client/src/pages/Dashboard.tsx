import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, BarChart3, Activity, Gauge, Star, Crosshair } from 'lucide-react';
import { getTickers, getOHLCV, getFearGreed, getMarketRegime, type TickerData, type FearGreedData, type MarketRegimeData } from '@/services/api';
import { useMarketStore } from '@/stores/market';
import { useAuthStore } from '@/stores/auth';
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
// Fear & Greed Gauge (canvas arc)
// ---------------------------------------------------------------------------

const FearGreedGauge: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const result = await getFearGreed();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load');
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

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
    const centerX = w / 2;
    const centerY = h * 0.75;
    const radius = Math.min(w, h) * 0.45;

    ctx.clearRect(0, 0, w, h);

    // Draw arc background segments: red -> yellow -> green
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;

    // Gradient arc: red (fear) to yellow (neutral) to green (greed)
    const segments = [
      { start: 0, end: 0.2, color: '#dc2626' },
      { start: 0.2, end: 0.4, color: '#ea580c' },
      { start: 0.4, end: 0.6, color: '#eab308' },
      { start: 0.6, end: 0.8, color: '#65a30d' },
      { start: 0.8, end: 1.0, color: '#16a34a' },
    ];

    const arcWidth = 12;
    ctx.lineCap = 'round';

    for (const seg of segments) {
      const a1 = startAngle + seg.start * Math.PI;
      const a2 = startAngle + seg.end * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, a1, a2);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = arcWidth;
      ctx.stroke();
    }

    // Draw needle
    const needleAngle = startAngle + (data.score / 100) * Math.PI;
    const needleLen = radius - 20;
    const nx = centerX + Math.cos(needleAngle) * needleLen;
    const ny = centerY + Math.sin(needleAngle) * needleLen;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--foreground')
      ? 'hsl(' + getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() + ')'
      : '#e5e5e5';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-foreground text-sm animate-pulse">Loading...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-foreground text-sm">{error || 'No data'}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full h-36">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
          <span className="text-3xl font-bold font-mono text-foreground">{data.score}</span>
          <span className={cn(
            'text-xs font-semibold mt-0.5',
            data.score < 20 ? 'text-red-500' :
            data.score < 40 ? 'text-orange-500' :
            data.score < 60 ? 'text-yellow-500' :
            data.score < 80 ? 'text-lime-500' :
            'text-green-500'
          )}>
            {data.label}
          </span>
        </div>
      </div>
    </div>
  );
};

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
// Market Regime Widget
// ---------------------------------------------------------------------------

function getRegimeColor(regime: string): string {
  switch (regime) {
    case 'trending_up': return 'text-green-400 bg-green-500/15';
    case 'trending_down': return 'text-red-400 bg-red-500/15';
    case 'ranging': return 'text-blue-400 bg-blue-500/15';
    case 'high_volatility': return 'text-orange-400 bg-orange-500/15';
    case 'low_volatility': return 'text-purple-400 bg-purple-500/15';
    default: return 'text-muted-foreground bg-secondary';
  }
}

function formatRegimeLabel(regime: string): string {
  return regime.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const MarketRegimeWidget: React.FC = () => {
  const [data, setData] = useState<MarketRegimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const result = await getMarketRegime();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load');
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-foreground text-sm animate-pulse">Loading...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-muted-foreground text-sm">{error || 'No data'}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Regime Badge */}
      <div className="flex items-center justify-between">
        <span className={cn(
          'inline-flex px-2.5 py-1 rounded-full text-xs font-bold',
          getRegimeColor(data.regime)
        )}>
          {formatRegimeLabel(data.regime)}
        </span>
        <span className="text-xs text-muted-foreground font-mono">{data.confidence}% conf.</span>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {data.description}
      </p>

      {/* Indicators */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">ADX</span>
          <span className="font-mono text-foreground">{data.indicators.adx}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">RSI</span>
          <span className="font-mono text-foreground">{data.indicators.rsi}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">BB Width</span>
          <span className="font-mono text-foreground">{data.indicators.bbWidth}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">ATR</span>
          <span className="font-mono text-foreground">{data.indicators.atr}</span>
        </div>
      </div>

      {/* Recommended Strategies */}
      <div className="pt-2 border-t border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Recommended</p>
        <div className="flex flex-wrap gap-1">
          {data.recommended.map((s) => (
            <span key={s} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-400">
              {s}
            </span>
          ))}
        </div>
      </div>
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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userWatchlist, setUserWatchlist] = useState<Set<string>>(new Set());

  // Fetch user watchlist symbols
  const fetchUserWatchlist = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const token = localStorage.getItem('quantis_token');
      const res = await fetch('/api/v1/watchlist', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setUserWatchlist(new Set(json.data.map((item: { symbol: string }) => item.symbol)));
        }
      }
    } catch {
      // silent
    }
  }, [isAuthenticated]);

  const toggleWatchlist = useCallback(async (symbol: string) => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('quantis_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const isInWatchlist = userWatchlist.has(symbol);
    try {
      const res = await fetch(`/api/v1/watchlist/${symbol}`, {
        method: isInWatchlist ? 'DELETE' : 'POST',
        headers,
      });
      if (res.ok) {
        setUserWatchlist((prev) => {
          const next = new Set(prev);
          if (isInWatchlist) next.delete(symbol);
          else next.add(symbol);
          return next;
        });
      }
    } catch {
      // silent
    }
  }, [isAuthenticated, userWatchlist]);

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

  useEffect(() => {
    fetchUserWatchlist();
  }, [fetchUserWatchlist]);

  // Derived data
  const tickerList: TickerData[] = Array.from(tickers.values());
  const sorted = [...tickerList].sort((a, b) => b.volume - a.volume);

  // Show user watchlist pairs first, then remaining by volume
  const watchlist = (() => {
    const top = sorted.slice(0, 10);
    if (!isAuthenticated || userWatchlist.size === 0) return top;
    const inWl = top.filter((t) => userWatchlist.has(t.symbol));
    const notInWl = top.filter((t) => !userWatchlist.has(t.symbol));
    return [...inWl, ...notInWl];
  })();

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
              const isStarred = userWatchlist.has(t.symbol);
              return (
                <div
                  key={t.symbol}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all',
                    'bg-card border-border hover:border-primary/50 hover:shadow-sm',
                    'select-none shrink-0'
                  )}
                >
                  {isAuthenticated && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWatchlist(t.symbol); }}
                      className="flex-shrink-0 transition-colors hover:scale-110"
                      title={isStarred ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                      <Star
                        className={cn(
                          'w-4 h-4',
                          isStarred ? 'text-primary fill-primary' : 'text-muted-foreground'
                        )}
                      />
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/chart/${t.symbol}`)}
                    className="flex items-center gap-3 cursor-pointer"
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
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Card Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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

        {/* Fear & Greed Index */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Fear &amp; Greed
            </h3>
          </div>
          <FearGreedGauge />
        </div>

        {/* Market Regime */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Crosshair className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Market Regime
            </h3>
          </div>
          <MarketRegimeWidget />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
