import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';

import {
  getAdminDashboard,
  getAdminUsers,
  getSystemHealth,
  updateUserTier,
  type AdminDashboard,
  type AdminUser,
  type SystemHealth,
} from '@/services/api';
import { useToastStore } from '@/stores/toast';
import {
  Users,
  BarChart3,
  Activity,
  Database,
  Shield,
  DollarSign,
  TrendingUp,
  Server,
} from 'lucide-react';

const TIERS = ['starter', 'trader', 'pro', 'institutional'];

const Admin: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);

  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin check via server-side flag from GET /auth/me (no hardcoded emails in client)
  const isAdmin = user?.is_admin === true;

  useEffect(() => {
    if (!isAdmin) return;

    async function load() {
      setLoading(true);
      try {
        const [d, u, h] = await Promise.all([
          getAdminDashboard(),
          getAdminUsers(),
          getSystemHealth(),
        ]);
        setDashboard(d);
        setUsers(u);
        setHealth(h);
      } catch {
        addToast('Failed to load admin data.', 'danger');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAdmin, addToast]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleTierChange = async (userId: string, tier: string) => {
    try {
      await updateUserTier(userId, tier);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, tier } : u))
      );
      addToast('User tier updated.', 'success');
    } catch {
      addToast('Failed to update tier.', 'danger');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center animate-pulse">
            <span className="text-black font-bold text-lg">Q</span>
          </div>
          <span className="text-muted-foreground text-sm">Loading admin panel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Admin</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
      </div>

      {/* Stats Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={dashboard.totalUsers} />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Users Today" value={dashboard.usersToday} />
          <StatCard icon={<BarChart3 className="w-4 h-4" />} label="Total Signals" value={dashboard.totalSignals} />
          <StatCard icon={<Database className="w-4 h-4" />} label="Total Candles" value={dashboard.totalCandles.toLocaleString()} />
          <StatCard icon={<Activity className="w-4 h-4" />} label="Active Pairs" value={dashboard.activePairs} />
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="Revenue" value="$0" />
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-2 font-medium">Email</th>
                  <th className="text-left py-3 px-2 font-medium">Display Name</th>
                  <th className="text-left py-3 px-2 font-medium">Tier</th>
                  <th className="text-left py-3 px-2 font-medium">Created</th>
                  <th className="text-left py-3 px-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                    <td className="py-3 px-2 text-foreground">{u.email}</td>
                    <td className="py-3 px-2 text-foreground">{u.display_name || '-'}</td>
                    <td className="py-3 px-2">
                      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                        {u.tier}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2">
                      <select
                        value={u.tier}
                        onChange={(e) => handleTierChange(u.id, e.target.value)}
                        className="h-8 rounded-md border border-border bg-secondary px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {TIERS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    health.dbStatus === 'ok' ? 'bg-success' : 'bg-danger'
                  }`}
                />
                <span className="text-sm text-foreground">
                  Database: <span className="font-medium">{health.dbStatus === 'ok' ? 'Connected' : 'Error'}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    health.redisStatus === 'ok' ? 'bg-success' : 'bg-danger'
                  }`}
                />
                <span className="text-sm text-foreground">
                  Redis: <span className="font-medium">{health.redisStatus === 'ok' ? 'Connected' : 'Error'}</span>
                </span>
              </div>
            </div>

            {health.latestSignalTime && (
              <div className="text-sm text-muted-foreground">
                Latest Signal: {new Date(health.latestSignalTime).toLocaleString()}
              </div>
            )}

            {health.candlesByExchange.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Candles by Exchange</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {health.candlesByExchange.map((item) => (
                    <div
                      key={item.exchange}
                      className="rounded-lg border border-border bg-secondary/50 px-3 py-2"
                    >
                      <p className="text-xs text-muted-foreground">{item.exchange}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {parseInt(item.count, 10).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({
  icon,
  label,
  value,
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </CardContent>
  </Card>
);

export default Admin;
