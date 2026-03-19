import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ExternalLink, Search, Filter } from 'lucide-react';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  category: 'market' | 'regulatory' | 'technology' | 'exchange' | 'defi';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  publishedAt: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  market: 'Market',
  regulatory: 'Regulatory',
  technology: 'Tech',
  exchange: 'Exchange',
  defi: 'DeFi',
};

const SENTIMENT_LABELS: Record<string, string> = {
  all: 'All',
  bullish: 'Bullish',
  bearish: 'Bearish',
  neutral: 'Neutral',
};

const SENTIMENT_STYLES: Record<string, string> = {
  bullish: 'bg-success/15 text-success border border-success/25',
  bearish: 'bg-danger/15 text-danger border border-danger/25',
  neutral: 'bg-muted text-muted-foreground border border-border',
};

const CATEGORY_STYLES: Record<string, string> = {
  market: 'bg-primary/15 text-primary border border-primary/25',
  regulatory: 'bg-warning/15 text-warning border border-warning/25',
  technology: 'bg-info/15 text-info border border-info/25',
  exchange: 'bg-accent/15 text-accent-foreground border border-accent/25',
  defi: 'bg-success/15 text-success border border-success/25',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const News: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sentiment, setSentiment] = useState('all');

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/news');
      if (!res.ok) throw new Error('Failed to fetch news');
      const json = await res.json();
      setNews(json.data ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60_000); // Poll every 5 minutes
    return () => clearInterval(interval);
  }, [fetchNews]);

  const filtered = useMemo(() => {
    let items = news;

    if (category !== 'all') {
      items = items.filter((n) => n.category === category);
    }

    if (sentiment !== 'all') {
      items = items.filter((n) => n.sentiment === sentiment);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          n.source.toLowerCase().includes(q)
      );
    }

    return items;
  }, [news, category, sentiment, search]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Crypto News</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stay up to date with the latest crypto market developments
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-xl p-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search news..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg bg-background border border-border text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Sentiment filter */}
        <select
          value={sentiment}
          onChange={(e) => setSentiment(e.target.value)}
          className="rounded-lg bg-background border border-border text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {Object.entries(SENTIMENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center animate-pulse">
              <span className="text-black font-bold text-lg">Q</span>
            </div>
            <span className="text-muted-foreground text-sm">Loading news...</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-danger text-sm">{error}</p>
            <button
              onClick={fetchNews}
              className="mt-3 text-primary text-sm hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground text-sm">No news articles match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-card border border-border rounded-xl p-5 transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 flex flex-col"
            >
              {/* Top row: badges */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
                    CATEGORY_STYLES[item.category] ?? 'bg-muted text-muted-foreground border border-border'
                  )}
                >
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
                    SENTIMENT_STYLES[item.sentiment]
                  )}
                >
                  {SENTIMENT_LABELS[item.sentiment]}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold text-foreground leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                {item.title}
              </h3>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-3 flex-1">
                {item.description}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="bg-secondary px-2 py-0.5 rounded font-medium text-foreground">
                    {item.source}
                  </span>
                  <span>{timeAgo(item.publishedAt)}</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default News;
