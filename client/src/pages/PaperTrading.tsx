import React, { useState, useEffect, useCallback } from 'react';
import {
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  X,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/utils/cn';

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

async function paperRequest<T>(endpoint: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const token = getToken();
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) config.body = JSON.stringify(body);
  const res = await fetch(`/api/v1/paper${endpoint}`, config);
  return res.json();
}

interface AccountData {
  balance: number;
  equity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  positionsCount: number;
}

interface PositionData {
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  amount: number;
  pnl: number;
  pnlPct: number;
  openedAt: string;
}

interface TradeData {
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  amount: number;
  pnl: number;
  openedAt: string;
  closedAt: string;
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
];

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });

const PaperTrading: React.FC = () => {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [history, setHistory] = useState<TradeData[]>([]);
  const [tradeSymbol, setTradeSymbol] = useState('BTCUSDT');
  const [tradeAmount, setTradeAmount] = useState('100');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [accRes, posRes, histRes] = await Promise.all([
        paperRequest<{ success: boolean; data: AccountData }>('/account'),
        paperRequest<{ success: boolean; data: PositionData[] }>('/positions'),
        paperRequest<{ success: boolean; data: TradeData[] }>('/history'),
      ]);
      if (accRes.success) setAccount(accRes.data);
      if (posRes.success) setPositions(posRes.data);
      if (histRes.success) setHistory(histRes.data);
    } catch { /* ignore */ }
  }, []);

  // Fetch ticker price for selected trade symbol
  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/market/ticker/${tradeSymbol}`);
      const json = await res.json();
      if (json.success && json.data?.price) {
        setCurrentPrice(json.data.price);
      }
    } catch { /* ignore */ }
  }, [tradeSymbol]);

  useEffect(() => {
    fetchData();
    fetchPrice();
  }, [fetchData, fetchPrice]);

  // Poll positions every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
      fetchPrice();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchPrice]);

  const placeOrder = async (side: 'buy' | 'sell') => {
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) return;
    setLoading(true);
    try {
      await paperRequest('/order', {
        method: 'POST',
        body: { symbol: tradeSymbol, side, quantity: amount },
      });
      await fetchData();
    } catch { /* ignore */ }
    setLoading(false);
  };

  const closePosition = async (symbol: string) => {
    setClosingSymbol(symbol);
    try {
      await paperRequest(`/close/${symbol}`, { method: 'POST' });
      await fetchData();
    } catch { /* ignore */ }
    setClosingSymbol(null);
  };

  const previewQty = currentPrice && parseFloat(tradeAmount) > 0
    ? parseFloat(tradeAmount) / currentPrice
    : null;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <CircleDollarSign className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Paper Trading</h1>
          <p className="text-xs text-muted-foreground">Practice trading with virtual $10,000</p>
        </div>
      </div>

      {/* Account Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Balance</span>
          </div>
          <p className="text-xl font-bold text-foreground">${fmt(account?.balance ?? 10000)}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Equity</span>
          </div>
          <p className="text-xl font-bold text-foreground">${fmt(account?.equity ?? 10000)}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Unrealized P&L</span>
          </div>
          <p className={cn(
            'text-xl font-bold',
            (account?.unrealizedPnl ?? 0) >= 0 ? 'text-success' : 'text-danger'
          )}>
            {(account?.unrealizedPnl ?? 0) >= 0 ? '+' : ''}${fmt(account?.unrealizedPnl ?? 0)}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CircleDollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Realized P&L</span>
          </div>
          <p className={cn(
            'text-xl font-bold',
            (account?.realizedPnl ?? 0) >= 0 ? 'text-success' : 'text-danger'
          )}>
            {(account?.realizedPnl ?? 0) >= 0 ? '+' : ''}${fmt(account?.realizedPnl ?? 0)}
          </p>
        </div>
      </div>

      {/* Quick Trade Panel */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick Trade</h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          {/* Symbol */}
          <div className="space-y-1.5 w-full sm:w-auto">
            <label className="text-sm font-medium text-muted-foreground">Symbol</label>
            <select
              value={tradeSymbol}
              onChange={(e) => setTradeSymbol(e.target.value)}
              className="flex h-10 w-full sm:w-40 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all duration-200"
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>{s.replace('USDT', '/USDT')}</option>
              ))}
            </select>
          </div>

          {/* Current price */}
          {currentPrice !== null && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Current Price</label>
              <p className="h-10 flex items-center text-sm font-mono text-foreground">${fmt(currentPrice)}</p>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5 w-full sm:w-auto">
            <label className="text-sm font-medium text-muted-foreground">Amount (USD)</label>
            <input
              type="number"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              min="1"
              step="10"
              className="flex h-10 w-full sm:w-32 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all duration-200"
            />
          </div>

          {/* Buy / Sell buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => placeOrder('buy')}
              disabled={loading || !currentPrice}
              className="h-10 px-6 rounded-lg text-sm font-medium bg-success text-white hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Buy
            </button>
            <button
              onClick={() => placeOrder('sell')}
              disabled={loading || !currentPrice}
              className="h-10 px-6 rounded-lg text-sm font-medium bg-danger text-white hover:bg-danger/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Sell
            </button>
          </div>
        </div>

        {/* Preview */}
        {previewQty !== null && currentPrice !== null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Preview: Buy {fmtQty(previewQty)} {tradeSymbol.replace('USDT', '')} at ${fmt(currentPrice)}
          </p>
        )}
      </div>

      {/* Open Positions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Open Positions ({positions.length})
          </h2>
        </div>
        {positions.length === 0 ? (
          <div className="px-5 pb-5 text-sm text-muted-foreground">No open positions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Symbol</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Side</th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Entry</th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Current</th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">P&L ($)</th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">P&L (%)</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={`${pos.symbol}-${pos.openedAt}`} className="border-t border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{pos.symbol.replace('USDT', '/USDT')}</td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs font-semibold uppercase',
                        pos.side === 'buy' ? 'text-success' : 'text-danger'
                      )}>
                        {pos.side === 'buy' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {pos.side}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">${fmt(pos.entryPrice)}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">${fmt(pos.currentPrice)}</td>
                    <td className="px-3 py-3 text-right font-mono text-muted-foreground">{fmtQty(pos.quantity)}</td>
                    <td className={cn(
                      'px-3 py-3 text-right font-mono font-medium',
                      pos.pnl >= 0 ? 'text-success' : 'text-danger'
                    )}>
                      {pos.pnl >= 0 ? '+' : ''}${fmt(pos.pnl)}
                    </td>
                    <td className={cn(
                      'px-3 py-3 text-right font-mono font-medium',
                      pos.pnlPct >= 0 ? 'text-success' : 'text-danger'
                    )}>
                      {pos.pnlPct >= 0 ? '+' : ''}{fmt(pos.pnlPct)}%
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => closePosition(pos.symbol)}
                        disabled={closingSymbol === pos.symbol}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-danger hover:text-white hover:border-danger disabled:opacity-50 transition-all duration-200"
                      >
                        <X className="w-3 h-3" />
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trade History */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Trade History ({history.length})
          </h2>
        </div>
        {history.length === 0 ? (
          <div className="px-5 pb-5 text-sm text-muted-foreground">No trade history yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Symbol</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Side</th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Entry</th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Exit</th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">P&L</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((trade, i) => (
                  <tr key={`${trade.symbol}-${trade.closedAt}-${i}`} className="border-t border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{trade.symbol.replace('USDT', '/USDT')}</td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        'text-xs font-semibold uppercase',
                        trade.side === 'buy' ? 'text-success' : 'text-danger'
                      )}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">${fmt(trade.entryPrice)}</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">${fmt(trade.exitPrice)}</td>
                    <td className={cn(
                      'px-3 py-3 text-right font-mono font-medium',
                      trade.pnl >= 0 ? 'text-success' : 'text-danger'
                    )}>
                      {trade.pnl >= 0 ? '+' : ''}${fmt(trade.pnl)}
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {new Date(trade.closedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperTrading;
