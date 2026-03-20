import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
}

interface EndpointGroup {
  name: string;
  endpoints: Endpoint[];
}

const methodStyles: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    name: 'Authentication',
    endpoints: [
      { method: 'POST', path: '/auth/register', description: 'Register a new user account' },
      { method: 'POST', path: '/auth/login', description: 'Login and receive JWT tokens' },
      { method: 'POST', path: '/auth/refresh', description: 'Refresh access token' },
      { method: 'GET', path: '/auth/me', description: 'Get current authenticated user' },
    ],
  },
  {
    name: 'Market Data',
    endpoints: [
      { method: 'GET', path: '/market/pairs', description: 'List all trading pairs' },
      { method: 'GET', path: '/market/pairs/:symbol', description: 'Get a specific trading pair' },
      { method: 'GET', path: '/market/ohlcv/:symbol', description: 'Get OHLCV candlestick data' },
      { method: 'GET', path: '/market/ticker', description: 'Get all live tickers' },
      { method: 'GET', path: '/market/ticker/:symbol', description: 'Get ticker for a specific symbol' },
      { method: 'GET', path: '/market/screener', description: 'Advanced screener with RSI, volume, trend filters' },
      { method: 'GET', path: '/market/fear-greed', description: 'Composite Fear & Greed index' },
      { method: 'GET', path: '/market/correlation', description: 'Correlation matrix between top pairs' },
      { method: 'GET', path: '/market/regime', description: 'Market regime classifier' },
      { method: 'GET', path: '/market/funding-rates', description: 'Simulated funding rates' },
      { method: 'GET', path: '/market/narratives', description: 'Sector/narrative performance tracker' },
      { method: 'GET', path: '/market/breadth', description: 'Market breadth indicators' },
      { method: 'GET', path: '/market/open-interest', description: 'Open interest data' },
      { method: 'GET', path: '/market/defi', description: 'DeFi TVL overview for top protocols' },
      { method: 'GET', path: '/market/profile/:symbol', description: 'Volume profile / TPO data' },
      { method: 'GET', path: '/market/seasonality/:symbol', description: 'Seasonality analysis' },
      { method: 'GET', path: '/market/confluence/:symbol', description: 'Cross-signal confluence zones' },
      { method: 'GET', path: '/market/liquidations/:symbol', description: 'Liquidation heatmap data' },
      { method: 'GET', path: '/market/orderflow/:symbol', description: 'Order flow footprint data' },
    ],
  },
  {
    name: 'Analysis & Signals',
    endpoints: [
      { method: 'GET', path: '/analysis/signals', description: 'Get latest trading signals' },
    ],
  },
  {
    name: 'Alerts',
    endpoints: [
      { method: 'GET', path: '/alerts', description: 'List all alerts' },
      { method: 'POST', path: '/alerts', description: 'Create a new alert' },
      { method: 'PUT', path: '/alerts/:id', description: 'Update an alert' },
      { method: 'DELETE', path: '/alerts/:id', description: 'Delete an alert' },
    ],
  },
  {
    name: 'AI Copilot',
    endpoints: [
      { method: 'POST', path: '/copilot/ask', description: 'Ask the AI copilot a trading question' },
    ],
  },
  {
    name: 'Paper Trading',
    endpoints: [
      { method: 'GET', path: '/paper/portfolio', description: 'Get paper trading portfolio' },
      { method: 'POST', path: '/paper/orders', description: 'Place a paper trading order' },
      { method: 'GET', path: '/paper/orders', description: 'List paper trading orders' },
    ],
  },
  {
    name: 'Social',
    endpoints: [
      { method: 'GET', path: '/social/feed', description: 'Get social feed posts' },
      { method: 'POST', path: '/social/posts', description: 'Create a post' },
      { method: 'POST', path: '/social/posts/:id/like', description: 'Like a post' },
      { method: 'POST', path: '/social/follow/:userId', description: 'Follow a user' },
    ],
  },
  {
    name: 'Gamification',
    endpoints: [
      { method: 'GET', path: '/gamification/profile', description: 'Get XP, level, streaks' },
      { method: 'GET', path: '/gamification/achievements', description: 'List achievements' },
    ],
  },
  {
    name: 'Other',
    endpoints: [
      { method: 'GET', path: '/leaderboard', description: 'Trader leaderboard rankings' },
      { method: 'GET', path: '/news', description: 'Aggregated crypto news' },
      { method: 'GET', path: '/whales/transactions', description: 'Recent whale transactions' },
      { method: 'GET', path: '/journal', description: 'Trade journal entries' },
      { method: 'GET', path: '/copy/traders', description: 'Top traders for copy trading' },
      { method: 'GET', path: '/wallets', description: 'Tracked wallet addresses' },
    ],
  },
];

const RATE_LIMITS = [
  { tier: 'Free', requests: '60 / min', burst: '10 / sec', websocket: '1 connection' },
  { tier: 'Pro', requests: '300 / min', burst: '30 / sec', websocket: '5 connections' },
  { tier: 'Enterprise', requests: '1000 / min', burst: '100 / sec', websocket: '20 connections' },
];

const APIDocs: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center">
              <span className="text-black font-bold text-lg">Q</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Quantis API</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Complete REST API for crypto analytics, real-time market data, AI-powered signals, paper trading, social features, and more.
            All endpoints are prefixed with <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-sm">/api/v1</code>.
          </p>
          <a
            href="/api/v1/docs/ui"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary font-medium text-sm hover:bg-primary/30 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Interactive Swagger UI
          </a>
        </div>

        {/* Endpoint Groups */}
        {ENDPOINT_GROUPS.map((group) => (
          <div key={group.name} className="space-y-3">
            <h2 className="text-lg font-bold text-foreground border-b border-border pb-2">{group.name}</h2>
            <div className="space-y-1">
              {group.endpoints.map((ep, idx) => (
                <div
                  key={`${ep.method}-${ep.path}-${idx}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase border min-w-[52px] text-center', methodStyles[ep.method])}>
                    {ep.method}
                  </span>
                  <code className="text-sm font-mono text-foreground flex-shrink-0">{ep.path}</code>
                  <span className="text-sm text-muted-foreground truncate">{ep.description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Code Examples */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground border-b border-border pb-2">Code Examples</h2>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Get all tickers</h3>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">cURL</p>
              <pre className="bg-secondary rounded-lg p-3 text-xs text-foreground overflow-x-auto font-mono">
{`curl -X GET https://quantis.app/api/v1/market/ticker`}
              </pre>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-3">JavaScript</p>
              <pre className="bg-secondary rounded-lg p-3 text-xs text-foreground overflow-x-auto font-mono">
{`const res = await fetch('/api/v1/market/ticker');
const { data } = await res.json();
console.log(data);`}
              </pre>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Get OHLCV candles</h3>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">cURL</p>
              <pre className="bg-secondary rounded-lg p-3 text-xs text-foreground overflow-x-auto font-mono">
{`curl -X GET "https://quantis.app/api/v1/market/ohlcv/BTCUSDT?timeframe=1h&limit=100"`}
              </pre>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-3">JavaScript</p>
              <pre className="bg-secondary rounded-lg p-3 text-xs text-foreground overflow-x-auto font-mono">
{`const res = await fetch('/api/v1/market/ohlcv/BTCUSDT?timeframe=1h&limit=100');
const { data } = await res.json();
// data: [{ time, open, high, low, close, volume }, ...]`}
              </pre>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Create an alert (authenticated)</h3>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">cURL</p>
              <pre className="bg-secondary rounded-lg p-3 text-xs text-foreground overflow-x-auto font-mono">
{`curl -X POST https://quantis.app/api/v1/alerts \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"symbol":"BTCUSDT","condition":"price_above","value":70000}'`}
              </pre>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-3">JavaScript</p>
              <pre className="bg-secondary rounded-lg p-3 text-xs text-foreground overflow-x-auto font-mono">
{`const res = await fetch('/api/v1/alerts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
  },
  body: JSON.stringify({
    symbol: 'BTCUSDT',
    condition: 'price_above',
    value: 70000,
  }),
});`}
              </pre>
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground border-b border-border pb-2">Rate Limits</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Requests</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Burst</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">WebSocket</th>
                </tr>
              </thead>
              <tbody>
                {RATE_LIMITS.map((rl) => (
                  <tr key={rl.tier} className="border-b border-border/50">
                    <td className="px-4 py-3 font-semibold text-foreground">{rl.tier}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{rl.requests}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{rl.burst}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{rl.websocket}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-8 border-t border-border">
          Quantis API v1.0.0. For full interactive documentation, visit the{' '}
          <a href="/api/v1/docs/ui" className="text-primary hover:underline">
            Swagger UI
          </a>.
        </div>
      </div>
    </div>
  );
};

export default APIDocs;
