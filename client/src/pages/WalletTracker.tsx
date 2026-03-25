import React, { useEffect, useState } from 'react';
import { Wallet2, Plus, Trash2, ChevronDown, Copy, Info } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/auth';

interface TrackedWallet {
  id: string;
  address: string;
  chain: 'ethereum' | 'solana' | 'bitcoin';
  label?: string;
  totalValue: number;
  addedAt: string;
}

interface TokenHolding {
  token: string;
  amount: number;
  valueUsd: number;
  change24h: number;
}

const CHAIN_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  ethereum: { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'Ethereum' },
  solana: { bg: 'bg-purple-900/30', text: 'text-purple-400', label: 'Solana' },
  bitcoin: { bg: 'bg-amber-900/30', text: 'text-amber-400', label: 'Bitcoin' },
};

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

const WalletTracker: React.FC = () => {
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  // Add wallet form
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState<'ethereum' | 'solana' | 'bitcoin'>('ethereum');
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);

  const fetchWallets = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/wallets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setWallets(json.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      await fetchWallets();
      setLoading(false);
    };
    load();
  }, [isAuthenticated]);

  const handleAdd = async () => {
    if (!token || !address) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/v1/wallets/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address, chain, label: label || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setAddress('');
        setLabel('');
        await fetchWallets();
      } else {
        setError(json.error || 'Failed to add wallet');
      }
    } catch {
      setError('Failed to add wallet');
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/wallets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        if (expandedId === id) {
          setExpandedId(null);
          setHoldings([]);
        }
        await fetchWallets();
      }
    } catch {
      // ignore
    }
  };

  const handleExpand = async (wallet: TrackedWallet) => {
    if (expandedId === wallet.id) {
      setExpandedId(null);
      setHoldings([]);
      return;
    }
    setExpandedId(wallet.id);
    setHoldingsLoading(true);
    try {
      const res = await fetch(`/api/v1/wallets/${wallet.address}/balance?chain=${wallet.chain}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setHoldings(json.data.holdings);
    } catch {
      setHoldings([]);
    }
    setHoldingsLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Wallet2 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Wallet Tracker</h1>
        </div>
        <div className="p-8 rounded-lg border border-border bg-card text-center">
          <p className="text-muted-foreground">Please log in to track wallets.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center animate-pulse">
          <span className="text-black font-bold text-sm">Q</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Data Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-2 mb-4 flex items-center gap-2">
        <Info className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm text-muted-foreground">Demo balances — connect real wallet coming soon</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Wallet2 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Wallet Tracker</h1>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">DEMO</span>
      </div>

      {/* Add Wallet Form */}
      <div className="p-4 rounded-lg border border-border bg-card space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Add Wallet
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Wallet address (0x... / base58...)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="relative">
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value as 'ethereum' | 'solana' | 'bitcoin')}
              className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="ethereum">Ethereum</option>
              <option value="solana">Solana</option>
              <option value="bitcoin">Bitcoin</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleAdd}
          disabled={adding || !address}
          className={cn(
            'px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
            adding || !address
              ? 'bg-secondary text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {adding ? 'Adding...' : 'Track Wallet'}
        </button>
      </div>

      {/* Tracked Wallets */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Tracked Wallets {wallets.length > 0 && <span className="text-sm text-muted-foreground font-normal">({wallets.length})</span>}
        </h2>

        {wallets.length === 0 ? (
          <div className="p-8 rounded-lg border border-border bg-card text-center">
            <p className="text-muted-foreground text-sm">No wallets tracked yet. Add your first wallet above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {wallets.map((w) => {
              const chainBadge = CHAIN_BADGES[w.chain] || CHAIN_BADGES.ethereum;
              const isExpanded = expandedId === w.id;

              return (
                <div key={w.id} className="rounded-lg border border-border bg-card overflow-hidden">
                  {/* Wallet Row */}
                  <div
                    onClick={() => handleExpand(w)}
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {w.label && (
                          <span className="text-sm font-semibold text-foreground">{w.label}</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(w.address); }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                        >
                          {truncateAddress(w.address)}
                          <Copy className="w-3 h-3" />
                        </button>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', chainBadge.bg, chainBadge.text)}>
                          {chainBadge.label}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground">
                        ${w.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(w.id); }}
                      className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </div>

                  {/* Expanded Holdings Table */}
                  {isExpanded && (
                    <div className="border-t border-border p-4">
                      {holdingsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-5 h-5 rounded bg-gold-gradient animate-pulse" />
                        </div>
                      ) : holdings.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No holdings found.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-muted-foreground border-b border-border">
                                <th className="text-left py-2 pr-4 font-medium">Token</th>
                                <th className="text-right py-2 px-4 font-medium">Amount</th>
                                <th className="text-right py-2 px-4 font-medium">Value (USD)</th>
                                <th className="text-right py-2 pl-4 font-medium">24h</th>
                              </tr>
                            </thead>
                            <tbody>
                              {holdings.map((h) => (
                                <tr key={h.token} className="border-b border-border/50 last:border-b-0">
                                  <td className="py-2.5 pr-4 font-medium text-foreground">{h.token}</td>
                                  <td className="py-2.5 px-4 text-right text-muted-foreground">
                                    {h.amount.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-foreground font-medium">
                                    ${h.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className={cn(
                                    'py-2.5 pl-4 text-right font-medium',
                                    h.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                                  )}>
                                    {h.change24h >= 0 ? '+' : ''}{h.change24h.toFixed(2)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletTracker;
