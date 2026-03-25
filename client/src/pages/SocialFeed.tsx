import React, { useEffect, useState } from 'react';
import { MessageSquare, Heart, TrendingUp, TrendingDown, Minus, Send } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/auth';
import { useNavigate } from 'react-router-dom';

interface Post {
  id: string;
  userId: string;
  userName: string;
  type: 'trade_idea' | 'analysis' | 'comment';
  content: string;
  symbol?: string;
  direction?: 'bullish' | 'bearish' | 'neutral';
  likeCount: number;
  createdAt: string;
}

interface TrendingSymbol {
  symbol: string;
  mentions: number;
}

const POST_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  trade_idea: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Trade Idea' },
  analysis: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Analysis' },
  comment: { bg: 'bg-slate-500/10', text: 'text-slate-400', label: 'Comment' },
};

const DIRECTION_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  bullish: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: TrendingUp, label: 'Bullish' },
  bearish: { bg: 'bg-red-500/10', text: 'text-red-400', icon: TrendingDown, label: 'Bearish' },
  neutral: { bg: 'bg-slate-500/10', text: 'text-slate-400', icon: Minus, label: 'Neutral' },
};

const POPULAR_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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

const SocialFeed: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [trending, setTrending] = useState<TrendingSymbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<'trade_idea' | 'analysis' | 'comment'>('comment');
  const [newSymbol, setNewSymbol] = useState('');
  const [newDirection, setNewDirection] = useState<'bullish' | 'bearish' | 'neutral' | ''>('');
  const [posting, setPosting] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  const fetchFeed = async () => {
    try {
      const res = await fetch('/api/v1/social/feed');
      const json = await res.json();
      if (json.success) setPosts(json.data);
    } catch {
      // ignore
    }
  };

  const fetchTrending = async () => {
    try {
      const res = await fetch('/api/v1/social/trending');
      const json = await res.json();
      if (json.success) setTrending(json.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchFeed(), fetchTrending()]);
      setLoading(false);
    };
    load();
  }, []);

  const handlePost = async () => {
    if (!newContent.trim() || !token) return;
    setPosting(true);
    try {
      const body: Record<string, string> = { type: newType, content: newContent.trim() };
      if (newSymbol) body.symbol = newSymbol;
      if (newDirection) body.direction = newDirection;

      const res = await fetch('/api/v1/social/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setNewContent('');
        setNewSymbol('');
        setNewDirection('');
        await Promise.all([fetchFeed(), fetchTrending()]);
      }
    } catch {
      // ignore
    }
    setPosting(false);
  };

  const handleLike = async (postId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/social/post/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, likeCount: json.data?.likeCount ?? p.likeCount } : p
          )
        );
      }
    } catch {
      // ignore
    }
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
        <MessageSquare className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Social Feed</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main feed column */}
        <div className="space-y-4">
          {/* Post Creation */}
          {isAuthenticated && (
            <div className="p-4 rounded-lg border border-border bg-card space-y-3">
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Share your analysis, trade idea, or thoughts..."
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />

              <div className="flex flex-wrap items-center gap-2">
                {/* Type selector */}
                <div className="flex gap-1">
                  {(['trade_idea', 'analysis', 'comment'] as const).map((type) => {
                    const style = POST_TYPE_STYLES[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setNewType(type)}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full font-medium transition-colors',
                          newType === type
                            ? `${style.bg} ${style.text} ring-1 ring-current`
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {style.label}
                      </button>
                    );
                  })}
                </div>

                {/* Symbol dropdown */}
                <select
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-border bg-background text-foreground focus:outline-none"
                >
                  <option value="">No symbol</option>
                  {POPULAR_SYMBOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {/* Direction pills */}
                <div className="flex gap-1">
                  {(['bullish', 'bearish', 'neutral'] as const).map((dir) => {
                    const style = DIRECTION_STYLES[dir];
                    return (
                      <button
                        key={dir}
                        onClick={() => setNewDirection(newDirection === dir ? '' : dir)}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full font-medium transition-colors',
                          newDirection === dir
                            ? `${style.bg} ${style.text} ring-1 ring-current`
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {style.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1" />

                <button
                  onClick={handlePost}
                  disabled={posting || !newContent.trim()}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                    posting || !newContent.trim()
                      ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  <Send className="w-3.5 h-3.5" />
                  Post
                </button>
              </div>
            </div>
          )}

          {/* Feed Posts */}
          {posts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No posts yet. Be the first to share!
            </div>
          ) : (
            posts.map((post) => {
              const typeStyle = POST_TYPE_STYLES[post.type];
              const dirStyle = post.direction ? DIRECTION_STYLES[post.direction] : null;

              return (
                <div
                  key={post.id}
                  className="p-4 rounded-lg border border-border bg-card space-y-3 hover:border-border/80 transition-colors"
                >
                  {/* User row */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold',
                        avatarColor(post.userName)
                      )}
                    >
                      {getInitials(post.userName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{post.userName}</p>
                        <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                            typeStyle.bg,
                            typeStyle.text
                          )}
                        >
                          {typeStyle.label}
                        </span>
                        {dirStyle && (
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5',
                              dirStyle.bg,
                              dirStyle.text
                            )}
                          >
                            <dirStyle.icon className="w-2.5 h-2.5" />
                            {dirStyle.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>

                  {/* Footer: symbol tag + like */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {post.symbol && (
                        <button
                          onClick={() => navigate(`/chart/${post.symbol}`)}
                          className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                        >
                          {post.symbol}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleLike(post.id)}
                      disabled={!isAuthenticated}
                      className={cn(
                        'flex items-center gap-1 text-xs transition-colors',
                        isAuthenticated
                          ? 'text-muted-foreground hover:text-red-400'
                          : 'text-muted-foreground cursor-not-allowed'
                      )}
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>{post.likeCount}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Trending sidebar */}
        <div className="space-y-3">
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Trending Symbols
            </h3>
            {trending.length === 0 ? (
              <p className="text-xs text-muted-foreground">No trending data yet.</p>
            ) : (
              <div className="space-y-2">
                {trending.map((item, idx) => (
                  <button
                    key={item.symbol}
                    onClick={() => navigate(`/chart/${item.symbol}`)}
                    className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono w-4">{idx + 1}</span>
                      <span className="text-sm font-medium text-foreground">{item.symbol}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.mentions} mention{item.mentions !== 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialFeed;
