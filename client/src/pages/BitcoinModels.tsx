import React, { useState, useEffect } from 'react';
import { CircleDollarSign, TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Model {
  name: string;
  fairValue: number;
  deviation: number;
  signal: 'undervalued' | 'fair' | 'overvalued';
  description: string;
}

interface BTCModelsData {
  currentPrice: number;
  models: Model[];
  overallSignal: 'undervalued' | 'fair' | 'overvalued';
}

function signalBadge(signal: string) {
  switch (signal) {
    case 'undervalued':
      return { bg: 'bg-success/10 border-success/20', text: 'text-success', label: 'Undervalued', Icon: TrendingUp };
    case 'overvalued':
      return { bg: 'bg-danger/10 border-danger/20', text: 'text-danger', label: 'Overvalued', Icon: TrendingDown };
    default:
      return { bg: 'bg-secondary border-border', text: 'text-muted-foreground', label: 'Fair Value', Icon: Minus };
  }
}

const BitcoinModels: React.FC = () => {
  const [data, setData] = useState<BTCModelsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/market/btc-models');
        if (!res.ok) { setError('Failed to load data'); return; }
        const text = await res.text();
        let json: any;
        try { json = JSON.parse(text); } catch { setError('Invalid response'); return; }
        if (!json.success || !json.data) {
          setError(json.error || 'Failed to load data');
        } else {
          setData(json.data);
        }
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const overall = data ? signalBadge(data.overallSignal) : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <CircleDollarSign className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bitcoin Price Models</h1>
          <p className="text-sm text-muted-foreground">On-chain and quantitative valuation frameworks</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Current price + overall signal */}
          <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Current BTC Price</p>
              <p className="text-3xl font-bold font-mono text-foreground">${(data.currentPrice ?? 0).toLocaleString()}</p>
            </div>
            {overall && (
              <div className={cn('flex items-center gap-2 rounded-full border px-4 py-2', overall.bg)}>
                <overall.Icon className={cn('w-4 h-4', overall.text)} />
                <span className={cn('text-sm font-semibold', overall.text)}>
                  Overall Consensus: {overall.label}
                </span>
              </div>
            )}
          </div>

          {/* Model cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {data.models.map((model) => {
              const badge = signalBadge(model.signal);
              return (
                <div key={model.name} className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-foreground font-semibold text-lg">{model.name}</h3>
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', badge.bg, badge.text)}>
                      <badge.Icon className="w-3 h-3" />
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex items-end gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Fair Value</p>
                      <p className="text-xl font-bold font-mono text-foreground">${(model.fairValue ?? 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Deviation</p>
                      <p className={cn(
                        'text-lg font-bold font-mono',
                        model.deviation > 0 ? 'text-danger' : model.deviation < -10 ? 'text-success' : 'text-muted-foreground'
                      )}>
                        {(model.deviation ?? 0) > 0 ? '+' : ''}{(model.deviation ?? 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Deviation bar */}
                  <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'absolute top-0 h-full rounded-full',
                        model.signal === 'undervalued' ? 'bg-success' : model.signal === 'overvalued' ? 'bg-danger' : 'bg-primary'
                      )}
                      style={{
                        left: model.deviation < 0 ? `${50 + model.deviation / 2}%` : '50%',
                        width: `${Math.min(50, Math.abs(model.deviation) / 2)}%`,
                      }}
                    />
                    <div className="absolute top-0 left-1/2 w-0.5 h-full bg-foreground/30" />
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">{model.description}</p>
                </div>
              );
            })}
          </div>

          {/* Disclaimer */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground mb-1">Disclaimer</p>
              <p>
                These models are theoretical frameworks and should not be used as sole investment advice.
                Past model accuracy does not guarantee future results. Stock-to-Flow, Rainbow Chart, and
                other models have known limitations and periods of significant deviation. Always conduct
                your own research and consider multiple factors before making investment decisions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5" />
            Data refreshed every 30 minutes.
          </div>
        </>
      )}
    </div>
  );
};

export default BitcoinModels;
