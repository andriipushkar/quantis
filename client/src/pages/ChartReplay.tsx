import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Pause,
  SkipForward,
  Rewind,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { TradingChart, type OHLCVData } from '@/components/charts/TradingChart';
import { cn } from '@/utils/cn';

interface SimTrade {
  type: 'buy' | 'sell';
  price: number;
  time: number;
  index: number;
}

interface ClosedTrade {
  entry: SimTrade;
  exit: SimTrade;
  pnl: number;
  pnlPercent: number;
}

const SPEEDS = [1, 2, 5, 10];

const PAIRS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'DOTUSDT',
  'LINKUSDT',
];

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

const ChartReplay: React.FC = () => {
  const { t } = useTranslation();

  const [pair, setPair] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [allCandles, setAllCandles] = useState<OHLCVData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showPairDropdown, setShowPairDropdown] = useState(false);
  const [showTfDropdown, setShowTfDropdown] = useState(false);

  // Trading state
  const [openTrade, setOpenTrade] = useState<SimTrade | null>(null);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);

  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch candles
  const fetchCandles = useCallback(async () => {
    setIsLoading(true);
    setIsPlaying(false);
    setCurrentIndex(50);
    setOpenTrade(null);
    setClosedTrades([]);
    try {
      const res = await fetch(
        `/api/v1/market/ohlcv/${pair}?timeframe=${timeframe}&limit=5000`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setAllCandles(json.data);
          setCurrentIndex(Math.min(50, json.data.length - 1));
        } else {
          setAllCandles([]);
        }
      }
    } catch {
      setAllCandles([]);
    } finally {
      setIsLoading(false);
    }
  }, [pair, timeframe]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // Play/pause logic
  useEffect(() => {
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    if (isPlaying && currentIndex < allCandles.length - 1) {
      const interval = Math.max(50, 1000 / speed);
      playTimerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= allCandles.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    }
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [isPlaying, speed, allCandles.length, currentIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.shiftKey) {
          // Next bar
          setCurrentIndex((prev) => Math.min(prev + 1, allCandles.length - 1));
        } else {
          setIsPlaying((p) => !p);
        }
      } else if (e.code === 'ArrowRight') {
        setCurrentIndex((prev) => Math.min(prev + 1, allCandles.length - 1));
      } else if (e.code === 'ArrowLeft') {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allCandles.length]);

  const visibleCandles = allCandles.slice(0, currentIndex + 1);
  const currentCandle = allCandles[currentIndex];
  const currentPrice = currentCandle?.close ?? 0;
  const currentTime = currentCandle
    ? new Date(currentCandle.time * 1000).toLocaleString()
    : '';

  // Trade handlers
  const handleBuy = useCallback(() => {
    if (!currentCandle || openTrade) return;
    setOpenTrade({
      type: 'buy',
      price: currentPrice,
      time: currentCandle.time,
      index: currentIndex,
    });
  }, [currentCandle, currentPrice, currentIndex, openTrade]);

  const handleSell = useCallback(() => {
    if (!currentCandle) return;
    if (openTrade && openTrade.type === 'buy') {
      // Close long position
      const pnl = currentPrice - openTrade.price;
      const pnlPercent = (pnl / openTrade.price) * 100;
      setClosedTrades((prev) => [
        ...prev,
        {
          entry: openTrade,
          exit: {
            type: 'sell',
            price: currentPrice,
            time: currentCandle.time,
            index: currentIndex,
          },
          pnl,
          pnlPercent,
        },
      ]);
      setOpenTrade(null);
    } else if (!openTrade) {
      // Open short position
      setOpenTrade({
        type: 'sell',
        price: currentPrice,
        time: currentCandle.time,
        index: currentIndex,
      });
    }
  }, [currentCandle, currentPrice, currentIndex, openTrade]);

  const handleClosePosition = useCallback(() => {
    if (!openTrade || !currentCandle) return;
    const isLong = openTrade.type === 'buy';
    const pnl = isLong
      ? currentPrice - openTrade.price
      : openTrade.price - currentPrice;
    const pnlPercent = (pnl / openTrade.price) * 100;
    setClosedTrades((prev) => [
      ...prev,
      {
        entry: openTrade,
        exit: {
          type: isLong ? 'sell' : 'buy',
          price: currentPrice,
          time: currentCandle.time,
          index: currentIndex,
        },
        pnl,
        pnlPercent,
      },
    ]);
    setOpenTrade(null);
  }, [openTrade, currentCandle, currentPrice, currentIndex]);

  // Unrealized P&L
  const unrealizedPnl = openTrade
    ? openTrade.type === 'buy'
      ? currentPrice - openTrade.price
      : openTrade.price - currentPrice
    : 0;
  const unrealizedPnlPercent = openTrade
    ? (unrealizedPnl / openTrade.price) * 100
    : 0;

  // Session summary
  const totalPnl = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = closedTrades.filter((t) => t.pnl > 0).length;
  const winRate =
    closedTrades.length > 0
      ? Math.round((wins / closedTrades.length) * 100)
      : 0;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Rewind className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">
            {t('chartReplay.title')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Pair selector */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowPairDropdown((p) => !p);
                setShowTfDropdown(false);
              }}
            >
              {pair}
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
            {showPairDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
                {PAIRS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPair(p);
                      setShowPairDropdown(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-secondary transition-colors',
                      p === pair ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Timeframe selector */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowTfDropdown((p) => !p);
                setShowPairDropdown(false);
              }}
            >
              {timeframe}
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
            {showTfDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 py-1 min-w-[80px]">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      setTimeframe(tf);
                      setShowTfDropdown(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-secondary transition-colors',
                      tf === timeframe ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-[500px]">
              <span className="text-muted-foreground text-sm">
                {t('common.loading')}
              </span>
            </div>
          ) : allCandles.length === 0 ? (
            <div className="flex items-center justify-center h-[500px]">
              <span className="text-muted-foreground text-sm">
                {t('common.noData')}
              </span>
            </div>
          ) : (
            <TradingChart
              symbol={pair}
              timeframe={timeframe}
              data={visibleCandles}
              showEMA={false}
              showBB={false}
              className="w-full h-[500px]"
            />
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Playback controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaying((p) => !p)}
                disabled={allCandles.length === 0}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCurrentIndex((prev) =>
                    Math.min(prev + 1, allCandles.length - 1)
                  )
                }
                disabled={allCandles.length === 0}
                title="Next Bar (Space)"
              >
                <SkipForward className="w-4 h-4" />
              </Button>

              {/* Speed selector */}
              <div className="flex items-center gap-1 ml-2">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium transition-colors',
                      speed === s
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Progress slider */}
            <div className="flex-1 min-w-[200px] mx-4">
              <input
                type="range"
                min={0}
                max={Math.max(0, allCandles.length - 1)}
                value={currentIndex}
                onChange={(e) => setCurrentIndex(parseInt(e.target.value, 10))}
                className="w-full accent-[hsl(var(--primary))] h-1.5 bg-secondary rounded-full cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">
                  {t('chartReplay.bar')} {currentIndex + 1} / {allCandles.length}
                </span>
                <span className="text-xs text-muted-foreground">{currentTime}</span>
              </div>
            </div>

            {/* Trade buttons */}
            <div className="flex items-center gap-2">
              {openTrade ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClosePosition}
                >
                  <X className="w-4 h-4 mr-1" />
                  {t('chartReplay.closePosition')}
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={handleBuy}
                    disabled={allCandles.length === 0}
                    className="bg-success hover:bg-success/90 text-white"
                  >
                    <TrendingUp className="w-4 h-4 mr-1" />
                    {t('chartReplay.buy')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSell}
                    disabled={allCandles.length === 0}
                    className="bg-danger hover:bg-danger/90 text-white"
                  >
                    <TrendingDown className="w-4 h-4 mr-1" />
                    {t('chartReplay.sell')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Open Position & Session Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Open Position */}
        <Card>
          <CardHeader>
            <CardTitle>{t('chartReplay.openPosition')}</CardTitle>
          </CardHeader>
          <CardContent>
            {openTrade ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('chartReplay.direction')}
                  </span>
                  <Badge variant={openTrade.type === 'buy' ? 'success' : 'danger'}>
                    {openTrade.type.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('chartReplay.entryPrice')}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    ${openTrade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('chartReplay.currentPrice')}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('chartReplay.unrealizedPnl')}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-bold',
                      unrealizedPnl >= 0 ? 'text-success' : 'text-danger'
                    )}
                  >
                    {unrealizedPnl >= 0 ? '+' : ''}
                    ${unrealizedPnl.toFixed(2)} ({unrealizedPnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('chartReplay.noOpenPosition')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Session Summary */}
        <Card>
          <CardHeader>
            <CardTitle>{t('chartReplay.sessionSummary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('chartReplay.totalTrades')}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {closedTrades.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('chartReplay.winRate')}
                </span>
                <span className="text-sm font-medium text-foreground">{winRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('chartReplay.totalPnl')}
                </span>
                <span
                  className={cn(
                    'text-sm font-bold',
                    totalPnl >= 0 ? 'text-success' : 'text-danger'
                  )}
                >
                  {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Trade history */}
            {closedTrades.length > 0 && (
              <div className="mt-4 space-y-1.5 max-h-[200px] overflow-y-auto">
                {closedTrades
                  .slice()
                  .reverse()
                  .map((trade, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1.5 px-2 rounded bg-secondary/50 text-xs"
                    >
                      <span className="text-muted-foreground">
                        {trade.entry.type.toUpperCase()} ${trade.entry.price.toFixed(2)}
                        {' -> '}${trade.exit.price.toFixed(2)}
                      </span>
                      <span
                        className={cn(
                          'font-medium',
                          trade.pnl >= 0 ? 'text-success' : 'text-danger'
                        )}
                      >
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)} (
                        {trade.pnlPercent.toFixed(2)}%)
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChartReplay;
