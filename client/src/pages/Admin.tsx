import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { cn } from '@/utils/cn';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Server,
  Shield,
  TrendingUp,
  Activity,
  BarChart3,
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Clock,
  CreditCard,
  Zap,
  RefreshCw,
} from 'lucide-react';

// ─── API helpers ────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

async function adminFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/v1/admin${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json.data ?? json;
}

async function adminMutate<T>(endpoint: string, method: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/v1/admin${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json.data ?? json;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalUsers: number;
  usersToday: number;
  mrr: number;
  arr: number;
  totalRevenue: number;
  activeSubscriptions: number;
  totalSignals: number;
  activePairs: number;
}

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  tier: string;
  created_at: string;
  is_banned?: boolean;
  language?: string;
  timezone?: string;
}

interface UserDetail extends AdminUser {
  subscriptionHistory: Array<{
    id: string;
    tier: string;
    status: string;
    started_at: string;
    expires_at: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    tx_hash: string | null;
    created_at: string;
  }>;
  stats: {
    alertsCount: number;
    paperTradingPnl: number;
  };
}

interface RevenueStats {
  mrr: number;
  arr: number;
  revenueToday: number;
  revenueMonth: number;
  growthPercent: number;
}

interface DailyRevenue {
  date: string;
  amount: number;
}

interface Payment {
  id: string;
  user_email: string;
  amount: number;
  currency: string;
  status: string;
  tx_hash: string | null;
  created_at: string;
}

interface SubscriptionsOverview {
  active: number;
  expired: number;
  cancelled: number;
  expiringSoon: Array<{ user_email: string; tier: string; expires_at: string }>;
  churnRate: number;
}

interface UserGrowthPoint {
  date: string;
  count: number;
}

interface TierDistribution {
  tier: string;
  count: number;
}

interface CollectorStatus {
  exchange: string;
  lastTick: string;
  lagSeconds: number;
}

interface SystemHealthData {
  dbStatus: string;
  redisStatus: string;
  latestSignalTime: string | null;
  candlesByExchange: Array<{ exchange: string; count: string }>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TIERS = ['starter', 'trader', 'pro', 'institutional'];
const PAYMENT_STATUSES = ['all', 'pending', 'confirmed', 'failed', 'refunded'];
const ITEMS_PER_PAGE = 15;

const TIER_BADGE: Record<string, string> = {
  starter: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  trader: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pro: 'bg-primary/20 text-primary border-primary/30',
  institutional: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-success/20 text-success border-success/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  failed: 'bg-danger/20 text-danger border-danger/30',
  refunded: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

type TabKey = 'overview' | 'users' | 'revenue' | 'system';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { key: 'revenue', label: 'Revenue', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'system', label: 'System', icon: <Server className="w-4 h-4" /> },
];

// ─── Formatting helpers ─────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtCurrencyFull(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncateHash(hash: string | null): string {
  if (!hash) return '-';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

// ─── Canvas Chart: Line ─────────────────────────────────────────────────────

function drawLineChart(
  canvas: HTMLCanvasElement,
  data: { label: string; value: number }[],
  color: string = '#C9A84C'
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || data.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  ctx.clearRect(0, 0, w, h);

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  // Grid lines
  ctx.strokeStyle = 'rgba(132, 142, 156, 0.15)';
  ctx.lineWidth = 1;
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = pad.top + (ch / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();

    // Y labels
    const val = maxVal - (range / gridSteps) * i;
    ctx.fillStyle = '#848E9C';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(val).toString(), pad.left - 8, y + 4);
  }

  // X labels (show ~6)
  const labelStep = Math.max(1, Math.floor(data.length / 6));
  ctx.fillStyle = '#848E9C';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < data.length; i += labelStep) {
    const x = pad.left + (cw / (data.length - 1)) * i;
    const label = data[i].label;
    ctx.fillText(label, x, h - pad.bottom + 18);
  }

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  gradient.addColorStop(0, `${color}40`);
  gradient.addColorStop(1, `${color}00`);

  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + ch);
  for (let i = 0; i < data.length; i++) {
    const x = pad.left + (cw / Math.max(data.length - 1, 1)) * i;
    const y = pad.top + ch - ((values[i] - minVal) / range) * ch;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  for (let i = 0; i < data.length; i++) {
    const x = pad.left + (cw / Math.max(data.length - 1, 1)) * i;
    const y = pad.top + ch - ((values[i] - minVal) / range) * ch;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ─── Canvas Chart: Bar ──────────────────────────────────────────────────────

function drawBarChart(
  canvas: HTMLCanvasElement,
  data: { label: string; value: number }[],
  color: string = '#0ECB81'
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || data.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { top: 20, right: 20, bottom: 40, left: 60 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  ctx.clearRect(0, 0, w, h);

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);

  // Grid lines
  ctx.strokeStyle = 'rgba(132, 142, 156, 0.15)';
  ctx.lineWidth = 1;
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = pad.top + (ch / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();

    const val = maxVal - (maxVal / gridSteps) * i;
    ctx.fillStyle = '#848E9C';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`$${Math.round(val)}`, pad.left - 8, y + 4);
  }

  const barWidth = Math.max(2, (cw / data.length) * 0.7);
  const gap = (cw / data.length) * 0.3;

  // X labels
  const labelStep = Math.max(1, Math.floor(data.length / 8));
  ctx.fillStyle = '#848E9C';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';

  for (let i = 0; i < data.length; i++) {
    const x = pad.left + (cw / data.length) * i + gap / 2;
    const barH = (values[i] / maxVal) * ch;
    const y = pad.top + ch - barH;

    // Bar gradient
    const barGrad = ctx.createLinearGradient(x, y, x, pad.top + ch);
    barGrad.addColorStop(0, color);
    barGrad.addColorStop(1, `${color}60`);

    ctx.fillStyle = barGrad;
    ctx.beginPath();
    const radius = Math.min(3, barWidth / 2);
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barWidth - radius, y);
    ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
    ctx.lineTo(x + barWidth, pad.top + ch);
    ctx.lineTo(x, pad.top + ch);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.fill();

    if (i % labelStep === 0) {
      ctx.fillStyle = '#848E9C';
      ctx.fillText(data[i].label, x + barWidth / 2, h - pad.bottom + 18);
    }
  }
}

// ─── Canvas Chart: Horizontal Bar ───────────────────────────────────────────

function drawHorizontalBarChart(
  canvas: HTMLCanvasElement,
  data: { label: string; value: number; color: string }[]
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || data.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { top: 10, right: 60, bottom: 10, left: 100 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  ctx.clearRect(0, 0, w, h);

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barHeight = Math.min(30, (ch / data.length) * 0.7);
  const rowHeight = ch / data.length;

  for (let i = 0; i < data.length; i++) {
    const y = pad.top + rowHeight * i + (rowHeight - barHeight) / 2;
    const barW = (data[i].value / maxVal) * cw;

    // Label
    ctx.fillStyle = '#EAECEF';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(data[i].label, pad.left - 12, y + barHeight / 2 + 4);

    // Bar
    const barGrad = ctx.createLinearGradient(pad.left, y, pad.left + barW, y);
    barGrad.addColorStop(0, data[i].color);
    barGrad.addColorStop(1, `${data[i].color}80`);
    ctx.fillStyle = barGrad;

    const radius = Math.min(4, barHeight / 2);
    ctx.beginPath();
    ctx.moveTo(pad.left + radius, y);
    ctx.lineTo(pad.left + barW - radius, y);
    ctx.arcTo(pad.left + barW, y, pad.left + barW, y + radius, radius);
    ctx.lineTo(pad.left + barW, y + barHeight - radius);
    ctx.arcTo(pad.left + barW, y + barHeight, pad.left + barW - radius, y + barHeight, radius);
    ctx.lineTo(pad.left + radius, y + barHeight);
    ctx.arcTo(pad.left, y + barHeight, pad.left, y + barHeight - radius, radius);
    ctx.lineTo(pad.left, y + radius);
    ctx.arcTo(pad.left, y, pad.left + radius, y, radius);
    ctx.fill();

    // Value
    ctx.fillStyle = '#EAECEF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(data[i].value.toString(), pad.left + barW + 8, y + barHeight / 2 + 4);
  }
}

// ─── Tier colors for chart ──────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  starter: '#6B7280',
  trader: '#3B82F6',
  pro: '#C9A84C',
  institutional: '#8B5CF6',
};

// ─── StatCard Component ─────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
}> = ({ icon, label, value, subtitle, trend }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      {trend !== undefined && (
        <p className={cn('text-xs mt-0.5 font-medium', trend >= 0 ? 'text-success' : 'text-danger')}>
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        </p>
      )}
    </CardContent>
  </Card>
);

// ─── TierBadge ──────────────────────────────────────────────────────────────

const TierBadge: React.FC<{ tier: string }> = ({ tier }) => (
  <span
    className={cn(
      'inline-block px-2 py-0.5 rounded-md text-xs font-medium border capitalize',
      TIER_BADGE[tier] || TIER_BADGE.starter
    )}
  >
    {tier}
  </span>
);

// ─── StatusBadge ────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={cn(
      'inline-block px-2 py-0.5 rounded-md text-xs font-medium border capitalize',
      STATUS_BADGE[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    )}
  >
    {status}
  </span>
);

// ─── Pagination ─────────────────────────────────────────────────────────────

const Pagination: React.FC<{
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}> = ({ page, totalPages, onPageChange }) => (
  <div className="flex items-center justify-between pt-4">
    <span className="text-sm text-muted-foreground">
      Page {page} of {Math.max(totalPages, 1)}
    </span>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-secondary text-sm text-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Prev
      </button>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-secondary text-sm text-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// ─── User Detail Modal ──────────────────────────────────────────────────────

const UserDetailModal: React.FC<{
  userId: string;
  onClose: () => void;
  onUserUpdated: () => void;
}> = ({ userId, onClose, onUserUpdated }) => {
  const addToast = useToastStore((s) => s.addToast);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminFetch<UserDetail>(`/users/${userId}`)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch(() => addToast('Failed to load user details.', 'danger'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, addToast]);

  const handleBanToggle = async () => {
    if (!detail) return;
    setActing(true);
    try {
      await adminMutate(`/users/${userId}/ban`, 'PUT', { banned: !detail.is_banned });
      setDetail((prev) => prev ? { ...prev, is_banned: !prev.is_banned } : prev);
      addToast(detail.is_banned ? 'User unbanned.' : 'User banned.', 'success');
      onUserUpdated();
    } catch {
      addToast('Action failed.', 'danger');
    } finally {
      setActing(false);
    }
  };

  const handleDelete = async () => {
    setActing(true);
    try {
      await adminMutate(`/users/${userId}`, 'DELETE');
      addToast('User deleted.', 'success');
      onUserUpdated();
      onClose();
    } catch {
      addToast('Delete failed.', 'danger');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">User Details</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : detail ? (
          <div className="p-5 space-y-6">
            {/* User Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Email" value={detail.email} />
              <InfoRow label="Name" value={detail.display_name || '-'} />
              <InfoRow label="Tier" value={<TierBadge tier={detail.tier} />} />
              <InfoRow label="Created" value={fmtDateTime(detail.created_at)} />
              <InfoRow label="Language" value={detail.language || 'en'} />
              <InfoRow label="Timezone" value={detail.timezone || 'UTC'} />
              <InfoRow label="Status" value={detail.is_banned ? <span className="text-danger font-medium">Banned</span> : <span className="text-success font-medium">Active</span>} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Alerts Count</p>
                <p className="text-lg font-bold text-foreground">{fmtNumber(detail.stats?.alertsCount ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Paper Trading PnL</p>
                <p className={cn('text-lg font-bold', (detail.stats?.paperTradingPnl ?? 0) >= 0 ? 'text-success' : 'text-danger')}>
                  {fmtCurrencyFull(detail.stats?.paperTradingPnl ?? 0)}
                </p>
              </div>
            </div>

            {/* Subscription History */}
            {detail.subscriptionHistory && detail.subscriptionHistory.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Subscription History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">Tier</th>
                        <th className="text-left py-2 px-2 font-medium">Status</th>
                        <th className="text-left py-2 px-2 font-medium">Started</th>
                        <th className="text-left py-2 px-2 font-medium">Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.subscriptionHistory.map((sub) => (
                        <tr key={sub.id} className="border-b border-border/50">
                          <td className="py-2 px-2"><TierBadge tier={sub.tier} /></td>
                          <td className="py-2 px-2"><StatusBadge status={sub.status} /></td>
                          <td className="py-2 px-2 text-muted-foreground">{fmtDate(sub.started_at)}</td>
                          <td className="py-2 px-2 text-muted-foreground">{fmtDate(sub.expires_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payments */}
            {detail.payments && detail.payments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payments</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">Amount</th>
                        <th className="text-left py-2 px-2 font-medium">Crypto</th>
                        <th className="text-left py-2 px-2 font-medium">Status</th>
                        <th className="text-left py-2 px-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((pay) => (
                        <tr key={pay.id} className="border-b border-border/50">
                          <td className="py-2 px-2 text-foreground">{fmtCurrencyFull(pay.amount)}</td>
                          <td className="py-2 px-2 text-foreground uppercase">{pay.currency}</td>
                          <td className="py-2 px-2"><StatusBadge status={pay.status} /></td>
                          <td className="py-2 px-2 text-muted-foreground">{fmtDate(pay.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <button
                onClick={handleBanToggle}
                disabled={acting}
                className="px-4 py-2 rounded-lg border border-danger/50 bg-danger/10 text-danger text-sm font-medium hover:bg-danger/20 disabled:opacity-50 transition-colors"
              >
                {detail.is_banned ? 'Unban User' : 'Ban User'}
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={acting}
                  className="px-4 py-2 rounded-lg border border-danger/50 bg-danger/10 text-danger text-sm font-medium hover:bg-danger/20 disabled:opacity-50 transition-colors"
                >
                  Delete User
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-danger flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Are you sure?
                  </span>
                  <button
                    onClick={handleDelete}
                    disabled={acting}
                    className="px-3 py-1.5 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/80 disabled:opacity-50 transition-colors"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-muted-foreground">Failed to load user details.</div>
        )}
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
    <div className="text-sm text-foreground">{value}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ─── OVERVIEW TAB ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const OverviewTab: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [growth, setGrowth] = useState<UserGrowthPoint[]>([]);
  const [tiers, setTiers] = useState<TierDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  const growthCanvasRef = useRef<HTMLCanvasElement>(null);
  const tierCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminFetch<DashboardStats>('/dashboard').catch(() => null),
      adminFetch<UserGrowthPoint[]>('/analytics/user-growth').catch(() => []),
      adminFetch<TierDistribution[]>('/analytics/tier-distribution').catch(() => []),
    ])
      .then(([d, g, t]) => {
        setStats(d);
        setGrowth(g);
        setTiers(t);
      })
      .catch(() => addToast('Failed to load overview data.', 'danger'))
      .finally(() => setLoading(false));
  }, [addToast]);

  // Draw growth chart
  useEffect(() => {
    if (!growthCanvasRef.current || growth.length === 0) return;
    const chartData = growth.map((g) => ({
      label: new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: g.count,
    }));
    drawLineChart(growthCanvasRef.current, chartData);

    const handleResize = () => {
      if (growthCanvasRef.current) drawLineChart(growthCanvasRef.current, chartData);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [growth]);

  // Draw tier chart
  useEffect(() => {
    if (!tierCanvasRef.current || tiers.length === 0) return;
    const chartData = tiers.map((t) => ({
      label: t.tier.charAt(0).toUpperCase() + t.tier.slice(1),
      value: t.count,
      color: TIER_COLORS[t.tier] || '#6B7280',
    }));
    drawHorizontalBarChart(tierCanvasRef.current, chartData);

    const handleResize = () => {
      if (tierCanvasRef.current) drawHorizontalBarChart(tierCanvasRef.current, chartData);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tiers]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={fmtNumber(stats.totalUsers)} />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Users Today" value={fmtNumber(stats.usersToday)} />
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="MRR" value={fmtCurrency(stats.mrr)} />
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="ARR" value={fmtCurrency(stats.arr)} />
          <StatCard icon={<CreditCard className="w-4 h-4" />} label="Total Revenue" value={fmtCurrency(stats.totalRevenue)} />
          <StatCard icon={<Zap className="w-4 h-4" />} label="Active Subs" value={fmtNumber(stats.activeSubscriptions)} />
          <StatCard icon={<BarChart3 className="w-4 h-4" />} label="Total Signals" value={fmtNumber(stats.totalSignals)} />
          <StatCard icon={<Activity className="w-4 h-4" />} label="Active Pairs" value={fmtNumber(stats.activePairs)} />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              User Growth (Last 90 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <canvas ref={growthCanvasRef} className="w-full h-full" />
              {growth.length === 0 && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No growth data available.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Tier Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <canvas ref={tierCanvasRef} className="w-full h-full" />
              {tiers.length === 0 && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No tier data available.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── USERS TAB ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const UsersTab: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (search) params.set('search', search);
      if (tierFilter !== 'all') params.set('tier', tierFilter);

      const data = await adminFetch<{ users: AdminUser[]; total: number }>(`/users?${params}`);
      setUsers(data.users || []);
      setTotalCount(data.total || 0);
    } catch {
      addToast('Failed to load users.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [page, search, tierFilter, addToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, tierFilter]);

  const handleTierChange = async (userId: string, tier: string) => {
    try {
      await adminMutate(`/users/${userId}/tier`, 'PUT', { tier });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, tier } : u)));
      addToast('User tier updated.', 'success');
    } catch {
      addToast('Failed to update tier.', 'danger');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
          <Users className="w-4 h-4" />
          {fmtNumber(totalCount)} users
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4 font-medium">Email</th>
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Tier</th>
                  <th className="text-left py-3 px-4 font-medium">Created</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2" />
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      <td className="py-3 px-4 text-foreground">{u.email}</td>
                      <td className="py-3 px-4 text-foreground">{u.display_name || '-'}</td>
                      <td className="py-3 px-4"><TierBadge tier={u.tier} /></td>
                      <td className="py-3 px-4 text-muted-foreground">{fmtDate(u.created_at)}</td>
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={u.tier}
                          onChange={(e) => handleTierChange(u.id, e.target.value)}
                          className="h-8 rounded-md border border-border bg-secondary px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {TIERS.map((t) => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && totalPages > 1 && (
            <div className="px-4 pb-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onUserUpdated={fetchUsers}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── REVENUE TAB ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const RevenueTab: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [subsOverview, setSubsOverview] = useState<SubscriptionsOverview | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentPage, setPaymentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const revenueCanvasRef = useRef<HTMLCanvasElement>(null);
  const paymentTotalPages = Math.ceil(paymentsTotal / ITEMS_PER_PAGE);

  // Load revenue data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminFetch<{ stats: RevenueStats; daily: DailyRevenue[] }>('/revenue').catch(() => null),
      adminFetch<SubscriptionsOverview>('/revenue/subscriptions').catch(() => null),
    ])
      .then(([rev, subs]) => {
        if (rev) {
          setRevenueStats(rev.stats);
          setDailyRevenue(rev.daily || []);
        }
        if (subs) setSubsOverview(subs);
      })
      .catch(() => addToast('Failed to load revenue data.', 'danger'))
      .finally(() => setLoading(false));
  }, [addToast]);

  // Load payments
  useEffect(() => {
    const params = new URLSearchParams({
      page: paymentPage.toString(),
      limit: ITEMS_PER_PAGE.toString(),
    });
    if (statusFilter !== 'all') params.set('status', statusFilter);

    adminFetch<{ payments: Payment[]; total: number }>(`/revenue/payments?${params}`)
      .then((data) => {
        setPayments(data.payments || []);
        setPaymentsTotal(data.total || 0);
      })
      .catch(() => {});
  }, [paymentPage, statusFilter]);

  useEffect(() => {
    setPaymentPage(1);
  }, [statusFilter]);

  // Draw revenue chart
  useEffect(() => {
    if (!revenueCanvasRef.current || dailyRevenue.length === 0) return;
    const chartData = dailyRevenue.map((d) => ({
      label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: d.amount,
    }));
    drawBarChart(revenueCanvasRef.current, chartData, '#0ECB81');

    const handleResize = () => {
      if (revenueCanvasRef.current) drawBarChart(revenueCanvasRef.current, chartData, '#0ECB81');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dailyRevenue]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Revenue Stats */}
      {revenueStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="MRR" value={fmtCurrency(revenueStats.mrr)} />
          <StatCard icon={<DollarSign className="w-4 h-4" />} label="ARR" value={fmtCurrency(revenueStats.arr)} />
          <StatCard icon={<CreditCard className="w-4 h-4" />} label="Revenue Today" value={fmtCurrency(revenueStats.revenueToday)} />
          <StatCard icon={<CreditCard className="w-4 h-4" />} label="Revenue This Month" value={fmtCurrency(revenueStats.revenueMonth)} />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Growth" value={`${revenueStats.growthPercent >= 0 ? '+' : ''}${revenueStats.growthPercent.toFixed(1)}%`} trend={revenueStats.growthPercent} />
        </div>
      )}

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Daily Revenue (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <canvas ref={revenueCanvasRef} className="w-full h-full" />
            {dailyRevenue.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No revenue data available.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payments
            </CardTitle>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-secondary px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-2 font-medium">User</th>
                  <th className="text-left py-3 px-2 font-medium">Amount</th>
                  <th className="text-left py-3 px-2 font-medium">Crypto</th>
                  <th className="text-left py-3 px-2 font-medium">Status</th>
                  <th className="text-left py-3 px-2 font-medium">Tx Hash</th>
                  <th className="text-left py-3 px-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No payments found.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                      <td className="py-3 px-2 text-foreground">{p.user_email}</td>
                      <td className="py-3 px-2 text-foreground font-medium">{fmtCurrencyFull(p.amount)}</td>
                      <td className="py-3 px-2 text-foreground uppercase">{p.currency}</td>
                      <td className="py-3 px-2"><StatusBadge status={p.status} /></td>
                      <td className="py-3 px-2">
                        {p.tx_hash ? (
                          <a
                            href={`https://blockchair.com/search?q=${p.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-mono text-xs"
                          >
                            {truncateHash(p.tx_hash)}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{fmtDate(p.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {paymentTotalPages > 1 && (
            <Pagination page={paymentPage} totalPages={paymentTotalPages} onPageChange={setPaymentPage} />
          )}
        </CardContent>
      </Card>

      {/* Subscriptions Overview */}
      {subsOverview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Subscriptions Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-lg font-bold text-success">{fmtNumber(subsOverview.active)}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Expired</p>
                <p className="text-lg font-bold text-muted-foreground">{fmtNumber(subsOverview.expired)}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Cancelled</p>
                <p className="text-lg font-bold text-danger">{fmtNumber(subsOverview.cancelled)}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Churn Rate</p>
                <p className="text-lg font-bold text-foreground">{subsOverview.churnRate.toFixed(1)}%</p>
              </div>
            </div>

            {/* Expiring Soon */}
            {subsOverview.expiringSoon && subsOverview.expiringSoon.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Expiring Soon
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">Email</th>
                        <th className="text-left py-2 px-2 font-medium">Tier</th>
                        <th className="text-left py-2 px-2 font-medium">Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subsOverview.expiringSoon.map((sub, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 px-2 text-foreground">{sub.user_email}</td>
                          <td className="py-2 px-2"><TierBadge tier={sub.tier} /></td>
                          <td className="py-2 px-2 text-yellow-400">{fmtDate(sub.expires_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SYSTEM TAB ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const SystemTab: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [collectors, setCollectors] = useState<CollectorStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminFetch<SystemHealthData>('/system').catch(() => null),
      adminFetch<CollectorStatus[]>('/analytics/collector-status').catch(() => []),
    ])
      .then(([h, c]) => {
        setHealth(h);
        setCollectors(c);
      })
      .catch(() => addToast('Failed to load system data.', 'danger'))
      .finally(() => setLoading(false));
  }, [addToast]);

  const refreshData = () => {
    setLoading(true);
    Promise.all([
      adminFetch<SystemHealthData>('/system').catch(() => null),
      adminFetch<CollectorStatus[]>('/analytics/collector-status').catch(() => []),
    ])
      .then(([h, c]) => {
        setHealth(h);
        setCollectors(c);
        addToast('System data refreshed.', 'success');
      })
      .catch(() => addToast('Failed to refresh.', 'danger'))
      .finally(() => setLoading(false));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Health Indicators */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Health Status
            </CardTitle>
            <button
              onClick={refreshData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                <div className={cn('w-3 h-3 rounded-full', health.dbStatus === 'ok' ? 'bg-success animate-pulse' : 'bg-danger')} />
                <div>
                  <p className="text-sm font-medium text-foreground">Database (PostgreSQL)</p>
                  <p className={cn('text-xs', health.dbStatus === 'ok' ? 'text-success' : 'text-danger')}>
                    {health.dbStatus === 'ok' ? 'Connected' : 'Error'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                <div className={cn('w-3 h-3 rounded-full', health.redisStatus === 'ok' ? 'bg-success animate-pulse' : 'bg-danger')} />
                <div>
                  <p className="text-sm font-medium text-foreground">Redis</p>
                  <p className={cn('text-xs', health.redisStatus === 'ok' ? 'text-success' : 'text-danger')}>
                    {health.redisStatus === 'ok' ? 'Connected' : 'Error'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Unable to fetch health data.</p>
          )}
        </CardContent>
      </Card>

      {/* Data Collector Monitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data Collector Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {collectors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-2 font-medium">Exchange</th>
                    <th className="text-left py-3 px-2 font-medium">Last Tick</th>
                    <th className="text-left py-3 px-2 font-medium">Lag</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {collectors.map((c) => {
                    const lagColor = c.lagSeconds < 5 ? 'success' : c.lagSeconds < 30 ? 'yellow-400' : 'danger';
                    const lagLabel = c.lagSeconds < 5 ? 'Healthy' : c.lagSeconds < 30 ? 'Delayed' : 'Critical';
                    return (
                      <tr key={c.exchange} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                        <td className="py-3 px-2 text-foreground font-medium capitalize">{c.exchange}</td>
                        <td className="py-3 px-2 text-muted-foreground">{fmtDateTime(c.lastTick)}</td>
                        <td className="py-3 px-2 text-foreground">{c.lagSeconds.toFixed(1)}s</td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2.5 h-2.5 rounded-full', `bg-${lagColor}`)} />
                            <span className={cn('text-xs font-medium', `text-${lagColor}`)}>{lagLabel}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4 text-center">No collector data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Candles by Exchange */}
      {health && health.candlesByExchange && health.candlesByExchange.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Candles by Exchange
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {health.candlesByExchange.map((item) => (
                <div key={item.exchange} className="rounded-lg border border-border bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground capitalize">{item.exchange}</p>
                  <p className="text-lg font-bold text-foreground">
                    {parseInt(item.count, 10).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Latest Signal Time */}
      {health && health.latestSignalTime && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Latest Signal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-foreground">{fmtDateTime(health.latestSignalTime)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── Loading Spinner ────────────────────────────────────────────────────────

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="flex flex-col items-center gap-3">
      <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      <span className="text-muted-foreground text-sm">Loading...</span>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ADMIN PAGE (Main Component) ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const Admin: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Admin check via server-side flag from GET /auth/me (no hardcoded emails in client)
  const isAdmin = user?.is_admin === true;

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Admin</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/50 border border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200',
              activeTab === tab.key
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-transparent'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'revenue' && <RevenueTab />}
        {activeTab === 'system' && <SystemTab />}
      </div>
    </div>
  );
};

export default Admin;
