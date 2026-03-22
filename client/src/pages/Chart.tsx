import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { TradingChart, type TradingChartRef, type OHLCVData } from '@/components/charts/TradingChart';
import { RSIChart } from '@/components/charts/RSIChart';
import { useMarketStore, TIMEFRAMES } from '@/stores/market';
import { getOHLCV, getPairs, type TradingPair } from '@/services/api';
import { subscribeOHLCV, unsubscribeOHLCV, subscribeTicker, unsubscribeTicker, getSocket } from '@/services/socket';
import { Activity, ChevronDown, BarChart3 } from 'lucide-react';
import { DrawingToolbar } from '@/components/charts/DrawingToolbar';

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
  } = useMarketStore();

  const currentSymbol = symbol || selectedPair;

  const [candles, setCandles] = useState<OHLCVData[]>([]);
  const [pairs, setPairs] = useState<TradingPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPairPicker, setShowPairPicker] = useState(false);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showRSI, setShowRSI] = useState(true);

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

  // Subscribe to WebSocket for live OHLCV + ticker updates
  useEffect(() => {
    const socket = getSocket();

    subscribeOHLCV(currentSymbol, selectedTimeframe);
    subscribeTicker([currentSymbol]);

    // Handle live candle updates — append or update the latest candle
    const handleOHLCVUpdate = (data: OHLCVData & { symbol?: string; timeframe?: string }) => {
      if (data.symbol && data.symbol !== currentSymbol) return;
      if (data.timeframe && data.timeframe !== selectedTimeframe) return;

      setCandles((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (data.time === last.time) {
          // Update existing candle
          return [...prev.slice(0, -1), { ...last, ...data }];
        } else if (data.time > last.time) {
          // Append new candle
          return [...prev, data];
        }
        return prev;
      });
    };

    socket.on('ohlcv:update', handleOHLCVUpdate);

    return () => {
      socket.off('ohlcv:update', handleOHLCVUpdate);
      unsubscribeOHLCV(currentSymbol, selectedTimeframe);
      unsubscribeTicker([currentSymbol]);
    };
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

  // Fetch pairs list for picker
  useEffect(() => {
    getPairs().then(setPairs).catch(() => {});
  }, []);

  // Compute RSI(14) from candle close prices
  const rsiData = useMemo(() => {
    if (candles.length < 15) return [];
    const closes = candles.map((c) => c.close);
    const period = 14;
    const result: { time: number; value: number }[] = [];

    // Calculate initial average gain/loss over first `period` changes
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) avgGain += diff;
      else avgLoss += Math.abs(diff);
    }
    avgGain /= period;
    avgLoss /= period;

    const rsi0 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: candles[period].time, value: rsi0 });

    // Smoothed RSI for remaining bars
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      result.push({ time: candles[i].time, value: rsi });
    }

    return result;
  }, [candles]);

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

        {/* Timeframe + Indicators */}
        <div className="flex items-center gap-2 flex-wrap">
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
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            <button
              onClick={() => setShowEMA(!showEMA)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                showEMA ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              EMA
            </button>
            <button
              onClick={() => setShowBB(!showBB)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                showBB ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              BB
            </button>
            <button
              onClick={() => setShowRSI(!showRSI)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                showRSI ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              RSI
            </button>
          </div>
        </div>
      </div>

      {/* Chart + Drawing Toolbar */}
      <div className="flex-1 min-h-[400px] h-[calc(100vh-14rem)] flex gap-2">
        {/* Drawing toolbar - visible on lg+ */}
        <div className="hidden lg:flex flex-shrink-0">
          <DrawingToolbar />
        </div>

        <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden relative min-h-[400px]">
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
              showEMA={showEMA}
              showBB={showBB}
              className="w-full h-full"
            />
          )}
        </div>
      </div>

      {/* RSI Sub-Chart */}
      {showRSI && rsiData.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <RSIChart data={rsiData} height={100} />
        </div>
      )}

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
