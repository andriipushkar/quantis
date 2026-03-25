import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { getRegimeScores, getMarketRegime, type RegimeScoreItem, type MarketRegimeData } from '@/services/api';
import { Activity, TrendingUp, TrendingDown, Minus, ArrowUpDown, Info, ChevronDown } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-emerald-400';
  if (score >= 40) return 'text-yellow-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500/15';
  if (score >= 60) return 'bg-emerald-500/15';
  if (score >= 40) return 'bg-yellow-500/15';
  if (score >= 20) return 'bg-orange-500/15';
  return 'bg-red-500/15';
}

function getLabelText(label: string): string {
  const map: Record<string, string> = {
    strong_trend: 'Strong Trend',
    trending: 'Trending',
    transitional: 'Transitional',
    choppy: 'Choppy',
    mean_reversion: 'Mean Reversion',
  };
  return map[label] || label;
}

function getDirectionIcon(direction: string) {
  if (direction === 'bullish') return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
  if (direction === 'bearish') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

// ── Score Gauge (Canvas) ───────────────────────────────────────────────

const ScoreGauge: React.FC<{ score: number; size?: number }> = React.memo(({ score, size = 160 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * 0.7 * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size * 0.6;
    const r = size * 0.38;
    const lineWidth = size * 0.08;

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Gradient arc
    const gradient = ctx.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0, '#F6465D');   // red (mean-reversion)
    gradient.addColorStop(0.25, '#F0923E');
    gradient.addColorStop(0.5, '#E5C94C');  // yellow (transitional)
    gradient.addColorStop(0.75, '#22C978');
    gradient.addColorStop(1, '#0ECB81');    // green (strong trend)

    const angle = Math.PI + (score / 100) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, angle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Needle
    const needleAngle = Math.PI + (score / 100) * Math.PI;
    const needleLen = r - lineWidth;
    const nx = cx + Math.cos(needleAngle) * needleLen;
    const ny = cy + Math.sin(needleAngle) * needleLen;

    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#C9A84C';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#C9A84C';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score text
    ctx.fillStyle = '#EAECEF';
    ctx.font = `bold ${size * 0.16}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(String(score), cx, cy - 8);

    // Labels
    ctx.fillStyle = '#848E9C';
    ctx.font = `${size * 0.07}px system-ui`;
    ctx.textAlign = 'left';
    ctx.fillText('Mean Rev', 8, cy + 16);
    ctx.textAlign = 'right';
    ctx.fillText('Trend', size - 8, cy + 16);
  }, [score, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size * 0.7 }}
    />
  );
});
ScoreGauge.displayName = 'ScoreGauge';

// ── Component Bar ──────────────────────────────────────────────────────

const ComponentBar: React.FC<{ label: string; value: number; score: number; tooltip: string }> = React.memo(
  ({ label, value, score, tooltip }) => (
    <div className="group relative">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground flex items-center gap-1">
          {label}
          <span className="hidden group-hover:inline text-[10px] text-muted-foreground/60">({tooltip})</span>
        </span>
        <span className="font-mono text-foreground">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getScoreBg(score).replace('/15', '/50'))}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
    </div>
  ),
);
ComponentBar.displayName = 'ComponentBar';

// ── Expanded Row Detail ────────────────────────────────────────────────

const CoinDetail: React.FC<{ item: RegimeScoreItem }> = React.memo(({ item }) => (
  <div className="px-4 py-4 bg-background/50 border-t border-border/50 grid grid-cols-1 md:grid-cols-3 gap-4">
    {/* Score Components */}
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score Components</h4>
      <ComponentBar label="ADX" value={item.components.adx} score={item.components.adxScore} tooltip="Directional strength" />
      <ComponentBar label="Hurst" value={item.components.hurst} score={item.components.hurstScore} tooltip=">0.5 = trending" />
      <ComponentBar label="Choppiness" value={item.components.choppiness} score={item.components.choppinessScore} tooltip="Low = trending" />
      <ComponentBar label="Efficiency" value={item.components.efficiencyRatio} score={item.components.erScore} tooltip="Direction/noise" />
    </div>

    {/* Description */}
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Analysis</h4>
      <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Confidence:</span>
        <span className="font-mono font-semibold text-foreground">{item.confidence}%</span>
      </div>
    </div>

    {/* Strategy Recommendations */}
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recommended</h4>
        <div className="flex flex-wrap gap-1">
          {item.strategies.recommended.map((s) => (
            <span key={s} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-400">
              {s}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Avoid</h4>
        <div className="flex flex-wrap gap-1">
          {item.strategies.avoid.map((s) => (
            <span key={s} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  </div>
));
CoinDetail.displayName = 'CoinDetail';

// ── Main Page ──────────────────────────────────────────────────────────

type SortField = 'symbol' | 'score' | 'direction' | 'price' | 'change24h';

const MarketRegime: React.FC = () => {
  const navigate = useNavigate();
  const [scores, setScores] = useState<RegimeScoreItem[]>([]);
  const [btcRegime, setBtcRegime] = useState<MarketRegimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterLabel, setFilterLabel] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [scoresData, btcData] = await Promise.all([
          getRegimeScores(),
          getMarketRegime(),
        ]);
        if (!cancelled) {
          setScores(scoresData);
          setBtcRegime(btcData);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load regime data');
          setLoading(false);
        }
      }
    }
    load();
    const interval = setInterval(load, 300_000); // refresh every 5 min
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) { setSortAsc((a) => !a); return field; }
      setSortAsc(field === 'symbol');
      return field;
    });
  }, []);

  const filtered = scores.filter((s) => filterLabel === 'all' || s.label === filterLabel);

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
      case 'score': cmp = a.score - b.score; break;
      case 'direction': cmp = a.direction.localeCompare(b.direction); break;
      case 'price': cmp = a.price - b.price; break;
      case 'change24h': cmp = a.change24h - b.change24h; break;
    }
    return sortAsc ? cmp : -cmp;
  });

  // Stats
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : 0;
  const trendingCount = scores.filter((s) => s.score >= 60).length;
  const choppyCount = scores.filter((s) => s.score < 40).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
          <span className="text-muted-foreground text-sm">Calculating regime scores...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <span className="text-muted-foreground">{error}</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Market Regime Scoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trend vs Mean-Reversion score for each coin. Score 80+ = use trend strategies. Score 20- = use mean-reversion.
          </p>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* BTC Regime Gauge */}
        <div className="md:col-span-1 bg-card border border-border rounded-xl p-5 flex flex-col items-center">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">BTC Regime</h3>
          <ScoreGauge score={btcRegime?.regimeScore ?? avgScore} size={180} />
          {btcRegime?.regimeLabel && (
            <span className={cn(
              'mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-bold',
              getScoreColor(btcRegime.regimeScore ?? 50),
              getScoreBg(btcRegime.regimeScore ?? 50),
            )}>
              {getLabelText(btcRegime.regimeLabel)}
            </span>
          )}
        </div>

        {/* Market Overview Stats */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Market Average</h3>
          <div className="text-3xl font-bold text-foreground">{avgScore}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {avgScore >= 60 ? 'Market favors trend strategies' : avgScore <= 40 ? 'Market favors mean-reversion' : 'Mixed conditions'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trending Coins</h3>
          <div className="text-3xl font-bold text-green-400">{trendingCount}</div>
          <p className="text-xs text-muted-foreground mt-1">of {scores.length} coins (score 60+)</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Choppy Coins</h3>
          <div className="text-3xl font-bold text-orange-400">{choppyCount}</div>
          <p className="text-xs text-muted-foreground mt-1">of {scores.length} coins (score &lt;40)</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">How to use:</strong> The score combines ADX (trend strength),
          Hurst Exponent (persistence), Choppiness Index (noise level), and Kaufman Efficiency Ratio.
          A coin with score 85 is strongly trending — use breakout/momentum strategies.
          A coin with score 15 is mean-reverting — use Bollinger Band bounces and RSI extremes.
          Click any row to see the detailed breakdown.
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'strong_trend', 'trending', 'transitional', 'choppy', 'mean_reversion'].map((f) => (
          <button
            key={f}
            onClick={() => setFilterLabel(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filterLabel === f
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {f === 'all' ? `All (${scores.length})` : `${getLabelText(f)} (${scores.filter((s) => s.label === f).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                {([
                  ['symbol', 'Coin'],
                  ['score', 'Score'],
                  ['direction', 'Direction'],
                  ['price', 'Price'],
                  ['change24h', '24h %'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    className="px-4 py-3 text-left cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort(field)}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {sortField === field && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left">Regime</th>
                <th className="px-4 py-3 text-left">ADX</th>
                <th className="px-4 py-3 text-left">Hurst</th>
                <th className="px-4 py-3 text-left">Conf.</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <React.Fragment key={item.symbol}>
                  <tr
                    className={cn(
                      'border-b border-border/50 hover:bg-white/[0.02] cursor-pointer transition-colors',
                      expandedSymbol === item.symbol && 'bg-white/[0.02]',
                    )}
                    onClick={() => setExpandedSymbol((p) => (p === item.symbol ? null : item.symbol))}
                  >
                    {/* Symbol */}
                    <td className="px-4 py-3">
                      <button
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        onClick={(e) => { e.stopPropagation(); navigate(`/chart/${item.symbol}`); }}
                      >
                        {item.symbol.replace('USDT', '')}
                        <span className="text-muted-foreground font-normal">/USDT</span>
                      </button>
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center relative">
                          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                            <circle
                              cx="18" cy="18" r="14" fill="none"
                              className={getScoreColor(item.score).replace('text-', 'stroke-')}
                              strokeWidth="3"
                              strokeDasharray={`${(item.score / 100) * 88} 88`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className={cn('absolute text-xs font-bold', getScoreColor(item.score))}>
                            {item.score}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Direction */}
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs">
                        {getDirectionIcon(item.direction)}
                        <span className={cn(
                          item.direction === 'bullish' ? 'text-green-400' :
                          item.direction === 'bearish' ? 'text-red-400' : 'text-muted-foreground',
                        )}>
                          {item.direction.charAt(0).toUpperCase() + item.direction.slice(1)}
                        </span>
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 font-mono text-sm text-foreground">
                      ${item.price.toLocaleString(undefined, { maximumFractionDigits: item.price < 1 ? 6 : 2 })}
                    </td>

                    {/* 24h Change */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        'font-mono text-sm',
                        item.change24h > 0 ? 'text-green-400' : item.change24h < 0 ? 'text-red-400' : 'text-muted-foreground',
                      )}>
                        {item.change24h > 0 ? '+' : ''}{item.change24h}%
                      </span>
                    </td>

                    {/* Regime Label */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold',
                        getScoreColor(item.score), getScoreBg(item.score),
                      )}>
                        {getLabelText(item.label)}
                      </span>
                    </td>

                    {/* ADX */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {item.components.adx}
                    </td>

                    {/* Hurst */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {item.components.hurst}
                    </td>

                    {/* Confidence */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {item.confidence}%
                    </td>

                    {/* Expand */}
                    <td className="px-4 py-3">
                      <ChevronDown className={cn(
                        'w-4 h-4 text-muted-foreground transition-transform',
                        expandedSymbol === item.symbol && 'rotate-180',
                      )} />
                    </td>
                  </tr>

                  {expandedSymbol === item.symbol && (
                    <tr>
                      <td colSpan={10}>
                        <CoinDetail item={item} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <span className="text-muted-foreground text-sm">No coins match the selected filter</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketRegime;
