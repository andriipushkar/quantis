import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Repeat, Plus, Trash2, BarChart3 } from 'lucide-react';
import { cn } from '@/utils/cn';

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

async function dcaRequest<T>(endpoint: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
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
  const res = await fetch(`/api/v1/dca${endpoint}`, config);
  return res.json();
}

interface DCABotData {
  id: string;
  symbol: string;
  baseAmount: number;
  interval: 'daily' | 'weekly';
  strategy: 'standard' | 'rsi_weighted' | 'fear_greed';
  createdAt: string;
}

interface Purchase {
  date: string;
  amount: number;
  price: number;
  quantity: number;
}

interface SimulationData {
  botId: string;
  symbol: string;
  strategy: string;
  totalInvested: number;
  currentValue: number;
  roi: number;
  avgBuyPrice: number;
  purchases: Purchase[];
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
];

const STRATEGY_INFO: Record<string, { label: string; description: string }> = {
  standard: {
    label: 'Standard DCA',
    description: 'Invest a fixed amount at each interval regardless of market conditions.',
  },
  rsi_weighted: {
    label: 'RSI-Weighted',
    description: 'Buy more when RSI is low (oversold) and less when RSI is high (overbought). Formula: amount * (2 - RSI/50).',
  },
  fear_greed: {
    label: 'Fear & Greed',
    description: 'Buy more during fear (low index) and less during greed (high index). Formula: amount * (2 - FG/50).',
  },
};

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SimulationChart: React.FC<{ simulation: SimulationData }> = ({ simulation }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || simulation.purchases.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 20, bottom: 30, left: 20 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Build cumulative data
    let cumInvested = 0;
    let cumQty = 0;
    const investedPoints: number[] = [];
    const valuePoints: number[] = [];

    for (const p of simulation.purchases) {
      cumInvested += p.amount;
      cumQty += p.quantity;
      investedPoints.push(cumInvested);
      valuePoints.push(cumQty * p.price);
    }

    const allValues = [...investedPoints, ...valuePoints];
    const minVal = Math.min(...allValues) * 0.95;
    const maxVal = Math.max(...allValues) * 1.05;
    const range = maxVal - minVal || 1;
    const n = investedPoints.length;

    const toX = (i: number) => pad.left + (i / Math.max(1, n - 1)) * plotW;
    const toY = (v: number) => pad.top + plotH - ((v - minVal) / range) * plotH;

    ctx.clearRect(0, 0, w, h);

    // Draw invested line (dashed)
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'hsl(0, 0%, 50%)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(investedPoints[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw value line
    ctx.beginPath();
    ctx.strokeStyle = simulation.roi >= 0 ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(valuePoints[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill area under value line
    ctx.lineTo(toX(n - 1), pad.top + plotH);
    ctx.lineTo(toX(0), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = simulation.roi >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)';
    ctx.fill();

    // Labels
    ctx.fillStyle = 'hsl(0, 0%, 50%)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Invested', pad.left + 4, pad.top + 12);
    ctx.fillStyle = simulation.roi >= 0 ? '#22c55e' : '#ef4444';
    ctx.fillText('Value', pad.left + 60, pad.top + 12);
  }, [simulation]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: '160px' }}
    />
  );
};

const DCABot: React.FC = () => {
  const [bots, setBots] = useState<DCABotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [simulations, setSimulations] = useState<Record<string, SimulationData>>({});
  const [simLoading, setSimLoading] = useState<Record<string, boolean>>({});

  // Form state
  const [formSymbol, setFormSymbol] = useState('BTCUSDT');
  const [formAmount, setFormAmount] = useState('50');
  const [formInterval, setFormInterval] = useState<'daily' | 'weekly'>('daily');
  const [formStrategy, setFormStrategy] = useState<'standard' | 'rsi_weighted' | 'fear_greed'>('standard');

  const fetchBots = useCallback(async () => {
    try {
      const res = await dcaRequest<{ success: boolean; data: DCABotData[] }>('/');
      if (res.success) setBots(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const createBot = async () => {
    if (!formAmount || parseFloat(formAmount) <= 0) return;
    setCreating(true);
    try {
      const res = await dcaRequest<{ success: boolean; data: DCABotData }>('/', {
        method: 'POST',
        body: {
          symbol: formSymbol,
          baseAmount: parseFloat(formAmount),
          interval: formInterval,
          strategy: formStrategy,
        },
      });
      if (res.success) {
        setBots((prev) => [...prev, res.data]);
        // Auto-simulate
        simulateBot(res.data.id);
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  const deleteBot = async (id: string) => {
    try {
      await dcaRequest(`/${id}`, { method: 'DELETE' });
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
      const res = await dcaRequest<{ success: boolean; data: SimulationData }>(`/${id}/simulate`);
      if (res.success) {
        setSimulations((prev) => ({ ...prev, [id]: res.data }));
      }
    } catch { /* ignore */ }
    setSimLoading((prev) => ({ ...prev, [id]: false }));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Repeat className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Smart DCA Bot</h1>
          <p className="text-sm text-muted-foreground">Automate dollar-cost averaging with smart strategies</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Bot Form */}
        <div className="bg-secondary rounded-xl border border-border p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create New Bot
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Symbol</label>
              <select
                value={formSymbol}
                onChange={(e) => setFormSymbol(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {SYMBOLS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Amount per purchase (USD)</label>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                min="1"
                step="1"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Interval</label>
              <div className="flex gap-2">
                {(['daily', 'weekly'] as const).map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setFormInterval(iv)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                      formInterval === iv
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {iv.charAt(0).toUpperCase() + iv.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Strategy</label>
              <div className="space-y-2">
                {(Object.entries(STRATEGY_INFO) as [string, { label: string; description: string }][]).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setFormStrategy(key as 'standard' | 'rsi_weighted' | 'fear_greed')}
                    className={cn(
                      'w-full text-left px-3 py-3 rounded-lg border transition-colors',
                      formStrategy === key
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-background border-border hover:border-border/80'
                    )}
                  >
                    <span className={cn('text-sm font-medium', formStrategy === key ? 'text-primary' : 'text-foreground')}>
                      {info.label}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={createBot}
              disabled={creating}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : 'Create Bot'}
            </button>
          </div>
        </div>

        {/* Active Bots */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Active Bots ({bots.length})
          </h2>

          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

          {!loading && bots.length === 0 && (
            <div className="bg-secondary rounded-xl border border-border p-8 text-center">
              <Repeat className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No bots yet. Create one to get started.</p>
            </div>
          )}

          {bots.map((bot) => {
            const sim = simulations[bot.id];
            const isSimLoading = simLoading[bot.id];

            return (
              <div key={bot.id} className="bg-secondary rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-semibold text-foreground">{bot.symbol}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {STRATEGY_INFO[bot.strategy]?.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ${fmt(bot.baseAmount)} / {bot.interval}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!sim && !isSimLoading && (
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

                {isSimLoading && (
                  <p className="text-xs text-muted-foreground py-2">Running simulation...</p>
                )}

                {sim && (
                  <div>
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">Invested</p>
                        <p className="text-sm font-semibold text-foreground">${fmt(sim.totalInvested)}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">Value</p>
                        <p className="text-sm font-semibold text-foreground">${fmt(sim.currentValue)}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">ROI</p>
                        <p className={cn('text-sm font-semibold', sim.roi >= 0 ? 'text-green-400' : 'text-red-400')}>
                          {sim.roi >= 0 ? '+' : ''}{fmt(sim.roi)}%
                        </p>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">Avg Price</p>
                        <p className="text-sm font-semibold text-foreground">${fmt(sim.avgBuyPrice)}</p>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-background rounded-lg p-2">
                      <SimulationChart simulation={sim} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DCABot;
