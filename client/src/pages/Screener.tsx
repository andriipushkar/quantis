import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getScreener, type ScreenerItem } from '@/services/api';
import { cn } from '@/utils/cn';

type SortKey = 'symbol' | 'exchange' | 'price' | 'change24h' | 'volume' | 'rsi';
type SortDir = 'asc' | 'desc';
type ExchangeFilter = 'all' | 'binance' | 'bybit';
type TrendFilter = 'all' | 'bullish' | 'bearish';
type ScanPreset = 'all' | 'oversold' | 'overbought' | 'volume_surge';

const Screener: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('all');
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('all');
  const [activeScan, setActiveScan] = useState<ScanPreset>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getScreener();
        setItems(data);
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
    const i = setInterval(fetchData, 10000);
    return () => clearInterval(i);
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const applyScan = (scan: ScanPreset) => {
    setActiveScan(scan);
    // Reset other filters when applying a scan
    if (scan === 'all') {
      setExchangeFilter('all');
      setTrendFilter('all');
    }
  };

  const filtered = useMemo(() => {
    let result = [...items];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.symbol.toLowerCase().includes(q));
    }

    // Exchange filter
    if (exchangeFilter !== 'all') {
      result = result.filter((t) => t.exchange === exchangeFilter);
    }

    // Trend filter
    if (trendFilter !== 'all') {
      result = result.filter((t) => t.trend === trendFilter);
    }

    // Scan presets
    switch (activeScan) {
      case 'oversold':
        result = result.filter((t) => t.rsi < 30);
        break;
      case 'overbought':
        result = result.filter((t) => t.rsi > 70);
        break;
      case 'volume_surge':
        // Top 25% by volume
        if (result.length > 0) {
          const sorted = [...result].sort((a, b) => b.volume - a.volume);
          const threshold = sorted[Math.floor(sorted.length * 0.25)]?.volume ?? 0;
          result = result.filter((t) => t.volume >= threshold);
        }
        break;
    }

    // Sort
    result.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    return result;
  }, [items, search, sortKey, sortDir, exchangeFilter, trendFilter, activeScan]);

  const SortHeader: React.FC<{ label: string; field: SortKey; className?: string }> = ({ label, field, className }) => (
    <button
      onClick={() => toggleSort(field)}
      className={cn(
        'flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors',
        sortKey === field ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  const getRsiColor = (rsi: number) => {
    if (rsi < 30) return 'text-success';
    if (rsi > 70) return 'text-danger';
    return 'text-muted-foreground';
  };

  const getRsiBarColor = (rsi: number) => {
    if (rsi < 30) return 'bg-success';
    if (rsi > 70) return 'bg-danger';
    return 'bg-warning';
  };

  const TrendBadge: React.FC<{ trend: ScreenerItem['trend'] }> = ({ trend }) => {
    switch (trend) {
      case 'bullish':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">
            <TrendingUp className="w-3 h-3" />
            Bullish
          </span>
        );
      case 'bearish':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger/15 text-danger">
            <TrendingDown className="w-3 h-3" />
            Bearish
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            <Minus className="w-3 h-3" />
            Neutral
          </span>
        );
    }
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-foreground">Screener</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search pair..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center flex-wrap gap-3">
        {/* Exchange filter */}
        <select
          value={exchangeFilter}
          onChange={(e) => setExchangeFilter(e.target.value as ExchangeFilter)}
          className="h-9 px-3 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Exchanges</option>
          <option value="binance">Binance</option>
          <option value="bybit">Bybit</option>
        </select>

        {/* Trend filter */}
        <select
          value={trendFilter}
          onChange={(e) => setTrendFilter(e.target.value as TrendFilter)}
          className="h-9 px-3 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Trends</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
        </select>

        {/* Divider */}
        <div className="w-px h-6 bg-border" />

        {/* Scan presets */}
        {([
          { key: 'all', label: 'All' },
          { key: 'oversold', label: 'Oversold (RSI<30)' },
          { key: 'overbought', label: 'Overbought (RSI>70)' },
          { key: 'volume_surge', label: 'Volume Surge' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => applyScan(key)}
            className={cn(
              'h-9 px-3 rounded-xl text-sm font-medium transition-colors',
              activeScan === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-ring'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 gap-4 px-5 py-3 border-b border-border">
          <SortHeader label="Pair" field="symbol" />
          <SortHeader label="Exchange" field="exchange" />
          <SortHeader label="Price" field="price" />
          <SortHeader label="24H%" field="change24h" />
          <SortHeader label="Volume" field="volume" />
          <SortHeader label="RSI" field="rsi" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trend</span>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((t) => (
            <button
              key={`${t.exchange}:${t.symbol}`}
              onClick={() => navigate(`/chart/${t.symbol}`)}
              className="grid grid-cols-7 gap-4 px-5 py-3 w-full text-left hover:bg-secondary/50 transition-colors"
            >
              {/* Pair */}
              <span className="text-sm font-semibold text-foreground">
                {t.symbol.replace('USDT', '/USDT')}
              </span>

              {/* Exchange */}
              <span className="text-sm text-muted-foreground capitalize">
                {t.exchange}
              </span>

              {/* Price */}
              <span className="text-sm font-mono text-foreground">
                ${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>

              {/* 24H% */}
              <span className={cn('text-sm font-mono font-medium', t.change24h >= 0 ? 'text-success' : 'text-danger')}>
                {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
              </span>

              {/* Volume */}
              <span className="text-sm font-mono text-muted-foreground">
                ${(t.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>

              {/* RSI with bar */}
              <div className="flex flex-col justify-center gap-1">
                <span className={cn('text-sm font-mono font-medium', getRsiColor(t.rsi))}>
                  {t.rsi.toFixed(1)}
                </span>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', getRsiBarColor(t.rsi))}
                    style={{ width: `${Math.min(100, Math.max(0, t.rsi))}%` }}
                  />
                </div>
              </div>

              {/* Trend badge */}
              <div className="flex items-center">
                <TrendBadge trend={t.trend} />
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">No results found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Screener;
