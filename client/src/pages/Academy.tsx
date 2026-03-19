import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  Lock,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/utils/cn';

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

interface Chapter {
  id: number;
  title: string;
  difficulty: Difficulty;
  duration: string;
  description: string;
  longDescription: string;
  keyConcepts: string[];
}

const chapters: Chapter[] = [
  {
    id: 1,
    title: 'Introduction to Crypto Markets',
    difficulty: 'Beginner',
    duration: '10 min',
    description: 'Market structure, exchanges, order types, fees',
    longDescription:
      'Learn the fundamentals of how cryptocurrency markets operate, including centralized and decentralized exchanges, spot vs derivatives markets, and how order books work. Understand the different order types (market, limit, stop) and how trading fees impact your profitability.',
    keyConcepts: [
      'Centralized vs decentralized exchange architecture',
      'Market, limit, and stop order types',
      'Maker/taker fee structures and their impact',
      'Bid-ask spread and liquidity basics',
    ],
  },
  {
    id: 2,
    title: 'Candlestick Basics',
    difficulty: 'Beginner',
    duration: '8 min',
    description: 'How to read candles, timeframes, chart types',
    longDescription:
      'Candlestick charts are the most popular way to visualize price data. Each candle represents four key data points: open, high, low, and close. Understanding how to read candles across different timeframes is essential for any trading strategy.',
    keyConcepts: [
      'Anatomy of a candlestick: body, wicks, open/close',
      'Bullish vs bearish candles and their meaning',
      'Timeframe selection: 1m to 1M and when to use each',
      'Line, bar, and candlestick chart comparison',
    ],
  },
  {
    id: 3,
    title: 'Trend Analysis',
    difficulty: 'Beginner',
    duration: '12 min',
    description: 'Trendlines, channels, support/resistance',
    longDescription:
      'Trend analysis forms the backbone of technical trading. Learn to identify uptrends, downtrends, and ranging markets using trendlines and price channels. Master the art of drawing accurate support and resistance levels that the market respects.',
    keyConcepts: [
      'Drawing valid trendlines with multiple touch points',
      'Ascending and descending price channels',
      'Identifying key support and resistance zones',
      'Trend confirmation with higher highs and higher lows',
    ],
  },
  {
    id: 4,
    title: 'Moving Averages',
    difficulty: 'Beginner',
    duration: '10 min',
    description: 'SMA, EMA, crossover strategies, Golden/Death Cross',
    longDescription:
      'Moving averages smooth out price noise and reveal the underlying trend direction. Learn the difference between SMA and EMA, how to use popular periods like 20, 50, and 200, and how crossover strategies can signal trend changes before they happen.',
    keyConcepts: [
      'SMA vs EMA: calculation and responsiveness differences',
      'Popular MA periods: 20, 50, 100, 200 and their significance',
      'Golden Cross (50 above 200) and Death Cross signals',
      'Using MAs as dynamic support and resistance',
    ],
  },
  {
    id: 5,
    title: 'RSI & Momentum',
    difficulty: 'Beginner',
    duration: '10 min',
    description: 'RSI interpretation, divergence, overbought/oversold',
    longDescription:
      'The Relative Strength Index (RSI) measures the speed and magnitude of price movements on a 0-100 scale. Learn to identify overbought and oversold conditions, spot hidden divergences that precede reversals, and combine RSI with other tools for higher-probability setups.',
    keyConcepts: [
      'RSI calculation and the 14-period default setting',
      'Overbought (>70) and oversold (<30) zones',
      'Bullish and bearish RSI divergence patterns',
      'RSI as a trend-following tool in strong markets',
    ],
  },
  {
    id: 6,
    title: 'MACD & Signal Lines',
    difficulty: 'Intermediate',
    duration: '12 min',
    description: 'MACD histogram, crossovers, divergence patterns',
    longDescription:
      'The MACD (Moving Average Convergence Divergence) is a versatile momentum indicator that shows the relationship between two moving averages. Master the three components: MACD line, signal line, and histogram to time entries and exits with greater precision.',
    keyConcepts: [
      'MACD line, signal line, and histogram components',
      'Bullish and bearish crossover signals',
      'MACD divergence for early reversal detection',
      'Zero-line crossovers and trend confirmation',
    ],
  },
  {
    id: 7,
    title: 'Bollinger Bands & Volatility',
    difficulty: 'Intermediate',
    duration: '12 min',
    description: 'Squeeze, breakout, %B, bandwidth',
    longDescription:
      'Bollinger Bands adapt to market volatility by expanding and contracting around a moving average. Learn to identify squeeze setups that precede explosive moves, use %B to gauge relative price position, and combine bandwidth analysis with volume for breakout confirmation.',
    keyConcepts: [
      'Band construction: 20-period SMA with 2 standard deviations',
      'Bollinger Squeeze: low volatility preceding big moves',
      'Percent B (%B) for overbought/oversold readings',
      'Bandwidth as a volatility cycle indicator',
    ],
  },
  {
    id: 8,
    title: 'Candlestick Patterns',
    difficulty: 'Intermediate',
    duration: '15 min',
    description: 'Top 20 patterns with real examples',
    longDescription:
      'Candlestick patterns encode market psychology into visual formations. From single-candle patterns like doji and hammer to multi-candle formations like engulfing and morning star, each pattern tells a story about the battle between buyers and sellers.',
    keyConcepts: [
      'Single candle: doji, hammer, shooting star, spinning top',
      'Double candle: engulfing, harami, tweezer tops/bottoms',
      'Triple candle: morning/evening star, three soldiers/crows',
      'Pattern reliability and confirmation techniques',
    ],
  },
  {
    id: 9,
    title: 'Chart Patterns',
    difficulty: 'Intermediate',
    duration: '15 min',
    description: 'Triangles, H&S, wedges, flags with entry/exit rules',
    longDescription:
      'Chart patterns are geometric formations that appear repeatedly in price action. Learn to identify continuation patterns like flags and pennants, reversal patterns like head and shoulders, and measure expected price targets using pattern-specific rules.',
    keyConcepts: [
      'Symmetrical, ascending, and descending triangles',
      'Head and shoulders (and inverse) with neckline breaks',
      'Rising/falling wedges as reversal patterns',
      'Bull/bear flags and pennants with measured moves',
    ],
  },
  {
    id: 10,
    title: 'Volume Analysis',
    difficulty: 'Intermediate',
    duration: '12 min',
    description: 'OBV, Volume Profile, VWAP, volume confirmation',
    longDescription:
      'Volume is the fuel that drives price movements. Learn to use On-Balance Volume (OBV) to confirm trends, Volume Profile to identify key price levels where heavy trading occurred, and VWAP as an institutional benchmark for intraday trading.',
    keyConcepts: [
      'On-Balance Volume (OBV) for trend confirmation',
      'Volume Profile: POC, value area, and HVN/LVN',
      'VWAP as an intraday fair value benchmark',
      'Volume divergence as a warning signal',
    ],
  },
  {
    id: 11,
    title: 'Risk Management',
    difficulty: 'Advanced',
    duration: '15 min',
    description: 'Position sizing, R/R ratio, max drawdown rules',
    longDescription:
      'Risk management is arguably the most important skill in trading. Learn to calculate optimal position sizes based on your risk tolerance, set proper risk-to-reward ratios, and implement portfolio-level drawdown rules that protect your capital during losing streaks.',
    keyConcepts: [
      'The 1-2% rule: never risk more per trade',
      'Risk/reward ratio calculation and minimum thresholds',
      'Position sizing formulas based on stop loss distance',
      'Maximum drawdown rules and circuit breakers',
    ],
  },
  {
    id: 12,
    title: 'Trading Psychology',
    difficulty: 'Advanced',
    duration: '10 min',
    description: 'FOMO, revenge trading, discipline, journaling',
    longDescription:
      'Your mindset is the edge that separates consistent traders from gamblers. Understand the common psychological traps like FOMO and revenge trading, build a disciplined routine, and use journaling to identify and correct your behavioral patterns over time.',
    keyConcepts: [
      'Identifying FOMO and its impact on trade quality',
      'Revenge trading: breaking the loss spiral',
      'Building a pre-trade checklist and routine',
      'Trade journaling for performance improvement',
    ],
  },
  {
    id: 13,
    title: 'On-Chain Analysis',
    difficulty: 'Advanced',
    duration: '15 min',
    description: 'Exchange flows, whale tracking, NVT, MVRV',
    longDescription:
      'On-chain analysis gives you an edge by examining data directly from the blockchain. Track exchange inflows and outflows to gauge selling pressure, monitor whale wallets for large movements, and use valuation metrics like NVT and MVRV to identify market cycle extremes.',
    keyConcepts: [
      'Exchange net flow as a buy/sell pressure indicator',
      'Whale wallet tracking and accumulation patterns',
      'NVT ratio: the crypto P/E ratio',
      'MVRV Z-Score for market cycle tops and bottoms',
    ],
  },
  {
    id: 14,
    title: 'Derivatives & Funding',
    difficulty: 'Advanced',
    duration: '12 min',
    description: 'Futures, liquidations, funding rate strategies',
    longDescription:
      'Crypto derivatives markets are larger than spot and heavily influence price action. Learn how perpetual futures work, how funding rates create arbitrage opportunities, and how liquidation cascades can cause extreme volatility in both directions.',
    keyConcepts: [
      'Perpetual futures vs traditional futures mechanics',
      'Funding rate interpretation and arbitrage strategies',
      'Liquidation heatmaps and cascade dynamics',
      'Open interest as a sentiment and positioning tool',
    ],
  },
  {
    id: 15,
    title: 'Building a Trading Plan',
    difficulty: 'Advanced',
    duration: '15 min',
    description: 'Strategy selection, backtesting, portfolio management',
    longDescription:
      'A comprehensive trading plan ties together everything you have learned into a repeatable, systematic process. Learn to select strategies that match your personality and schedule, backtest them on historical data, and manage a diversified portfolio of uncorrelated trades.',
    keyConcepts: [
      'Defining your trading style: scalp, swing, or position',
      'Backtesting methodology and avoiding overfitting',
      'Portfolio diversification across assets and strategies',
      'Performance metrics: Sharpe ratio, win rate, expectancy',
    ],
  },
];

const difficultyColor: Record<Difficulty, string> = {
  Beginner: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Advanced: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const UNLOCKED_COUNT = 5;

const Academy: React.FC = () => {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const isAvailable = (id: number) => id <= UNLOCKED_COUNT || completed.has(id - 1);
  const isCompleted = (id: number) => completed.has(id);

  const toggleComplete = (id: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleExpand = (id: number) => {
    if (!isAvailable(id)) return;
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const completedCount = completed.size;
  const progressPercent = Math.round((completedCount / chapters.length) * 100);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trading Academy</h1>
          <p className="text-sm text-muted-foreground">
            Master crypto trading from beginner to advanced
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Course Progress</span>
          <span className="text-sm text-muted-foreground">
            {completedCount}/{chapters.length} chapters ({progressPercent}%)
          </span>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Chapters */}
      <div className="space-y-3">
        {chapters.map((chapter) => {
          const available = isAvailable(chapter.id);
          const done = isCompleted(chapter.id);
          const expanded = expandedId === chapter.id;

          return (
            <div
              key={chapter.id}
              className={cn(
                'bg-card border border-border rounded-lg transition-all duration-200',
                available
                  ? 'hover:border-primary/30 cursor-pointer'
                  : 'opacity-60 cursor-not-allowed'
              )}
            >
              {/* Card header */}
              <div
                className="flex items-center gap-4 p-4"
                onClick={() => toggleExpand(chapter.id)}
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {done ? (
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  ) : available ? (
                    <BookOpen className="w-6 h-6 text-primary" />
                  ) : (
                    <Lock className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-medium">
                      Chapter {chapter.id}
                    </span>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border font-medium',
                        difficultyColor[chapter.difficulty]
                      )}
                    >
                      {chapter.difficulty}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {chapter.duration}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mt-1 truncate">
                    {chapter.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {chapter.description}
                  </p>
                </div>

                {/* Expand indicator */}
                {available && (
                  <div className="flex-shrink-0 text-muted-foreground">
                    {expanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                )}
              </div>

              {/* Expanded content */}
              {expanded && available && (
                <div className="px-4 pb-4 pt-0 border-t border-border mx-4 mb-4 mt-0">
                  <div className="pt-4 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {chapter.longDescription}
                    </p>

                    <div>
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                        Key Concepts
                      </h4>
                      <ul className="space-y-1.5">
                        {chapter.keyConcepts.map((concept, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-muted-foreground flex items-start gap-2"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            {concept}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComplete(chapter.id);
                        }}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          done
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                        )}
                      >
                        {done ? 'Completed' : 'Mark as Completed'}
                      </button>
                      <Link
                        to="/chart/BTCUSDT"
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                      >
                        Practice on Chart
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Academy;
