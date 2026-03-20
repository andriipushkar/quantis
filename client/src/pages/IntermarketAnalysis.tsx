import React, { useState, useEffect } from 'react';
import { Globe2, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Asset {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  category: string;
}

interface Correlation {
  pair: string;
  value: number;
}

interface MultiAssetData {
  assets: Asset[];
  correlations: Correlation[];
  riskOnOff: 'risk-on' | 'risk-off' | 'neutral';
  updatedAt: string;
}

const CATEGORIES = ['Indices', 'Commodities', 'Bonds', 'Forex', 'Crypto'];

function correlationColor(v: number): string {
  if (v >= 0.6) return 'text-success';
  if (v >= 0.3) return 'text-green-400';
  if (v > -0.3) return 'text-muted-foreground';
  if (v > -0.6) return 'text-orange-400';
  return 'text-danger';
}

function correlationBg(v: number): string {
  if (v >= 0.6) return 'bg-success/10';
  if (v >= 0.3) return 'bg-green-400/10';
  if (v > -0.3) return 'bg-secondary';
  if (v > -0.6) return 'bg-orange-400/10';
  return 'bg-danger/10';
}

const IntermarketAnalysis: React.FC = () => {
  const [data, setData] = useState<MultiAssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/market/multi-asset');
        const json = await res.json();
        if (!res.ok || !json.success) {
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Intermarket Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Cross-asset correlations and macro environment
          </p>
        </div>
        {data && (
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border',
              data.riskOnOff === 'risk-on'
                ? 'bg-success/10 text-success border-success/20'
                : data.riskOnOff === 'risk-off'
                ? 'bg-danger/10 text-danger border-danger/20'
                : 'bg-secondary text-muted-foreground border-border'
            )}
          >
            {data.riskOnOff === 'risk-on' && <TrendingUp className="w-3 h-3" />}
            {data.riskOnOff === 'risk-off' && <TrendingDown className="w-3 h-3" />}
            {data.riskOnOff === 'neutral' && <Minus className="w-3 h-3" />}
            {data.riskOnOff.replace('-', ' ').toUpperCase()}
          </span>
        )}
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
          {/* Asset cards grouped by category */}
          {CATEGORIES.map((cat) => {
            const assets = data.assets.filter((a) => a.category === cat);
            if (assets.length === 0) return null;
            return (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{cat}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.map((a) => (
                    <div key={a.symbol} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{a.symbol}</p>
                        <p className="text-foreground font-semibold">{a.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-foreground font-bold font-mono">
                          {a.price >= 100 ? `$${a.price.toLocaleString()}` : a.price < 10 ? a.price.toFixed(2) : `$${a.price.toFixed(2)}`}
                        </p>
                        <p className={cn(
                          'text-sm font-mono font-semibold',
                          a.change24h >= 0 ? 'text-success' : 'text-danger'
                        )}>
                          {a.change24h >= 0 ? '+' : ''}{a.change24h.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Correlation Table */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-foreground font-semibold mb-4">BTC Correlations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {data.correlations.map((c) => (
                <div
                  key={c.pair}
                  className={cn('rounded-lg p-3 flex items-center justify-between', correlationBg(c.value))}
                >
                  <span className="text-sm text-foreground font-medium">{c.pair}</span>
                  <span className={cn('font-mono font-bold text-sm', correlationColor(c.value))}>
                    {c.value > 0 ? '+' : ''}{c.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success inline-block" /> Strong positive</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 inline-block" /> Weak</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-danger inline-block" /> Strong negative</span>
            </div>
          </div>

          {/* Note */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5" />
            Data updated every 30 minutes. Last update: {new Date(data.updatedAt).toLocaleTimeString()}
          </div>
        </>
      )}
    </div>
  );
};

export default IntermarketAnalysis;
