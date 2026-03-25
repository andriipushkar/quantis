import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FlaskConical,
  Play,
  Loader2,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  ShieldAlert,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/utils/cn';

// ── Types ──────────────────────────────────────────────────────────

interface Condition {
  id: string;
  indicator: string;
  operator: string;
  value: number;
}

interface BacktestTrade {
  entry_time: string;
  exit_time: string;
  side: 'long';
  entry_price: number;
  exit_price: number;
  pnl_pct: number;
  duration_ms: number;
}

interface BacktestStats {
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  total_return_pct: number;
}

interface EquityPoint {
  time: string;
  equity: number;
}

interface BacktestResult {
  trades: BacktestTrade[];
  stats: BacktestStats;
  equity_curve: EquityPoint[];
}

// ── Constants ──────────────────────────────────────────────────────

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];
const TIMEFRAMES = ['1h', '4h', '1d'];
const INDICATORS = ['RSI', 'EMA9', 'EMA21', 'MACD', 'BB_Upper', 'BB_Lower'];
const OPERATORS = ['>', '<', 'crosses_above', 'crosses_below'];

const OPERATOR_LABELS: Record<string, string> = {
  '>': '>',
  '<': '<',
  crosses_above: 'Crosses Above',
  crosses_below: 'Crosses Below',
};

interface PresetStrategy {
  name: string;
  description: string;
  entry_conditions: Omit<Condition, 'id'>[];
  exit_conditions: Omit<Condition, 'id'>[];
  stop_loss_pct: number;
  take_profit_pct: number;
}

const PRESETS: PresetStrategy[] = [
  {
    name: 'RSI Mean Reversion',
    description: 'Buy oversold, sell overbought',
    entry_conditions: [{ indicator: 'RSI', operator: 'crosses_above', value: 30 }],
    exit_conditions: [{ indicator: 'RSI', operator: 'crosses_below', value: 70 }],
    stop_loss_pct: 3,
    take_profit_pct: 8,
  },
  {
    name: 'EMA Crossover',
    description: 'EMA9 crosses above EMA21',
    entry_conditions: [
      { indicator: 'EMA9', operator: 'crosses_above', value: 0 },
      { indicator: 'RSI', operator: '>', value: 50 },
    ],
    exit_conditions: [{ indicator: 'EMA9', operator: 'crosses_below', value: 0 }],
    stop_loss_pct: 4,
    take_profit_pct: 10,
  },
  {
    name: 'BB Bounce',
    description: 'Buy at lower band, sell at upper',
    entry_conditions: [{ indicator: 'BB_Lower', operator: 'crosses_above', value: 0 }],
    exit_conditions: [{ indicator: 'BB_Upper', operator: 'crosses_below', value: 0 }],
    stop_loss_pct: 2.5,
    take_profit_pct: 6,
  },
];

// ── Helpers ────────────────────────────────────────────────────────

let _condId = 0;
function newCondition(partial?: Omit<Condition, 'id'>): Condition {
  return {
    id: `cond-${++_condId}`,
    indicator: partial?.indicator ?? 'RSI',
    operator: partial?.operator ?? '>',
    value: partial?.value ?? 30,
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Equity Chart Component ─────────────────────────────────────────

const EquityChart: React.FC<{ data: EquityPoint[] }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const values = data.map((d) => d.equity);
    const min = Math.min(...values) * 0.98;
    const max = Math.max(...values) * 1.02;
    const range = max - min || 1;

    const xStep = W / (data.length - 1);

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, 'rgba(14, 203, 129, 0.25)');
    gradient.addColorStop(1, 'rgba(14, 203, 129, 0.0)');

    ctx.beginPath();
    ctx.moveTo(0, H - ((values[0] - min) / range) * H);
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(i * xStep, H - ((values[i] - min) / range) * H);
    }
    ctx.lineTo((data.length - 1) * xStep, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(0, H - ((values[0] - min) / range) * H);
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(i * xStep, H - ((values[i] - min) / range) * H);
    }
    ctx.strokeStyle = '#0ECB81';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Start/End labels
    ctx.fillStyle = '#848E9C';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${values[0].toLocaleString()}`, 4, H - ((values[0] - min) / range) * H - 6);
    ctx.textAlign = 'right';
    const lastVal = values[values.length - 1];
    ctx.fillStyle = lastVal >= values[0] ? '#0ECB81' : '#F6465D';
    ctx.fillText(`$${lastVal.toLocaleString()}`, W - 4, H - ((lastVal - min) / range) * H - 6);
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
};

// ── Condition Row ──────────────────────────────────────────────────

const ConditionRow: React.FC<{
  cond: Condition;
  onChange: (id: string, field: keyof Omit<Condition, 'id'>, value: string | number) => void;
  onRemove: (id: string) => void;
}> = ({ cond, onChange, onRemove }) => (
  <div className="flex items-center gap-2 mb-2">
    <select
      value={cond.indicator}
      onChange={(e) => onChange(cond.id, 'indicator', e.target.value)}
      className="bg-[#1E2330] border border-[#2A3040] rounded px-2 py-1.5 text-sm text-[#EAECEF] flex-1 min-w-0"
    >
      {INDICATORS.map((ind) => (
        <option key={ind} value={ind}>{ind}</option>
      ))}
    </select>
    <select
      value={cond.operator}
      onChange={(e) => onChange(cond.id, 'operator', e.target.value)}
      className="bg-[#1E2330] border border-[#2A3040] rounded px-2 py-1.5 text-sm text-[#EAECEF] flex-1 min-w-0"
    >
      {OPERATORS.map((op) => (
        <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
      ))}
    </select>
    <input
      type="number"
      value={cond.value}
      onChange={(e) => onChange(cond.id, 'value', parseFloat(e.target.value) || 0)}
      className="bg-[#1E2330] border border-[#2A3040] rounded px-2 py-1.5 text-sm text-[#EAECEF] w-20"
    />
    <button
      onClick={() => onRemove(cond.id)}
      className="text-[#848E9C] hover:text-[#F6465D] transition-colors p-1"
    >
      <Trash2 size={14} />
    </button>
  </div>
);

// ── Stat Card ──────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}> = ({ label, value, icon, color = 'text-[#EAECEF]' }) => (
  <div className="bg-[#1E2330] border border-[#2A3040] rounded-lg p-4">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[#848E9C]">{icon}</span>
      <span className="text-xs text-[#848E9C] uppercase tracking-wide">{label}</span>
    </div>
    <div className={cn('text-xl font-semibold', color)}>{value}</div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────

const StrategyBacktester: React.FC = () => {
  // Form state
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [entryConditions, setEntryConditions] = useState<Condition[]>([newCondition({ indicator: 'RSI', operator: 'crosses_above', value: 30 })]);
  const [exitConditions, setExitConditions] = useState<Condition[]>([newCondition({ indicator: 'RSI', operator: 'crosses_below', value: 70 })]);
  const [stopLoss, setStopLoss] = useState(3);
  const [takeProfit, setTakeProfit] = useState(8);

  // Result state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const updateCondition = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Condition[]>>,
      id: string,
      field: keyof Omit<Condition, 'id'>,
      value: string | number
    ) => {
      setter((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    },
    []
  );

  const applyPreset = (preset: PresetStrategy) => {
    setEntryConditions(preset.entry_conditions.map((c) => newCondition(c)));
    setExitConditions(preset.exit_conditions.map((c) => newCondition(c)));
    setStopLoss(preset.stop_loss_pct);
    setTakeProfit(preset.take_profit_pct);
  };

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body = {
        symbol,
        timeframe,
        from,
        to,
        strategy: {
          entry_conditions: entryConditions.map(({ indicator, operator, value }) => ({ indicator, operator, value })),
          exit_conditions: exitConditions.map(({ indicator, operator, value }) => ({ indicator, operator, value })),
          stop_loss_pct: stopLoss,
          take_profit_pct: takeProfit,
        },
      };

      const res = await fetch('/api/analysis/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || 'Backtest failed');
        return;
      }

      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E11] text-[#EAECEF]">
      {/* Header */}
      <div className="border-b border-[#2A3040] bg-[#141821]">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center gap-3">
          <FlaskConical size={24} className="text-[#C9A84C]" />
          <h1 className="text-xl font-bold">Strategy Backtester</h1>
          <span className="ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#C9A84C] to-[#CD7F32] text-[#0B0E11] rounded">
            PRO
          </span>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Left Panel: Strategy Builder ───────────────── */}
          <div className="lg:col-span-4 space-y-5">
            {/* Symbol & Timeframe */}
            <div className="bg-[#141821] border border-[#2A3040] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#848E9C] uppercase tracking-wide mb-4">Market</h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-[#848E9C] mb-1">Symbol</label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full bg-[#1E2330] border border-[#2A3040] rounded px-3 py-2 text-sm text-[#EAECEF]"
                  >
                    {SYMBOLS.map((s) => (
                      <option key={s} value={s}>{s.replace('USDT', '/USDT')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#848E9C] mb-1">Timeframe</label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="w-full bg-[#1E2330] border border-[#2A3040] rounded px-3 py-2 text-sm text-[#EAECEF]"
                  >
                    {TIMEFRAMES.map((tf) => (
                      <option key={tf} value={tf}>{tf}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#848E9C] mb-1">From</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full bg-[#1E2330] border border-[#2A3040] rounded px-3 py-2 text-sm text-[#EAECEF]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#848E9C] mb-1">To</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full bg-[#1E2330] border border-[#2A3040] rounded px-3 py-2 text-sm text-[#EAECEF]"
                  />
                </div>
              </div>
            </div>

            {/* Entry Conditions */}
            <div className="bg-[#141821] border border-[#2A3040] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[#0ECB81] uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp size={14} /> Entry Conditions
                </h2>
                <button
                  onClick={() => setEntryConditions((prev) => [...prev, newCondition()])}
                  className="text-xs text-[#C9A84C] hover:text-[#EAECEF] transition-colors flex items-center gap-1"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              {entryConditions.map((c) => (
                <ConditionRow
                  key={c.id}
                  cond={c}
                  onChange={(id, field, val) => updateCondition(setEntryConditions, id, field, val)}
                  onRemove={(id) => setEntryConditions((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
              {entryConditions.length === 0 && (
                <p className="text-xs text-[#848E9C] italic">No entry conditions. Add at least one.</p>
              )}
            </div>

            {/* Exit Conditions */}
            <div className="bg-[#141821] border border-[#2A3040] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[#F6465D] uppercase tracking-wide flex items-center gap-2">
                  <TrendingDown size={14} /> Exit Conditions
                </h2>
                <button
                  onClick={() => setExitConditions((prev) => [...prev, newCondition()])}
                  className="text-xs text-[#C9A84C] hover:text-[#EAECEF] transition-colors flex items-center gap-1"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              {exitConditions.map((c) => (
                <ConditionRow
                  key={c.id}
                  cond={c}
                  onChange={(id, field, val) => updateCondition(setExitConditions, id, field, val)}
                  onRemove={(id) => setExitConditions((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
              {exitConditions.length === 0 && (
                <p className="text-xs text-[#848E9C] italic">No exit conditions. Add at least one.</p>
              )}
            </div>

            {/* Risk Management */}
            <div className="bg-[#141821] border border-[#2A3040] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#848E9C] uppercase tracking-wide mb-4">Risk Management</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#848E9C] mb-1">Stop Loss %</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="50"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 3)}
                    className="w-full bg-[#1E2330] border border-[#2A3040] rounded px-3 py-2 text-sm text-[#EAECEF]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#848E9C] mb-1">Take Profit %</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="100"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 8)}
                    className="w-full bg-[#1E2330] border border-[#2A3040] rounded px-3 py-2 text-sm text-[#EAECEF]"
                  />
                </div>
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={runBacktest}
              disabled={loading || entryConditions.length === 0 || exitConditions.length === 0}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all',
                loading || entryConditions.length === 0 || exitConditions.length === 0
                  ? 'bg-[#2A3040] text-[#848E9C] cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#C9A84C] to-[#CD7F32] text-[#0B0E11] hover:brightness-110'
              )}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Running Backtest...
                </>
              ) : (
                <>
                  <Play size={16} /> Run Backtest
                </>
              )}
            </button>

            {/* Presets */}
            <div className="bg-[#141821] border border-[#2A3040] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[#848E9C] uppercase tracking-wide mb-3 flex items-center gap-2">
                <Zap size={14} className="text-[#C9A84C]" /> Preset Strategies
              </h2>
              <div className="space-y-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="w-full text-left bg-[#1E2330] hover:bg-[#262D3D] border border-[#2A3040] rounded-lg px-4 py-3 transition-colors"
                  >
                    <span className="text-sm font-medium text-[#EAECEF]">{preset.name}</span>
                    <p className="text-xs text-[#848E9C] mt-0.5">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Panel: Results ─────────────────────── */}
          <div className="lg:col-span-8 space-y-5">
            {/* Error */}
            {error && (
              <div className="bg-[#F6465D]/10 border border-[#F6465D]/30 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle size={18} className="text-[#F6465D] flex-shrink-0" />
                <span className="text-sm text-[#F6465D]">{error}</span>
              </div>
            )}

            {/* Empty State */}
            {!result && !loading && !error && (
              <div className="bg-[#141821] border border-[#2A3040] rounded-xl flex flex-col items-center justify-center py-32">
                <FlaskConical size={48} className="text-[#2A3040] mb-4" />
                <h3 className="text-lg font-semibold text-[#848E9C] mb-2">No Backtest Results Yet</h3>
                <p className="text-sm text-[#5A6270] max-w-md text-center">
                  Configure your strategy on the left panel and click "Run Backtest" to see how it would have performed on historical data.
                </p>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="bg-[#141821] border border-[#2A3040] rounded-xl flex flex-col items-center justify-center py-32">
                <Loader2 size={40} className="text-[#C9A84C] animate-spin mb-4" />
                <h3 className="text-lg font-semibold text-[#848E9C]">Running backtest...</h3>
                <p className="text-sm text-[#5A6270] mt-1">Simulating strategy across historical candles</p>
              </div>
            )}

            {/* Results */}
            {result && !loading && (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard
                    label="Total Trades"
                    value={result.stats.total_trades}
                    icon={<BarChart3 size={14} />}
                  />
                  <StatCard
                    label="Win Rate"
                    value={`${result.stats.win_rate}%`}
                    icon={<Target size={14} />}
                    color={result.stats.win_rate >= 50 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}
                  />
                  <StatCard
                    label="Profit Factor"
                    value={result.stats.profit_factor}
                    icon={<TrendingUp size={14} />}
                    color={result.stats.profit_factor >= 1 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}
                  />
                  <StatCard
                    label="Max Drawdown"
                    value={`${result.stats.max_drawdown_pct}%`}
                    icon={<ShieldAlert size={14} />}
                    color="text-[#F6465D]"
                  />
                  <StatCard
                    label="Sharpe Ratio"
                    value={result.stats.sharpe_ratio}
                    icon={<Zap size={14} />}
                    color={result.stats.sharpe_ratio >= 1 ? 'text-[#0ECB81]' : 'text-[#848E9C]'}
                  />
                  <StatCard
                    label="Total Return"
                    value={`${result.stats.total_return_pct}%`}
                    icon={<TrendingUp size={14} />}
                    color={result.stats.total_return_pct >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'}
                  />
                </div>

                {/* Equity Curve */}
                {result.equity_curve.length > 1 && (
                  <div className="bg-[#141821] border border-[#2A3040] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#848E9C] uppercase tracking-wide mb-4">
                      Equity Curve
                    </h3>
                    <div className="h-64">
                      <EquityChart data={result.equity_curve} />
                    </div>
                  </div>
                )}

                {/* Trade List */}
                <div className="bg-[#141821] border border-[#2A3040] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-[#848E9C] uppercase tracking-wide mb-4">
                    Trade History ({result.trades.length})
                  </h3>
                  {result.trades.length === 0 ? (
                    <p className="text-sm text-[#5A6270] text-center py-8">No trades generated with the given conditions.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#2A3040] text-[#848E9C] text-xs uppercase tracking-wide">
                            <th className="text-left py-2 pr-4">Entry Time</th>
                            <th className="text-left py-2 pr-4">Exit Time</th>
                            <th className="text-left py-2 pr-4">Side</th>
                            <th className="text-right py-2 pr-4">Entry Price</th>
                            <th className="text-right py-2 pr-4">Exit Price</th>
                            <th className="text-right py-2 pr-4">P&L %</th>
                            <th className="text-right py-2">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.trades.map((trade, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-[#2A3040]/50 hover:bg-[#1E2330] transition-colors"
                            >
                              <td className="py-2.5 pr-4 text-[#EAECEF] whitespace-nowrap">{formatDate(trade.entry_time)}</td>
                              <td className="py-2.5 pr-4 text-[#EAECEF] whitespace-nowrap">{formatDate(trade.exit_time)}</td>
                              <td className="py-2.5 pr-4">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#0ECB81]/10 text-[#0ECB81]">
                                  LONG
                                </span>
                              </td>
                              <td className="py-2.5 pr-4 text-right text-[#EAECEF] font-mono">
                                ${trade.entry_price.toLocaleString()}
                              </td>
                              <td className="py-2.5 pr-4 text-right text-[#EAECEF] font-mono">
                                ${trade.exit_price.toLocaleString()}
                              </td>
                              <td
                                className={cn(
                                  'py-2.5 pr-4 text-right font-semibold font-mono',
                                  trade.pnl_pct >= 0 ? 'text-[#0ECB81]' : 'text-[#F6465D]'
                                )}
                              >
                                {trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct}%
                              </td>
                              <td className="py-2.5 text-right text-[#848E9C]">{formatDuration(trade.duration_ms)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyBacktester;
