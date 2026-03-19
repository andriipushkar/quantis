import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import type { Signal } from '@/services/api';

interface SignalCardProps {
  signal: Signal;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal }) => {
  const navigate = useNavigate();
  const isBuy = signal.type === 'buy';

  const formatPrice = (price: number) =>
    price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });

  const calcPercent = (target: number) => {
    const pct = ((target - signal.entry_price) / signal.entry_price) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className={cn('h-1', isBuy ? 'bg-success' : 'bg-danger')} />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2 py-0.5 rounded text-xs font-semibold',
              isBuy ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
            )}>
              {signal.type.toUpperCase()}
            </span>
            <span className="text-foreground font-semibold text-sm">{signal.pair}</span>
          </div>
          <span className="text-xs font-mono text-foreground">{signal.confidence}%</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between bg-secondary/50 rounded-lg px-3 py-2">
            <span className="text-muted-foreground">Entry</span>
            <span className="text-foreground font-mono">${formatPrice(signal.entry_price)}</span>
          </div>
          <div className="flex justify-between bg-secondary/50 rounded-lg px-3 py-2">
            <span className="text-danger">SL</span>
            <span className="text-foreground font-mono">
              ${formatPrice(signal.stop_loss)}
              <span className="text-danger ml-1">{calcPercent(signal.stop_loss)}</span>
            </span>
          </div>
          <div className="flex justify-between bg-secondary/50 rounded-lg px-3 py-2">
            <span className="text-success">TP1</span>
            <span className="text-foreground font-mono">${formatPrice(signal.tp1)}</span>
          </div>
          <div className="flex justify-between bg-secondary/50 rounded-lg px-3 py-2">
            <span className="text-success">TP2</span>
            <span className="text-foreground font-mono">${formatPrice(signal.tp2)}</span>
          </div>
        </div>

        <button
          onClick={() => navigate(`/chart/${signal.pair}`)}
          className="w-full text-center text-xs text-primary hover:text-primary/80 transition-colors py-1"
        >
          Open Chart
        </button>
      </div>
    </div>
  );
};
