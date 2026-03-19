import React, { useEffect, useState } from 'react';
import { GitCompare, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface CorrelationData {
  pairs: string[];
  matrix: number[][];
}

function getCellColor(value: number): string {
  if (value >= 0.9) return 'bg-red-600 text-white';
  if (value >= 0.7) return 'bg-red-500/80 text-white';
  if (value >= 0.5) return 'bg-red-400/60 text-foreground';
  if (value >= 0.3) return 'bg-red-300/40 text-foreground';
  if (value >= 0.1) return 'bg-red-200/20 text-foreground';
  if (value > -0.1) return 'bg-secondary text-muted-foreground';
  if (value > -0.3) return 'bg-blue-200/20 text-foreground';
  if (value > -0.5) return 'bg-blue-300/40 text-foreground';
  if (value > -0.7) return 'bg-blue-400/60 text-foreground';
  if (value > -0.9) return 'bg-blue-500/80 text-white';
  return 'bg-blue-600 text-white';
}

function stripQuote(symbol: string): string {
  return symbol.replace(/USDT$/, '');
}

const INTERPRETATION = [
  { range: '> 0.7', label: 'Strong Positive', color: 'bg-red-500' },
  { range: '0.3 to 0.7', label: 'Moderate Positive', color: 'bg-red-300/60' },
  { range: '-0.3 to 0.3', label: 'Weak / Neutral', color: 'bg-secondary' },
  { range: '-0.7 to -0.3', label: 'Moderate Inverse', color: 'bg-blue-300/60' },
  { range: '< -0.7', label: 'Strong Inverse', color: 'bg-blue-500' },
];

const Correlation: React.FC = () => {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/v1/market/correlation');
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || 'Failed to load correlation data');
        }
      } catch {
        setError('Failed to load correlation data');
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <GitCompare className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <GitCompare className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">{error || 'No data available'}</p>
      </div>
    );
  }

  const { pairs, matrix } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitCompare className="w-6 h-6 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Correlation Matrix</h1>
      </div>

      {/* Matrix Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full border-collapse min-w-max">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-medium text-muted-foreground border-b border-r border-border" />
              {pairs.map((pair) => (
                <th
                  key={pair}
                  className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border whitespace-nowrap"
                >
                  {stripQuote(pair)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pairs.map((rowPair, i) => (
              <tr key={rowPair}>
                <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-medium text-muted-foreground border-r border-border whitespace-nowrap">
                  {stripQuote(rowPair)}
                </td>
                {matrix[i].map((value, j) => {
                  const isDiagonal = i === j;
                  return (
                    <td
                      key={`${i}-${j}`}
                      className={cn(
                        'px-3 py-2 text-center text-xs font-mono cursor-default transition-all border border-border/30',
                        isDiagonal
                          ? 'bg-amber-500/30 text-amber-300 font-bold'
                          : getCellColor(value)
                      )}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                          text: `${stripQuote(rowPair)} / ${stripQuote(pairs[j])}: ${value.toFixed(4)}`,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {value.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-1.5 rounded-lg bg-popover border border-border text-xs text-foreground shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Info className="w-4 h-4 text-muted-foreground" />
          Color Scale & Interpretation
        </div>

        {/* Gradient bar */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground w-8 text-right">-1</span>
          <div className="flex-1 h-5 rounded-md overflow-hidden flex">
            <div className="flex-1 bg-blue-600" />
            <div className="flex-1 bg-blue-500/80" />
            <div className="flex-1 bg-blue-400/60" />
            <div className="flex-1 bg-blue-300/40" />
            <div className="flex-1 bg-blue-200/20" />
            <div className="flex-1 bg-secondary" />
            <div className="flex-1 bg-red-200/20" />
            <div className="flex-1 bg-red-300/40" />
            <div className="flex-1 bg-red-400/60" />
            <div className="flex-1 bg-red-500/80" />
            <div className="flex-1 bg-red-600" />
          </div>
          <span className="text-xs text-muted-foreground w-8">+1</span>
        </div>

        {/* Interpretation guide */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {INTERPRETATION.map((item) => (
            <div key={item.range} className="flex items-center gap-2">
              <div className={cn('w-4 h-4 rounded', item.color)} />
              <div className="text-xs">
                <span className="font-mono text-muted-foreground">{item.range}</span>
                <span className="text-foreground ml-1">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Correlation;
