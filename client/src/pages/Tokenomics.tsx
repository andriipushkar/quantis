import React, { useEffect, useState } from 'react';
import { PieChart, Info, ArrowUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenUnlock {
  date: string;
  amount: number;
  description: string;
}

interface TokenomicsData {
  symbol: string;
  name: string;
  circulatingSupply: number;
  maxSupply: number | null;
  inflationRate: number;
  fdv: number;
  supplyRatio: number;
  unlocks: TokenUnlock[];
  score: number;
  scoreExplanation: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];

function fmtSupply(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-yellow-400';
  return 'text-danger';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-success';
  if (score >= 60) return 'bg-primary';
  if (score >= 40) return 'bg-yellow-400';
  return 'bg-danger';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Tokenomics: React.FC = () => {
  const [tokens, setTokens] = useState<TokenomicsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/v1/tokenomics/compare?symbols=${SYMBOLS.join(',')}`);
        const json = await res.json();
        if (!cancelled && json.data) {
          setTokens(json.data);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const displayed = selected ? tokens.filter((t) => t.symbol === selected) : tokens;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PieChart className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <PieChart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Tokenomics Analyzer</h1>
            <p className="text-xs text-muted-foreground">
              Supply metrics, inflation, and tokenomics scores
            </p>
          </div>
        </div>

        {/* Symbol selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelected(null)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              !selected
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          {SYMBOLS.map((sym) => (
            <button
              key={sym}
              onClick={() => setSelected(selected === sym ? null : sym)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                selected === sym
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Token Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayed.map((token) => (
          <div
            key={token.symbol}
            className="bg-card border border-border rounded-xl p-5 space-y-4 transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-foreground">{token.symbol}</p>
                <p className="text-xs text-muted-foreground">{token.name}</p>
              </div>
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                scoreColor(token.score),
                token.score >= 80 ? 'bg-success/15' :
                token.score >= 60 ? 'bg-primary/15' :
                token.score >= 40 ? 'bg-yellow-400/15' : 'bg-danger/15'
              )}>
                {token.score}
              </div>
            </div>

            {/* Supply Gauge */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Supply</span>
                <span className="text-foreground font-medium">
                  {fmtSupply(token.circulatingSupply)} / {token.maxSupply ? fmtSupply(token.maxSupply) : 'Unlimited'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', scoreBg(token.score))}
                  style={{ width: `${Math.min(token.supplyRatio * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 text-right">
                {(token.supplyRatio * 100).toFixed(1)}% circulating
              </p>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Inflation</p>
                <p className={cn(
                  'text-sm font-bold',
                  token.inflationRate <= 0 ? 'text-success' :
                  token.inflationRate <= 2 ? 'text-foreground' : 'text-danger'
                )}>
                  {token.inflationRate > 0 ? '+' : ''}{token.inflationRate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">FDV</p>
                <p className="text-sm font-bold text-foreground">{fmtUsd(token.fdv)}</p>
              </div>
            </div>

            {/* Unlocks */}
            {token.unlocks.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Upcoming Unlocks
                </p>
                {token.unlocks.map((u, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-foreground font-mono whitespace-nowrap">{u.date}</span>
                    <span>{u.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Score explanation */}
            <div className="flex items-start gap-2 p-2 rounded-lg bg-secondary/50">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {token.scoreExplanation}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      {!selected && tokens.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpDown className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Side-by-Side Comparison
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 pr-4 font-medium">Token</th>
                  <th className="text-right py-3 px-4 font-medium">Circulating</th>
                  <th className="text-right py-3 px-4 font-medium">Max Supply</th>
                  <th className="text-right py-3 px-4 font-medium">Supply %</th>
                  <th className="text-right py-3 px-4 font-medium">Inflation</th>
                  <th className="text-right py-3 px-4 font-medium">FDV</th>
                  <th className="text-right py-3 pl-4 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr
                    key={t.symbol}
                    className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <div>
                        <p className="font-semibold text-foreground">{t.symbol}</p>
                        <p className="text-xs text-muted-foreground">{t.name}</p>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-foreground font-mono text-xs">
                      {fmtSupply(t.circulatingSupply)}
                    </td>
                    <td className="text-right py-3 px-4 text-foreground font-mono text-xs">
                      {t.maxSupply ? fmtSupply(t.maxSupply) : 'N/A'}
                    </td>
                    <td className="text-right py-3 px-4 text-foreground">
                      {(t.supplyRatio * 100).toFixed(1)}%
                    </td>
                    <td className={cn(
                      'text-right py-3 px-4 font-medium',
                      t.inflationRate <= 0 ? 'text-success' :
                      t.inflationRate <= 2 ? 'text-foreground' : 'text-danger'
                    )}>
                      {t.inflationRate > 0 ? '+' : ''}{t.inflationRate.toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 text-foreground font-mono text-xs">
                      {fmtUsd(t.fdv)}
                    </td>
                    <td className="text-right py-3 pl-4">
                      <span className={cn('font-bold', scoreColor(t.score))}>
                        {t.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tokenomics;
