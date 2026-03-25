import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useMarketStore } from '@/stores/market';
import { useToastStore } from '@/stores/toast';

const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

export const WatchlistStrip: React.FC = () => {
  const navigate = useNavigate();
  const { tickers, setSelectedPair } = useMarketStore();
  const addToast = useToastStore((s) => s.addToast);

  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [alertPrice, setAlertPrice] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClick = (symbol: string) => {
    setSelectedPair(symbol);
    navigate(`/chart/${symbol}`);
  };

  const handleBellClick = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    if (activeAlert === symbol) {
      setActiveAlert(null);
      return;
    }
    const ticker = tickers.get(symbol);
    const price = ticker?.price ?? 0;
    setAlertPrice(Math.round(price).toString());
    setActiveAlert(symbol);
  };

  const handleCreateAlert = async (symbol: string, type: 'price_above' | 'price_below') => {
    const value = parseFloat(alertPrice);
    if (isNaN(value) || value <= 0) {
      addToast('Please enter a valid price', 'danger');
      return;
    }

    const base = symbol.replace('USDT', '');
    const label = type === 'price_above' ? 'above' : 'below';
    const name = `${base} ${label} $${value.toLocaleString()}`;

    try {
      const token = getToken();
      const res = await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          conditions: { type, symbol, value },
          channels: ['push'],
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      addToast(`Alert created: ${name}`, 'success');
    } catch {
      addToast('Failed to create alert', 'danger');
    }

    setActiveAlert(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!activeAlert) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveAlert(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeAlert]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {DEFAULT_WATCHLIST.map((symbol) => {
        const ticker = tickers.get(symbol);
        const changePercent = ticker?.change24h ?? 0;
        const isPositive = changePercent >= 0;
        const isAlertOpen = activeAlert === symbol;

        return (
          <div key={symbol} className="relative flex-shrink-0">
            <button
              onClick={() => handleClick(symbol)}
              className="relative bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/50 hover:shadow-gold-sm transition-all duration-200 min-w-[120px] sm:min-w-[140px]"
            >
              {/* Bell icon */}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => handleBellClick(e, symbol)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleBellClick(e as unknown as React.MouseEvent, symbol);
                  }
                }}
                className={cn(
                  'absolute top-1.5 right-1.5 p-1 rounded-md transition-colors',
                  isAlertOpen
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                )}
              >
                <Bell className="w-3.5 h-3.5" />
              </span>

              <div className="text-sm font-semibold text-foreground">
                {symbol.replace('USDT', '')}
                <span className="text-muted-foreground font-normal">/USDT</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-foreground text-sm font-mono">
                  ${ticker?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '--'}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium',
                    isPositive ? 'text-success' : 'text-danger'
                  )}
                >
                  {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                </span>
              </div>
            </button>

            {/* Quick alert dropdown */}
            {isAlertOpen && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 mt-1 z-10 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[200px] max-w-[calc(100vw-2rem)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs text-muted-foreground mb-2">
                  Current: <span className="text-foreground font-mono">${ticker?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '--'}</span>
                </div>
                <input
                  type="number"
                  value={alertPrice}
                  onChange={(e) => setAlertPrice(e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm text-foreground font-mono focus:outline-none focus:border-primary mb-2"
                  placeholder="Target price"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCreateAlert(symbol, 'price_above')}
                    className="flex-1 text-xs font-medium py-1.5 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors"
                  >
                    Alert Above
                  </button>
                  <button
                    onClick={() => handleCreateAlert(symbol, 'price_below')}
                    className="flex-1 text-xs font-medium py-1.5 rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                  >
                    Alert Below
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
