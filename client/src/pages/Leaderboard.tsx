import React, { useEffect, useState } from 'react';
import { Trophy, Medal, TrendingUp, Target, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface PaperTrader {
  rank: number;
  displayName: string;
  returnPct: number;
  totalTrades: number;
  winRate: number;
}

interface StrategyPerformance {
  strategy: string;
  totalSignals: number;
  avgConfidence: number;
  winRate: number;
  wins: number;
  closed: number;
}

type Tab = 'paper' | 'signals';

function getRankBadge(rank: number): React.ReactNode {
  if (rank === 1) return <span className="text-amber-400 text-lg">&#x1f947;</span>;
  if (rank === 2) return <span className="text-slate-300 text-lg">&#x1f948;</span>;
  if (rank === 3) return <span className="text-amber-600 text-lg">&#x1f949;</span>;
  return <span className="text-muted-foreground font-mono text-sm w-6 text-center">{rank}</span>;
}

const Leaderboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('paper');
  const [paperData, setPaperData] = useState<PaperTrader[]>([]);
  const [signalData, setSignalData] = useState<StrategyPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'paper') {
          const res = await fetch('/api/v1/leaderboard/paper');
          const json = await res.json();
          if (json.success) setPaperData(json.data);
        } else {
          const res = await fetch('/api/v1/leaderboard/signals');
          const json = await res.json();
          if (json.success) setSignalData(json.data);
        }
      } catch {
        // ignore
      }
      setLoading(false);
    };
    fetchData();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Demo Data Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2 mb-4 flex items-center gap-2">
        <Info className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm text-muted-foreground">Simulated rankings — based on paper trading</span>
      </div>

      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Leaderboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('paper')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === 'paper'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Paper Trading
        </button>
        <button
          onClick={() => setActiveTab('signals')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === 'signals'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Signal Accuracy
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Trophy className="w-6 h-6 text-primary animate-pulse" />
        </div>
      ) : activeTab === 'paper' ? (
        /* Paper Trading Leaderboard */
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Trader</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Return %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Trades</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paperData.map((trader) => (
                  <tr
                    key={trader.rank}
                    className={cn(
                      'transition-colors hover:bg-secondary/50',
                      trader.rank <= 3 && 'bg-primary/5'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center w-8">
                        {getRankBadge(trader.rank)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-sm font-medium',
                        trader.rank <= 3 ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {trader.displayName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'text-sm font-mono font-medium',
                        trader.returnPct >= 0 ? 'text-green-500' : 'text-red-500'
                      )}>
                        {trader.returnPct >= 0 ? '+' : ''}{trader.returnPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-muted-foreground font-mono">{trader.totalTrades}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'text-sm font-mono',
                        trader.winRate >= 60 ? 'text-green-500' : trader.winRate >= 50 ? 'text-amber-500' : 'text-red-500'
                      )}>
                        {trader.winRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paperData.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No paper trading data yet.
            </div>
          )}
        </div>
      ) : (
        /* Signal Accuracy */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {signalData.length === 0 ? (
            <div className="col-span-full bg-card border border-border rounded-xl p-8 text-center">
              <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No signal data available yet.</p>
            </div>
          ) : (
            signalData.map((strat) => (
              <div key={strat.strategy} className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground capitalize">{strat.strategy}</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                    <p className={cn(
                      'text-lg font-bold font-mono',
                      strat.winRate >= 60 ? 'text-green-500' : strat.winRate >= 50 ? 'text-amber-500' : 'text-red-500'
                    )}>
                      {strat.winRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Signals</p>
                    <p className="text-lg font-bold text-foreground font-mono">{strat.totalSignals}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Confidence</p>
                    <p className="text-lg font-bold text-foreground font-mono">{strat.avgConfidence.toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Closed</p>
                    <p className="text-lg font-bold text-foreground font-mono">{strat.closed}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
