import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Layers, Megaphone, ArrowUpRight, ArrowDownRight, Minus, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { getNarratives, type NarrativeData } from '@/services/api';
import { cn } from '@/utils/cn';

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// Constants
// =============================================================================

const TABS = [
  { key: 'narratives', label: 'Narratives' },
  { key: 'influencer-tracker', label: 'Influencer Tracker' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// =============================================================================
// Helpers
// =============================================================================

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'rising':
      return <ArrowUpRight className="w-4 h-4 text-green-400" />;
    case 'falling':
      return <ArrowDownRight className="w-4 h-4 text-red-400" />;
    default:
      return <Minus className="w-4 h-4 text-muted-foreground" />;
  }
}

function narrativeScoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  if (score >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function narrativeScoreBg(score: number): string {
  if (score >= 70) return 'bg-green-500/10 border-green-500/20';
  if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/20';
  if (score >= 30) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

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

// =============================================================================
// Narratives Tab
// =============================================================================

const NarrativesTab: React.FC = () => {
  const [data, setData] = useState<NarrativeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getNarratives();
      setData(result);
      setLastChecked(new Date());
      setError(null);
    } catch {
      setError('Failed to fetch narrative data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Layers className="w-8 h-8 text-primary animate-pulse" />
          <span className="text-muted-foreground text-sm">Loading narratives...</span>
        </div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-center">
          <Layers className="w-8 h-8 text-danger" />
          <span className="text-muted-foreground text-sm">{error}</span>
          <button
            onClick={fetchData}
            className="mt-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Last checked */}
      {lastChecked && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>Updated: {lastChecked.toLocaleTimeString()}</span>
        </div>
      )}

      {/* Sector Rotation Note */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Sector Rotation</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Narrative tracking helps identify which crypto sectors are gaining momentum. Capital tends to rotate
              between sectors — when one narrative cools off, funds often flow into emerging themes. Use this to
              spot early rotation signals and position ahead of sector momentum.
            </p>
          </div>
        </div>
      </div>

      {/* Narrative Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((narrative) => (
          <div
            key={narrative.name}
            className={cn(
              'bg-card border rounded-xl p-5 transition-all duration-200 hover:shadow-lg',
              narrativeScoreBg(narrative.score)
            )}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">{narrative.name}</h3>
                <TrendIcon trend={narrative.trend} />
              </div>
              <div className={cn(
                'px-3 py-1 rounded-full text-sm font-bold',
                narrativeScoreColor(narrative.score)
              )}>
                {narrative.score}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Avg Change</p>
                <p className={cn(
                  'text-sm font-semibold font-mono',
                  narrative.avgChange > 0 ? 'text-green-400' : narrative.avgChange < 0 ? 'text-red-400' : 'text-foreground'
                )}>
                  {narrative.avgChange > 0 ? '+' : ''}{narrative.avgChange.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Volume</p>
                <p className="text-sm font-semibold text-foreground">{formatVolume(narrative.avgVolume)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg RSI</p>
                <p className={cn(
                  'text-sm font-semibold font-mono',
                  narrative.avgRsi > 70 ? 'text-red-400' : narrative.avgRsi < 30 ? 'text-green-400' : 'text-foreground'
                )}>
                  {narrative.avgRsi.toFixed(1)}
                </p>
              </div>
            </div>

            {/* Token List */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Tokens</p>
              {narrative.tokens.map((token) => (
                <div
                  key={token.symbol}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-secondary/30"
                >
                  <span className="text-sm font-medium text-foreground">
                    {token.symbol.replace('USDT', '')}
                  </span>
                  <span className={cn(
                    'text-xs font-mono font-semibold',
                    token.change24h > 0 ? 'text-green-400' : token.change24h < 0 ? 'text-red-400' : 'text-muted-foreground'
                  )}>
                    {token.change24h > 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                  </span>
                </div>
              ))}
              {narrative.tokens.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No ticker data available</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">No narrative data available</p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Influencer Tracker Tab
// =============================================================================

const InfluencerTrackerTab: React.FC = () => {
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
      <div className="flex items-center justify-center h-64">
        <Megaphone className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

// =============================================================================
// Main Page
// =============================================================================

export default function SocialIntelligence() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('tab') as TabKey) || 'narratives';

  const setTab = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Social Intelligence</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/50 border border-border w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors border',
              activeTab === tab.key
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary border-transparent'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'narratives' && <NarrativesTab />}
      {activeTab === 'influencer-tracker' && <InfluencerTrackerTab />}
    </div>
  );
}
