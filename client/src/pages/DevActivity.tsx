import React, { useState, useEffect } from 'react';
import { GitBranch, Star, AlertTriangle, Users, Code, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Project {
  symbol: string;
  name: string;
  weeklyCommits: number;
  activeDevs: number;
  stars: number;
  openIssues: number;
  lastRelease: string;
  devScore: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-yellow-500';
  return 'text-danger';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-success';
  if (score >= 60) return 'bg-primary';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-danger';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

const DevActivity: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/market/dev-activity');
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || 'Failed to load data');
        } else {
          setProjects(json.data.projects);
        }
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <GitBranch className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Developer Activity</h1>
          <p className="text-sm text-muted-foreground">GitHub development metrics for top crypto projects</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}

      {!loading && projects.length > 0 && (
        <>
          {/* Project cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => (
              <div key={p.symbol} className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-foreground font-semibold text-lg">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">{p.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-2xl font-bold', scoreColor(p.devScore))}>{p.devScore}</p>
                    <p className={cn('text-xs font-semibold', scoreColor(p.devScore))}>{scoreLabel(p.devScore)}</p>
                  </div>
                </div>

                {/* Score gauge */}
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', scoreBg(p.devScore))}
                    style={{ width: `${p.devScore}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Commits/wk</span>
                    <span className="ml-auto font-mono font-semibold text-foreground">{p.weeklyCommits}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Devs</span>
                    <span className="ml-auto font-mono font-semibold text-foreground">{p.activeDevs}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Stars</span>
                    <span className="ml-auto font-mono font-semibold text-foreground">{(p.stars / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Issues</span>
                    <span className="ml-auto font-mono font-semibold text-foreground">{p.openIssues}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">Last release: {p.lastRelease}</p>

                {p.devScore < 40 && (
                  <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Low development activity warning
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-foreground font-semibold">Comparison</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs border-b border-border">
                    <th className="px-4 py-3 text-left font-medium">Project</th>
                    <th className="px-4 py-3 text-right font-medium">Dev Score</th>
                    <th className="px-4 py-3 text-right font-medium">Commits/wk</th>
                    <th className="px-4 py-3 text-right font-medium">Active Devs</th>
                    <th className="px-4 py-3 text-right font-medium">Stars</th>
                    <th className="px-4 py-3 text-right font-medium">Open Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {projects
                    .sort((a, b) => b.devScore - a.devScore)
                    .map((p) => (
                      <tr key={p.symbol} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-foreground">{p.name} <span className="text-muted-foreground font-normal">({p.symbol})</span></td>
                        <td className={cn('px-4 py-2.5 text-right font-mono font-bold', scoreColor(p.devScore))}>{p.devScore}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{p.weeklyCommits}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{p.activeDevs}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{p.stars.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{p.openIssues}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5" />
            Data refreshed every 30 minutes. Metrics are simulated for demonstration.
          </div>
        </>
      )}
    </div>
  );
};

export default DevActivity;
