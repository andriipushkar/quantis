import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Signal {
  id: string;
  pair: string;
  exchange: string;
  type: 'buy' | 'sell';
  strategy: string;
  strength: 'weak' | 'medium' | 'strong';
  confidence: number;
  entry_price: number;
  stop_loss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  reasoning: string;
  timeframe: string;
  status: string;
  created_at: string;
}

const Signals: React.FC = () => {
  const navigate = useNavigate();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignals = async () => {
    try {
      const res = await fetch('/api/v1/analysis/signals');
      const json = await res.json();
      if (json.success) setSignals(json.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchSignals();
    const i = setInterval(fetchSignals, 15000);
    return () => clearInterval(i);
  }, []);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  const pct = (entry: number, target: number) => {
    const p = ((target - entry) / entry) * 100;
    return `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Activity className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Trading Signals</h1>
        <button onClick={fetchSignals} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {signals.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center max-w-lg mx-auto">
          <Activity className="w-10 h-10 text-primary mx-auto mb-4 animate-pulse" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Analysis Engine Running</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Monitoring 10 pairs every 60 seconds. Signals appear when conditions are met:
          </p>
          <div className="space-y-2 text-left text-sm text-muted-foreground">
            <p>- <span className="text-foreground">Trend Following:</span> EMA crossover + RSI + Volume</p>
            <p>- <span className="text-foreground">Mean Reversion:</span> RSI &lt; 25 or &gt; 75</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {signals.map((s) => {
            const isBuy = s.type === 'buy';
            return (
              <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-all">
                <div className={cn('h-1', isBuy ? 'bg-success' : 'bg-danger')} />
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1',
                        isBuy ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                      )}>
                        {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {s.type.toUpperCase()}
                      </span>
                      <span className="text-sm font-bold text-foreground">{s.pair.replace('USDT', '/USDT')}</span>
                    </div>
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded',
                      s.strength === 'strong' ? 'bg-success/15 text-success' : s.strength === 'medium' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      {s.strength.toUpperCase()}
                    </span>
                  </div>

                  {/* Strategy + Confidence */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{s.strategy.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', s.confidence >= 70 ? 'bg-success' : s.confidence >= 50 ? 'bg-primary' : 'bg-danger')}
                          style={{ width: `${s.confidence}%` }}
                        />
                      </div>
                      <span className="font-mono text-foreground">{s.confidence}%</span>
                    </div>
                  </div>

                  {/* Levels */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="flex justify-between bg-secondary/50 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground">Entry</span>
                      <span className="text-foreground font-mono">${fmt(s.entry_price)}</span>
                    </div>
                    <div className="flex justify-between bg-secondary/50 rounded-lg px-3 py-2">
                      <span className="text-danger">SL</span>
                      <span className="font-mono text-foreground">{pct(s.entry_price, s.stop_loss)}</span>
                    </div>
                    <div className="flex justify-between bg-secondary/50 rounded-lg px-3 py-2">
                      <span className="text-success">TP1</span>
                      <span className="font-mono text-foreground">{pct(s.entry_price, s.tp1)}</span>
                    </div>
                    <div className="flex justify-between bg-secondary/50 rounded-lg px-3 py-2">
                      <span className="text-success">TP2</span>
                      <span className="font-mono text-foreground">{pct(s.entry_price, s.tp2)}</span>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.reasoning}</p>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleTimeString()}
                    </span>
                    <button
                      onClick={() => navigate(`/chart/${s.pair}`)}
                      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      Open Chart →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Signals;
