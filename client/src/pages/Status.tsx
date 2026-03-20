import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
}

interface ExchangeStatus {
  name: string;
  score: number | null;
  status: 'operational' | 'degraded' | 'down';
}

interface HealthData {
  services: ServiceStatus[];
  exchanges: ExchangeStatus[];
  database: 'connected' | 'disconnected';
  uptime: string | null;
  overall: 'operational' | 'partial' | 'major';
}

const REFRESH_INTERVAL = 30_000;

const StatusDot: React.FC<{ status: 'operational' | 'degraded' | 'down' }> = ({ status }) => {
  const colors: Record<string, string> = {
    operational: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    down: 'bg-red-500',
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status] ?? colors.down}`} />
  );
};

const Status: React.FC = () => {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const [healthRes, exchangeRes] = await Promise.allSettled([
        fetch('/health'),
        fetch('/api/v1/exchanges/health'),
      ]);

      let uptime: string | null = null;
      let dbStatus: 'connected' | 'disconnected' = 'disconnected';
      const services: ServiceStatus[] = [
        { name: 'API Gateway', status: 'down' },
        { name: 'Data Collector', status: 'down' },
        { name: 'Analysis Engine', status: 'down' },
        { name: 'Alert Service', status: 'down' },
      ];

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const hJson = await healthRes.value.json();
        uptime = hJson.uptime ?? hJson.data?.uptime ?? null;
        dbStatus =
          hJson.database === 'connected' || hJson.db === 'connected' || hJson.data?.database === 'connected'
            ? 'connected'
            : 'disconnected';
        // If health endpoint responds, core services are up
        services[0].status = 'operational'; // API Gateway
        services[1].status = 'operational'; // Data Collector
        services[2].status = 'operational'; // Analysis Engine
        services[3].status = 'operational'; // Alert Service
      }

      const exchanges: ExchangeStatus[] = [
        { name: 'Binance', score: null, status: 'down' },
        { name: 'Bybit', score: null, status: 'down' },
        { name: 'OKX', score: null, status: 'down' },
      ];

      if (exchangeRes.status === 'fulfilled' && exchangeRes.value.ok) {
        const eJson = await exchangeRes.value.json();
        const exData = eJson.data ?? eJson;
        const arr = Array.isArray(exData) ? exData : Object.values(exData);
        arr.forEach((ex: any) => {
          const name = (ex.name ?? ex.exchange ?? '').toLowerCase();
          const match = exchanges.find((e) => name.includes(e.name.toLowerCase()));
          if (match) {
            const score = ex.score ?? ex.health ?? ex.healthScore ?? null;
            match.score = typeof score === 'number' ? score : null;
            match.status =
              match.score !== null
                ? match.score >= 80
                  ? 'operational'
                  : match.score >= 50
                    ? 'degraded'
                    : 'down'
                : 'operational';
          }
        });
      }

      const allStatuses = [
        ...services.map((s) => s.status),
        ...exchanges.map((e) => e.status),
        dbStatus === 'connected' ? 'operational' : 'down',
      ];
      const hasDown = allStatuses.includes('down');
      const hasDegraded = allStatuses.includes('degraded');
      const overall: HealthData['overall'] =
        hasDown ? 'major' : hasDegraded ? 'partial' : 'operational';

      setData({ services, exchanges, database: dbStatus, uptime, overall });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchHealth]);

  const formatUptime = (val: string | null) => {
    if (!val) return 'N/A';
    const secs = parseFloat(val);
    if (isNaN(secs)) return val;
    const days = Math.floor(secs / 86400);
    const hrs = Math.floor((secs % 86400) / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${days}d ${hrs}h ${mins}m`;
  };

  const overallLabel: Record<string, { text: string; color: string; Icon: React.ElementType }> = {
    operational: { text: 'All Systems Operational', color: 'text-emerald-500', Icon: CheckCircle },
    partial: { text: 'Partial Outage', color: 'text-amber-500', Icon: AlertTriangle },
    major: { text: 'Major Outage', color: 'text-red-500', Icon: XCircle },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center">
              <span className="text-black font-bold text-sm">Q</span>
            </div>
            <span className="text-primary font-bold text-lg tracking-wide">Quantis Status</span>
          </Link>
          <button
            onClick={fetchHealth}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Overall status banner */}
        {data ? (
          <div
            className={`flex items-center gap-3 p-5 rounded-xl border ${
              data.overall === 'operational'
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : data.overall === 'partial'
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-red-500/5 border-red-500/20'
            }`}
          >
            {(() => {
              const info = overallLabel[data.overall];
              return (
                <>
                  <info.Icon className={`w-6 h-6 ${info.color}`} />
                  <span className={`text-lg font-semibold ${info.color}`}>{info.text}</span>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-5 rounded-xl border border-border bg-card">
            <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
            <span className="text-muted-foreground">Checking system status...</span>
          </div>
        )}

        {data && (
          <>
            {/* Services */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
              <h2 className="px-5 py-4 text-sm font-semibold text-foreground border-b border-border">
                Services
              </h2>
              <ul>
                {data.services.map((svc) => (
                  <li
                    key={svc.name}
                    className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 last:border-b-0"
                  >
                    <span className="text-sm text-foreground">{svc.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground capitalize">{svc.status}</span>
                      <StatusDot status={svc.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Exchanges */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
              <h2 className="px-5 py-4 text-sm font-semibold text-foreground border-b border-border">
                Exchanges
              </h2>
              <ul>
                {data.exchanges.map((ex) => (
                  <li
                    key={ex.name}
                    className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 last:border-b-0"
                  >
                    <span className="text-sm text-foreground">{ex.name}</span>
                    <div className="flex items-center gap-3">
                      {ex.score !== null && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {ex.score.toFixed(0)}%
                        </span>
                      )}
                      <StatusDot status={ex.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Database + Uptime */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
              <h2 className="px-5 py-4 text-sm font-semibold text-foreground border-b border-border">
                Infrastructure
              </h2>
              <ul>
                <li className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
                  <span className="text-sm text-foreground">Database</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground capitalize">
                      {data.database}
                    </span>
                    <StatusDot
                      status={data.database === 'connected' ? 'operational' : 'down'}
                    />
                  </div>
                </li>
                <li className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm text-foreground">API Uptime</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatUptime(data.uptime)}
                  </span>
                </li>
              </ul>
            </section>
          </>
        )}

        {/* Last checked */}
        {lastChecked && (
          <p className="text-center text-xs text-muted-foreground">
            Last checked: {lastChecked.toLocaleTimeString()} &middot; Auto-refreshes every 30s
          </p>
        )}
      </main>
    </div>
  );
};

export default Status;
