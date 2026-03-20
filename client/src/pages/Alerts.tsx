import React, { useEffect, useState, useCallback } from 'react';
import { Bell, Plus, Trash2, Check, ChevronRight, Link2, Zap, ArrowRight } from 'lucide-react';
import { getAlerts, createAlert, deleteAlert, getPairs, getTicker, type Alert, type TradingPair } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { cn } from '@/utils/cn';

type ConditionType = 'price_above' | 'price_below' | 'rsi_above' | 'rsi_below' | 'price_change_pct';

interface BuilderState {
  step: number;
  pair: string;
  conditionType: ConditionType;
  value: string;
  channels: string[];
  name: string;
}

const CONDITION_LABELS: Record<ConditionType, string> = {
  price_above: 'Price Above',
  price_below: 'Price Below',
  rsi_above: 'RSI Above',
  rsi_below: 'RSI Below',
  price_change_pct: 'Price Change %',
};

const STEPS = ['Select Pair', 'Condition', 'Value', 'Channels', 'Name'];

function generateName(pair: string, conditionType: ConditionType, value: string): string {
  const symbol = pair.replace(/USDT$/, '');
  switch (conditionType) {
    case 'price_above': return `${symbol} above $${Number(value).toLocaleString()}`;
    case 'price_below': return `${symbol} below $${Number(value).toLocaleString()}`;
    case 'rsi_above': return `${symbol} RSI above ${value}`;
    case 'rsi_below': return `${symbol} RSI below ${value}`;
    case 'price_change_pct': return `${symbol} change ${value}%`;
    default: return 'New Alert';
  }
}

const Alerts: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pairs, setPairs] = useState<TradingPair[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [builder, setBuilder] = useState<BuilderState>({
    step: 1,
    pair: '',
    conditionType: 'price_above',
    value: '',
    channels: ['push'],
    name: '',
  });

  const fetchAlerts = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  useEffect(() => {
    if (showCreate && pairs.length === 0) {
      getPairs().then(setPairs).catch(() => {});
    }
  }, [showCreate, pairs.length]);

  // Fetch current price when pair changes
  useEffect(() => {
    if (!builder.pair) { setCurrentPrice(null); return; }
    getTicker(builder.pair).then((t) => setCurrentPrice(t.price)).catch(() => setCurrentPrice(null));
  }, [builder.pair]);

  // Auto-generate name when conditions change
  useEffect(() => {
    if (builder.pair && builder.value) {
      setBuilder((prev) => ({
        ...prev,
        name: generateName(prev.pair, prev.conditionType, prev.value),
      }));
    }
  }, [builder.pair, builder.conditionType, builder.value]);

  const handleCreate = async () => {
    if (!builder.name.trim()) return;
    setCreating(true);
    try {
      await createAlert({
        name: builder.name.trim(),
        conditions: {
          type: builder.conditionType,
          symbol: builder.pair,
          value: parseFloat(builder.value),
        },
        channels: builder.channels,
      });
      setBuilder({ step: 1, pair: '', conditionType: 'price_above', value: '', channels: ['push'], name: '' });
      setShowCreate(false);
      fetchAlerts();
    } catch { /* ignore */ }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch { /* ignore */ }
  };

  const toggleChannel = (ch: string) => {
    setBuilder((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter((c) => c !== ch)
        : [...prev.channels, ch],
    }));
  };

  const canProceed = (): boolean => {
    switch (builder.step) {
      case 1: return !!builder.pair;
      case 2: return !!builder.conditionType;
      case 3: return !!builder.value && !isNaN(parseFloat(builder.value));
      case 4: return builder.channels.length > 0;
      case 5: return !!builder.name.trim();
      default: return false;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Bell className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Login to manage your alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Alerts</h1>
        <button
          onClick={() => {
            setShowCreate(!showCreate);
            if (!showCreate) {
              setBuilder({ step: 1, pair: '', conditionType: 'price_above', value: '', channels: ['push'], name: '' });
            }
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Create Alert
        </button>
      </div>

      {/* Visual Alert Builder */}
      {showCreate && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-6">
          {/* Stepper */}
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {STEPS.map((label, idx) => {
              const stepNum = idx + 1;
              const isActive = builder.step === stepNum;
              const isCompleted = builder.step > stepNum;
              return (
                <React.Fragment key={label}>
                  {idx > 0 && (
                    <div className={cn(
                      'flex-1 h-0.5 min-w-[20px]',
                      isCompleted ? 'bg-primary' : 'bg-border'
                    )} />
                  )}
                  <button
                    onClick={() => {
                      if (stepNum <= builder.step) setBuilder((prev) => ({ ...prev, step: stepNum }));
                    }}
                    className="flex flex-col items-center gap-1 flex-shrink-0"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                      isActive ? 'bg-primary text-primary-foreground' :
                      isCompleted ? 'bg-primary/20 text-primary' :
                      'bg-secondary text-muted-foreground'
                    )}>
                      {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
                    </div>
                    <span className={cn(
                      'text-[10px] whitespace-nowrap',
                      isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}>
                      {label}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Step Content */}
          <div className="min-h-[120px]">
            {/* Step 1: Select Pair */}
            {builder.step === 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Select Trading Pair</h3>
                <select
                  value={builder.pair}
                  onChange={(e) => setBuilder((prev) => ({ ...prev, pair: e.target.value }))}
                  className="w-full h-10 px-4 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Choose a pair...</option>
                  {pairs.map((p) => (
                    <option key={p.id} value={p.symbol}>{p.symbol} ({p.exchange})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Step 2: Condition Type */}
            {builder.step === 2 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Condition Type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.entries(CONDITION_LABELS) as [ConditionType, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setBuilder((prev) => ({ ...prev, conditionType: key }))}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-all text-left',
                        builder.conditionType === key
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary text-foreground hover:bg-secondary/80'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        builder.conditionType === key ? 'border-primary' : 'border-muted-foreground'
                      )}>
                        {builder.conditionType === key && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Value */}
            {builder.step === 3 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Threshold Value</h3>
                {currentPrice !== null && (
                  <p className="text-xs text-muted-foreground">
                    Current {builder.pair.replace(/USDT$/, '')} price:{' '}
                    <span className="text-foreground font-mono font-medium">
                      ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
                <input
                  type="number"
                  placeholder={
                    builder.conditionType === 'rsi_above' || builder.conditionType === 'rsi_below'
                      ? 'e.g. 70'
                      : builder.conditionType === 'price_change_pct'
                      ? 'e.g. 5'
                      : 'e.g. 75000'
                  }
                  value={builder.value}
                  onChange={(e) => setBuilder((prev) => ({ ...prev, value: e.target.value }))}
                  className="w-full h-10 px-4 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </div>
            )}

            {/* Step 4: Channels */}
            {builder.step === 4 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Notification Channels</h3>
                <div className="space-y-2">
                  {/* Push */}
                  <button
                    onClick={() => toggleChannel('push')}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-all text-left',
                      builder.channels.includes('push')
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-secondary'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                      builder.channels.includes('push') ? 'border-primary bg-primary' : 'border-muted-foreground'
                    )}>
                      {builder.channels.includes('push') && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <span className="text-foreground font-medium">In-app Push</span>
                  </button>
                  {/* Email */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-secondary/50 opacity-60 cursor-not-allowed">
                    <div className="w-5 h-5 rounded border-2 border-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground font-medium text-sm">Email</span>
                    <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">Coming soon</span>
                  </div>
                  {/* Telegram */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-secondary/50 opacity-60 cursor-not-allowed">
                    <div className="w-5 h-5 rounded border-2 border-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground font-medium text-sm">Telegram</span>
                    <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">Coming soon</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Name */}
            {builder.step === 5 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Alert Name</h3>
                <p className="text-xs text-muted-foreground">Auto-generated from your conditions. Edit if needed.</p>
                <input
                  type="text"
                  placeholder="Alert name"
                  value={builder.name}
                  onChange={(e) => setBuilder((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 px-4 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <button
              onClick={() => {
                if (builder.step === 1) setShowCreate(false);
                else setBuilder((prev) => ({ ...prev, step: prev.step - 1 }));
              }}
              className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm hover:bg-secondary/80 transition-colors"
            >
              {builder.step === 1 ? 'Cancel' : 'Back'}
            </button>
            {builder.step < 5 ? (
              <button
                onClick={() => setBuilder((prev) => ({ ...prev, step: prev.step + 1 }))}
                disabled={!canProceed()}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating || !canProceed()}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {creating ? 'Creating...' : 'Create Alert'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Alert List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Bell className="w-6 h-6 text-primary animate-pulse" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No alerts yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{alert.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {alert.is_active ? 'Active' : 'Paused'} &middot; Created {new Date(alert.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  alert.is_active ? 'bg-green-500' : 'bg-muted-foreground'
                )} />
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Alert Chains (Pro Feature) ──────────────────────────── */}
      <AlertChains />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Alert Chains Component
// ---------------------------------------------------------------------------

interface ChainTemplate {
  name: string;
  description: string;
  steps: { label: string; type: 'when' | 'check' | 'alert' }[];
}

const CHAIN_TEMPLATES: ChainTemplate[] = [
  {
    name: 'Macro Crash Detector',
    description: 'Detects potential market crashes using price action + RSI confirmation.',
    steps: [
      { label: 'BTC drops > 5% in 4H', type: 'when' },
      { label: 'RSI < 35', type: 'check' },
      { label: 'Notify immediately', type: 'alert' },
    ],
  },
  {
    name: 'Whale + TA Confluence',
    description: 'Whale deposit at overbought conditions signals potential top.',
    steps: [
      { label: 'Whale deposit > $10M to exchange', type: 'when' },
      { label: 'RSI > 70', type: 'check' },
      { label: 'Notify immediately', type: 'alert' },
    ],
  },
  {
    name: 'Funding Rate Arbitrage',
    description: 'Alerts when funding rate diverges across exchanges, creating arb opportunity.',
    steps: [
      { label: 'Funding rate divergence > 0.07% across exchanges', type: 'when' },
      { label: 'Notify immediately', type: 'alert' },
    ],
  },
];

const STEP_COLORS = {
  when: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  check: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  alert: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

const STEP_LABELS = {
  when: 'WHEN',
  check: 'AND CHECK',
  alert: 'THEN ALERT',
};

const AlertChains: React.FC = () => {
  const { addToast } = useToastStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Alert Chains
        </h2>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
          <Zap className="w-2.5 h-2.5" />
          PRO
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CHAIN_TEMPLATES.map((chain) => (
          <div
            key={chain.name}
            className="bg-card border border-border rounded-xl p-5 space-y-4 transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{chain.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{chain.description}</p>
            </div>

            {/* Chain logic visualization */}
            <div className="space-y-2">
              {chain.steps.map((step, i) => (
                <React.Fragment key={i}>
                  <div
                    className={cn(
                      'flex items-start gap-2 px-3 py-2 rounded-lg border text-xs',
                      STEP_COLORS[step.type]
                    )}
                  >
                    <span className="font-bold whitespace-nowrap">{STEP_LABELS[step.type]}</span>
                    <span className="opacity-80">{step.label}</span>
                  </div>
                  {i < chain.steps.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowRight className="w-3 h-3 text-muted-foreground rotate-90" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            <button
              onClick={() => addToast('Pro feature — upgrade to use Alert Chains', 'info')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Zap className="w-3 h-3" />
              Activate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;
