import React, { useEffect, useState } from 'react';
import { Megaphone, TrendingUp, TrendingDown, Minus, Users } from 'lucide-react';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentMention {
  symbol: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  time: string;
}

interface Influencer {
  id: string;
  name: string;
  handle: string;
  followers: number;
  category: 'analyst' | 'macro' | 'degen' | 'vc';
  impactScore: number;
  accuracy: number;
  avgPriceImpact: number;
  recentMentions: RecentMention[];
  bullishBias: number;
}

interface ConsensusItem {
  symbol: string;
  bullish: number;
  bearish: number;
  neutral: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const CATEGORY_COLORS: Record<string, string> = {
  analyst: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  macro: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  degen: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  vc: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const InfluencerTracker: React.FC = () => {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [consensus, setConsensus] = useState<ConsensusItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [infRes, conRes] = await Promise.all([
          fetch('/api/v1/influencers'),
          fetch('/api/v1/influencers/consensus'),
        ]);
        const infJson = await infRes.json();
        const conJson = await conRes.json();

        if (!cancelled) {
          setInfluencers(infJson.data ?? []);
          setConsensus(conJson.data ?? []);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Megaphone className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Influencer Tracker</h1>
          <p className="text-xs text-muted-foreground">
            Track crypto influencer sentiment and accuracy
          </p>
        </div>
      </div>

      {/* Consensus Section */}
      {consensus.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            Influencer Consensus
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {consensus.map((c) => (
              <div key={c.symbol} className="space-y-2">
                <p className="text-sm font-bold text-foreground">{c.symbol}</p>
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="w-3 h-3 text-success" />
                  <span className="text-success font-medium">{c.bullish}</span>
                  <Minus className="w-3 h-3 text-muted-foreground mx-0.5" />
                  <span className="text-muted-foreground">{c.neutral}</span>
                  <TrendingDown className="w-3 h-3 text-danger mx-0.5" />
                  <span className="text-danger font-medium">{c.bearish}</span>
                </div>
                {/* Stacked bar */}
                <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary">
                  {c.total > 0 && (
                    <>
                      <div
                        className="bg-success h-full"
                        style={{ width: `${(c.bullish / c.total) * 100}%` }}
                      />
                      <div
                        className="bg-muted-foreground/40 h-full"
                        style={{ width: `${(c.neutral / c.total) * 100}%` }}
                      />
                      <div
                        className="bg-danger h-full"
                        style={{ width: `${(c.bearish / c.total) * 100}%` }}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Influencer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {influencers.map((inf) => (
          <div
            key={inf.id}
            className="bg-card border border-border rounded-xl p-5 space-y-4 transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
          >
            {/* Top row: Avatar + info */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                {getInitials(inf.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{inf.name}</p>
                <p className="text-xs text-muted-foreground">{inf.handle}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {formatFollowers(inf.followers)}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize',
                      CATEGORY_COLORS[inf.category] || 'bg-secondary text-muted-foreground border-border'
                    )}
                  >
                    {inf.category}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {/* Impact Score */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Impact
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${inf.impactScore}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground">{inf.impactScore}</span>
                </div>
              </div>

              {/* Accuracy */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Accuracy
                </p>
                <p className={cn(
                  'text-sm font-bold',
                  inf.accuracy >= 65 ? 'text-success' : inf.accuracy >= 50 ? 'text-foreground' : 'text-danger'
                )}>
                  {inf.accuracy}%
                </p>
              </div>

              {/* Avg Price Impact */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Avg Impact
                </p>
                <p className={cn(
                  'text-sm font-bold',
                  inf.avgPriceImpact >= 0 ? 'text-success' : 'text-danger'
                )}>
                  {inf.avgPriceImpact >= 0 ? '+' : ''}{inf.avgPriceImpact.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Recent Mentions */}
            {inf.recentMentions.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Recent Mentions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {inf.recentMentions.map((m, i) => (
                    <span
                      key={`${m.symbol}-${i}`}
                      className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border',
                        m.sentiment === 'bullish'
                          ? 'bg-success/10 text-success border-success/20'
                          : m.sentiment === 'bearish'
                          ? 'bg-danger/10 text-danger border-danger/20'
                          : 'bg-secondary text-muted-foreground border-border'
                      )}
                    >
                      {m.symbol}
                      {m.sentiment === 'bullish' && <TrendingUp className="w-2.5 h-2.5" />}
                      {m.sentiment === 'bearish' && <TrendingDown className="w-2.5 h-2.5" />}
                      <span className="text-muted-foreground">{timeAgo(m.time)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bullish Bias bar */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>Bearish</span>
                <span>Bias: {inf.bullishBias}% bullish</span>
                <span>Bullish</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary">
                <div
                  className="bg-danger h-full"
                  style={{ width: `${100 - inf.bullishBias}%` }}
                />
                <div
                  className="bg-success h-full"
                  style={{ width: `${inf.bullishBias}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InfluencerTracker;
