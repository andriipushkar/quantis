import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown, Activity } from 'lucide-react';
import { getTickers, type TickerData } from '@/services/api';
import { cn } from '@/utils/cn';

type SortKey = 'symbol' | 'price' | 'change24h' | 'volume';
type SortDir = 'asc' | 'desc';

const Screener: React.FC = () => {
  const navigate = useNavigate();
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTickers();
        setTickers(Object.values(data));
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
    const i = setInterval(fetchData, 5000);
    return () => clearInterval(i);
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let items = [...tickers];
    if (search) items = items.filter((t) => t.symbol.toLowerCase().includes(search.toLowerCase()));
    items.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return sortDir === 'asc' ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return items;
  }, [tickers, search, sortKey, sortDir]);

  const SortHeader: React.FC<{ label: string; field: SortKey }> = ({ label, field }) => (
    <button
      onClick={() => toggleSort(field)}
      className={cn(
        'flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors',
        sortKey === field ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Activity className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-border">
          <SortHeader label="Pair" field="symbol" />
          <SortHeader label="Price" field="price" />
          <SortHeader label="24h Change" field="change24h" />
          <SortHeader label="Volume" field="volume" />
        </div>

        <div className="divide-y divide-border">
          {filtered.map((t) => (
            <button
              key={t.symbol}
              onClick={() => navigate(`/chart/${t.symbol}`)}
              className="grid grid-cols-4 gap-4 px-5 py-3 w-full text-left hover:bg-secondary/50 transition-colors"
            >
              <span className="text-sm font-semibold text-foreground">
                {t.symbol.replace('USDT', '/USDT')}
              </span>
              <span className="text-sm font-mono text-foreground">
                ${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={cn('text-sm font-mono font-medium', t.change24h >= 0 ? 'text-success' : 'text-danger')}>
                {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
              </span>
              <span className="text-sm font-mono text-muted-foreground">
                ${(t.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
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
