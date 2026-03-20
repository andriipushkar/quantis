import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useToastStore } from '@/stores/toast';

interface Indicator {
  name: string;
  tier: 'Free' | 'Trader' | 'Pro';
  description: string;
  formula: string;
  defaults: string;
  useCase: string;
}

interface IndicatorCategory {
  name: string;
  indicators: Indicator[];
}

const INDICATOR_CATEGORIES: IndicatorCategory[] = [
  {
    name: 'Trend',
    indicators: [
      { name: 'SMA', tier: 'Free', description: 'Simple Moving Average — average price over N periods.', formula: 'SMA = Sum(Close, N) / N', defaults: 'Period: 20', useCase: 'Identify overall trend direction and dynamic support/resistance.' },
      { name: 'EMA', tier: 'Free', description: 'Exponential Moving Average — weighted toward recent prices.', formula: 'EMA = Close * k + EMA_prev * (1-k), k=2/(N+1)', defaults: 'Period: 21', useCase: 'Faster trend detection than SMA, good for crossovers.' },
      { name: 'Bollinger Bands', tier: 'Free', description: 'Envelope around SMA using standard deviations.', formula: 'Upper = SMA + 2*StdDev, Lower = SMA - 2*StdDev', defaults: 'Period: 20, StdDev: 2', useCase: 'Spot overbought/oversold and volatility squeezes.' },
      { name: 'Ichimoku Cloud', tier: 'Trader', description: 'Multi-component trend system with support, resistance, and momentum.', formula: 'Tenkan, Kijun, Senkou A/B, Chikou', defaults: '9, 26, 52', useCase: 'Full-picture trend analysis with built-in S/R.' },
      { name: 'SuperTrend', tier: 'Trader', description: 'ATR-based trailing stop trend indicator.', formula: 'ATR * multiplier offset from HL2', defaults: 'ATR: 10, Multiplier: 3', useCase: 'Clear buy/sell signals with trailing stop logic.' },
      { name: 'VWAP', tier: 'Free', description: 'Volume Weighted Average Price — intraday fair value.', formula: 'VWAP = Cumulative(Price*Vol) / Cumulative(Vol)', defaults: 'Session: Daily', useCase: 'Intraday support/resistance and trade execution benchmark.' },
      { name: 'Parabolic SAR', tier: 'Free', description: 'Stop and Reverse — trailing dots above or below price.', formula: 'SAR = SAR_prev + AF*(EP - SAR_prev)', defaults: 'Step: 0.02, Max: 0.2', useCase: 'Trend direction and trailing stop placement.' },
      { name: 'Keltner Channels', tier: 'Trader', description: 'EMA-based envelope using ATR for width.', formula: 'Upper = EMA + ATR*mult, Lower = EMA - ATR*mult', defaults: 'EMA: 20, ATR: 10, Mult: 1.5', useCase: 'Breakout detection and trend continuation.' },
      { name: 'Donchian Channels', tier: 'Free', description: 'Highest high / lowest low over N periods.', formula: 'Upper = Highest(N), Lower = Lowest(N)', defaults: 'Period: 20', useCase: 'Channel breakout strategies (Turtle Trading).' },
      { name: 'Linear Regression', tier: 'Pro', description: 'Best-fit regression line through price data.', formula: 'Least squares regression of Close over N', defaults: 'Period: 50', useCase: 'Trend direction with statistical confidence.' },
      { name: 'DEMA', tier: 'Trader', description: 'Double EMA — reduces lag of single EMA.', formula: 'DEMA = 2*EMA(N) - EMA(EMA(N))', defaults: 'Period: 21', useCase: 'Low-lag trend following for active traders.' },
      { name: 'TEMA', tier: 'Pro', description: 'Triple EMA — further lag reduction.', formula: 'TEMA = 3*EMA - 3*EMA(EMA) + EMA(EMA(EMA))', defaults: 'Period: 21', useCase: 'Ultra-responsive trend line for scalping.' },
    ],
  },
  {
    name: 'Oscillators',
    indicators: [
      { name: 'RSI', tier: 'Free', description: 'Relative Strength Index — momentum oscillator 0-100.', formula: 'RSI = 100 - 100/(1 + RS), RS = AvgGain/AvgLoss', defaults: 'Period: 14', useCase: 'Identify overbought (>70) and oversold (<30) conditions.' },
      { name: 'MACD', tier: 'Free', description: 'Moving Average Convergence Divergence — trend momentum.', formula: 'MACD = EMA(12) - EMA(26), Signal = EMA(9, MACD)', defaults: '12, 26, 9', useCase: 'Trend changes via crossovers and histogram divergence.' },
      { name: 'Stochastic', tier: 'Free', description: 'Stochastic Oscillator — price relative to range.', formula: '%K = (Close-Low)/(High-Low)*100, %D = SMA(%K,3)', defaults: '%K: 14, %D: 3', useCase: 'Overbought/oversold in ranging markets.' },
      { name: 'Williams %R', tier: 'Free', description: 'Williams Percent Range — inverse stochastic.', formula: '%R = (Highest-Close)/(Highest-Lowest)*-100', defaults: 'Period: 14', useCase: 'Quick overbought/oversold readings.' },
      { name: 'CCI', tier: 'Trader', description: 'Commodity Channel Index — deviation from statistical mean.', formula: 'CCI = (TP - SMA(TP)) / (0.015 * MeanDeviation)', defaults: 'Period: 20', useCase: 'Spot new trends and extreme conditions.' },
      { name: 'MFI', tier: 'Trader', description: 'Money Flow Index — volume-weighted RSI.', formula: 'MFI = 100 - 100/(1 + MoneyFlowRatio)', defaults: 'Period: 14', useCase: 'Volume-confirmed overbought/oversold signals.' },
      { name: 'Ultimate Oscillator', tier: 'Pro', description: 'Multi-timeframe momentum oscillator.', formula: 'UO = Weighted avg of BP/TR across 3 periods', defaults: '7, 14, 28', useCase: 'Reduce false signals via multi-period averaging.' },
      { name: 'Awesome Oscillator', tier: 'Trader', description: 'Difference between 5 and 34 period SMA of midpoints.', formula: 'AO = SMA(5, HL2) - SMA(34, HL2)', defaults: '5, 34', useCase: 'Momentum shifts via zero-line crosses and saucers.' },
      { name: 'Stochastic RSI', tier: 'Trader', description: 'Stochastic applied to RSI values.', formula: 'StochRSI = (RSI - RSI_Low)/(RSI_High - RSI_Low)', defaults: 'RSI: 14, Stoch: 14', useCase: 'More sensitive than standard RSI for crypto.' },
      { name: 'ROC', tier: 'Free', description: 'Rate of Change — percentage price change.', formula: 'ROC = (Close - Close_N) / Close_N * 100', defaults: 'Period: 12', useCase: 'Momentum and divergence analysis.' },
    ],
  },
  {
    name: 'Volume',
    indicators: [
      { name: 'OBV', tier: 'Free', description: 'On-Balance Volume — cumulative volume flow.', formula: 'OBV += Vol if up, OBV -= Vol if down', defaults: 'None', useCase: 'Confirm trends or spot divergences with price.' },
      { name: 'Volume Profile', tier: 'Pro', description: 'Horizontal volume histogram by price level.', formula: 'Volume distributed across price bins', defaults: 'Rows: 24', useCase: 'Find high-volume nodes for support/resistance.' },
      { name: 'CMF', tier: 'Trader', description: 'Chaikin Money Flow — accumulation/distribution.', formula: 'CMF = Sum(CLVF * Vol, N) / Sum(Vol, N)', defaults: 'Period: 20', useCase: 'Measure buying/selling pressure over a window.' },
      { name: 'VWAP Bands', tier: 'Pro', description: 'Standard deviation bands around VWAP.', formula: 'VWAP +/- N * StdDev(VWAP)', defaults: 'Bands: 1, 2, 3 StdDev', useCase: 'Intraday mean-reversion and momentum targets.' },
      { name: 'A/D Line', tier: 'Free', description: 'Accumulation/Distribution Line — money flow volume.', formula: 'A/D = Prev + CLVF * Volume', defaults: 'None', useCase: 'Confirm trend strength with volume flow.' },
      { name: 'RVOL', tier: 'Trader', description: 'Relative Volume — current vs. average volume.', formula: 'RVOL = Current Vol / SMA(Vol, N)', defaults: 'Period: 20', useCase: 'Spot unusual volume spikes for breakout confirmation.' },
    ],
  },
  {
    name: 'Volatility',
    indicators: [
      { name: 'ATR', tier: 'Free', description: 'Average True Range — volatility measurement.', formula: 'ATR = SMA(TrueRange, N)', defaults: 'Period: 14', useCase: 'Set stop losses and gauge market volatility.' },
      { name: 'Bollinger Bandwidth', tier: 'Trader', description: 'Width of Bollinger Bands as a ratio.', formula: 'BW = (Upper - Lower) / Middle', defaults: 'Period: 20, StdDev: 2', useCase: 'Detect volatility squeezes before big moves.' },
      { name: 'Historical Volatility', tier: 'Pro', description: 'Annualized standard deviation of returns.', formula: 'HV = StdDev(ln(C/C_prev), N) * sqrt(365)', defaults: 'Period: 20', useCase: 'Compare current volatility to historical norms.' },
      { name: 'Donchian Width', tier: 'Trader', description: 'Width of Donchian Channel relative to price.', formula: 'DW = (Upper - Lower) / Close', defaults: 'Period: 20', useCase: 'Measure volatility contraction/expansion.' },
    ],
  },
];

const TIER_COLORS: Record<string, string> = {
  Free: 'bg-success/15 text-success',
  Trader: 'bg-primary/15 text-primary',
  Pro: 'bg-warning/15 text-warning',
};

const CATEGORY_COLORS: Record<string, string> = {
  Trend: 'bg-blue-500/15 text-blue-400',
  Oscillators: 'bg-purple-500/15 text-purple-400',
  Volume: 'bg-emerald-500/15 text-emerald-400',
  Volatility: 'bg-orange-500/15 text-orange-400',
};

const IndicatorLibrary: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return INDICATOR_CATEGORIES;
    return INDICATOR_CATEGORIES.map((cat) => ({
      ...cat,
      indicators: cat.indicators.filter((ind) =>
        ind.name.toLowerCase().includes(q) || ind.description.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.indicators.length > 0);
  }, [searchQuery]);

  const totalCount = useMemo(
    () => INDICATOR_CATEGORIES.reduce((sum, cat) => sum + cat.indicators.length, 0),
    []
  );

  const handleAddToChart = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    addToast(`Navigate to Chart page to add ${name} indicator`, 'info');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Indicator Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse {totalCount}+ technical indicators across {INDICATOR_CATEGORIES.length} categories
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search indicators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Tier Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">Tiers:</span>
        {['Free', 'Trader', 'Pro'].map((tier) => (
          <span key={tier} className={cn('px-2 py-0.5 rounded-full font-medium', TIER_COLORS[tier])}>
            {tier}
          </span>
        ))}
      </div>

      {/* Categories */}
      {filteredCategories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No indicators match "{searchQuery}"
        </div>
      ) : (
        filteredCategories.map((category) => (
          <section key={category.name} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">{category.name}</h2>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CATEGORY_COLORS[category.name])}>
                {category.indicators.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {category.indicators.map((indicator) => {
                const isExpanded = expandedCard === `${category.name}-${indicator.name}`;
                const cardKey = `${category.name}-${indicator.name}`;
                return (
                  <div
                    key={cardKey}
                    onClick={() => setExpandedCard(isExpanded ? null : cardKey)}
                    className={cn(
                      'bg-card border border-border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-sm',
                      isExpanded && 'border-primary/40 col-span-1 sm:col-span-2'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground text-sm">{indicator.name}</span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', TIER_COLORS[indicator.tier])}>
                            {indicator.tier}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{indicator.description}</p>
                      </div>
                      <div className="flex-shrink-0 mt-0.5">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Formula</span>
                          <p className="text-xs text-foreground font-mono mt-0.5">{indicator.formula}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Defaults</span>
                          <p className="text-xs text-foreground mt-0.5">{indicator.defaults}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Use Case</span>
                          <p className="text-xs text-foreground mt-0.5">{indicator.useCase}</p>
                        </div>
                        <button
                          onClick={(e) => handleAddToChart(e, indicator.name)}
                          className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-all border border-primary/25"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          Add to Chart
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default IndicatorLibrary;
