import React, { useEffect, useState } from 'react';
import { Users, Star, TrendingUp, TrendingDown, Shield, X, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/auth';

interface LeadTrader {
  id: string;
  displayName: string;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  totalTrades: number;
  copiers: number;
  riskScore: number;
  badge: 'bronze' | 'silver' | 'gold' | 'platinum';
  monthsProfitable: number;
  avgTradeReturn: number;
  bio: string;
}

interface ActiveCopy {
  id: string;
  leaderId: string;
  allocation: number;
  startedAt: string;
  currentPnl: number;
  leaderName: string;
  leaderBadge: string;
}

const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  bronze: { bg: 'bg-orange-900/30', text: 'text-orange-400', label: 'Bronze' },
  silver: { bg: 'bg-slate-700/40', text: 'text-slate-300', label: 'Silver' },
  gold: { bg: 'bg-amber-900/30', text: 'text-amber-400', label: 'Gold' },
  platinum: { bg: 'bg-cyan-900/30', text: 'text-cyan-300', label: 'Platinum' },
};

function getInitials(name: string): string {
  return name
    .split(/[\s_]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function avatarColor(name: string): string {
  const colors = [
    'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-rose-600',
    'bg-amber-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-pink-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

const CopyTrading: React.FC = () => {
  const [leaders, setLeaders] = useState<LeadTrader[]>([]);
  const [activeCopies, setActiveCopies] = useState<ActiveCopy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalLeader, setModalLeader] = useState<LeadTrader | null>(null);
  const [allocation, setAllocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);

  const fetchLeaders = async () => {
    try {
      const res = await fetch('/api/v1/copy/leaders');
      const json = await res.json();
      if (json.success) setLeaders(json.data);
    } catch {
      // ignore
    }
  };

  const fetchActiveCopies = async () => {
    if (!isAuthenticated || !token) return;
    try {
      const res = await fetch('/api/v1/copy/active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setActiveCopies(json.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchLeaders(), fetchActiveCopies()]);
      setLoading(false);
    };
    load();
  }, [isAuthenticated]);

  const handleFollow = async () => {
    if (!modalLeader || !allocation || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/copy/follow/${modalLeader.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ allocation: parseFloat(allocation) }),
      });
      const json = await res.json();
      if (json.success) {
        setModalLeader(null);
        setAllocation('');
        await Promise.all([fetchLeaders(), fetchActiveCopies()]);
      }
    } catch {
      // ignore
    }
    setSubmitting(false);
  };

  const handleStopCopy = async (leaderId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/copy/follow/${leaderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        await Promise.all([fetchLeaders(), fetchActiveCopies()]);
      }
    } catch {
      // ignore
    }
  };

  const isFollowing = (leaderId: string) =>
    activeCopies.some((c) => c.leaderId === leaderId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center animate-pulse">
          <span className="text-black font-bold text-sm">Q</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Data Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2 mb-4 flex items-center gap-2">
        <Info className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm text-muted-foreground">Demo mode — real copy trading coming soon</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Copy Trading</h1>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Past performance does not guarantee future results. Copy trading involves risk and may not be suitable for all investors. Only allocate funds you can afford to lose.
        </p>
      </div>

      {/* My Active Copies */}
      {isAuthenticated && activeCopies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">My Active Copies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCopies.map((copy) => {
              const badgeStyle = BADGE_STYLES[copy.leaderBadge] || BADGE_STYLES.bronze;
              return (
                <div
                  key={copy.id}
                  className="p-4 rounded-lg border border-border bg-card space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold',
                          avatarColor(copy.leaderName)
                        )}
                      >
                        {getInitials(copy.leaderName)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{copy.leaderName}</p>
                        <span
                          className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', badgeStyle.bg, badgeStyle.text)}
                        >
                          {badgeStyle.label}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStopCopy(copy.leaderId)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
                    >
                      Stop Copy
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Allocated</p>
                      <p className="text-foreground font-medium">${copy.allocation.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Current P&L</p>
                      <p
                        className={cn(
                          'font-medium',
                          copy.currentPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}
                      >
                        {copy.currentPnl >= 0 ? '+' : ''}${copy.currentPnl.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Since {new Date(copy.startedAt).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lead Traders */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Top Traders</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {leaders.map((leader) => {
            const badgeStyle = BADGE_STYLES[leader.badge];
            const following = isFollowing(leader.id);
            return (
              <div
                key={leader.id}
                className="p-5 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors space-y-4"
              >
                {/* Top row: avatar + name + badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm',
                        avatarColor(leader.displayName)
                      )}
                    >
                      {getInitials(leader.displayName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{leader.displayName}</p>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                            badgeStyle.bg,
                            badgeStyle.text
                          )}
                        >
                          {badgeStyle.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{leader.bio}</p>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                    <p className="text-sm font-semibold text-foreground">{leader.winRate}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total Return</p>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        leader.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {leader.totalReturn >= 0 ? '+' : ''}
                      {leader.totalReturn}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Max DD</p>
                    <p className="text-sm font-semibold text-red-400">-{leader.maxDrawdown}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Copiers</p>
                    <p className="text-sm font-semibold text-foreground">{leader.copiers}</p>
                  </div>
                </div>

                {/* Risk score bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Risk Score
                    </span>
                    <span className="text-xs font-medium text-foreground">{leader.riskScore}/5</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        leader.riskScore <= 2
                          ? 'bg-emerald-500'
                          : leader.riskScore <= 3
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      )}
                      style={{ width: `${(leader.riskScore / 5) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Extra stats row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{leader.totalTrades.toLocaleString()} trades</span>
                  <span>{leader.monthsProfitable} months profitable</span>
                  <span>Avg {leader.avgTradeReturn}%/trade</span>
                </div>

                {/* Copy button */}
                <div className="pt-1">
                  {following ? (
                    <button
                      onClick={() => handleStopCopy(leader.id)}
                      className="w-full py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
                    >
                      Stop Copying
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (!isAuthenticated) return;
                        setModalLeader(leader);
                      }}
                      className={cn(
                        'w-full py-2 rounded-lg text-sm font-medium transition-colors',
                        isAuthenticated
                          ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                          : 'bg-secondary text-muted-foreground cursor-not-allowed'
                      )}
                    >
                      {isAuthenticated ? 'Copy Trader' : 'Login to Copy'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Copy Modal */}
      {modalLeader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Copy {modalLeader.displayName}
              </h3>
              <button
                onClick={() => {
                  setModalLeader(null);
                  setAllocation('');
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-secondary">
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="font-semibold text-foreground">{modalLeader.winRate}%</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <p className="text-xs text-muted-foreground">Total Return</p>
                <p
                  className={cn(
                    'font-semibold',
                    modalLeader.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {modalLeader.totalReturn >= 0 ? '+' : ''}
                  {modalLeader.totalReturn}%
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Allocation Amount (USD)
              </label>
              <input
                type="number"
                min="10"
                step="10"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                placeholder="e.g. 500"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>Past performance does not guarantee future results.</span>
            </div>

            <button
              onClick={handleFollow}
              disabled={submitting || !allocation || parseFloat(allocation) <= 0}
              className={cn(
                'w-full py-2.5 rounded-lg text-sm font-semibold transition-colors',
                submitting || !allocation || parseFloat(allocation) <= 0
                  ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {submitting ? 'Starting...' : 'Start Copying'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CopyTrading;
