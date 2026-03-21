import React, { useMemo } from 'react';
import { cn } from '@/utils/cn';
import type { ConfluenceScore } from '@/services/api';

interface ConfluenceGaugeProps {
  data: ConfluenceScore;
  compact?: boolean;
}

const LABEL_CONFIG = {
  strong_buy: { text: 'Strong Buy', color: 'text-success', bg: 'bg-success/15', ring: 'ring-success/30' },
  buy: { text: 'Buy', color: 'text-success', bg: 'bg-success/10', ring: 'ring-success/20' },
  neutral: { text: 'Neutral', color: 'text-muted-foreground', bg: 'bg-secondary', ring: 'ring-border' },
  sell: { text: 'Sell', color: 'text-danger', bg: 'bg-danger/10', ring: 'ring-danger/20' },
  strong_sell: { text: 'Strong Sell', color: 'text-danger', bg: 'bg-danger/15', ring: 'ring-danger/30' },
};

const RISK_CONFIG = {
  low: { text: 'Low Risk', color: 'text-success' },
  medium: { text: 'Medium Risk', color: 'text-primary' },
  high: { text: 'High Risk', color: 'text-danger' },
};

const COMPONENT_LABELS: Record<string, { name: string; icon: string }> = {
  trend: { name: 'Trend', icon: '/' },
  momentum: { name: 'Momentum', icon: '~' },
  signals: { name: 'Signals', icon: '!' },
  sentiment: { name: 'Sentiment', icon: '#' },
  volume: { name: 'Volume', icon: '^' },
};

function scoreToColor(score: number): string {
  if (score >= 70) return '#0ECB81'; // success green
  if (score >= 55) return '#3DB68A';
  if (score >= 45) return '#848E9C'; // neutral grey
  if (score >= 30) return '#D9534F';
  return '#F6465D'; // danger red
}

export const ConfluenceGauge: React.FC<ConfluenceGaugeProps> = ({ data, compact = false }) => {
  const config = LABEL_CONFIG[data.label];
  const riskConfig = RISK_CONFIG[data.risk];

  const gaugeRotation = useMemo(() => {
    // Map score 1-100 to -90deg to +90deg (semicircle)
    return ((data.score - 1) / 99) * 180 - 90;
  }, [data.score]);

  const scoreColor = scoreToColor(data.score);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1', config.bg, config.ring)}>
        <span className="text-lg font-bold font-mono" style={{ color: scoreColor }}>
          {data.score}
        </span>
        <span className={cn('text-xs font-semibold', config.color)}>{config.text}</span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Decision Confluence
          </h3>
          <span className="text-sm font-semibold text-foreground">{data.symbol}</span>
        </div>
        <div className={cn('px-2.5 py-1 rounded-md text-xs font-semibold ring-1', config.bg, config.color, config.ring)}>
          {config.text}
        </div>
      </div>

      {/* Gauge */}
      <div className="flex flex-col items-center">
        <div className="relative w-40 h-20 overflow-hidden">
          {/* Semicircle background */}
          <svg viewBox="0 0 200 100" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 10 100 A 90 90 0 0 1 190 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              className="text-secondary"
              strokeLinecap="round"
            />
            {/* Colored arc (proportional to score) */}
            <path
              d="M 10 100 A 90 90 0 0 1 190 100"
              fill="none"
              stroke={scoreColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(data.score / 100) * 283} 283`}
            />
          </svg>
          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 origin-bottom"
            style={{
              transform: `translateX(-50%) rotate(${gaugeRotation}deg)`,
              width: '2px',
              height: '60px',
              background: 'linear-gradient(to top, transparent, currentColor)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-foreground -ml-[3px] -mt-1" />
          </div>
        </div>
        {/* Score number */}
        <div className="flex items-baseline gap-1 -mt-2">
          <span className="text-3xl font-bold font-mono" style={{ color: scoreColor }}>
            {data.score}
          </span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className={cn('text-xs', riskConfig.color)}>{riskConfig.text}</span>
          <span className="text-xs text-muted-foreground">
            Confidence: {data.confidence}%
          </span>
        </div>
      </div>

      {/* Component Breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Components
        </h4>
        {Object.entries(data.components).map(([key, component]) => {
          const meta = COMPONENT_LABELS[key] || { name: key, icon: '?' };
          const barColor = scoreToColor(component.score);

          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-20 flex items-center gap-1">
                <span className="font-mono text-[10px] opacity-50">{meta.icon}</span>
                {meta.name}
              </span>
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${component.score}%`, backgroundColor: barColor }}
                />
              </div>
              <span className="text-xs font-mono w-8 text-right" style={{ color: barColor }}>
                {component.score}
              </span>
              <span className="text-[10px] text-muted-foreground w-6 text-right">
                {component.weight}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConfluenceGauge;
