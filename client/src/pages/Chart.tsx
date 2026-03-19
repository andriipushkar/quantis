import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { TradingChart, type TradingChartRef, type OHLCVData } from '@/components/charts/TradingChart';
import { useMarketStore, TIMEFRAMES } from '@/stores/market';
import { getOHLCV, getTickers, getPairs, type TradingPair } from '@/services/api';
import { Activity, ChevronDown, BarChart3 } from 'lucide-react';

interface Indicators {
  price: number | null;
  rsi: number | null;
  ema9: number | null;
  ema21: number | null;
  sma20: number | null;
  bb_upper: number | null;
  bb_lower: number | null;
  bb_middle: number | null;
}

const IndicatorBadge: React.FC<{
  label: string;
  value: number | null;
  colorFn?: (v: number | null) => string;
}> = ({ label, value, colorFn }) => {
  const color = colorFn ? colorFn(value) : 'text-foreground';
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-mono font-medium', color)}>
        {value !== null ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
      </span>
    </div>
  );
};

const Chart: React.FC = () => {
  const { symbol } = useParams<{ symbol?: string }>();
  const navigate = useNavigate();
  const chartRef = useRef<TradingChartRef>(null);
  const {
    selectedPair,
    selectedTimeframe,
    tickers,
    setSelectedPair,
    setSelectedTimeframe,
    updateTickers,
  } = useMarketStore();

  const currentSymbol = symbol || selectedPair;

  const [candles, setCandles] = useState<OHLCVData[]>([]);
  const [pairs, setPairs] = useState<TradingPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPairPicker, setShowPairPicker] = useState(false);
  const [indicators, setIndicators] = useState<Indicators | null>(null);

  // Sync URL param to store
  useEffect(() => {
    if (symbol && symbol !== selectedPair) {
      setSelectedPair(symbol);
    }
  }, [symbol, selectedPair, setSelectedPair]);

  // Fetch candles
  const fetchCandles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOHLCV(currentSymbol, selectedTimeframe, 500);
      setCandles(data);
    } catch {
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }, [currentSymbol, selectedTimeframe]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // Poll for new candles + indicators every 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getOHLCV(currentSymbol, selectedTimeframe, 500);
        setCandles(data);
      } catch { /* ignore */ }
      try {
        const res = await fetch(`/api/v1/analysis/indicators/${currentSymbol}?timeframe=${selectedTimeframe}`);
        const json = await res.json();
        if (json.success) setIndicators(json.data.current);
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [currentSymbol, selectedTimeframe]);

  // Fetch indicators on symbol/timeframe change
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/analysis/indicators/${currentSymbol}?timeframe=${selectedTimeframe}`);
        const json = await res.json();
        if (json.success) setIndicators(json.data.current);
      } catch { /* ignore */ }
    })();
  }, [currentSymbol, selectedTimeframe]);

  // Fetch tickers for header price display
  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const data = await getTickers();
        updateTickers(data);
      } catch { /* ignore */ }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 5000);
    return () => clearInterval(interval);
  }, [updateTickers]);

  // Fetch pairs list for picker
  useEffect(() => {
    getPairs().then(setPairs).catch(() => {});
  }, []);

  const ticker = tickers.get(currentSymbol);
  const priceColor = ticker && ticker.change24h >= 0 ? 'text-success' : 'text-danger';

  return (
    <div className="space-y-3 h-[calc(100vh-5rem)]">
      {/* Chart Header: Pair + Price */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          {/* Pair selector */}
          <div className="relative">
            <button
              onClick={() => setShowPairPicker(!showPairPicker)}
              className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl hover:border-primary/50 transition-all"
            >
              <span className="text-lg font-bold text-foreground">
                {currentSymbol.replace('USDT', '/USDT')}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>

            {showPairPicker && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-card border border-border rounded-xl shadow-lg p-2 w-56 max-h-64 overflow-y-auto">
                {pairs.map((p) => (
                  <button
                    key={p.symbol}
                    onClick={() => {
                      navigate(`/chart/${p.symbol}`);
                      setShowPairPicker(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                      p.symbol === currentSymbol
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-secondary'
                    )}
                  >
                    {p.symbol.replace('USDT', '/USDT')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Price display */}
          {ticker && (
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold font-mono text-foreground">
                ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={cn('text-sm font-mono font-medium', priceColor)}>
                {ticker.change24h >= 0 ? '+' : ''}{ticker.change24h.toFixed(2)}%
              </span>
              <span className="text-xs text-muted-foreground">
                Vol: ${(ticker.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setSelectedTimeframe(tf.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                selectedTimeframe === tf.value
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 h-[calc(100%-4rem)] bg-card border border-border rounded-xl overflow-hidden relative">
        {loading && candles.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Activity className="w-6 h-6 text-primary animate-pulse" />
          </div>
        ) : (
          <TradingChart
            ref={chartRef}
            symbol={currentSymbol}
            timeframe={selectedTimeframe}
            data={candles}
            className="w-full h-full"
          />
        )}
      </div>

      {/* Indicators Panel */}
      {indicators && (
        <div className="flex flex-wrap gap-3">
          <IndicatorBadge label="RSI(14)" value={indicators.rsi} colorFn={(v) => v !== null ? (v > 70 ? 'text-danger' : v < 30 ? 'text-success' : 'text-foreground') : 'text-muted-foreground'} />
          <IndicatorBadge label="EMA 9" value={indicators.ema9} />
          <IndicatorBadge label="EMA 21" value={indicators.ema21} />
          <IndicatorBadge label="SMA 20" value={indicators.sma20} />
          <IndicatorBadge label="BB Upper" value={indicators.bb_upper} />
          <IndicatorBadge label="BB Lower" value={indicators.bb_lower} />
        </div>
      )}

      {/* Close pair picker on outside click */}
      {showPairPicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowPairPicker(false)} />
      )}
    </div>
  );
};

export default Chart;
