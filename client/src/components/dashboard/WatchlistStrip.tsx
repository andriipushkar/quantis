import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { useMarketStore } from '@/stores/market';

const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];

export const WatchlistStrip: React.FC = () => {
  const navigate = useNavigate();
  const { tickers, setSelectedPair } = useMarketStore();

  const handleClick = (symbol: string) => {
    setSelectedPair(symbol);
    navigate(`/chart/${symbol}`);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {DEFAULT_WATCHLIST.map((symbol) => {
        const ticker = tickers.get(symbol);
        const changePercent = ticker?.change24h ?? 0;
        const isPositive = changePercent >= 0;

        return (
          <button
            key={symbol}
            onClick={() => handleClick(symbol)}
            className="flex-shrink-0 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/50 hover:shadow-gold-sm transition-all duration-200 min-w-[140px]"
          >
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
        );
      })}
    </div>
  );
};
