import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { cn } from '@/utils/cn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import {
  Copy,
  Check,
  Users,
  DollarSign,
  Clock,
  Share2,
  UserPlus,
  Gift,
} from 'lucide-react';

interface ReferralData {
  referralCode: string | null;
  referralLink: string | null;
  totalReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
}

const Referral: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const addToast = useToastStore((s) => s.addToast);
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/referral', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleCopy = async () => {
    if (!data?.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      addToast('Referral link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Failed to copy link', 'danger');
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const res = await fetch('/api/v1/referral/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      addToast(result.message || 'Withdrawal submitted', 'success');
    } catch {
      addToast('Withdrawal request failed', 'danger');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center animate-pulse">
            <span className="text-black font-bold text-lg">Q</span>
          </div>
          <span className="text-muted-foreground text-sm">Loading referral data...</span>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Referrals',
      value: data?.totalReferrals ?? 0,
      icon: Users,
      color: 'text-primary',
    },
    {
      label: 'Total Earnings',
      value: `$${(data?.totalEarnings ?? 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-success',
    },
    {
      label: 'Pending',
      value: `$${(data?.pendingEarnings ?? 0).toFixed(2)}`,
      icon: Clock,
      color: 'text-warning',
    },
  ];

  const steps = [
    {
      icon: Share2,
      title: 'Share your link',
      description: 'Send your unique referral link to friends, on social media, or in communities.',
    },
    {
      icon: UserPlus,
      title: 'Friend signs up',
      description: 'They create a free Quantis account using your link and start trading.',
    },
    {
      icon: Gift,
      title: 'Earn 20%',
      description: 'You earn 20% commission on their first paid subscription. Withdraw anytime.',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Referral Program</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite friends and earn 20% commission on their first subscription.
        </p>
      </div>

      {/* Referral link */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground font-mono truncate border border-border">
              {data?.referralLink || 'No referral link available'}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              disabled={!data?.referralLink}
              className="flex-shrink-0"
            >
              {copied ? (
                <Check className="w-4 h-4 mr-1.5" />
              ) : (
                <Copy className="w-4 h-4 mr-1.5" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          {data?.referralCode && (
            <p className="text-xs text-muted-foreground mt-2">
              Referral code: <span className="font-mono text-foreground">{data.referralCode}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={cn('w-10 h-10 rounded-lg bg-secondary flex items-center justify-center', stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Withdraw */}
      {(data?.pendingEarnings ?? 0) > 0 && (
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                You have ${(data?.pendingEarnings ?? 0).toFixed(2)} available to withdraw
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Minimum withdrawal: $10. Paid in USDT to your wallet.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleWithdraw}
              isLoading={withdrawing}
              disabled={(data?.pendingEarnings ?? 0) < 10}
            >
              Withdraw
            </Button>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-col items-center text-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gold-gradient text-black text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">{step.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Referral history placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Referral History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    No referrals yet. Share your link to get started!
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Referral;
