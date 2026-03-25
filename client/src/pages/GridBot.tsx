import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid3x3, Plus, Trash2, BarChart3, RefreshCw, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

async function gridRequest<T>(endpoint: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const token = getToken();
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) config.body = JSON.stringify(body);
  const res = await fetch(`/api/v1/paper/grid-bot${endpoint}`, config);
  return res.json();
}

interface GridBotData {
  id: string;
  symbol: string;
  lower_price: number;
  upper_price: number;
  grid_levels: number;
  investment: number;
  grid_type: 'equal' | 'geometric';
  status: 'active' | 'stopped';
  current_value?: number;
  pnl_pct?: number;
  filled_grids?: number;
  total_trades?: number;
  createdAt: string;
}

interface SimulationData {
  botId: string;
  symbol: string;
  profit: number;
  pnl_pct: number;
  current_value: number;
  filled_grids: number;
  total_trades: number;
  grid_fills: { price: number; side: 'buy' | 'sell'; filled: boolean }[];
  equity_curve: { timestamp: string; value: number }[];
}

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX'] as const;

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPrice = (n: number) =>
  n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : fmt(n);

function computeGridLevels(lower: number, upper: number, levels: number, type: 'equal' | 'geometric'): number[] {
  if (lower >= upper || levels < 2) return [];
  const prices: number[] = [];
  for (let i = 0; i <= levels; i++) {
    if (type === 'geometric') {
      prices.push(lower * Math.pow(upper / lower, i / levels));
    } else {
      prices.push(lower + ((upper - lower) * i) / levels);
    }
  }
  return prices;
}

const ProfitChart: React.FC<{ data: SimulationData }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.equity_curve.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 16, right: 16, bottom: 24, left: 16 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const values = data.equity_curve.map((p) => p.value);
    const minVal = Math.min(...values) * 0.98;
    const maxVal = Math.max(...values) * 1.02;
    const range = maxVal - minVal || 1;
    const n = values.length;

    const toX = (i: number) => pad.left + (i / Math.max(1, n - 1)) * plotW;
    const toY = (v: number) => pad.top + plotH - ((v - minVal) / range) * plotH;

    ctx.clearRect(0, 0, w, h);

    // Investment baseline
    const baseline = data.equity_curve[0]?.value ?? 0;
    const baseY = toY(baseline);
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'hsl(0, 0%, 40%)';
    ctx.lineWidth = 1;
    ctx.moveTo(pad.left, baseY);
    ctx.lineTo(w - pad.right, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Equity curve
    const color = data.pnl_pct >= 0 ? '#22c55e' : '#ef4444';
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill
    ctx.lineTo(toX(n - 1), pad.top + plotH);
    ctx.lineTo(toX(0), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = data.pnl_pct >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)';
    ctx.fill();

    // Labels
    ctx.fillStyle = 'hsl(0, 0%, 50%)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Investment', pad.left + 4, baseY - 4);
    ctx.fillStyle = color;
    ctx.fillText(`P&L: ${data.pnl_pct >= 0 ? '+' : ''}${fmt(data.pnl_pct)}%`, pad.left + 80, pad.top + 12);
  }, [data]);

  return <canvas ref={canvasRef} className="w-full" style={{ height: '140px' }} />;
};

const GridPreview: React.FC<{ levels: number[]; lower: number; upper: number }> = ({ levels, lower, upper }) => {
  if (levels.length === 0) return null;
  const range = upper - lower || 1;
  const profitPerGrid = ((upper - lower) / (levels.length - 1) / lower) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Grid Preview</span>
        <span>~{fmt(profitPerGrid)}% per grid</span>
      </div>
      <div className="relative h-32 bg-background rounded-lg border border-border overflow-hidden">
        {levels.map((price, i) => {
          const pct = ((price - lower) / range) * 100;
          return (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-dashed border-primary/30"
              style={{ bottom: `${pct}%` }}
            >
              <span className="absolute right-1 -top-3 text-[9px] text-muted-foreground">
                ${fmtPrice(price)}
              </span>
            </div>
          );
        })}
        <div className="absolute left-2 bottom-1 text-[9px] text-red-400">Buy zone</div>
        <div className="absolute left-2 top-1 text-[9px] text-green-400">Sell zone</div>
      </div>
    </div>
  );
};

const PriceRangeBar: React.FC<{ lower: number; upper: number; current?: number }> = ({ lower, upper, current }) => {
  const range = upper - lower || 1;
  const currentPct = current ? Math.min(100, Math.max(0, ((current - lower) / range) * 100)) : null;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>${fmtPrice(lower)}</span>
        {current != null && <span className="text-primary font-medium">${fmtPrice(current)}</span>}
        <span>${fmtPrice(upper)}</span>
      </div>
      <div className="relative h-2 bg-background rounded-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 via-primary/20 to-green-500/30 rounded-full" />
        {currentPct != null && (
          <div
            className="absolute top-0 w-1.5 h-full bg-primary rounded-full"
            style={{ left: `calc(${currentPct}% - 3px)` }}
          />
        )}
      </div>
    </div>
  );
};

const GridBot: React.FC = () => {
  const [bots, setBots] = useState<GridBotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulations, setSimulations] = useState<Record<string, SimulationData>>({});
  const [simLoading, setSimLoading] = useState<Record<string, boolean>>({});

  // Form state
  const [formSymbol, setFormSymbol] = useState<string>('BTC');
  const [lowerPrice, setLowerPrice] = useState('');
  const [upperPrice, setUpperPrice] = useState('');
  const [gridLevels, setGridLevels] = useState('10');
  const [investment, setInvestment] = useState('1000');
  const [gridType, setGridType] = useState<'equal' | 'geometric'>('equal');
  const [fetchingPrice, setFetchingPrice] = useState(false);

  const fetchBots = useCallback(async () => {
    try {
      const res = await gridRequest<{ success: boolean; data: GridBotData[] }>('/');
      if (res.success) setBots(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const fetchCurrentPrice = async () => {
    setFetchingPrice(true);
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${formSymbol}USDT`);
      const data = await res.json();
      const price = parseFloat(data.price);
      if (price > 0) {
        setLowerPrice((price * 0.95).toFixed(2));
        setUpperPrice((price * 1.05).toFixed(2));
      }
    } catch { /* ignore */ }
    setFetchingPrice(false);
  };

  const createBot = async () => {
    const lower = parseFloat(lowerPrice);
    const upper = parseFloat(upperPrice);
    const levels = parseInt(gridLevels, 10);
    const inv = parseFloat(investment);

    if (!lower || !upper || lower >= upper) {
      setError('Lower price must be less than upper price.');
      return;
    }
    if (levels < 5 || levels > 50) {
      setError('Grid levels must be between 5 and 50.');
      return;
    }
    if (!inv || inv <= 0) {
      setError('Investment must be greater than 0.');
      return;
    }

    setError(null);
    setCreating(true);
    try {
      const res = await gridRequest<{ success: boolean; data: GridBotData }>('/', {
        method: 'POST',
        body: {
          symbol: `${formSymbol}USDT`,
          lower_price: lower,
          upper_price: upper,
          grid_levels: levels,
          investment: inv,
          grid_type: gridType,
        },
      });
      if (res.success) {
        setBots((prev) => [...prev, res.data]);
        simulateBot(res.data.id);
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  const deleteBot = async (id: string) => {
    try {
      await gridRequest(`/${id}`, { method: 'DELETE' });
      setBots((prev) => prev.filter((b) => b.id !== id));
      setSimulations((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch { /* ignore */ }
  };

  const simulateBot = async (id: string) => {
    setSimLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await gridRequest<{ success: boolean; data: SimulationData }>(`/${id}/simulate`, { method: 'POST' });
      if (res.success) {
        setSimulations((prev) => ({ ...prev, [id]: res.data }));
      }
    } catch { /* ignore */ }
    setSimLoading((prev) => ({ ...prev, [id]: false }));
  };

  const previewLevels = computeGridLevels(
    parseFloat(lowerPrice) || 0,
    parseFloat(upperPrice) || 0,
    parseInt(gridLevels, 10) || 10,
    gridType
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Grid3x3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grid Bot</h1>
          <p className="text-sm text-muted-foreground">Paper-trade grid strategies across price ranges</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Create Grid Bot Form */}
        <div className="bg-secondary rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Grid Bot
          </h2>

          {/* Symbol selector */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Symbol</label>
            <div className="flex flex-wrap gap-2">
              {SYMBOLS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFormSymbol(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    formSymbol === s
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {s}/USDT
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-muted-foreground">Price Range (USD)</label>
              <button
                onClick={fetchCurrentPrice}
                disabled={fetchingPrice}
                className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className={cn('w-3 h-3', fetchingPrice && 'animate-spin')} />
                Use Current Price ±5%
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground">Lower</span>
                <input
                  type="number"
                  value={lowerPrice}
                  onChange={(e) => setLowerPrice(e.target.value)}
                  placeholder="e.g. 60000"
                  min="0"
                  step="any"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Upper</span>
                <input
                  type="number"
                  value={upperPrice}
                  onChange={(e) => setUpperPrice(e.target.value)}
                  placeholder="e.g. 70000"
                  min="0"
                  step="any"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>

          {/* Grid Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Grid Levels (5-50)</label>
              <input
                type="number"
                value={gridLevels}
                onChange={(e) => setGridLevels(e.target.value)}
                min="5"
                max="50"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Investment (USD)</label>
              <input
                type="number"
                value={investment}
                onChange={(e) => setInvestment(e.target.value)}
                min="1"
                step="1"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Grid Type */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Grid Type</label>
            <div className="flex gap-2">
              {(['equal', 'geometric'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setGridType(type)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                    gridType === type
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Preview */}
          {parseFloat(lowerPrice) > 0 && parseFloat(upperPrice) > parseFloat(lowerPrice) && (
            <GridPreview levels={previewLevels} lower={parseFloat(lowerPrice)} upper={parseFloat(upperPrice)} />
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={createBot}
            disabled={creating}
            className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Creating...' : 'Create Grid Bot'}
          </button>
        </div>

        {/* Right: Active Grid Bots */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Active Grid Bots ({bots.length})
          </h2>

          {loading && <p className="text-sm text-muted-foreground">Loading bots...</p>}

          {!loading && bots.length === 0 && (
            <div className="bg-secondary rounded-xl border border-border p-8 text-center">
              <Grid3x3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No grid bots yet. Create one to get started.</p>
            </div>
          )}

          {bots.map((bot) => {
            const sim = simulations[bot.id];
            const isSimLoading = simLoading[bot.id];
            const filledGrids = sim?.filled_grids ?? bot.filled_grids ?? 0;
            const totalTrades = sim?.total_trades ?? bot.total_trades ?? 0;
            const currentValue = sim?.current_value ?? bot.current_value ?? bot.investment;
            const pnl = sim?.pnl_pct ?? bot.pnl_pct ?? 0;

            return (
              <div key={bot.id} className="bg-secondary rounded-xl border border-border p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{bot.symbol}</span>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        bot.status === 'active'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-red-500/10 text-red-500'
                      )}
                    >
                      {bot.status}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {bot.grid_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!isSimLoading && (
                      <button
                        onClick={() => simulateBot(bot.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        Simulate
                      </button>
                    )}
                    <button
                      onClick={() => deleteBot(bot.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Price range bar */}
                <PriceRangeBar lower={bot.lower_price} upper={bot.upper_price} />

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
                  <div className="bg-background rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Invested</p>
                    <p className="text-xs font-semibold text-foreground">${fmt(bot.investment)}</p>
                  </div>
                  <div className="bg-background rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Value</p>
                    <p className="text-xs font-semibold text-foreground">${fmt(currentValue)}</p>
                  </div>
                  <div className="bg-background rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">P&L</p>
                    <p className={cn('text-xs font-semibold', pnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                      {pnl >= 0 ? '+' : ''}{fmt(pnl)}%
                    </p>
                  </div>
                  <div className="bg-background rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Grids</p>
                    <p className="text-xs font-semibold text-foreground">{filledGrids}/{bot.grid_levels}</p>
                  </div>
                  <div className="bg-background rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Trades</p>
                    <p className="text-xs font-semibold text-foreground">{totalTrades}</p>
                  </div>
                </div>

                {isSimLoading && (
                  <p className="text-xs text-muted-foreground py-2">Running simulation...</p>
                )}

                {/* Simulation results */}
                {sim && (
                  <div className="space-y-3">
                    {/* Grid fill visualization */}
                    {sim.grid_fills && sim.grid_fills.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Grid Fills</p>
                        <div className="flex gap-0.5">
                          {sim.grid_fills.map((g, i) => (
                            <div
                              key={i}
                              className={cn(
                                'flex-1 h-3 rounded-sm',
                                g.filled
                                  ? g.side === 'buy' ? 'bg-green-500/60' : 'bg-red-500/60'
                                  : 'bg-background border border-border'
                              )}
                              title={`$${fmtPrice(g.price)} (${g.side})${g.filled ? ' - Filled' : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Profit chart */}
                    {sim.equity_curve && sim.equity_curve.length > 0 && (
                      <div className="bg-background rounded-lg p-2">
                        <ProfitChart data={sim} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom: How Grid Bots Work */}
      <div className="bg-secondary rounded-xl border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" />
          How Grid Bots Work
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="space-y-1">
            <p className="font-medium text-foreground">1. Set a Price Range</p>
            <p>
              Define the lower and upper price boundaries. The bot places buy orders near the bottom
              and sell orders near the top of the range.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">2. Grid Levels Divide the Range</p>
            <p>
              The price range is split into equal (arithmetic) or geometric intervals. Each level
              acts as a trigger for a buy or sell order, capturing small profits on every swing.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">3. Profit from Volatility</p>
            <p>
              As price oscillates within the range, the bot repeatedly buys low and sells high at
              each grid level. More volatility within the range means more filled grids and more profit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GridBot;
