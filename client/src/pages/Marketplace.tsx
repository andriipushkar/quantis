import React, { useEffect, useState } from 'react';
import { Store, Star, Users, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/auth';

interface Strategy {
  id: string;
  name: string;
  description: string;
  creator: string;
  type: string;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  followers: number;
  rating: number;
  ratingCount: number;
  price: number | 'free';
  timeframe: string;
  pairs: string[];
  createdAt: string;
}

const TYPE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  trend: { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'Trend' },
  mean_reversion: { bg: 'bg-purple-900/30', text: 'text-purple-400', label: 'Mean Reversion' },
  breakout: { bg: 'bg-amber-900/30', text: 'text-amber-400', label: 'Breakout' },
  scalp: { bg: 'bg-emerald-900/30', text: 'text-emerald-400', label: 'Scalp' },
};

function renderStars(rating: number): React.ReactNode {
  const stars: React.ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={cn(
          'w-3.5 h-3.5',
          i <= Math.round(rating) ? 'text-primary fill-primary' : 'text-muted-foreground/30'
        )}
      />
    );
  }
  return <span className="flex items-center gap-0.5">{stars}</span>;
}

const Marketplace: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [showPublish, setShowPublish] = useState(false);
  const [publishForm, setPublishForm] = useState({ name: '', description: '', type: 'trend', timeframe: '4H', pairs: '' });
  const [publishing, setPublishing] = useState(false);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);

  const fetchStrategies = async () => {
    try {
      const params = new URLSearchParams({ sort: sortBy });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`/api/v1/marketplace?${params}`);
      const json = await res.json();
      if (json.success) setStrategies(json.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchStrategies();
      setLoading(false);
    };
    load();
  }, [typeFilter, sortBy]);

  const handleFollow = async (id: string) => {
    if (!isAuthenticated || !token) return;
    try {
      const res = await fetch(`/api/v1/marketplace/${id}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setFollowedIds((prev) => {
          const next = new Set(prev);
          if (json.data.followed) next.add(id);
          else next.delete(id);
          return next;
        });
        await fetchStrategies();
      }
    } catch {
      // ignore
    }
  };

  const handlePublish = async () => {
    if (!token || !publishForm.name || !publishForm.description) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/v1/marketplace/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...publishForm,
          pairs: publishForm.pairs.split(',').map((p) => p.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPublishForm({ name: '', description: '', type: 'trend', timeframe: '4H', pairs: '' });
        setShowPublish(false);
        await fetchStrategies();
      }
    } catch {
      // ignore
    }
    setPublishing(false);
  };

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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Store className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Strategy Marketplace</h1>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Types</option>
            <option value="trend">Trend</option>
            <option value="mean_reversion">Mean Reversion</option>
            <option value="breakout">Breakout</option>
            <option value="scalp">Scalp</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="rating">Sort by Rating</option>
            <option value="return">Sort by Return</option>
            <option value="followers">Sort by Followers</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        <span className="text-sm text-muted-foreground ml-auto">
          {strategies.length} strategies
        </span>
      </div>

      {/* Strategy Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {strategies.map((s) => {
          const badge = TYPE_BADGES[s.type] || TYPE_BADGES.trend;
          const isFollowing = followedIds.has(s.id);

          return (
            <div
              key={s.id}
              className="p-5 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors space-y-4"
            >
              {/* Top: Name + Type badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-foreground truncate">{s.name}</h3>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap', badge.bg, badge.text)}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">by {s.creator}</p>
                </div>
                {/* Price badge */}
                <div className="flex-shrink-0">
                  {s.price === 'free' || s.price === 0 ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 font-semibold">
                      Free
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                      ${s.price}/mo
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {s.description}
              </p>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="text-sm font-semibold text-foreground">{s.winRate}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Return</p>
                  <p className={cn('text-sm font-semibold', s.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {s.totalReturn >= 0 ? '+' : ''}{s.totalReturn}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Max DD</p>
                  <p className="text-sm font-semibold text-red-400">-{s.maxDrawdown}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Sharpe</p>
                  <p className="text-sm font-semibold text-foreground">{s.sharpeRatio}</p>
                </div>
              </div>

              {/* Rating + Followers + Timeframe row */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {renderStars(s.rating)}
                  <span className="text-muted-foreground">({s.ratingCount})</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{s.followers.toLocaleString()} followers</span>
                </div>
                <span className="text-muted-foreground">{s.timeframe}</span>
              </div>

              {/* Pairs */}
              <div className="flex flex-wrap gap-1.5">
                {s.pairs.map((pair) => (
                  <span
                    key={pair}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium"
                  >
                    {pair}
                  </span>
                ))}
              </div>

              {/* Follow Button */}
              <button
                onClick={() => handleFollow(s.id)}
                className={cn(
                  'w-full py-2 rounded-lg text-sm font-medium transition-colors',
                  isAuthenticated
                    ? isFollowing
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                    : 'bg-secondary text-muted-foreground cursor-not-allowed'
                )}
              >
                {isAuthenticated
                  ? isFollowing
                    ? 'Unfollow'
                    : 'Follow Strategy'
                  : 'Login to Follow'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Publish Strategy Section */}
      {isAuthenticated && (
        <div className="border border-border rounded-lg bg-card">
          <button
            onClick={() => setShowPublish(!showPublish)}
            className="w-full flex items-center gap-2 p-4 text-left"
          >
            <Plus className="w-5 h-5 text-primary" />
            <span className="text-base font-semibold text-foreground">Publish Your Strategy</span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground ml-auto transition-transform',
                showPublish && 'rotate-180'
              )}
            />
          </button>

          {showPublish && (
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Strategy Name</label>
                <input
                  type="text"
                  value={publishForm.name}
                  onChange={(e) => setPublishForm({ ...publishForm, name: e.target.value })}
                  placeholder="e.g. Golden Cross Momentum"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                <textarea
                  value={publishForm.description}
                  onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                  placeholder="Describe your strategy's logic, ideal market conditions, risk management..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Type</label>
                  <select
                    value={publishForm.type}
                    onChange={(e) => setPublishForm({ ...publishForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="trend">Trend</option>
                    <option value="mean_reversion">Mean Reversion</option>
                    <option value="breakout">Breakout</option>
                    <option value="scalp">Scalp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Timeframe</label>
                  <input
                    type="text"
                    value={publishForm.timeframe}
                    onChange={(e) => setPublishForm({ ...publishForm, timeframe: e.target.value })}
                    placeholder="e.g. 4H, 1D"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Pairs (comma separated)</label>
                  <input
                    type="text"
                    value={publishForm.pairs}
                    onChange={(e) => setPublishForm({ ...publishForm, pairs: e.target.value })}
                    placeholder="BTCUSDT, ETHUSDT"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <button
                onClick={handlePublish}
                disabled={publishing || !publishForm.name || !publishForm.description}
                className={cn(
                  'px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                  publishing || !publishForm.name || !publishForm.description
                    ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {publishing ? 'Publishing...' : 'Publish Strategy'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
