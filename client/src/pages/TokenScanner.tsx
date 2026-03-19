import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Shield, Search, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface RiskFactor {
  name: string;
  score: number;
  maxScore: number;
  detail: string;
}

interface ScanResult {
  symbol: string;
  score: number;
  label: 'SAFE' | 'CAUTION' | 'RISKY' | 'DANGER';
  factors: RiskFactor[];
}

interface RecentScan {
  symbol: string;
  score: number;
  label: string;
  scannedAt: string;
}

function getLabelColor(label: string): string {
  switch (label) {
    case 'SAFE': return 'text-green-400';
    case 'CAUTION': return 'text-yellow-400';
    case 'RISKY': return 'text-orange-400';
    case 'DANGER': return 'text-red-400';
    default: return 'text-muted-foreground';
  }
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 25) return '#f97316';
  return '#ef4444';
}

function getFactorBarColor(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.75) return 'bg-green-500';
  if (pct >= 0.5) return 'bg-yellow-500';
  if (pct >= 0.25) return 'bg-orange-500';
  return 'bg-red-500';
}

function getRecommendation(score: number, label: string): string {
  if (label === 'SAFE') return 'This token shows strong fundamentals across all risk factors. It appears relatively safe for trading, though always do your own additional research.';
  if (label === 'CAUTION') return 'This token has some positive indicators but also areas of concern. Consider smaller position sizes and use stop-losses.';
  if (label === 'RISKY') return 'Multiple risk factors are elevated. Only consider this token with high risk tolerance and very small position sizes.';
  return 'This token shows significant red flags across multiple risk factors. Extreme caution is advised. Consider avoiding or only using tiny test positions.';
}

const RiskGauge: React.FC<{ score: number }> = ({ score }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 200;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2 + 10;
    const radius = 80;
    const lineWidth = 12;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalArc = endAngle - startAngle;

    // Background arc
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = 'hsl(0, 0%, 20%)';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score arc
    const scoreAngle = startAngle + (score / 100) * totalArc;
    const color = getScoreColor(score);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, scoreAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score text
    ctx.fillStyle = color;
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(score), cx, cy - 5);

    // "/ 100" text
    ctx.fillStyle = 'hsl(0, 0%, 50%)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('/ 100', cx, cy + 25);
  }, [score]);

  return <canvas ref={canvasRef} className="mx-auto" />;
};

const TokenScanner: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  const scan = useCallback(async (symbol?: string) => {
    const s = (symbol || searchInput).trim().toUpperCase();
    if (!s) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/v1/scanner/${encodeURIComponent(s)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to scan token');
        return;
      }
      setResult(json.data);
      setRecentScans((prev) => {
        const filtered = prev.filter((r) => r.symbol !== json.data.symbol);
        return [
          { symbol: json.data.symbol, score: json.data.score, label: json.data.label, scannedAt: new Date().toISOString() },
          ...filtered,
        ].slice(0, 10);
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') scan();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Token Risk Scanner</h1>
          <p className="text-sm text-muted-foreground">Analyze any token for risk factors before trading</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Enter symbol (e.g. BTCUSDT)"
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>
        <button
          onClick={() => scan()}
          disabled={loading || !searchInput.trim()}
          className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score Card */}
          <div className="bg-secondary rounded-xl border border-border p-6 flex flex-col items-center">
            <h2 className="text-lg font-semibold text-foreground mb-1">{result.symbol}</h2>
            <span className={cn('text-sm font-bold mb-4', getLabelColor(result.label))}>
              {result.label}
            </span>
            <RiskGauge score={result.score} />
            <div className="mt-4 flex items-center gap-2">
              {result.label === 'SAFE' && <CheckCircle className="w-4 h-4 text-green-400" />}
              {result.label === 'CAUTION' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
              {result.label === 'RISKY' && <AlertTriangle className="w-4 h-4 text-orange-400" />}
              {result.label === 'DANGER' && <XCircle className="w-4 h-4 text-red-400" />}
              <span className="text-xs text-muted-foreground">Risk Assessment Score</span>
            </div>
          </div>

          {/* Factor Breakdown */}
          <div className="bg-secondary rounded-xl border border-border p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold text-foreground mb-4">Factor Breakdown</h3>
            <div className="space-y-4">
              {result.factors.map((factor) => (
                <div key={factor.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground font-medium">{factor.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {factor.score} / {factor.maxScore}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-background overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', getFactorBarColor(factor.score, factor.maxScore))}
                      style={{ width: `${(factor.score / factor.maxScore) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{factor.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-secondary rounded-xl border border-border p-6 lg:col-span-3">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Recommendation</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {getRecommendation(result.score, result.label)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <div className="bg-secondary rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Scans</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {recentScans.map((scan) => (
              <button
                key={scan.symbol + scan.scannedAt}
                onClick={() => {
                  setSearchInput(scan.symbol);
                  void (async () => {
                    setSearchInput(scan.symbol);
                    const el = scan;
                    setLoading(true);
                    setError(null);
                    try {
                      const res = await fetch(`/api/v1/scanner/${encodeURIComponent(el.symbol)}`);
                      const json = await res.json();
                      if (json.success) setResult(json.data);
                    } catch { /* ignore */ }
                    setLoading(false);
                  })();
                }}
                className="flex items-center gap-2 p-2 rounded-lg bg-background hover:bg-background/80 transition-colors border border-border"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getScoreColor(scan.score) }}
                />
                <span className="text-xs text-foreground font-medium truncate">{scan.symbol}</span>
                <span className="text-xs text-muted-foreground ml-auto">{scan.score}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenScanner;
