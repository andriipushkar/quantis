import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Server, Wifi, WifiOff, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { getExchangeHealth, type ExchangeHealthData } from '@/services/api';
import { cn } from '@/utils/cn';

function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

function getLabelBadge(label: string) {
  switch (label) {
    case 'Healthy':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400">
          <CheckCircle className="w-3 h-3" /> Healthy
        </span>
      );
    case 'Degraded':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-400">
          <AlertTriangle className="w-3 h-3" /> Degraded
        </span>
      );
    case 'Critical':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400">
          <WifiOff className="w-3 h-3" /> Critical
        </span>
      );
    default:
      return null;
  }
}

function getWsIcon(status: string) {
  switch (status) {
    case 'connected':
      return <Wifi className="w-4 h-4 text-green-400" />;
    case 'stale':
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    default:
      return <WifiOff className="w-4 h-4 text-red-400" />;
  }
}

function formatExchangeName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const ScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const centerX = w / 2;
    const centerY = h * 0.78;
    const radius = Math.min(w, h) * 0.42;

    ctx.clearRect(0, 0, w, h);

    // Background arc
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score arc
    const scoreAngle = startAngle + (score / 100) * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, scoreAngle);
    ctx.strokeStyle = getScoreColor(score);
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
  }, [score]);

  return (
    <div className="relative w-full h-28">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
        <span className="text-2xl font-bold font-mono text-foreground">{score}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
};

const ExchangeHealth: React.FC = () => {
  const [data, setData] = useState<ExchangeHealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getExchangeHealth();
      setData(result);
      setLastChecked(new Date());
      setError(null);
    } catch {
      setError('Failed to fetch exchange health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Server className="w-8 h-8 text-primary animate-pulse" />
          <span className="text-muted-foreground text-sm">Checking exchange health...</span>
        </div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Server className="w-8 h-8 text-danger" />
          <span className="text-muted-foreground text-sm">{error}</span>
          <button
            onClick={fetchData}
            className="mt-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Exchange Health Monitor</h1>
        </div>
        {lastChecked && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Exchange Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {data.map((ex) => (
          <div
            key={ex.exchange}
            className={cn(
              'bg-card border rounded-xl p-5 transition-all',
              ex.label === 'Healthy' ? 'border-green-500/30' :
              ex.label === 'Degraded' ? 'border-yellow-500/30' :
              'border-red-500/30'
            )}
          >
            {/* Exchange Name + Badge */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">
                {formatExchangeName(ex.exchange)}
              </h2>
              {getLabelBadge(ex.label)}
            </div>

            {/* Score Gauge */}
            <ScoreGauge score={ex.score} />

            {/* Metrics */}
            <div className="space-y-3 mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Active Pairs</span>
                <span className="text-sm font-semibold text-foreground">{ex.metrics.activePairs}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Data Freshness</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ex.metrics.dataFreshness}%`,
                        backgroundColor: getScoreColor(ex.metrics.dataFreshness),
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{ex.metrics.dataFreshness}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">WebSocket</span>
                <div className="flex items-center gap-1.5">
                  {getWsIcon(ex.metrics.wsStatus)}
                  <span className="text-sm font-medium text-foreground capitalize">{ex.metrics.wsStatus}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Latest Update</span>
                <span className="text-xs font-mono text-muted-foreground">
                  {ex.metrics.latestUpdate
                    ? new Date(ex.metrics.latestUpdate).toLocaleTimeString()
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExchangeHealth;
