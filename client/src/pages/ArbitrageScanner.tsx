import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, RefreshCw, Calculator, Zap, TrendingUp, Clock, Bell, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { SkeletonRow } from '@/components/common/Skeleton';

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

async function arbRequest<T>(endpoint: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/v1/market/arbitrage${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return res.json();
}

async function createArbAlert(type: string, threshold: number) {
  const token = getToken();
  await fetch('/api/v1/market/arbitrage/alerts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ type, threshold, channels: ['push'] }),
  });
}

/* ── Types ─────────────────────────────────────────────────────── */

interface CrossExchangeOpp {
  pair: string;
  buyExchange: string;
  buyPrice: number;
  sellExchange: string;
  sellPrice: number;
  spreadPct: number;
  estProfit: number;
  buyFeePct: number;
  sellFeePct: number;
  totalFeesPct: number;
  netProfitPct: number;
  netProfit1k: number;
}

interface FundingRateOpp {
  pair: string;
  longExchange: string;
  shortExchange: string;
  fundingSpread: number;
  annualizedReturn: number;
  nextFunding: string;
}

interface TriangularOpp {
  path: string[];
  exchange: string;
  profitPct: number;
  legs: { from: string; to: string; rate: number }[];
}

interface DexCexOpp {
  symbol: string;
  dexName: string;
  dexPrice: number;
  cexExchange: string;
  cexPrice: number;
  spreadPct: number;
  direction: string;
  dexLiquidity: number;
  estProfit: number;
  netProfit: number;
}

type Tab = 'cross-exchange' | 'funding-rate' | 'triangular' | 'dex-cex';

/* ── Helpers ───────────────────────────────────────────────────── */

const fmt = (n: number | undefined | null, digits = 2) =>
  (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

const fmtPrice = (n: number | undefined | null) => {
  const v = n ?? 0;
  return v < 1 ? fmt(v, 6) : v < 100 ? fmt(v, 4) : fmt(v, 2);
};

const EXCHANGE_COLORS: Record<string, string> = {
  Binance: 'bg-yellow-500/20 text-yellow-400',
  Bybit: 'bg-orange-500/20 text-orange-400',
  OKX: 'bg-blue-500/20 text-blue-400',
  Kraken: 'bg-purple-500/20 text-purple-400',
  Coinbase: 'bg-sky-500/20 text-sky-400',
};

const DEX_COLORS: Record<string, string> = {
  Uniswap: 'bg-pink-500/20 text-pink-400',
  SushiSwap: 'bg-indigo-500/20 text-indigo-400',
  PancakeSwap: 'bg-cyan-500/20 text-cyan-400',
};

const ExchangeBadge: React.FC<{ name: string }> = ({ name }) => (
  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', EXCHANGE_COLORS[name] ?? 'bg-muted text-muted-foreground')}>
    {name}
  </span>
);

const DexBadge: React.FC<{ name: string }> = ({ name }) => (
  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', DEX_COLORS[name] ?? 'bg-purple-500/20 text-purple-400')}>
    {name}
  </span>
);

const spreadColor = (pct: number) =>
  pct > 0.3 ? 'text-green-500' : pct >= 0.1 ? 'text-yellow-400' : 'text-muted-foreground';

/* ── TABS CONFIG ───────────────────────────────────────────────── */

const TABS: { id: Tab; label: string }[] = [
  { id: 'cross-exchange', label: 'Cross-Exchange' },
  { id: 'funding-rate', label: 'Funding Rate' },
  { id: 'triangular', label: 'Triangular' },
  { id: 'dex-cex', label: 'DEX-CEX' },
];

/* ── Component ─────────────────────────────────────────────────── */

const ArbitrageScanner: React.FC = () => {
  const [tab, setTab] = useState<Tab>('cross-exchange');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [crossData, setCrossData] = useState<CrossExchangeOpp[]>([]);
  const [fundingData, setFundingData] = useState<FundingRateOpp[]>([]);
  const [triangularData, setTriangularData] = useState<TriangularOpp[]>([]);
  const [dexCexData, setDexCexData] = useState<DexCexOpp[]>([]);

  const [calcAmount, setCalcAmount] = useState('1000');
  const [selectedOpp, setSelectedOpp] = useState<CrossExchangeOpp | null>(null);

  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState('0.3');

  /* ── Fetchers ──────────────────────────────────────────────── */

  const fetchCrossExchange = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await arbRequest<{ data: CrossExchangeOpp[] }>('/cross-exchange');
      setCrossData(data.data ?? []);
    } catch {
      setError('Failed to load cross-exchange data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFunding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await arbRequest<{ data: FundingRateOpp[] }>('/funding-rate');
      setFundingData(data.data ?? []);
    } catch {
      setError('Failed to load funding rate data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTriangular = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await arbRequest<{ data: TriangularOpp[] }>('/triangular');
      setTriangularData(data.data ?? []);
    } catch {
      setError('Failed to load triangular data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDexCex = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await arbRequest<{ data: DexCexOpp[] }>('/dex-cex');
      setDexCexData(data.data ?? []);
    } catch {
      setError('Failed to load DEX-CEX data');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    if (tab === 'cross-exchange') fetchCrossExchange();
    else if (tab === 'funding-rate') fetchFunding();
    else if (tab === 'triangular') fetchTriangular();
    else fetchDexCex();
  }, [tab, fetchCrossExchange, fetchFunding, fetchTriangular, fetchDexCex]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  /* ── Stats (cross-exchange) ────────────────────────────────── */

  const totalOpps = crossData.length;
  const bestSpread = crossData.reduce((max, o) => Math.max(max, o.spreadPct), 0);
  const avgSpread = totalOpps > 0 ? crossData.reduce((s, o) => s + o.spreadPct, 0) / totalOpps : 0;

  const tradeAmount = parseFloat(calcAmount) || 0;
  const calcGrossProfit = selectedOpp
    ? tradeAmount * (selectedOpp.spreadPct / 100)
    : null;
  const calcFees = selectedOpp
    ? tradeAmount * (selectedOpp.totalFeesPct / 100)
    : null;
  const calcNetProfit =
    calcGrossProfit !== null && calcFees !== null
      ? calcGrossProfit - calcFees
      : null;

  /* ── Alert handler ─────────────────────────────────────────── */

  const handleCreateAlert = async () => {
    const threshold = parseFloat(alertThreshold);
    if (isNaN(threshold) || threshold <= 0) return;
    try {
      await createArbAlert(tab, threshold);
      setShowAlertModal(false);
    } catch {
      // silently fail — user can retry
    }
  };

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Arbitrage Scanner</h1>
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/20 text-primary uppercase tracking-wide">
            PRO
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Alert button */}
          <div className="relative">
            <button
              onClick={() => setShowAlertModal((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                showAlertModal
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-card text-muted-foreground border border-border hover:text-foreground',
              )}
            >
              <Bell className="w-3.5 h-3.5" />
              Alert
            </button>
            {showAlertModal && (
              <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg p-4 shadow-xl z-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Set Alert Threshold</h3>
                  <button onClick={() => setShowAlertModal(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get notified when a <span className="text-primary font-medium">{tab}</span> opportunity exceeds the threshold.
                </p>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Spread Threshold (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary/50"
                    placeholder="0.3"
                  />
                </div>
                <button
                  onClick={handleCreateAlert}
                  className="w-full px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors border border-primary/30"
                >
                  Create Alert
                </button>
              </div>
            )}
          </div>
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              autoRefresh
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-card text-muted-foreground border border-border hover:text-foreground',
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            {autoRefresh ? 'Live' : 'Auto'}
          </button>
          {/* Refresh */}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto w-full gap-0 border border-border rounded-lg">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-primary/20 text-primary'
                : 'bg-card text-muted-foreground hover:text-foreground hover:bg-card/80',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* ── Cross-Exchange ──────────────────────────────── */}
          {tab === 'cross-exchange' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Opportunities', value: totalOpps.toString(), icon: ArrowLeftRight },
                  { label: 'Best Spread %', value: `${fmt(bestSpread)}%`, icon: TrendingUp },
                  { label: 'Avg Spread', value: `${fmt(avgSpread)}%`, icon: Zap },
                ].map((s) => (
                  <div key={s.label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <s.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-bold text-foreground">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="bg-card border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">Pair</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Buy Exchange</th>
                      <th className="text-left px-4 py-3 font-medium">Buy Price</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Sell Exchange</th>
                      <th className="text-left px-4 py-3 font-medium">Sell Price</th>
                      <th className="text-left px-4 py-3 font-medium">Spread %</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Fees</th>
                      <th className="text-left px-4 py-3 font-medium">Net Profit ($1K)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && crossData.length === 0 ? (
                      <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}</>
                    ) : crossData.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No arbitrage opportunities found</td></tr>
                    ) : (
                      crossData.map((o, i) => (
                        <tr
                          key={`${o.pair}-${i}`}
                          onClick={() => setSelectedOpp(o)}
                          className={cn(
                            'border-b border-border/50 hover:bg-primary/5 cursor-pointer transition-colors',
                            selectedOpp?.pair === o.pair && selectedOpp?.buyExchange === o.buyExchange && 'bg-primary/10',
                          )}
                        >
                          <td className="px-4 py-3 font-medium text-foreground">{o.pair}</td>
                          <td className="px-4 py-3 hidden sm:table-cell"><ExchangeBadge name={o.buyExchange} /></td>
                          <td className="px-4 py-3 text-foreground font-mono">${fmtPrice(o.buyPrice)}</td>
                          <td className="px-4 py-3 hidden sm:table-cell"><ExchangeBadge name={o.sellExchange} /></td>
                          <td className="px-4 py-3 text-foreground font-mono">${fmtPrice(o.sellPrice)}</td>
                          <td className={cn('px-4 py-3 font-bold', spreadColor(o.spreadPct))}>{fmt(o.spreadPct)}%</td>
                          <td className="px-4 py-3 text-yellow-400 font-mono hidden sm:table-cell">{fmt(o.totalFeesPct)}%</td>
                          <td className={cn('px-4 py-3 font-bold font-mono', o.netProfit1k >= 0 ? 'text-green-500' : 'text-red-500')}>
                            ${fmt(o.netProfit1k)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Funding Rate ───────────────────────────────── */}
          {tab === 'funding-rate' && (
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    {['Pair', 'Long Exchange', 'Short Exchange', 'Funding Spread', 'Annualized Return %', 'Next Funding'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && fundingData.length === 0 ? (
                    <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}</>
                  ) : fundingData.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No funding rate opportunities found</td></tr>
                  ) : (
                    fundingData.map((o, i) => (
                      <tr key={`${o.pair}-${i}`} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{o.pair}</td>
                        <td className="px-4 py-3"><ExchangeBadge name={o.longExchange} /></td>
                        <td className="px-4 py-3"><ExchangeBadge name={o.shortExchange} /></td>
                        <td className="px-4 py-3 text-foreground font-mono">{fmt(o.fundingSpread, 4)}%</td>
                        <td className={cn('px-4 py-3 font-bold', o.annualizedReturn > 20 ? 'text-green-500' : 'text-foreground')}>
                          {fmt(o.annualizedReturn)}%
                        </td>
                        <td className="px-4 py-3 text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {o.nextFunding}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Triangular ─────────────────────────────────── */}
          {tab === 'triangular' && (
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    {['Path', 'Exchange', 'Profit %', 'Leg Details'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && triangularData.length === 0 ? (
                    <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)}</>
                  ) : triangularData.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No triangular opportunities found</td></tr>
                  ) : (
                    triangularData.map((o, i) => (
                      <tr key={`${o.exchange}-${i}`} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 font-medium text-foreground">
                            {o.path.map((symbol, idx) => (
                              <React.Fragment key={idx}>
                                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">
                                  {symbol}
                                </span>
                                {idx < o.path.length - 1 && (
                                  <span className="text-muted-foreground text-xs mx-0.5">&rarr;</span>
                                )}
                              </React.Fragment>
                            ))}
                            <span className="text-muted-foreground text-xs mx-0.5">&rarr;</span>
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">
                              {o.path[0]}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><ExchangeBadge name={o.exchange} /></td>
                        <td className={cn('px-4 py-3 font-bold', o.profitPct > 0.1 ? 'text-green-500' : 'text-foreground')}>
                          {fmt(o.profitPct, 3)}%
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {o.legs.map((leg, li) => (
                              <span key={li} className="text-xs text-muted-foreground">
                                {leg.from} &rarr; {leg.to}: <span className="text-foreground font-mono">{fmt(leg.rate, 6)}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── DEX-CEX ────────────────────────────────────── */}
          {tab === 'dex-cex' && (
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Token</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">DEX</th>
                    <th className="text-left px-4 py-3 font-medium">DEX Price</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">CEX</th>
                    <th className="text-left px-4 py-3 font-medium">CEX Price</th>
                    <th className="text-left px-4 py-3 font-medium">Spread %</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Direction</th>
                    <th className="text-left px-4 py-3 font-medium">Net Profit ($1K)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && dexCexData.length === 0 ? (
                    <>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}</>
                  ) : dexCexData.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No DEX-CEX opportunities found</td></tr>
                  ) : (
                    dexCexData.map((o, i) => (
                      <tr key={`${o.symbol}-${i}`} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{o.symbol}</td>
                        <td className="px-4 py-3 hidden sm:table-cell"><DexBadge name={o.dexName} /></td>
                        <td className="px-4 py-3 text-foreground font-mono">${fmtPrice(o.dexPrice)}</td>
                        <td className="px-4 py-3 hidden sm:table-cell"><ExchangeBadge name={o.cexExchange} /></td>
                        <td className="px-4 py-3 text-foreground font-mono">${fmtPrice(o.cexPrice)}</td>
                        <td className={cn('px-4 py-3 font-bold', spreadColor(o.spreadPct))}>{fmt(o.spreadPct)}%</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {o.direction === 'buy_dex_sell_cex' ? (
                            <span className="text-green-400 text-xs font-medium">Buy DEX &rarr; Sell CEX</span>
                          ) : (
                            <span className="text-yellow-400 text-xs font-medium">Buy CEX &rarr; Sell DEX</span>
                          )}
                        </td>
                        <td className={cn('px-4 py-3 font-bold font-mono', o.netProfit >= 0 ? 'text-green-500' : 'text-red-500')}>
                          ${fmt(o.netProfit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Profit Calculator Sidebar ────────────────────── */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4 sticky top-20 lg:top-6">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Profit Calculator</h2>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Trade Amount ($)</label>
              <input
                type="number"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                min={0}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary/50"
                placeholder="1000"
              />
            </div>

            {selectedOpp ? (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pair</span>
                  <span className="text-foreground font-medium">{selectedOpp.pair}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Buy</span>
                  <span className="text-foreground">
                    <ExchangeBadge name={selectedOpp.buyExchange} /> ${fmtPrice(selectedOpp.buyPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sell</span>
                  <span className="text-foreground">
                    <ExchangeBadge name={selectedOpp.sellExchange} /> ${fmtPrice(selectedOpp.sellPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spread</span>
                  <span className={cn('font-bold', spreadColor(selectedOpp.spreadPct))}>
                    {fmt(selectedOpp.spreadPct)}%
                  </span>
                </div>
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">Gross Profit</span>
                    <span className="text-base font-bold text-foreground">
                      ${calcGrossProfit !== null ? fmt(calcGrossProfit) : '---'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">Trading Fees</span>
                    <span className="text-base font-bold text-yellow-400">
                      -${calcFees !== null ? fmt(calcFees) : '---'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-border/50">
                    <span className="text-sm text-muted-foreground">Net Profit</span>
                    <span className={cn('text-xl font-bold', calcNetProfit !== null && calcNetProfit >= 0 ? 'text-green-500' : 'text-red-500')}>
                      ${calcNetProfit !== null ? fmt(calcNetProfit) : '---'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Includes buy fee ({fmt(selectedOpp.buyFeePct)}%) + sell fee ({fmt(selectedOpp.sellFeePct)}%). Withdrawal fees not included.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {tab === 'cross-exchange'
                  ? 'Click a row in the table to calculate profit'
                  : 'Switch to Cross-Exchange tab and click a row'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArbitrageScanner;
