import React from 'react';
import { Lock, Link2, BarChart3, Box, Bell } from 'lucide-react';
import { useToastStore } from '@/stores/toast';

const featureCards = [
  {
    icon: Link2,
    title: 'Options Chain',
    description:
      'All strikes and expirations with Greeks, IV, volume, OI',
  },
  {
    icon: BarChart3,
    title: 'Max Pain',
    description:
      'Price where most options expire worthless. Key support/resistance level.',
  },
  {
    icon: Box,
    title: 'IV Surface',
    description:
      '3D visualization of implied volatility across strikes and expirations',
  },
];

const mockStrikes = [
  { strike: 90000, callBid: 5200, callAsk: 5350, putBid: 320, putAsk: 380, iv: 52.1 },
  { strike: 95000, callBid: 2800, callAsk: 2950, putBid: 780, putAsk: 860, iv: 48.3 },
  { strike: 100000, callBid: 1100, callAsk: 1250, putBid: 1900, putAsk: 2050, iv: 45.7 },
  { strike: 105000, callBid: 420, callAsk: 530, putBid: 4200, putAsk: 4380, iv: 50.2 },
  { strike: 110000, callBid: 140, callAsk: 210, putBid: 7800, putAsk: 7950, iv: 55.9 },
];

const Options: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Options Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Advanced options data for crypto derivatives
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
          Available on Pro plan
        </span>
      </div>

      {/* Feature Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {featureCards.map((card) => (
          <div
            key={card.title}
            className="bg-card border border-border rounded-xl p-6 transition-all duration-200 hover:border-primary/40"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <card.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-foreground font-semibold text-base mb-2">
              {card.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {card.description}
            </p>
          </div>
        ))}
      </div>

      {/* Mock Options Chain Preview */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-foreground font-semibold">
            BTC Options Chain Preview
          </h2>
          <span className="text-xs text-muted-foreground">
            Expiry: 28 Mar 2026 (sample data)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs border-b border-border">
                <th className="px-4 py-3 text-right font-medium">Call Bid</th>
                <th className="px-4 py-3 text-right font-medium">Call Ask</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">Strike</th>
                <th className="px-4 py-3 text-right font-medium">Put Bid</th>
                <th className="px-4 py-3 text-right font-medium">Put Ask</th>
                <th className="px-4 py-3 text-right font-medium">IV %</th>
              </tr>
            </thead>
            <tbody>
              {mockStrikes.map((row) => (
                <tr
                  key={row.strike}
                  className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                >
                  <td className="px-4 py-2.5 text-right font-mono text-success">
                    {row.callBid.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-success">
                    {row.callAsk.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono font-semibold text-foreground">
                    {row.strike.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-danger">
                    {row.putBid.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-danger">
                    {row.putAsk.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                    {row.iv.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notify Me */}
      <div className="flex justify-center">
        <button
          onClick={() => addToast("You'll be notified when Options launch", 'success')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:opacity-90"
        >
          <Bell className="w-4 h-4" />
          Notify me when available
        </button>
      </div>
    </div>
  );
};

export default Options;
