import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, TrendingUp, Zap, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useMarketStore } from '@/stores/market';
import { ALL_NAV_ITEMS } from '@/config/navigation';

interface SearchResult {
  id: string;
  name: string;
  type: 'pair' | 'page' | 'action';
  icon: React.ElementType;
  route: string;
}

// Label key → readable name mapping (English fallback for search)
const LABEL_NAMES: Record<string, string> = {
  'nav.dashboard': 'Dashboard',
  'nav.chart': 'Chart',
  'nav.multiChart': 'Multi-Chart',
  'nav.screener': 'Screener',
  'nav.signals': 'Signals',
  'nav.heatmap': 'Heatmap',
  'nav.correlation': 'Correlation',
  'nav.regime': 'Market Regime Scoring',
  'nav.seasonality': 'Seasonality',
  'nav.marketBreadth': 'Market Breadth',
  'nav.confluence': 'Confluence Map',
  'nav.patternScanner': 'Pattern Scanner',
  'nav.elliottWave': 'Elliott Wave',
  'nav.harmonicPatterns': 'Harmonic Patterns',
  'nav.wyckoff': 'Wyckoff Phase',
  'nav.orderFlow': 'Order Flow',
  'nav.marketProfile': 'Market Profile',
  'nav.intermarket': 'Intermarket',
  'nav.tokenScanner': 'Token Scanner',
  'nav.openInterest': 'Open Interest',
  'nav.fundingRates': 'Funding Rates',
  'nav.whaleAlert': 'Whale Alert',
  'nav.liquidations': 'Liquidations',
  'nav.exchangeHealth': 'Exchange Health',
  'nav.defi': 'DeFi',
  'nav.networkMetrics': 'Network Metrics',
  'nav.tokenomics': 'Tokenomics',
  'nav.renko': 'Renko Chart',
  'nav.btcModels': 'BTC Models',
  'nav.paperTrading': 'Paper Trading',
  'nav.dcaBot': 'DCA Bot',
  'nav.copyTrading': 'Copy Trading',
  'nav.chartReplay': 'Chart Replay',
  'nav.copilot': 'AI Copilot',
  'nav.scriptEditor': 'Script Editor',
  'nav.indicatorLibrary': 'Indicator Library',
  'nav.options': 'Options',
  'nav.portfolio': 'Portfolio',
  'nav.journal': 'Journal',
  'nav.alerts': 'Alerts',
  'nav.taxReport': 'Tax Report',
  'nav.walletTracker': 'Wallet Tracker',
  'nav.profile': 'Profile',
  'nav.settings': 'Settings',
  'nav.social': 'Social Feed',
  'nav.leaderboard': 'Leaderboard',
  'nav.marketplace': 'Marketplace',
  'nav.news': 'News',
  'nav.influencerTracker': 'Influencer Tracker',
  'nav.academy': 'Academy',
};

// Build PAGES from the shared navigation config so every page is searchable
const PAGES: SearchResult[] = ALL_NAV_ITEMS.map((item) => ({
  id: `page-${item.path.replace(/\//g, '-').replace(/^-/, '')}`,
  name: LABEL_NAMES[item.labelKey] ?? item.labelKey.replace('nav.', ''),
  type: 'page' as const,
  icon: item.icon,
  route: item.path,
}));

const ACTIONS: SearchResult[] = [
  { id: 'action-create-alert', name: 'Create Alert', type: 'action', icon: Zap, route: '/alerts' },
  { id: 'action-open-chart', name: 'Open Chart', type: 'action', icon: Zap, route: '/chart' },
  { id: 'action-paper-trade', name: 'Paper Trade', type: 'action', icon: Zap, route: '/paper-trading' },
  { id: 'action-screener', name: 'Run Screener', type: 'action', icon: Zap, route: '/screener' },
  { id: 'action-copilot', name: 'Ask AI Copilot', type: 'action', icon: Zap, route: '/copilot' },
  { id: 'action-new-journal', name: 'New Journal Entry', type: 'action', icon: Zap, route: '/journal' },
  { id: 'action-settings', name: 'Open Settings', type: 'action', icon: Zap, route: '/settings' },
];

const RECENT_STORAGE_KEY = 'quantis-recent-searches';
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(terms: string[]) {
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(terms.slice(0, MAX_RECENT)));
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  pair: { label: 'Pair', className: 'bg-primary/15 text-primary' },
  page: { label: 'Page', className: 'bg-blue-500/15 text-blue-400' },
  action: { label: 'Action', className: 'bg-emerald-500/15 text-emerald-400' },
};

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const tickers = useMarketStore((s) => s.tickers);

  // Build pair results from market store
  const pairResults = useMemo((): SearchResult[] => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const pairs: SearchResult[] = [];
    for (const symbol of tickers.keys()) {
      if (symbol.toLowerCase().includes(q)) {
        pairs.push({
          id: `pair-${symbol}`,
          name: symbol.replace('USDT', '/USDT'),
          type: 'pair',
          icon: TrendingUp,
          route: `/chart/${symbol}`,
        });
      }
      if (pairs.length >= 8) break;
    }
    return pairs;
  }, [query, tickers]);

  const results = useMemo((): SearchResult[] => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const pageResults = PAGES.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
    const actionResults = ACTIONS.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 4);
    return [...pairResults, ...pageResults, ...actionResults];
  }, [query, pairResults]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [results.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      const term = query.trim();
      if (term) {
        const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, MAX_RECENT);
        setRecentSearches(updated);
        saveRecent(updated);
      }
      navigate(result.route);
      onClose();
    },
    [navigate, onClose, query, recentSearches]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[activeIndex]) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [results, activeIndex, selectResult, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pairs, pages, actions..."
            className="flex-1 bg-transparent text-foreground text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-muted-foreground bg-secondary rounded border border-border font-mono">
            ESC
          </kbd>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {query.trim() === '' ? (
            // Show recent searches
            recentSearches.length > 0 ? (
              <div className="px-3 py-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">
                  Recent Searches
                </span>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all mt-1"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {term}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Type to search pairs, pages, and actions
              </div>
            )
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          ) : (
            results.map((result, idx) => {
              const Icon = result.icon;
              const badge = TYPE_BADGE[result.type];
              return (
                <button
                  key={result.id}
                  data-active={idx === activeIndex}
                  onClick={() => selectResult(result)}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-all',
                    idx === activeIndex
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{result.name}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', badge.className)}>
                    {badge.label}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="px-1 py-0.5 bg-secondary border border-border rounded font-mono mr-1">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 bg-secondary border border-border rounded font-mono mr-1">↵</kbd> Select</span>
          <span><kbd className="px-1 py-0.5 bg-secondary border border-border rounded font-mono mr-1">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
};
