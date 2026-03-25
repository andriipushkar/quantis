import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  X,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Star,
  BarChart3,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import { SkeletonRow } from '@/components/common/Skeleton';

/* ── Types ─────────────────────────────────────────────────────── */

interface JournalEntry {
  id: string;
  pair: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number | null;
  size: number;
  strategy: string | null;
  emotional_state: string | null;
  notes: string | null;
  confidence: number | null;
  timeframe: string | null;
  pnl: number | null;
  pnlPct: number | null;
  createdAt: string;
  updatedAt: string;
}

interface JournalStats {
  totalTrades: number;
  closedTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
}

/* ── API helpers ───────────────────────────────────────────────── */

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

/* ── Constants ─────────────────────────────────────────────────── */

const PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
];

const STRATEGIES = ['Trend Following', 'Mean Reversion', 'Breakout', 'Scalp', 'Other'];

const EMOTIONS: { value: string; label: string }[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'fomo', label: 'FOMO' },
  { value: 'revenge', label: 'Revenge' },
  { value: 'greedy', label: 'Greedy' },
  { value: 'fearful', label: 'Fearful' },
];

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

/* ── Stat Card ─────────────────────────────────────────────────── */

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ElementType; color?: string }> = ({
  label,
  value,
  icon: Icon,
  color,
}) => (
  <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2 mb-1">
      <Icon className={cn('w-4 h-4', color || 'text-primary')} />
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-xl font-bold font-mono text-foreground">{value}</span>
  </div>
);

/* ── Star Rating ───────────────────────────────────────────────── */

const StarRating: React.FC<{ value: number; onChange?: (v: number) => void; readonly?: boolean }> = ({
  value,
  onChange,
  readonly,
}) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={readonly}
        onClick={() => onChange?.(n)}
        className={cn('transition-colors', readonly ? 'cursor-default' : 'cursor-pointer hover:text-primary')}
      >
        <Star
          className={cn(
            'w-5 h-5',
            n <= value ? 'text-primary fill-primary' : 'text-muted-foreground'
          )}
        />
      </button>
    ))}
  </div>
);

/* ── Journal Page ──────────────────────────────────────────────── */

const Journal: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [pair, setPair] = useState('BTCUSDT');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [size, setSize] = useState('');
  const [strategy, setStrategy] = useState('');
  const [emotion, setEmotion] = useState('');
  const [confidence, setConfidence] = useState(3);
  const [notes, setNotes] = useState('');
  const [timeframe, setTimeframe] = useState('1h');

  const fetchData = useCallback(async () => {
    try {
      const [entriesRes, statsRes] = await Promise.all([
        apiFetch<{ success: boolean; data: JournalEntry[] }>('/api/v1/journal'),
        apiFetch<{ success: boolean; data: JournalStats }>('/api/v1/journal/stats'),
      ]);
      setEntries(Array.isArray(entriesRes.data) ? entriesRes.data : []);
      setStats(statsRes.data && typeof statsRes.data === 'object' && !Array.isArray(statsRes.data) ? statsRes.data : null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setPair('BTCUSDT');
    setDirection('long');
    setEntryPrice('');
    setExitPrice('');
    setSize('');
    setStrategy('');
    setEmotion('');
    setConfidence(3);
    setNotes('');
    setTimeframe('1h');
    setEditingId(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (entry: JournalEntry) => {
    setPair(entry.pair);
    setDirection(entry.direction);
    setEntryPrice(String(entry.entryPrice));
    setExitPrice(entry.exitPrice !== null ? String(entry.exitPrice) : '');
    setSize(String(entry.size));
    setStrategy(entry.strategy || '');
    setEmotion(entry.emotional_state || '');
    setConfidence(entry.confidence || 3);
    setNotes(entry.notes || '');
    setTimeframe(entry.timeframe || '1h');
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = {
      pair,
      direction,
      entryPrice: parseFloat(entryPrice),
      exitPrice: exitPrice ? parseFloat(exitPrice) : undefined,
      size: parseFloat(size),
      strategy: strategy || undefined,
      emotional_state: emotion || undefined,
      confidence,
      notes: notes || undefined,
      timeframe: timeframe || undefined,
    };

    try {
      if (editingId) {
        await apiFetch(`/api/v1/journal/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/api/v1/journal', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      setShowForm(false);
      resetForm();
      fetchData();
    } catch {
      // silent
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/v1/journal/${id}`, { method: 'DELETE' });
      fetchData();
    } catch {
      // silent
    }
  };

  const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Trading Journal</h1>
            <p className="text-xs text-muted-foreground">Track, review, and improve your trades</p>
          </div>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="w-4 h-4 mr-2" />
          Add Trade
        </Button>
      </div>

      {/* ── Stats bar ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total Trades" value={stats.totalTrades} icon={BarChart3} />
          <StatCard
            label="Win Rate"
            value={`${stats.winRate}%`}
            icon={Target}
            color={stats.winRate >= 50 ? 'text-success' : 'text-danger'}
          />
          <StatCard
            label="Avg Win"
            value={`$${fmt(stats.avgWin)}`}
            icon={TrendingUp}
            color="text-success"
          />
          <StatCard
            label="Avg Loss"
            value={`$${fmt(stats.avgLoss)}`}
            icon={TrendingDown}
            color="text-danger"
          />
          <StatCard
            label="Profit Factor"
            value={stats.profitFactor === Infinity ? '∞' : fmt(stats.profitFactor)}
            icon={AlertTriangle}
            color={stats.profitFactor >= 1 ? 'text-success' : 'text-danger'}
          />
        </div>
      )}

      {/* ── Add/Edit Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground">
                {editingId ? 'Edit Trade' : 'Add Trade'}
              </h2>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Pair */}
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
                  Pair
                </label>
                <select
                  value={pair}
                  onChange={(e) => setPair(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {PAIRS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Direction toggle */}
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
                  Direction
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('long')}
                    className={cn(
                      'flex-1 h-10 rounded-lg text-sm font-medium transition-all border',
                      direction === 'long'
                        ? 'bg-success/10 border-success text-success'
                        : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Long
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('short')}
                    className={cn(
                      'flex-1 h-10 rounded-lg text-sm font-medium transition-all border',
                      direction === 'short'
                        ? 'bg-danger/10 border-danger text-danger'
                        : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Short
                  </button>
                </div>
              </div>

              {/* Entry/Exit/Size row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
                    Entry Price
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
                    Exit Price
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
                    Size (USD)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="100"
                  />
                </div>
              </div>

              {/* Strategy + Timeframe */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
                    Strategy
                  </label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">None</option>
                    {STRATEGIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
                    Timeframe
                  </label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {TIMEFRAMES.map((tf) => (
                      <option key={tf} value={tf}>{tf}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Emotional State */}
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
                  Emotional State
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map((em) => (
                    <button
                      key={em.value}
                      type="button"
                      onClick={() => setEmotion(emotion === em.value ? '' : em.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        emotion === em.value
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {em.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence */}
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
                  Confidence
                </label>
                <StarRating value={confidence} onChange={setConfidence} />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="What was your rationale? What did you learn?"
                />
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full">
                {editingId ? 'Update Trade' : 'Save Trade'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── Trade List ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-3 px-4 font-medium">Date</th>
                <th className="text-left py-3 px-4 font-medium">Pair</th>
                <th className="text-left py-3 px-4 font-medium">Direction</th>
                <th className="text-right py-3 px-4 font-medium">Entry</th>
                <th className="text-right py-3 px-4 font-medium">Exit</th>
                <th className="text-right py-3 px-4 font-medium">P&L ($)</th>
                <th className="text-right py-3 px-4 font-medium">P&L (%)</th>
                <th className="text-left py-3 px-4 font-medium">Strategy</th>
                <th className="text-left py-3 px-4 font-medium">Emotion</th>
                <th className="text-center py-3 px-4 font-medium">Rating</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={11} />)}</>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-muted-foreground">
                    No trades recorded yet. Click "Add Trade" to get started.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isProfit = entry.pnl !== null && entry.pnl > 0;
                  const isLoss = entry.pnl !== null && entry.pnl < 0;
                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        'border-b border-border/50 last:border-0 transition-colors',
                        isProfit && 'bg-success/5',
                        isLoss && 'bg-danger/5'
                      )}
                    >
                      <td className="py-3 px-4 text-foreground text-xs">
                        {new Date(entry.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-foreground font-medium">{entry.pair}</td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            entry.direction === 'long'
                              ? 'bg-success/10 text-success'
                              : 'bg-danger/10 text-danger'
                          )}
                        >
                          {entry.direction === 'long' ? 'Long' : 'Short'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-foreground font-mono text-xs">
                        ${fmt(entry.entryPrice)}
                      </td>
                      <td className="py-3 px-4 text-right text-foreground font-mono text-xs">
                        {entry.exitPrice !== null ? `$${fmt(entry.exitPrice)}` : '—'}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 text-right font-mono font-medium text-xs',
                          isProfit ? 'text-success' : isLoss ? 'text-danger' : 'text-muted-foreground'
                        )}
                      >
                        {entry.pnl !== null
                          ? `${entry.pnl >= 0 ? '+' : ''}$${fmt(entry.pnl)}`
                          : '—'}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 text-right font-mono font-medium text-xs',
                          isProfit ? 'text-success' : isLoss ? 'text-danger' : 'text-muted-foreground'
                        )}
                      >
                        {entry.pnlPct !== null
                          ? `${entry.pnlPct >= 0 ? '+' : ''}${(entry.pnlPct ?? 0).toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {entry.strategy || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs capitalize text-muted-foreground">
                        {entry.emotional_state || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {entry.confidence ? (
                          <StarRating value={entry.confidence} readonly />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditForm(entry)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Journal;
