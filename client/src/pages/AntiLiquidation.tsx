import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

async function paperRequest<T>(endpoint: string): Promise<T> {
  const token = getToken();
  const config: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  const res = await fetch(`/api/v1/paper${endpoint}`, config);
  return res.json();
}

interface PositionData {
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  amount: number;
  pnl: number;
  pnlPct: number;
  openedAt: string;
}

interface EnrichedPosition extends PositionData {
  leverage: number;
  liquidationPrice: number;
  distancePct: number;
}

function computeLiquidation(pos: PositionData): EnrichedPosition {
  // Simulate leverage (between 2x and 25x based on symbol hash)
  let h = 0;
  for (let i = 0; i < pos.symbol.length; i++) {
    h = ((h << 5) - h + pos.symbol.charCodeAt(i)) | 0;
  }
  const leverage = 2 + (Math.abs(h) % 24); // 2x to 25x

  // Liquidation price calculation:
  // For longs: liqPrice = entryPrice * (1 - 1/leverage)
  // For shorts: liqPrice = entryPrice * (1 + 1/leverage)
  const liqPrice = pos.side === 'buy'
    ? pos.entryPrice * (1 - 1 / leverage)
    : pos.entryPrice * (1 + 1 / leverage);

  const distancePct = pos.side === 'buy'
    ? ((pos.currentPrice - liqPrice) / pos.currentPrice) * 100
    : ((liqPrice - pos.currentPrice) / pos.currentPrice) * 100;

  return {
    ...pos,
    leverage,
    liquidationPrice: Math.round(liqPrice * 100) / 100,
    distancePct: Math.round(distancePct * 100) / 100,
  };
}

function getDistanceColor(pct: number): string {
  if (pct > 20) return 'text-green-400';
  if (pct > 10) return 'text-yellow-400';
  if (pct > 5) return 'text-orange-400';
  return 'text-red-400';
}

function getDistanceBg(pct: number): string {
  if (pct > 20) return 'bg-green-500';
  if (pct > 10) return 'bg-yellow-500';
  if (pct > 5) return 'bg-orange-500';
  return 'bg-red-500';
}

function getDistanceLabel(pct: number): string {
  if (pct > 20) return 'Safe';
  if (pct > 10) return 'Moderate';
  if (pct > 5) return 'Warning';
  return 'Danger';
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toFixed(2)}`;
  if (value >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

const AntiLiquidation: React.FC = () => {
  const [positions, setPositions] = useState<EnrichedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simPrice, setSimPrice] = useState(50); // slider 0-100 representing range
  const [simSymbol, setSimSymbol] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await paperRequest<{ success: boolean; data: PositionData[] }>('/positions');
      if (res.success && res.data) {
        const enriched = res.data.map(computeLiquidation);
        setPositions(enriched);
        if (enriched.length > 0 && !simSymbol) {
          setSimSymbol(enriched[0].symbol);
        }
      } else {
        setPositions([]);
      }
    } catch {
      setError('Failed to load positions. Make sure you are logged in.');
    }
    setLoading(false);
  }, [simSymbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // What-if simulator
  const selectedPosition = positions.find((p) => p.symbol === simSymbol);
  const simPriceRange = selectedPosition
    ? {
      min: selectedPosition.currentPrice * 0.7,
      max: selectedPosition.currentPrice * 1.3,
    }
    : { min: 0, max: 100 };
  const simulatedPrice = simPriceRange.min + (simPrice / 100) * (simPriceRange.max - simPriceRange.min);

  // Which positions would be liquidated at simulated price
  const liquidatedPositions = positions.filter((p) => {
    if (p.symbol !== simSymbol) return false;
    if (p.side === 'buy') return simulatedPrice <= p.liquidationPrice;
    return simulatedPrice >= p.liquidationPrice;
  });

  // Recommendations
  const dangerPositions = positions.filter((p) => p.distancePct < 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-muted-foreground text-sm">Loading positions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Anti-Liquidation Shield</h1>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Recommendations */}
      {dangerPositions.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-amber-400">Recommendations</span>
          </div>
          {dangerPositions.map((p) => (
            <p key={p.symbol + p.side} className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{p.symbol}</span> ({p.side === 'buy' ? 'Long' : 'Short'}) is only{' '}
              <span className="text-red-400 font-semibold">{p.distancePct.toFixed(1)}%</span> from liquidation.{' '}
              Consider reducing position size or adding margin.
            </p>
          ))}
        </div>
      )}

      {/* Position Cards */}
      {positions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No open positions. Open trades in Paper Trading to see liquidation analysis.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {positions.map((pos) => (
            <div key={pos.symbol + pos.side + pos.openedAt} className="rounded-xl border border-border bg-card p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{pos.symbol}</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-semibold',
                    pos.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  )}>
                    {pos.side === 'buy' ? 'LONG' : 'SHORT'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{pos.leverage}x</span>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Entry</p>
                  <p className="font-medium text-foreground">{formatPrice(pos.entryPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current</p>
                  <p className="font-medium text-foreground">{formatPrice(pos.currentPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Liquidation</p>
                  <p className="font-medium text-red-400">{formatPrice(pos.liquidationPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className={cn('font-bold', getDistanceColor(pos.distancePct))}>
                    {pos.distancePct.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Distance Gauge */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('text-xs font-semibold', getDistanceColor(pos.distancePct))}>
                    {getDistanceLabel(pos.distancePct)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', getDistanceBg(pos.distancePct))}
                    style={{ width: `${Math.min(100, pos.distancePct * 2.5)}%` }}
                  />
                </div>
              </div>

              {/* P&L */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">P&L</span>
                <span className={cn('font-semibold', pos.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)} ({pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* What-If Simulator */}
      {positions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-foreground">What-If Price Simulator</h2>
          <p className="text-sm text-muted-foreground">
            Drag the slider to simulate price movement and see which positions would be liquidated.
          </p>

          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground">Symbol:</label>
            <select
              value={simSymbol}
              onChange={(e) => { setSimSymbol(e.target.value); setSimPrice(50); }}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {[...new Set(positions.map((p) => p.symbol))].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {selectedPosition && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Simulated Price: <span className="font-bold text-foreground">{formatPrice(simulatedPrice)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Current: {formatPrice(selectedPosition.currentPrice)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={simPrice}
                  onChange={(e) => setSimPrice(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatPrice(simPriceRange.min)} (-30%)</span>
                  <span>{formatPrice(simPriceRange.max)} (+30%)</span>
                </div>
              </div>

              {liquidatedPositions.length > 0 ? (
                <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                  <p className="text-sm font-semibold text-red-400">
                    {liquidatedPositions.length} position(s) would be LIQUIDATED at {formatPrice(simulatedPrice)}
                  </p>
                  {liquidatedPositions.map((p) => (
                    <p key={p.symbol + p.side} className="text-xs text-muted-foreground mt-1">
                      {p.symbol} {p.side === 'buy' ? 'Long' : 'Short'} @ {formatPrice(p.entryPrice)} (Liq: {formatPrice(p.liquidationPrice)})
                    </p>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                  <p className="text-sm font-semibold text-green-400">
                    All positions safe at {formatPrice(simulatedPrice)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AntiLiquidation;
